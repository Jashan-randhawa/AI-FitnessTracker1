const crypto = require('crypto');
const mongoose = require('mongoose');
const IdempotencyKey = require('../models/IdempotencyKey');
const sendError = require('../utils/sendError');
const logger = require('../utils/logger');

const KEY_REGEX = /^[A-Za-z0-9_:.-]{8,128}$/;
const disconnectedFallbackMap = new Map();

const isDbConnected = () => Boolean(mongoose.connection && mongoose.connection.readyState === 1);

const canonicalize = (val) => {
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(canonicalize);
  const sorted = {};
  for (const k of Object.keys(val).sort()) {
    if (k === 'idempotencyKey') continue;
    sorted[k] = canonicalize(val[k]);
  }
  return sorted;
};

const isTimestampJitter = (a, b) => {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a).filter((k) => k !== 'idempotencyKey');
  const keysB = Object.keys(b).filter((k) => k !== 'idempotencyKey');
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    const valA = a[k];
    const valB = b[k];
    if (k === 'date') {
      const tA = new Date(valA).getTime();
      const tB = new Date(valB).getTime();
      if (Number.isFinite(tA) && Number.isFinite(tB)) {
        if (Math.abs(tA - tB) > 10000) return false;
        continue;
      }
    }
    if (valA !== null && typeof valA === 'object' && valB !== null && typeof valB === 'object') {
      if (!isTimestampJitter(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
};

const computeRequestHash = (method, route, body) => {
  const normalizedMethod = (method || 'POST').toUpperCase();
  const canonicalBody = JSON.stringify(canonicalize(body || {}));
  return crypto
    .createHash('sha256')
    .update(`${normalizedMethod}:${route}:${canonicalBody}`)
    .digest('hex');
};

const releaseClaim = async (userId, key) => {
  const cacheKey = `${String(userId)}:${key}`;
  if (isDbConnected()) {
    try {
      await IdempotencyKey.deleteOne({ user: userId, key });
    } catch (err) {
      logger.warn('[Idempotency] Failed to release claim in database', { error: err.message });
    }
  } else {
    disconnectedFallbackMap.delete(cacheKey);
  }
};

const safeSetHeader = (res, name, value) => {
  if (typeof res.set === 'function') {
    res.set(name, value);
  } else if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
  }
};

const idempotency = async (req, res, next) => {
  const rawKey =
    req.headers?.['idempotency-key'] ||
    req.headers?.['x-idempotency-key'] ||
    req.body?.data?.idempotencyKey ||
    req.body?.idempotencyKey;

  // Requests without an idempotency key behave exactly as today
  if (rawKey === undefined || rawKey === null || rawKey === '') {
    req._idempotencyHandled = true;
    return next();
  }

  if (typeof rawKey !== 'string') {
    return sendError(res, 400, 'Invalid Idempotency-Key. Key must be a string.', {
      code: 'INVALID_IDEMPOTENCY_KEY',
    });
  }

  const trimmedKey = rawKey.trim();
  if (!KEY_REGEX.test(trimmedKey)) {
    return sendError(
      res,
      400,
      'Invalid Idempotency-Key. Key must be 8-128 characters of [A-Za-z0-9_:.-]',
      { code: 'INVALID_IDEMPOTENCY_KEY' }
    );
  }

  const userId = req.user?._id;
  if (!userId) {
    // If route isn't authenticated yet or user missing, skip claim scoping
    req._idempotencyHandled = true;
    return next();
  }

  const userStr = String(userId);
  const cacheKey = `${userStr}:${trimmedKey}`;
  const route = (req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl || req.path || '').split('?')[0];
  const canonicalPayload = canonicalize(req.body || {});
  const requestHash = computeRequestHash(req.method, route, req.body);

  const ttlHours = parseInt(process.env.IDEMPOTENCY_TTL_HOURS, 10) || 336;
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  if (isDbConnected()) {
    let existing = null;
    try {
      existing = await IdempotencyKey.findOne({ user: userId, key: trimmedKey });
    } catch (err) {
      logger.warn('[Idempotency] Failed to query existing key from database', { error: err.message });
    }

    if (existing) {
      if (existing.status === 'in_progress') {
        safeSetHeader(res, 'Retry-After', '1');
        return sendError(res, 409, 'An operation with this idempotency key is currently in progress', {
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }

      if (existing.status === 'completed' || existing.response !== undefined) {
        if (existing.requestHash && existing.requestHash !== requestHash) {
          const isJitter = existing.rawPayload && isTimestampJitter(existing.rawPayload, canonicalPayload);
          if (!isJitter) {
            return sendError(res, 422, 'Idempotency key was previously used with a different request payload', {
              code: 'IDEMPOTENCY_KEY_REUSED',
            });
          }
        }
        safeSetHeader(res, 'Idempotency-Replayed', 'true');
        return res.status(existing.statusCode || 200).json(existing.response);
      }
    }

    // Atomic claim via insert
    try {
      await IdempotencyKey.create({
        user: userId,
        key: trimmedKey,
        requestHash,
        rawPayload: canonicalPayload,
        route,
        status: 'in_progress',
        expiresAt,
      });
    } catch (err) {
      if (err.code === 11000 || /duplicate key/i.test(err.message)) {
        // Seen before concurrently
        try {
          const record = await IdempotencyKey.findOne({ user: userId, key: trimmedKey });
          if (record) {
            if (record.status === 'in_progress') {
              safeSetHeader(res, 'Retry-After', '1');
              return sendError(res, 409, 'An operation with this idempotency key is currently in progress', {
                code: 'IDEMPOTENCY_IN_PROGRESS',
              });
            }
            if (record.requestHash && record.requestHash !== requestHash) {
              const isJitter = record.rawPayload && isTimestampJitter(record.rawPayload, canonicalPayload);
              if (!isJitter) {
                return sendError(res, 422, 'Idempotency key was previously used with a different request payload', {
                  code: 'IDEMPOTENCY_KEY_REUSED',
                });
              }
            }
            safeSetHeader(res, 'Idempotency-Replayed', 'true');
            return res.status(record.statusCode || 200).json(record.response);
          }
        } catch (findErr) {
          logger.warn('[Idempotency] Failed to read record after duplicate key conflict', {
            error: findErr.message,
          });
        }
      } else {
        logger.warn('[Idempotency] Failed to insert in_progress record', { error: err.message });
      }
    }
  } else {
    // Disconnected unit tests fallback
    const cached = disconnectedFallbackMap.get(cacheKey);
    if (cached) {
      if (cached.status === 'in_progress') {
        safeSetHeader(res, 'Retry-After', '1');
        return sendError(res, 409, 'An operation with this idempotency key is currently in progress', {
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }
      if (cached.status === 'completed' || cached.response !== undefined) {
        if (cached.requestHash && cached.requestHash !== requestHash) {
          const isJitter = cached.rawPayload && isTimestampJitter(cached.rawPayload, canonicalPayload);
          if (!isJitter) {
            return sendError(res, 422, 'Idempotency key was previously used with a different request payload', {
              code: 'IDEMPOTENCY_KEY_REUSED',
            });
          }
        }
        safeSetHeader(res, 'Idempotency-Replayed', 'true');
        return res.status(cached.statusCode || 200).json(cached.response);
      }
    }

    disconnectedFallbackMap.set(cacheKey, {
      user: userStr,
      key: trimmedKey,
      requestHash,
      rawPayload: canonicalPayload,
      route,
      status: 'in_progress',
      expiresAt,
    });
  }

  req._idempotencyHandled = true;

  const originalJson = typeof res.json === 'function' ? res.json.bind(res) : null;
  const originalSend = typeof res.send === 'function' ? res.send.bind(res) : null;
  let captured = false;

  if (typeof res.on === 'function') {
    res.on('close', () => {
      if (!res.writableEnded && !captured) {
        releaseClaim(userId, trimmedKey).catch(() => {});
      }
    });
  }

  const finalize = async (data) => {
    if (captured) return;
    captured = true;

    const statusCode = res.statusCode || 200;

    if (statusCode >= 500) {
      await releaseClaim(userId, trimmedKey);
      return;
    }

    if (isDbConnected()) {
      try {
        await IdempotencyKey.findOneAndUpdate(
          { user: userId, key: { $eq: trimmedKey } },
          {
            $set: {
              user: userId,
              key: trimmedKey,
              requestHash,
              rawPayload: canonicalPayload,
              route,
              status: 'completed',
              statusCode,
              response: data,
              expiresAt,
            },
          },
          { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        logger.warn('[Idempotency] Failed to persist completed record', { error: err.message });
      }
    } else {
      disconnectedFallbackMap.set(cacheKey, {
        user: userStr,
        key: trimmedKey,
        requestHash,
        rawPayload: canonicalPayload,
        route,
        status: 'completed',
        statusCode,
        response: data,
        expiresAt,
      });
    }
  };

  if (originalJson) {
    res.json = function (data) {
      finalize(data).catch(() => {});
      return originalJson(data);
    };
  }

  if (originalSend) {
    res.send = function (data) {
      let parsed = data;
      if (typeof data === 'string') {
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
      }
      finalize(parsed).catch(() => {});
      return originalSend(data);
    };
  }

  try {
    next();
  } catch (err) {
    releaseClaim(userId, trimmedKey).catch(() => {});
    throw err;
  }
};

idempotency._clearDisconnectedMap = () => {
  disconnectedFallbackMap.clear();
};

module.exports = idempotency;
