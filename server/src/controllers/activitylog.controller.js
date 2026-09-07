const asyncHandler = require('express-async-handler');
const ActivityLog = require('../models/ActivityLog');
const sendError = require('../utils/sendError');

// POST /api/activitylogs — body: { data: { name, duration, caloriesBurned, date } }
const create = asyncHandler(async (req, res) => {
  const body = { ...(req.body.data || {}) };

  // Original controller normalized `caloriesBurned` (client field name) to
  // `calories` (schema field name) — the client still sends caloriesBurned.
  if (body.caloriesBurned !== undefined) {
    body.calories = body.caloriesBurned;
    delete body.caloriesBurned;
  }

  const entry = await ActivityLog.create({
    ...body,
    date: body.date || new Date(),
    user: req.user._id,
  });
  res.json(entry.toJSON());
});

// GET /api/activitylogs
const find = asyncHandler(async (req, res) => {
  const result = await ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(result.map((r) => r.toJSON()));
});

// GET /api/activitylogs/:id
const findOne = asyncHandler(async (req, res) => {
  const entry = await ActivityLog.findOne({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  res.json(entry.toJSON());
});

// PUT /api/activitylogs/:id
const update = asyncHandler(async (req, res) => {
  const body = { ...(req.body.data || req.body || {}) };
  if (body.caloriesBurned !== undefined) {
    body.calories = body.caloriesBurned;
    delete body.caloriesBurned;
  }

  const entry = await ActivityLog.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, body, {
    new: true,
    runValidators: true,
  });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  res.json(entry.toJSON());
});

// DELETE /api/activitylogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await ActivityLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  res.json(entry.toJSON());
});

module.exports = { create, find, findOne, update, remove };
