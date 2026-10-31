const logger = require('../utils/logger');
const { recordProviderCall } = require('../middleware/aiBudget');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Primary model defaults to gpt-4o-mini; fallback defaults to Gemini 2.0 Flash
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const DEFAULT_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'google/gemini-2.0-flash-001';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.OPENROUTER_TIMEOUT_MS, 10) || 15000;
const MAX_PRIMARY_RETRIES = 2;
const MAX_FALLBACK_RETRIES = 1;
const BASE_BACKOFF_MS = 300;
const MAX_BACKOFF_MS = 3000;
const MAX_RETRY_AFTER_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates a normalized timeout error.
 */
const createTimeoutError = (timeoutMs) => {
  const err = new Error(`OpenRouter request timed out after ${timeoutMs}ms`);
  err.name = 'TimeoutError';
  err.code = 'ETIMEDOUT';
  err.isTimeout = true;
  err.status = 504;
  return err;
};

/**
 * Creates a normalized client cancellation error.
 */
const createClientAbortError = (reason) => {
  const err = reason || new Error('Request aborted by client');
  err.name = 'AbortError';
  err.isClientAbort = true;
  err.status = 499;
  return err;
};

/**
 * Creates a normalized malformed provider response error.
 */
const createMalformedResponseError = (msg) => {
  const err = new Error(msg || 'Malformed response envelope received from upstream AI provider');
  err.name = 'MalformedProviderResponseError';
  err.isMalformed = true;
  err.status = 502;
  return err;
};

/**
 * Creates a normalized empty completion content error.
 */
const createEmptyResponseError = (msg) => {
  const err = new Error(msg || 'AI provider returned empty response content');
  err.name = 'EmptyModelResponseError';
  err.isEmptyResponse = true;
  err.status = 502;
  return err;
};

/**
 * Checks if an error or HTTP status qualifies as a transient failure
 * suitable for exponential backoff retry.
 * Explicit user cancellation (isClientAbort) is NEVER treated as transient.
 * Timeouts (isTimeout / TimeoutError / ETIMEDOUT) ARE treated as transient.
 * Permanent client failures (400, 401, 403, 404, 422) are NEVER transient.
 *
 * @param {number|null} status
 * @param {Error|null} error
 * @returns {boolean}
 */
const isTransient = (status, error) => {
  if (error) {
    if (error.isClientAbort) return false;
    if (error.isTimeout || error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') return true;
    if (error.name === 'AbortError' && error.message?.includes('timed out')) return true;
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') return true;
    if (error.name === 'FetchError' || error instanceof TypeError) return true;
  }
  if (status === 429) return true;
  if (status && status >= 500 && status < 600) return true;
  return false;
};

/**
 * Validates provider envelope and extracts clean completion content.
 * Throws MalformedProviderResponseError or EmptyModelResponseError on invalid shapes.
 */
const extractAndValidateContent = (data) => {
  if (!data || typeof data !== 'object') {
    throw createMalformedResponseError('Provider returned non-object JSON payload');
  }

  if (data.error) {
    const errorMsg = data.error.message || data.error.code || 'Upstream provider returned an error envelope';
    const err = new Error(`OpenRouter Error: ${errorMsg}`);
    err.status = data.error.code === 401 ? 401 : (data.error.code === 429 ? 429 : 502);
    throw err;
  }

  if (!Array.isArray(data.choices) || data.choices.length === 0) {
    throw createMalformedResponseError('Provider response missing choices array');
  }

  const choice = data.choices[0];
  if (!choice || typeof choice !== 'object' || !choice.message) {
    throw createMalformedResponseError('Provider choices[0] missing message object');
  }

  let text = '';
  const content = choice.message.content;

  if (typeof content === 'string') {
    text = content.trim();
  } else if (Array.isArray(content)) {
    // OpenRouter content block array support
    text = content
      .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  if (!text) {
    throw createEmptyResponseError('Provider returned choices[0].message with empty content');
  }

  return text;
};

/**
 * Single HTTP request attempt against OpenRouter.
 * Combines provider timeout with external client cancellation signal.
 */
const attemptRequest = async ({
  messages,
  title,
  model,
  maxTokens,
  timeoutMs,
  apiKey,
  signal: externalSignal,
  fetchFn = globalThis.fetch,
}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(createTimeoutError(timeoutMs));
  }, timeoutMs);

  const onExternalAbort = () => {
    clearTimeout(timer);
    controller.abort(createClientAbortError(externalSignal?.reason));
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      return {
        status: null,
        ok: false,
        responseText: '',
        data: null,
        error: createClientAbortError(externalSignal.reason),
      };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetchFn(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fittrack.app',
        'X-Title': title,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        provider: { sort: 'latency' },
      }),
    });

    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }

    // Inspect Retry-After header on 429
    let retryAfterMs = null;
    if (response.status === 429 && response.headers && typeof response.headers.get === 'function') {
      const retryHeader = response.headers.get('retry-after');
      if (retryHeader) {
        const parsedSec = parseFloat(retryHeader);
        if (!isNaN(parsedSec) && parsedSec > 0) {
          retryAfterMs = Math.min(Math.round(parsedSec * 1000), MAX_RETRY_AFTER_MS);
        }
      }
    }

    const responseText = await response.text();
    let data = null;
    let parseError = null;
    try {
      data = JSON.parse(responseText);
    } catch (pe) {
      parseError = pe;
    }

    if (response.ok && parseError) {
      return {
        status: 502,
        ok: false,
        responseText,
        data: null,
        error: createMalformedResponseError('Provider returned invalid non-JSON body on HTTP 200'),
      };
    }

    return {
      status: response.status,
      ok: response.ok,
      responseText,
      data,
      retryAfterMs,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }

    const isClientCancel = externalSignal?.aborted || err.isClientAbort;
    const isTimeout =
      !isClientCancel &&
      (err.isTimeout ||
        err.name === 'TimeoutError' ||
        err.code === 'ETIMEDOUT' ||
        (err.name === 'AbortError' && err.message?.includes('timed out')));

    const errorToReturn = isClientCancel
      ? createClientAbortError(externalSignal?.reason)
      : (isTimeout ? createTimeoutError(timeoutMs) : err);

    return {
      status: isTimeout ? 504 : null,
      ok: false,
      responseText: '',
      data: null,
      error: errorToReturn,
    };
  }
};

