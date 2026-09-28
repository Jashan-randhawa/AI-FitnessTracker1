export interface GuardLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}

export interface AiLimitersOptions {
  /** Maximum requests allowed per IP within window. Default: 30 */
  perIp?: number;
  /** Maximum requests allowed per authenticated user (req.user.id). Default: 20 */
  perUser?: number;
  /** Window size in milliseconds. Default: 60000 (1 minute) */
  windowMs?: number;
  /** Optional custom store for express-rate-limit (e.g. RedisStore) */
  store?: any;
  /** Optional custom error message when IP limit is exceeded */
  ipMessage?: string;
  /** Optional custom error message when user limit is exceeded */
  userMessage?: string;
}

export interface LimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string | object;
  store?: any;
  keyGenerator?: (req: any) => string;
}

export interface ErrorHandlerOptions {
  /** Injectable logger. If omitted, uses console in non-test envs. */
  logger?: GuardLogger;
  /** Whether running in production mode. Default: process.env.NODE_ENV === 'production' */
  isProduction?: boolean;
  /** Custom generic error message for masked internal server errors. */
  genericErrorMessage?: string;
}

export interface RequestIdOptions {
  /** Request header name to inspect for incoming ID. Default: 'x-request-id' */
  headerName?: string;
  /** Generator function for generating new IDs. Default: crypto.randomUUID */
  generator?: () => string;
}
