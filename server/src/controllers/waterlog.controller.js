const asyncHandler = require('express-async-handler');
const { publishChange } = require('../services/eventBus');
const WaterLog = require('../models/WaterLog');
const sendError = require('../utils/sendError');

// POST /api/waterlogs — body: { data: { amount, date } }
const create = asyncHandler(async (req, res) => {
  const body = req.body.data || {};
  const entry = await WaterLog.create({
    ...body,
    date: body.date || new Date(),
    user: req.user._id,
  });
  publishChange(String(req.user._id), 'water', entry.date);
  res.json(entry.toJSON());
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
