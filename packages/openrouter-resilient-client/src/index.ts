import {
  OpenRouterClientOptions,
  OpenRouterLogger,
  ChatMessage,
  ChatParams,
  ChatResult,
  UsageInfo,
} from './types';

export * from './types';

export const DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.0-flash-001';
export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_FALLBACK_RETRIES = 1;
export const BASE_BACKOFF_MS = 500;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const silentLogger: OpenRouterLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

export class OpenRouterError extends Error {
  status: number;
  isOperational: boolean;
  originalError?: unknown;

  constructor(message: string, status = 500, originalError?: unknown) {
    super(message);
    this.name = 'OpenRouterError';
    this.status = status;
    this.isOperational = true;
    this.originalError = originalError;
  }
}

/**
 * Checks if an error or HTTP status qualifies as a transient failure
 * suitable for exponential backoff retry.
 */
export const isTransient = (status?: number | null, error?: unknown): boolean => {
  if (error && typeof error === 'object') {
    const err = error as { name?: string; code?: string };
    if (err.name === 'AbortError') return true;
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;
    if (err.name === 'FetchError' || error instanceof TypeError) return true;
  }
  if (status === 429) return true;
  if (status && status >= 500 && status < 600) return true;
  return false;
};

/**
 * Robust JSON extraction from markdown code fences or raw string output.
 */
export const extractCleanJson = <T = unknown>(text: string): T | null => {
  if (!text || typeof text !== 'string') return null;

  // 1. Try stripping <think>...</think> if present
  let sanitized = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Try matching code block fences
  const fencedMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch && fencedMatch[1]) {
    sanitized = fencedMatch[1].trim();
  }

  // 3. Attempt direct parse
  try {
    return JSON.parse(sanitized) as T;
  } catch {
    // 4. Try finding bracket bounds if embedded in surrounding prose
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(sanitized.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // continue
      }
    }

    const firstBracket = sanitized.indexOf('[');
    const lastBracket = sanitized.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(sanitized.slice(firstBracket, lastBracket + 1)) as T;
      } catch {
        // continue
      }
    }
  }

  return null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface OpenRouterClient {
  chat: (params: ChatParams) => Promise<ChatResult>;
  chatCompletion: (params: ChatParams) => Promise<string>;
  chatCompletionDetailed: (params: ChatParams & { returnUsage?: boolean }) => Promise<string | ChatResult>;
  options: Readonly<OpenRouterClientOptions>;
}

