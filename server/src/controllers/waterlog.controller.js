const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const { publishChange } = require('../services/eventBus');
const WaterLog = require('../models/WaterLog');
const IdempotencyKey = require('../models/IdempotencyKey');
const sendError = require('../utils/sendError');

const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;
const idempotencyMap = new Map();

const isDbConnected = () => mongoose.connection && mongoose.connection.readyState === 1;

const cleanExpiredIdempotency = (now = Date.now()) => {
  for (const [key, item] of idempotencyMap.entries()) {
    if (now - item.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyMap.delete(key);
    }
  }
};

// POST /api/waterlogs — body: { data: { amount, date } }
const create = asyncHandler(async (req, res) => {
  const body = req.body.data || req.body || {};
  const idempotencyKey =
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    body.idempotencyKey;

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const trimmedKey = idempotencyKey.trim();

    // Durable DB idempotency check (Phase G / N6)
    // Only query DB if mongoose is connected or in stubbed test mode (avoids 10s buffering timeout in disconnected unit tests)
    if (isDbConnected()) {
      try {
        const persisted = await IdempotencyKey.findOne({
          user: req.user._id,
          key: trimmedKey,
        });
        if (persisted && persisted.response) {
          return res.status(200).json(persisted.response);
        }
      } catch {
        // Fall through to in-memory fallback
      }
    }

    // Fast-path in-memory fallback
    cleanExpiredIdempotency();
    const cacheKey = `${String(req.user._id)}:${trimmedKey}`;
    const cached = idempotencyMap.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached.response);
    }
  }

  const entry = await WaterLog.create({
    ...body,
    date: body.date || new Date(),
    user: req.user._id,
  });

  const responseJson = entry.toJSON();

  if (idempotencyKey && typeof idempotencyKey === 'string') {
    const trimmedKey = idempotencyKey.trim();
    const cacheKey = `${String(req.user._id)}:${trimmedKey}`;
    idempotencyMap.set(cacheKey, { timestamp: Date.now(), response: responseJson });

    // Persist to 5-minute TTL database store when connected (Phase G / N6)
    if (isDbConnected()) {
      await IdempotencyKey.findOneAndUpdate(
        { user: req.user._id, key: trimmedKey },
        { user: req.user._id, key: trimmedKey, response: responseJson, createdAt: new Date() },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      ).catch(() => {
        // In-memory fallback already recorded
      });
    }
  }

  publishChange(String(req.user._id), 'water', entry.date);
  res.json(responseJson);
});

// GET /api/waterlogs
const find = asyncHandler(async (req, res) => {
  const result = await WaterLog.find({ user: req.user._id }).sort({ date: -1 });
  res.json(result.map((r) => r.toJSON()));
});

// PUT /api/waterlogs/:id — body: { data: { amount } }
const update = asyncHandler(async (req, res) => {
  const raw = req.body.data || req.body || {};
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    return sendError(res, 400, 'amount must be between 1 and 10000 ml');
  }
  const entry = await WaterLog.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { amount },
    { new: true, runValidators: true }
  );
  if (!entry) return sendError(res, 404, 'Water log entry not found');
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(entry.toJSON());
});

// DELETE /api/waterlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await WaterLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Water log entry not found');
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(entry.toJSON());
});

module.exports = { create, find, update, remove };