/**
 * Executes a call against a specific model with exponential backoff retries and jitter.
 */
const callWithRetry = async ({
  messages,
  title,
  model,
  maxTokens,
  timeoutMs,
  apiKey,
  maxRetries,
  signal,
  fetchFn,
  isFallback = false,
}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if client cancelled before starting attempt
    if (signal?.aborted) {
      throw createClientAbortError(signal.reason);
    }

    const callStart = Date.now();
    const result = await attemptRequest({
      messages,
      title,
      model,
      maxTokens,
      timeoutMs,
      apiKey,
      signal,
      fetchFn,
    });
    const latencyMs = Date.now() - callStart;

    if (result.ok && result.data) {
      try {
        const validatedContent = extractAndValidateContent(result.data);
        recordProviderCall({
          provider: 'openrouter',
          model,
          usage: result.data.usage || null,
          status: 'success',
          attempt: attempt + 1,
          latencyMs,
          isFallback,
        });
        return {
          data: result.data,
          content: validatedContent,
          model,
          attempts: attempt + 1,
        };
      } catch (validationErr) {
        lastError = validationErr;
        recordProviderCall({
          provider: 'openrouter',
          model,
          usage: result.data?.usage || null,
          status: 'failure',
          attempt: attempt + 1,
          latencyMs,
          isFallback,
        });
        // Do not retry empty or malformed model responses on the same model if retries exhausted
        if (attempt >= maxRetries) {
          throw validationErr;
        }
      }
    } else {
      const isTimeout = Boolean(result.error?.isTimeout || result.status === 504);
      recordProviderCall({
        provider: 'openrouter',
        model,
        usage: result.data?.usage || null,
        status: isTimeout ? 'timeout' : 'failure',
        timedOut: isTimeout,
        attempt: attempt + 1,
        latencyMs,
        isFallback,
      });

      const currentError =
        result.error ||
        new Error(`OpenRouter HTTP ${result.status}: ${result.responseText?.slice(0, 300) || 'Unknown error'}`);
      currentError.status = result.status || currentError.status || 500;
      lastError = currentError;

      // Do NOT retry client cancellations
      if (currentError.isClientAbort) {
        throw currentError;
      }

      // Permanent client errors (400, 401, 403, 404, 422) must fail immediately without retrying
      if (result.status && [400, 401, 403, 404, 422].includes(result.status)) {
        throw currentError;
      }

      const canRetry = attempt < maxRetries && isTransient(result.status, result.error);
      if (!canRetry) {
        break;
      }

      // Calculate bounded backoff with jitter or honor Retry-After
      const jitter = Math.floor(Math.random() * 150);
      const computedBackoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempt) + jitter, MAX_BACKOFF_MS);
      const backoffMs = result.retryAfterMs ? Math.min(result.retryAfterMs, MAX_RETRY_AFTER_MS) : computedBackoff;

      logger.warn(
        `[OpenRouter ${title}] Transient error (${result.status || currentError.message}) on model ${model}. Retrying attempt ${attempt + 1}/${maxRetries} in ${backoffMs}ms...`
      );
      await sleep(backoffMs);
    }
  }

  throw lastError;
};

