const asyncHandler = require('express-async-handler');
const { getRedisClient, isRedisAvailable } = require('../utils/redisClient');
const logger = require('../utils/logger');

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const memoryCache = new Map();

// Helper to get from cache (Redis or Memory)
const getCachedSearch = async (cacheKey) => {
  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn('[youtube] Redis cache read failed, falling back to memory', { error: err.message });
    }
  }

  const memEntry = memoryCache.get(cacheKey);
  if (memEntry) {
    if (Date.now() < memEntry.expiresAt) {
      return memEntry.data;
    }
    memoryCache.delete(cacheKey);
  }
  return null;
};

// Helper to set cache (Redis and Memory)
const setCachedSearch = async (cacheKey, data) => {
  // Always update in-memory cache
  memoryCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });

  // Clean memory cache if it grows too large
  if (memoryCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiresAt <= now) {
        memoryCache.delete(k);
      }
    }
  }

  if (isRedisAvailable()) {
    try {
      const redis = getRedisClient();
      await redis.set(cacheKey, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn('[youtube] Redis cache write failed', { error: err.message });
    }
  }
};

// GET /api/youtube/search?q=
const search = asyncHandler(async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  const cacheKey = `yt:search:${encodeURIComponent(query.toLowerCase())}`;
  const cached = await getCachedSearch(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RapidAPI key not configured on server' });
  }

  try {
    const response = await fetch(
      `https://youtube138.p.rapidapi.com/search/?q=${encodeURIComponent(query)}&hl=en&gl=US`,
      {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'youtube138.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: `YouTube API error: ${response.status}` });
    }

    const data = await response.json();
    await setCachedSearch(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    res.json(data);
  } catch (err) {
    logger.error('[youtube] Search request error', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch from YouTube API' });
  }
});

module.exports = { search };
