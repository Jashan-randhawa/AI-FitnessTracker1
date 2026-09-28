import rateLimit from 'express-rate-limit';
import { AiLimitersOptions, LimiterOptions } from './types';

/**
 * Creates an Express rate limiter instance with sensible defaults.
 */
export const createLimiter = (options: LimiterOptions = {}) => {
  const {
    windowMs = 60 * 1000,
    max = 30,
    message,
    store,
    keyGenerator,
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    ...(keyGenerator ? { keyGenerator, validate: { keyGeneratorIpFallback: false } } : {}),
    ...(message
      ? {
          message:
            typeof message === 'string'
              ? { error: { message } }
              : message,
        }
      : {}),
  });
};

/**
 * Dual-tier AI limiter protecting LLM endpoints from runaway costs
 * and preventing NAT budget starvation.
 * Returns an array that can be passed directly to `app.use()` or used individually.
 */
export function aiLimiters(options: AiLimitersOptions = {}) {
  const {
    perIp = 30,
    perUser = 20,
    windowMs = 60 * 1000,
    store,
    ipMessage = 'AI request limit reached. Please wait a moment before sending more requests.',
    userMessage = 'You have reached your personal AI request limit. Please wait a moment before sending more requests.',
  } = options;

  const ipLimiter = rateLimit({
    windowMs,
    max: perIp,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: { error: { message: ipMessage } },
  });

  const userLimiter = rateLimit({
    windowMs,
    max: perUser,
    keyGenerator: (req: any) =>
      String(req.user?.id || req.user?._id || req.ip || 'anonymous'),
    validate: { keyGeneratorIpFallback: false },
    standardHeaders: true,
    legacyHeaders: false,
    store,
    message: { error: { message: userMessage } },
  });

  const middlewareList: any = [ipLimiter, userLimiter];
  middlewareList.ipLimiter = ipLimiter;
  middlewareList.userLimiter = userLimiter;

  return middlewareList;
}

/**
 * Rate limiter for authentication routes (login / register).
 * Default: 20 requests per 15 minutes.
 */
export const authLimiter = (options: Partial<LimiterOptions> = {}) =>
  createLimiter({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? 20,
    message: options.message ?? {
      error: {
        message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
      },
    },
    store: options.store,
  });

/**
 * Rate limiter for password reset routes.
 * Default: 10 requests per 15 minutes.
 */
export const passwordResetLimiter = (options: Partial<LimiterOptions> = {}) =>
  createLimiter({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    max: options.max ?? 10,
    message: options.message ?? {
      error: {
        type: 'rate_limited',
        message: 'Too many password reset attempts. Please try again after 15 minutes.',
      },
    },
    store: options.store,
  });

/**
 * Rate limiter for third-party proxy requests (e.g. YouTube search).
 * Default: 30 requests per minute.
 */
export const proxyLimiter = (options: Partial<LimiterOptions> = {}) =>
  createLimiter({
    windowMs: options.windowMs ?? 60 * 1000,
    max: options.max ?? 30,
    message: options.message ?? {
      error: {
        message: 'Third-party API rate limit reached. Please try again shortly.',
      },
    },
    store: options.store,
  });
