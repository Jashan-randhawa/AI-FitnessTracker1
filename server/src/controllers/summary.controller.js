const asyncHandler = require('express-async-handler');
const sendError = require('../utils/sendError');
const { computeDaySummary, computeRangeSummary } = require('../services/summary.service');
const { dayKey, isValidDateKey, isValidTimeZone } = require('../utils/localDay');

const MAX_RANGE_DAYS = 366;

/** Timezone comes from the client header; invalid values are rejected, not guessed. */
const readTimeZone = (req) => {
  const header = req.get('X-Timezone');
  if (header === undefined || header === '') return { tz: 'UTC' };
  if (!isValidTimeZone(header)) return { error: 'X-Timezone must be a valid IANA timezone' };
  return { tz: header };
};

// GET /api/summary/day?date=YYYY-MM-DD (defaults to today in the user's timezone)
const getDaySummary = asyncHandler(async (req, res) => {
  const { tz, error } = readTimeZone(req);
  if (error) return sendError(res, 400, error);

  const today = dayKey(new Date(), tz);
  const date = req.query.date === undefined ? today : req.query.date;
  if (!isValidDateKey(date)) return sendError(res, 400, 'date must be YYYY-MM-DD');

  const summary = await computeDaySummary({ user: req.user, date, tz, today });
  res.json(summary);
});

// GET /api/summary/range?from=YYYY-MM-DD&to=YYYY-MM-DD
const getRangeSummary = asyncHandler(async (req, res) => {
  const { tz, error } = readTimeZone(req);
  if (error) return sendError(res, 400, error);

  const { from, to } = req.query;
  if (!isValidDateKey(from) || !isValidDateKey(to)) {
    return sendError(res, 400, 'from and to must be YYYY-MM-DD');
  }
  if (from > to) return sendError(res, 400, 'from must be on or before to');

  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (span > MAX_RANGE_DAYS) {
    return sendError(res, 400, `range must be at most ${MAX_RANGE_DAYS} days`);
  }

  const summary = await computeRangeSummary({ user: req.user, from, to, tz });
  res.json(summary);
});

module.exports = { getDaySummary, getRangeSummary };