export function createOpenRouterClient(options: OpenRouterClientOptions = {}): OpenRouterClient {
  const apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY : undefined);
  const primaryModel = options.model || (typeof process !== 'undefined' && process.env?.OPENROUTER_MODEL) || DEFAULT_MODEL;
  const fallbackModel = options.fallbackModel !== undefined
    ? options.fallbackModel
    : ((typeof process !== 'undefined' && process.env?.OPENROUTER_FALLBACK_MODEL) || DEFAULT_FALLBACK_MODEL);
  const defaultTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxPrimaryRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const maxFallbackRetries = options.maxFallbackRetries ?? DEFAULT_FALLBACK_RETRIES;
  const referer = options.referer ?? 'https://openrouter.ai';
  const defaultTitle = options.appTitle ?? 'OpenRouter Client';
  const logger = options.logger ?? silentLogger;
  const baseUrl = options.baseUrl ?? OPENROUTER_URL;

  const attemptRequest = async ({
    messages,
    title,
    model,
    maxTokens,
    timeoutMs,
    clientSignal,
  }: {
    messages: ChatMessage[];
    title: string;
    model: string;
    maxTokens?: number;
    timeoutMs: number;
    clientSignal?: AbortSignal;
  }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onClientAbort = () => controller.abort();
    if (clientSignal) {
      if (clientSignal.aborted) {
        controller.abort();
      } else {
        clientSignal.addEventListener('abort', onClientAbort, { once: true });
      }
    }

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': referer,
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
      if (clientSignal) clientSignal.removeEventListener('abort', onClientAbort);

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        // non-json response
      }

      return {
        status: response.status,
        ok: response.ok,
        responseText,
        data,
        error: null,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (clientSignal) clientSignal.removeEventListener('abort', onClientAbort);
      return {
        status: null,
        ok: false,
        responseText: '',
        data: null,
        error: err.name === 'AbortError'
          ? new Error(`OpenRouter request timed out after ${timeoutMs}ms`)
          : err,
      };
    }
  };

  const callWithRetry = async ({
    messages,
    title,
    model,
    maxTokens,
    timeoutMs,
    maxRetries,
    signal,
  }: {
    messages: ChatMessage[];
    title: string;
    model: string;
    maxTokens?: number;
    timeoutMs: number;
    maxRetries: number;
    signal?: AbortSignal;
  }) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await attemptRequest({
        messages,
        title,
        model,
        maxTokens,
        timeoutMs,
        clientSignal: signal,
      });

      if (result.ok && result.data) {
        return { data: result.data, model };
      }

      const currentError = (result.error as Error) || new Error(
        `OpenRouter HTTP ${result.status}: ${result.responseText?.slice(0, 300) || 'Unknown error'}`
      );
      lastError = currentError;

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

  const chat = async (params: ChatParams): Promise<ChatResult> => {
    if (!apiKey) {
      throw new OpenRouterError('OpenRouter API key not configured.', 500);
    }

    const {
      messages,
      title = defaultTitle,
      model = primaryModel,
      fallbackModel: overrideFallback = fallbackModel,
      maxTokens,
      timeoutMs = defaultTimeoutMs,
      signal,
    } = params;

    let finalResult: { data: any; model: string } | null = null;
    let primaryError: unknown = null;

    // 1. Primary model attempt with retries
    try {
      finalResult = await callWithRetry({
        messages,
        title,
        model,
        maxTokens,
        timeoutMs,
        maxRetries: maxPrimaryRetries,
        signal,
      });
    } catch (err: any) {
      primaryError = err;
      logger.warn(`[OpenRouter ${title}] Primary model ${model} failed: ${err.message}`);
    }

    // 2. Fallback model attempt if primary failed
    if (!finalResult && overrideFallback && overrideFallback !== model) {
      logger.warn(`[OpenRouter ${title}] Switching to fallback model: ${overrideFallback}`);
      try {
        finalResult = await callWithRetry({
          messages,
          title,
          model: overrideFallback,
          maxTokens,
          timeoutMs,
          maxRetries: maxFallbackRetries,
          signal,
        });
      } catch (fallbackErr: any) {
        logger.error(`[OpenRouter ${title}] Fallback model ${overrideFallback} also failed: ${fallbackErr.message}`);
      }
    }

    // 3. Both failed
    if (!finalResult) {
      throw new OpenRouterError(
        'AI assistant is temporarily unavailable. Please try again in a moment.',
        503,
        primaryError
      );
    }

    const text = finalResult.data.choices?.[0]?.message?.content ?? '';
    const rawUsage = finalResult.data.usage || {};
    const usage: UsageInfo = {
      prompt_tokens: rawUsage.prompt_tokens ?? 0,
      completion_tokens: rawUsage.completion_tokens ?? 0,
      total_tokens: rawUsage.total_tokens ?? 0,
    };

    return {
      text,
      content: text,
      usage,
      model: finalResult.model,
      raw: finalResult.data,
    };
  };

  const chatCompletionDetailed = async (
    params: ChatParams & { returnUsage?: boolean }
  ): Promise<string | ChatResult> => {
    const res = await chat(params);
    if (params.returnUsage) {
      return res;
    }
    return res.text;
  };

  const chatCompletion = async (params: ChatParams): Promise<string> => {
    const res = await chat(params);
    return res.text;
  };

  return {
    chat,
    chatCompletion,
    chatCompletionDetailed,
    options: Object.freeze({
      apiKey,
      model: primaryModel,
      fallbackModel,
      timeoutMs: defaultTimeoutMs,
      maxRetries: maxPrimaryRetries,
      maxFallbackRetries,
      referer,
      appTitle: defaultTitle,
      logger,
      baseUrl,
    }),
  };
}
