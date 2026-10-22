const logger = require('../utils/logger');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Primary model defaults to gpt-4o-mini; fallback defaults to Gemini 2.0 Flash
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const DEFAULT_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'google/gemini-2.0-flash-001';
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PRIMARY_RETRIES = 2;
const MAX_FALLBACK_RETRIES = 1;
const BASE_BACKOFF_MS = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks if an error or HTTP status qualifies as a transient failure
 * suitable for exponential backoff retry.
 * Explicit user cancellation (isClientAbort) is NEVER treated as transient.
 * @param {number|null} status
 * @param {Error|null} error
 * @returns {boolean}
 */
const isTransient = (status, error) => {
  if (error) {
    if (error.isClientAbort) return false;
    if (error.name === 'AbortError' && !error.message?.includes('timed out')) return false;
    if (error.name === 'AbortError') return true;
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true;
    if (error.name === 'FetchError' || error instanceof TypeError) return true;
  }
  if (status === 429) return true;
  if (status && status >= 500 && status < 600) return true;
  return false;
};

/**
 * Single HTTP request attempt against OpenRouter.
 * Combines provider timeout with external client cancellation signal.
 */
const attemptRequest = async ({ messages, title, model, maxTokens, timeoutMs, apiKey, signal: externalSignal }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`OpenRouter request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const onExternalAbort = () => {
    const err = externalSignal?.reason || new Error('Request aborted by client');
    controller.abort(err);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const abortErr = externalSignal.reason || new Error('Request aborted by client');
      abortErr.name = 'AbortError';
      abortErr.isClientAbort = true;
      return {
        status: null,
        ok: false,
        responseText: '',
        data: null,
        error: abortErr,
      };
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
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

    const responseText = await response.text();
    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      // response wasn't JSON
    }

    return {
      status: response.status,
      ok: response.ok,
      responseText,
      data,
      error: null,
    };
  } catch (err) {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }

    const isTimeout = err.name === 'AbortError' && err.message?.includes('timed out');
    const isClientCancel = externalSignal?.aborted || (!isTimeout && err.name === 'AbortError');
    const errorToReturn = isTimeout
      ? new Error(`OpenRouter request timed out after ${timeoutMs}ms`)
      : err;

    if (isClientCancel) {
      errorToReturn.name = 'AbortError';
      errorToReturn.isClientAbort = true;
    }

    return {
      status: null,
      ok: false,
      responseText: '',
      data: null,
      error: errorToReturn,
    };
  }
};

/**
 * Executes a call against a specific model with exponential backoff retries.
 */
const callWithRetry = async ({ messages, title, model, maxTokens, timeoutMs, apiKey, maxRetries, signal }) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if client cancelled before starting attempt
    if (signal?.aborted) {
      const abortErr = signal.reason || new Error('Request aborted by client');
      abortErr.name = 'AbortError';
      abortErr.isClientAbort = true;
      throw abortErr;
    }

    const result = await attemptRequest({ messages, title, model, maxTokens, timeoutMs, apiKey, signal });

    if (result.ok && result.data) {
      return { data: result.data, model };
    }

    const currentError = result.error || new Error(
      `OpenRouter HTTP ${result.status}: ${result.responseText?.slice(0, 300) || 'Unknown error'}`
    );
    lastError = currentError;

    // Do NOT retry client cancellations
    if (currentError.isClientAbort) {
      break;
    }

    const canRetry = attempt < maxRetries && isTransient(result.status, result.error);
    if (!canRetry) {
      break;
    }

    const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
    logger.warn(`[OpenRouter ${title}] Transient error (${result.status || currentError.message}) on model ${model}. Retrying attempt ${attempt + 1}/${maxRetries} in ${backoffMs}ms...`);
    await sleep(backoffMs);
  }

  throw lastError;
};

/**
 * Executes chat completion with exponential retry, fallback model resilience,
 * token usage extraction, and external cancellation support.
 */
const chatCompletionDetailed = async ({
  messages,
  title,
  model = DEFAULT_MODEL,
  fallbackModel = DEFAULT_FALLBACK_MODEL,
  maxTokens,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  returnUsage = false,
  signal,
}) => {
  // Pre-check abort before any credential or network initialization
  if (signal?.aborted) {
    const abortErr = signal.reason || new Error('Request aborted by client');
    abortErr.name = 'AbortError';
    abortErr.isClientAbort = true;
    throw abortErr;
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
    });
  } catch (err) {
    primaryError = err;
    if (err.isClientAbort) {
      throw err; // Stop immediately on explicit client cancellation
    }
    logger.warn(`[OpenRouter ${title}] Primary model ${model} failed: ${err.message}`);
  }

  // 2. If primary model failed (non-client cancellation) and fallback model is configured & different, try fallback
  if (!finalResult && fallbackModel && fallbackModel !== model) {
    logger.warn(`[OpenRouter ${title}] Switching to fallback model: ${fallbackModel}`);
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
      });
    } catch (fallbackErr) {
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
    throw outageErr;
  }

  const content = finalResult.data.choices?.[0]?.message?.content ?? '';
  const usage = finalResult.data.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  if (returnUsage) {
    return {
      content,
      usage,
      model: finalResult.model,
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
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL,
};
