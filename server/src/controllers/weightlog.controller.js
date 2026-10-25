const asyncHandler = require('express-async-handler');
const WeightLog = require('../models/WeightLog');
const User = require('../models/User');
const sendError = require('../utils/sendError');

// POST /api/weightlogs — body: { data: { weightKg, date, notes, source } }
const create = asyncHandler(async (req, res) => {
  const raw = req.body.data || req.body || {};
  const weightKg = Number(raw.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400) {
    return sendError(res, 400, 'weightKg must be a number between 20 and 400 kg');
  }

  const logDate = raw.date ? new Date(raw.date) : new Date();
  if (isNaN(logDate.getTime())) {
    return sendError(res, 400, 'Invalid date format');
  }

  const entry = await WeightLog.create({
    user: req.user._id,
    weightKg,
    date: logDate,
    notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 100) : '',
    source: ['profile', 'quick-log', 'onboarding'].includes(raw.source) ? raw.source : 'quick-log',
  });

  // Check if this is the newest weigh-in; if so, sync to User.weight
  const newestLog = await WeightLog.findOne({ user: req.user._id }).sort({ date: -1 });
  if (newestLog && String(newestLog._id) === String(entry._id)) {
    await User.findByIdAndUpdate(req.user._id, { weight: weightKg });
  }

  res.status(201).json(entry.toJSON());
});

// GET /api/weightlogs — query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
const find = asyncHandler(async (req, res) => {
  const query = { user: req.user._id };
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) {
      const fromDate = new Date(req.query.from);
      if (!isNaN(fromDate.getTime())) query.date.$gte = fromDate;
    }
    if (req.query.to) {
      const toDate = new Date(req.query.to);
      if (!isNaN(toDate.getTime())) query.date.$lte = toDate;
    }
  }

  const results = await WeightLog.find(query).sort({ date: 1 });
  res.json(results.map((r) => r.toJSON()));
});

// DELETE /api/weightlogs/:id
const remove = asyncHandler(async (req, res) => {
  const entry = await WeightLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!entry) return sendError(res, 404, 'Weight log entry not found');

  // Re-sync User.weight with newest remaining log if any
  const newestLog = await WeightLog.findOne({ user: req.user._id }).sort({ date: -1 });
  if (newestLog) {
    await User.findByIdAndUpdate(req.user._id, { weight: newestLog.weightKg });
  }

  res.json(entry.toJSON());
});

module.exports = { create, find, remove };
