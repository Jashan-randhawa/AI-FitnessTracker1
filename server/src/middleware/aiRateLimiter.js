/**
 * Production Security: Per-User Rate Limiting Middleware for AI Endpoints (Phase 5)
 *
 * Enforces:
 * - 10 requests/hour per user on Food Snap Vision (/api/image-analysis)
 * - 30 requests/hour per user on FitBot chat (/api/ai/chat)
 *
 * Keyed by authenticated user ID (req.user._id || req.user.id) with IP fallback.
 * Returns structured HTTP 429 JSON:
 * {
 *   error: "Rate limit exceeded",
 *   message: string,
 *   retryAfterSeconds: number
 * }
 */

// In-memory sliding window bucket store: Map<string, { timestamps: number[] }>
const rateBuckets = new Map();

/**
 * Creates a per-user sliding window rate limiting middleware.
 *
 * @param {Object} options
 * @param {number} options.maxRequests - Max allowed requests per window
 * @param {number} options.windowMs - Sliding window in milliseconds (default 1 hour)
 * @param {string} options.endpointName - Identifying name for log/error
 * @param {string} options.friendlyMessage - Error message returned to client
 * @returns {Function} Express middleware
 */
const createAiRateLimiter = ({
  maxRequests,
  windowMs = 60 * 60 * 1000, // 1 hour
  endpointName = 'AI',
  friendlyMessage,
}) => {
  return (req, res, next) => {
    // Exclude test runs if specifically bypassed via header
    if (req.headers['x-bypass-ai-ratelimit'] === 'true' && process.env.NODE_ENV === 'test') {
      return next();
    }

    const userId = String(req.user?._id || req.user?.id || req.ip || 'anonymous');
    const bucketKey = `${endpointName}:${userId}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let bucket = rateBuckets.get(bucketKey);
    if (!bucket) {
      bucket = { timestamps: [] };
      rateBuckets.set(bucketKey, bucket);
    }

    // Filter out timestamps outside the sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= maxRequests) {
      // Calculate remaining time until oldest request in window expires
      const oldestTimestamp = bucket.timestamps[0];
      const expiryTime = oldestTimestamp + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((expiryTime - now) / 1000));

      res.set('Retry-After', String(retryAfterSeconds));
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', '0');
      res.set('X-RateLimit-Reset', String(Math.ceil(expiryTime / 1000)));

      return res.status(429).json({
        error: 'Rate limit exceeded',
        message:
          friendlyMessage ||
          `${endpointName} rate limit exceeded (${maxRequests} requests/hour). Please wait before trying again.`,
        retryAfterSeconds,
      });
    }

    // Allow request and record timestamp
    bucket.timestamps.push(now);

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(maxRequests - bucket.timestamps.length));
    res.set('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));

    next();
  };
};

/**
 * 10 requests / hour per user for Food Snap Vision analysis.
 */
const foodSnapRateLimiter = createAiRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
  endpointName: 'FoodSnap',
  friendlyMessage: 'Food Snap vision rate limit reached (10 photos/hour). Please wait before analyzing more meals.',
});

/**
 * 30 requests / hour per user for FitBot AI assistant conversations.
 */
const fitbotRateLimiter = createAiRateLimiter({
  maxRequests: 30,
  windowMs: 60 * 60 * 1000,
  endpointName: 'FitBot',
  friendlyMessage: 'FitBot chat limit reached (30 messages/hour). Please wait before sending more messages.',
});

/**
 * Clears in-memory rate buckets (used in test teardown).
 */
const resetAiRateLimits = () => {
  rateBuckets.clear();
};

module.exports = {
  createAiRateLimiter,
  foodSnapRateLimiter,
  fitbotRateLimiter,
  resetAiRateLimits,
};
