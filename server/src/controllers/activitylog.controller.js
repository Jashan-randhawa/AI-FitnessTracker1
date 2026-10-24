const asyncHandler = require('express-async-handler');
const { publishChange } = require('../services/eventBus');
const ActivityLog = require('../models/ActivityLog');
const sendError = require('../utils/sendError');

const normalizePayload = (raw) => {
  const body = { ...raw };
  if (body.caloriesBurned !== undefined && body.calories === undefined) {
    body.calories = Number(body.caloriesBurned) || 0;
  }
  if (body.calories !== undefined) {
    body.calories = Number(body.calories) || 0;
  }
  if (body.duration !== undefined) {
    body.duration = Number(body.duration) || 0;
  }
  if (body.type) {
    body.type = String(body.type).toLowerCase().trim();
  }
  if (body.intensity) {
    const norm = String(body.intensity).toLowerCase().trim();
    body.intensity = ['low', 'medium', 'high'].includes(norm) ? norm : 'medium';
  }
  if (body.source) {
    const norm = String(body.source).toLowerCase().trim();
    body.source = ['manual', 'planner', 'live-session', 'quick-log'].includes(norm) ? norm : 'manual';
  }
  return body;
};

// POST /api/activitylogs — body: { data: { ... } } or flat { ... }
const create = asyncHandler(async (req, res) => {
  const raw = req.body.data || req.body || {};
  const body = normalizePayload(raw);

  const entry = await ActivityLog.create({
    ...body,
    date: body.date || new Date(),
    user: req.user._id,
  });

  const json = entry.toJSON();
  if (json.caloriesBurned === undefined && json.calories !== undefined) {
    json.caloriesBurned = json.calories;
  }
  publishChange(String(req.user._id), 'activity', json.date);
  res.json(json);
});

// GET /api/activitylogs
const find = asyncHandler(async (req, res) => {
  const result = await ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(
    result.map((r) => {
      const j = r.toJSON();
      if (j.caloriesBurned === undefined && j.calories !== undefined) {
        j.caloriesBurned = j.calories;
      }
      return j;
    })
  );
});

// GET /api/activitylogs/:id
const findOne = asyncHandler(async (req, res) => {
  const entry = await ActivityLog.findOne({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  const json = entry.toJSON();
  if (json.caloriesBurned === undefined && json.calories !== undefined) {
    json.caloriesBurned = json.calories;
  }
  res.json(json);
});

// PUT /api/activitylogs/:id
const update = asyncHandler(async (req, res) => {
  const body = normalizePayload(req.body.data || req.body || {});

  const entry = await ActivityLog.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, body, {
    new: true,
    runValidators: true,
  });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  const json = entry.toJSON();
  if (json.caloriesBurned === undefined && json.calories !== undefined) {
    json.caloriesBurned = json.calories;
  }
  publishChange(String(req.user._id), 'activity', json.date);
  res.json(json);
});

// DELETE /api/activitylogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await ActivityLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Activity log entry not found');
  publishChange(String(req.user._id), 'activity', entry.date);
  res.json(entry.toJSON());
});

module.exports = { create, find, findOne, update, remove };
