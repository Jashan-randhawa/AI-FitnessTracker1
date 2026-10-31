/**
 * Local-calendar-day helpers. All day buckets are computed in the user's
 * IANA timezone (sent by the client as the X-Timezone header), so a meal
 * logged at 23:50 local time counts toward that local day, not the UTC day.
 */

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const isValidTimeZone = (tz) => {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const isValidDateKey = (value) => {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
};

/** Local calendar day (YYYY-MM-DD) that `date` falls on in timezone `tz`. */
const dayKey = (date, tz) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

/** Adds `n` calendar days to a YYYY-MM-DD key (pure calendar arithmetic). */
const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** All day keys from `from` to `to` inclusive. */
const rangeKeys = (from, to) => {
  const keys = [];
  for (let k = from; k <= to; k = addDays(k, 1)) keys.push(k);
  return keys;
};

/**
 * A UTC window guaranteed to contain every instant of local days from..to in
 * any timezone (offsets run from UTC-12 to UTC+14). Rows are then filtered to
 * the exact local days after grouping.
 */
const utcWindowFor = (from, to) => {
  const HOUR = 3600 * 1000;
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - 14 * HOUR),
    end: new Date(Date.parse(`${addDays(to, 1)}T00:00:00Z`) + 14 * HOUR),
  };
};

/**
 * Validates a date for offline-logging replay.
 * Must not be more than 5 minutes in the future, nor older than OFFLINE_MAX_AGE_DAYS (default 30).
 */
const validateLogDate = (rawDate) => {
  const logDate = rawDate ? new Date(rawDate) : new Date();
  if (isNaN(logDate.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  const now = Date.now();
  const maxFuture = now + 5 * 60 * 1000;
  const maxAgeDays = parseInt(process.env.OFFLINE_MAX_AGE_DAYS, 10) || 30;
  const maxPast = now - maxAgeDays * 24 * 60 * 60 * 1000;

  if (logDate.getTime() > maxFuture) {
    return {
      valid: false,
      error: 'Date cannot be more than 5 minutes in the future',
      code: 'DATE_OUT_OF_RANGE',
    };
  }
  if (logDate.getTime() < maxPast) {
    return {
      valid: false,
      error: `Date cannot be older than ${maxAgeDays} days`,
      code: 'DATE_OUT_OF_RANGE',
    };
  }
  return { valid: true, date: logDate };
};

module.exports = {
  isValidTimeZone,
  isValidDateKey,
  dayKey,
  addDays,
  rangeKeys,
  utcWindowFor,
  validateLogDate,
};