/**
 * Executes chat completion with exponential retry, fallback model resilience,
 * token usage extraction, and external cancellation support.
 */
const chatCompletionDetailed = async ({
  messages,
  title = 'FitTrack AI Assistant',
  model = DEFAULT_MODEL,
  fallbackModel = DEFAULT_FALLBACK_MODEL,
  maxTokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  returnUsage = false,
  signal,
  fetchFn = globalThis.fetch,
}) => {
  // Pre-check abort before any credential or network initialization
  if (signal?.aborted) {
    throw createClientAbortError(signal.reason);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error('OpenRouter API key not configured.');
    err.status = 500;
    err.isOperational = true;
    throw err;
  }

  let finalResult = null;
  let primaryError = null;
  let fallbackUsed = false;
  let totalAttempts = 0;

  // 1. Attempt primary model with retries
  try {
    finalResult = await callWithRetry({
      messages,
      title,
      model,
      maxTokens,
      timeoutMs,
      apiKey,
      maxRetries: MAX_PRIMARY_RETRIES,
      signal,
      fetchFn,
    });
    totalAttempts += finalResult.attempts;
  } catch (err) {
    primaryError = err;
    totalAttempts += MAX_PRIMARY_RETRIES + 1;
    if (err.isClientAbort) {
      throw err; // Stop immediately on explicit client cancellation
    }
    // Do not call fallback on bad credentials (401 / 403)
    if (err.status === 401 || err.status === 403) {
      throw err;
    }
    logger.warn(`[OpenRouter ${title}] Primary model ${model} failed: ${err.message}`);
  }

  // 2. If primary model failed (non-client cancellation, non-auth) and fallback is configured & different, try fallback
  if (!finalResult && fallbackModel && fallbackModel !== model) {
    logger.warn(`[OpenRouter ${title}] Switching to fallback model: ${fallbackModel}`);
    fallbackUsed = true;
    try {
      finalResult = await callWithRetry({
        messages,
        title,
        model: fallbackModel,
        maxTokens,
        timeoutMs,
        apiKey,
        maxRetries: MAX_FALLBACK_RETRIES,
        signal,
        fetchFn,
        isFallback: true,
      });
      totalAttempts += finalResult.attempts;
    } catch (fallbackErr) {
      totalAttempts += MAX_FALLBACK_RETRIES + 1;
      if (fallbackErr.isClientAbort) {
        throw fallbackErr;
      }
      logger.error(`[OpenRouter ${title}] Fallback model ${fallbackModel} also failed: ${fallbackErr.message}`);
    }
  }

  // 3. If all attempts failed, throw a user-friendly operational error
  if (!finalResult) {
    const outageErr = new Error('FitBot AI assistant is temporarily unavailable. Please try again in a moment.');
    outageErr.status = 503;
    outageErr.isOperational = true;
    outageErr.originalError = primaryError;
    outageErr.attempts = totalAttempts;
    throw outageErr;
  }

  const content = finalResult.content;

  // Extract usage metadata truthfully without reporting fake zeros
  let usage = null;
  if (finalResult.data?.usage && typeof finalResult.data.usage === 'object') {
    usage = {
      prompt_tokens: typeof finalResult.data.usage.prompt_tokens === 'number' ? finalResult.data.usage.prompt_tokens : null,
      completion_tokens: typeof finalResult.data.usage.completion_tokens === 'number' ? finalResult.data.usage.completion_tokens : null,
      total_tokens: typeof finalResult.data.usage.total_tokens === 'number' ? finalResult.data.usage.total_tokens : null,
    };
  } else {
    usage = {
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null,
    };
  }

  if (returnUsage) {
    return {
      content,
      usage,
      model: finalResult.model,
      fallbackUsed,
      attempts: totalAttempts,
    };
  }

  return content;
};

const chatCompletion = async (params) => {
  return chatCompletionDetailed(params);
};

module.exports = {
  chatCompletion,
  chatCompletionDetailed,
  isTransient,
  createTimeoutError,
  createClientAbortError,
  createMalformedResponseError,
  createEmptyResponseError,
  extractAndValidateContent,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_TIMEOUT_MS,
  MAX_PRIMARY_RETRIES,
  MAX_FALLBACK_RETRIES,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
};
