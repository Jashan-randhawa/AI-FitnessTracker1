export interface OpenRouterLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}

export interface OpenRouterClientOptions {
  /** OpenRouter API key. If omitted, checks process.env.OPENROUTER_API_KEY. */
  apiKey?: string;
  /** Primary model identifier. Default: 'openai/gpt-4o-mini' */
  model?: string;
  /** Fallback model identifier on primary failure. Default: 'google/gemini-2.0-flash-001' */
  fallbackModel?: string;
  /** Per-request timeout in milliseconds. Default: 20000 */
  timeoutMs?: number;
  /** Maximum retry attempts for transient errors. Default: 2 */
  maxRetries?: number;
  /** Maximum retry attempts on fallback model. Default: 1 */
  maxFallbackRetries?: number;
  /** HTTP-Referer header sent to OpenRouter. Default: 'https://openrouter.ai' */
  referer?: string;
  /** Application title for OpenRouter metrics (X-Title). Default: 'OpenRouter Client' */
  appTitle?: string;
  /** Injectable logger. Defaults to silent no-op. */
  logger?: OpenRouterLogger;
  /** Base URL for OpenRouter chat completions. */
  baseUrl?: string;
}

export interface ChatMessageContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
  name?: string;
}

export interface ChatParams {
  messages: ChatMessage[];
  title?: string;
  model?: string;
  fallbackModel?: string;
  maxTokens?: number;
  timeoutMs?: number;
  returnUsage?: boolean;
  signal?: AbortSignal;
}

export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResult {
  text: string;
  content: string;
  usage: UsageInfo;
  model: string;
  raw?: unknown;
}
