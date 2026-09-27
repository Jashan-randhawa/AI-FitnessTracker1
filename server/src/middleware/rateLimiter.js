const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for local authentication routes (login / register).
 * Prevents brute-force credential stuffing.
 * 20 attempts per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
    },
  },
});

/**
 * Rate limiter for password reset requests and validations.
 * 10 attempts per 15 minutes per IP.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      type: 'rate_limited',
      message: 'Too many password reset attempts. Please try again after 15 minutes.',
    },
  },
});

/**
 * Rate limiter for AI chat and image analysis endpoints.
 * Protects OpenRouter API key quotas and avoids runaway costs.
 * 30 requests per minute per IP.
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'AI request limit reached. Please wait a moment before sending more requests.',
    },
  },
});

/**
 * Rate limiter for YouTube proxy searches.
 * Protects RapidAPI quotas.
 * 30 requests per minute per IP.
 */
const youtubeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'YouTube search rate limit reached. Please try again shortly.',
    },
  },
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  aiLimiter,
  youtubeLimiter,
};
