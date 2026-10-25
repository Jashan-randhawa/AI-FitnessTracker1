const asyncHandler = require('express-async-handler');
const WeightLog = require('../models/WeightLog');
const User = require('../models/User');
const sendError = require('../utils/sendError');
const { publishChange } = require('../services/eventBus');
const { dayKey, isValidTimeZone, isValidDateKey } = require('../utils/localDay');

// POST /api/weightlogs — body: { data: { weightKg, date, localDay, notes, source } }
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

  let localDay = null;
  if (raw.localDay && isValidDateKey(raw.localDay)) {
    localDay = raw.localDay;
  } else {
    const tzHeader = req.headers ? req.headers['x-timezone'] : undefined;
    const tz = isValidTimeZone(tzHeader) ? tzHeader : 'UTC';
    localDay = dayKey(logDate, tz);
  }

  // N2: One weight entry per user per local day (upsert replaces same-day entry with latest)
  const entry = await WeightLog.findOneAndUpdate(
    { user: req.user._id, localDay },
    {
      weightKg,
      date: logDate,
      localDay,
      notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 100) : '',
      source: ['profile', 'quick-log', 'onboarding'].includes(raw.source) ? raw.source : 'quick-log',
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  // Check if this is the newest weigh-in; if so, sync to User.weight
  const newestLog = await WeightLog.findOne({ user: req.user._id }).sort({ date: -1 });
  if (newestLog && String(newestLog._id) === String(entry._id)) {
    await User.findByIdAndUpdate(req.user._id, { weight: newestLog.weightKg });
  }

  // N3: Publish change event
  publishChange(String(req.user._id), 'weight', entry.date);

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

  // N3: Publish change event on delete
  publishChange(String(req.user._id), 'weight', entry.date);

  res.json(entry.toJSON());
});

module.exports = { create, find, remove };
