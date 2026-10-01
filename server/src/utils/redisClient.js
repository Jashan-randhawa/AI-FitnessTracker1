/**
 * Redis Client Singleton for AI-FitnessTracker1
 * Provides optional distributed caching & rate-limiting with graceful
 * fallback to in-memory storage when REDIS_URL is not configured or offline.
 */

const Redis = require('ioredis');
const logger = require('./logger');

let redisClient = null;
let isConnected = false;

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 5) {
          logger.warn('[redis] Max reconnection attempts reached. Continuing with in-memory fallback.');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: false,
      connectTimeout: 5000,
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('[redis] Connected to Redis server.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Do not crash application on Redis connectivity drops
      logger.warn('[redis] Redis connection error, using in-memory fallback:', { error: err.message });
    });

    redisClient.on('close', () => {
      isConnected = false;
    });
  } catch (err) {
    logger.warn('[redis] Failed to initialize Redis client, using in-memory fallback:', { error: err.message });
    redisClient = null;
    isConnected = false;
  }
}

/**
 * Returns whether Redis is currently connected and ready.
 * @returns {boolean}
 */
const isRedisAvailable = () => {
  return isConnected && redisClient !== null && redisClient.status === 'ready';
};

/**
 * Distributed rate limiter with in-memory fallback.
 * @param {string} prefix
 * @param {string} identifier
 * @param {number} maxAttempts
 * @param {number} windowMs
 * @param {Map} fallbackMap
 * @returns {Promise<{ limited: boolean, retryAfter?: number, currentCount: number }>}
 */
/**
 * Distributed rate limiter with in-memory fallback.
 * @param {string} prefix
 * @param {string} identifier
 * @param {number} maxAttempts
 * @param {number} windowMs
 * @param {Map} fallbackMap
 * @param {{ readOnly?: boolean }} options
 * @returns {Promise<{ limited: boolean, retryAfter?: number, currentCount: number }>}
 */
const checkDistributedRateLimit = async (
  prefix,
  identifier,
  maxAttempts,
  windowMs,
  fallbackMap,
  { readOnly = false } = {}
) => {
  const key = `${prefix}:${identifier.toLowerCase()}`;
  const now = Date.now();

  if (isRedisAvailable()) {
    try {
      const windowSeconds = Math.ceil(windowMs / 1000);

      if (readOnly) {
        const multi = redisClient.multi();
        multi.get(key);
        multi.ttl(key);
        const results = await multi.exec();
        if (results && results.length >= 2) {
          const rawCount = results[0][1];
          const count = rawCount ? parseInt(rawCount, 10) : 0;
          const ttl = results[1][1];
          if (count >= maxAttempts) {
            return { limited: true, retryAfter: Math.max(1, ttl), currentCount: count };
          }
          return { limited: false, currentCount: count };
        }
      } else {
        const multi = redisClient.multi();
        multi.incr(key);
        multi.ttl(key);
        const results = await multi.exec();

        if (results && results.length >= 2) {
          const count = results[0][1];
          let ttl = results[1][1];

          // If key had no TTL (e.g. freshly created), set expiry
          if (ttl === -1 || ttl === -2) {
            await redisClient.expire(key, windowSeconds);
            ttl = windowSeconds;
          }

          if (count > maxAttempts) {
            return {
              limited: true,
              retryAfter: Math.max(1, ttl),
              currentCount: count,
            };
          }

          return { limited: false, currentCount: count };
        }
      }
    } catch (redisErr) {
      logger.warn('[redis] Rate limit query failed, falling back to memory store:', { error: redisErr.message });
    }
  }

  // In-memory fallback
  const entry = fallbackMap.get(key);
  if (!entry || now > entry.resetAt) {
    if (readOnly) {
      return { limited: false, currentCount: 0 };
    }
    fallbackMap.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, currentCount: 1 };
  }

  if (entry.count >= maxAttempts) {
    return {
      limited: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      currentCount: entry.count,
    };
  }

  if (readOnly) {
    return { limited: false, currentCount: entry.count };
  }

  entry.count += 1;
  return { limited: false, currentCount: entry.count };
};

/**
 * Clear rate limit / lockout entry in both fallback map and Redis
 */
const clearDistributedRateLimit = async (prefix, identifier, fallbackMap) => {
  const key = `${prefix}:${identifier.toLowerCase()}`;
  fallbackMap.delete(key);
  if (isRedisAvailable()) {
    try {
      await redisClient.del(key);
    } catch (_) {}
  }
};

module.exports = {
  getRedisClient: () => redisClient,
  isRedisAvailable,
  checkDistributedRateLimit,
  clearDistributedRateLimit,
};
