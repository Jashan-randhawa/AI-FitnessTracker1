const asyncHandler = require('express-async-handler');
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
  res.json(entry.toJSON());
});

// GET /api/waterlogs
const find = asyncHandler(async (req, res) => {
  const result = await WaterLog.find({ user: req.user._id }).sort({ date: -1 });
  res.json(result.map((r) => r.toJSON()));
});

// DELETE /api/waterlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await WaterLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Water log entry not found');
  res.json(entry.toJSON());
});

module.exports = { create, find, remove };
