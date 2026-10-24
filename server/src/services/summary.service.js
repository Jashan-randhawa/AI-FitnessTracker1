/**
 * Single source of truth for daily totals, streaks and goals.
 *
 * Totals are aggregated in MongoDB and grouped by the user's local calendar
 * day (Mongo's $dateToString with an IANA timezone). The client and the
 * FitBot context both read from here, so they cannot disagree.
 */

const FoodLog = require('../models/FoodLog');
const ActivityLog = require('../models/ActivityLog');
const WaterLog = require('../models/WaterLog');
const { deriveGoals } = require('../utils/goals');
const {
  dayKey,
  addDays,
  rangeKeys,
  utcWindowFor,
} = require('../utils/localDay');

const MAX_STREAK_DAYS = 366;

/**
 * Achievement rules. These mirror the client's badge list (labels and icons
 * live on the client). Targets and ids must stay in step with it.
 */
const BADGE_RULES = [
  { id: 'first_log', target: 1, value: (c) => c.foodCount },
  { id: 'streak_3', target: 3, value: (c) => c.streak },
  { id: 'streak_7', target: 7, value: (c) => c.streak },
  { id: 'workouts_10', target: 10, value: (c) => c.activityCount },
  { id: 'food_50', target: 50, value: (c) => c.foodCount },
  { id: 'workouts_25', target: 25, value: (c) => c.activityCount },
  { id: 'streak_30', target: 30, value: (c) => c.streak },
];

/** Pure: achievement state from lifetime counts and the current streak. */
const computeBadges = ({ foodCount, activityCount, streak }) =>
  BADGE_RULES.map((rule) => {
    const value = rule.value({ foodCount, activityCount, streak });
    return {
      id: rule.id,
      earned: value >= rule.target,
      current: Math.min(value, rule.target),
      target: rule.target,
    };
  });

/** Logs without a `date` fall back to `createdAt`, matching the client today. */
const bucketExpr = (tz) => ({
  $dateToString: {
    format: '%Y-%m-%d',
    date: { $ifNull: ['$date', '$createdAt'] },
    timezone: tz,
  },
});

const windowMatch = (userId, from, to) => {
  const { start, end } = utcWindowFor(from, to);
  return {
    user: userId,
    $or: [
      { date: { $gte: start, $lt: end } },
      { date: { $exists: false }, createdAt: { $gte: start, $lt: end } },
      { date: null, createdAt: { $gte: start, $lt: end } },
    ],
  };
};

/** Pipelines are exported so tests can assert their shape without a database. */
const buildFoodPipeline = (userId, from, to, tz) => [
  { $match: windowMatch(userId, from, to) },
  {
    $group: {
      _id: bucketExpr(tz),
      calories: { $sum: { $ifNull: ['$calories', 0] } },
      protein: { $sum: { $ifNull: ['$protein', 0] } },
      carbs: { $sum: { $ifNull: ['$carbs', 0] } },
      fat: { $sum: { $ifNull: ['$fat', 0] } },
      meals: { $sum: 1 },
    },
  },
];

const buildActivityPipeline = (userId, from, to, tz) => [
  { $match: windowMatch(userId, from, to) },
  {
    $group: {
      _id: bucketExpr(tz),
      burnedKcal: { $sum: { $ifNull: ['$calories', 0] } },
      minutes: { $sum: { $ifNull: ['$duration', 0] } },
      count: { $sum: 1 },
    },
  },
];

const buildWaterPipeline = (userId, from, to, tz) => [
  { $match: windowMatch(userId, from, to) },
  {
    $group: {
      _id: bucketExpr(tz),
      ml: { $sum: { $ifNull: ['$amount', 0] } },
    },
  },
];

const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

const emptyRow = (date) => ({
  date,
  food: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
  activity: { burnedKcal: 0, minutes: 0, count: 0 },
  waterMl: 0,
});

/**
 * Pure: merges the three grouped results into one row per local day, keeping
 * only days inside [from, to].
 */
const mergeRows = (days, foodRows, activityRows, waterRows) => {
  const byDate = new Map(days.map((d) => [d, emptyRow(d)]));

  for (const r of foodRows) {
    const row = byDate.get(r._id);
    if (!row) continue;
    row.food = {
      calories: Math.round(r.calories),
      protein: round1(r.protein),
      carbs: round1(r.carbs),
      fat: round1(r.fat),
      meals: r.meals,
    };
  }
  for (const r of activityRows) {
    const row = byDate.get(r._id);
    if (!row) continue;
    row.activity = {
      burnedKcal: Math.round(r.burnedKcal),
      minutes: Math.round(r.minutes),
      count: r.count,
    };
  }
  for (const r of waterRows) {
    const row = byDate.get(r._id);
    if (!row) continue;
    row.waterMl = Math.round(r.ml);
  }

  return days.map((d) => byDate.get(d));
};

/**
 * Pure: consecutive days with logged food or activity, counting back from
 * `today`. If today has nothing yet, the streak starts from yesterday, so
 * morning users are not shown a broken streak. Capped at 366 days.
 */
const computeStreak = (loggedDays, today) => {
  const logged = new Set(loggedDays);
  let cursor = logged.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (streak < MAX_STREAK_DAYS && logged.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};

const hasLoggedData = (row) => row.food.meals > 0 || row.activity.count > 0;

/** Runs the three aggregations for a window of local days. */
const aggregateRange = async (userId, from, to, tz) => {
  const days = rangeKeys(from, to);
  const [foodRows, activityRows, waterRows] = await Promise.all([
    FoodLog.aggregate(buildFoodPipeline(userId, from, to, tz)),
    ActivityLog.aggregate(buildActivityPipeline(userId, from, to, tz)),
    WaterLog.aggregate(buildWaterPipeline(userId, from, to, tz)),
  ]);
  return mergeRows(days, foodRows, activityRows, waterRows);
};

/**
 * Summary for one local day, plus the streak counted up to that day.
 * @param {{ user: object, date: string, tz: string, today: string }} args
 */
const computeDaySummary = async ({ user, date, tz, today }) => {
  const userId = user._id;
  // The streak looks back a full year, so fetch one window that covers it.
  const streakFrom = addDays(date, -(MAX_STREAK_DAYS - 1));
  const rows = await aggregateRange(userId, streakFrom, date, tz);
  const day = rows[rows.length - 1];

  const loggedDays = rows.filter(hasLoggedData).map((r) => r.date);
  const streak = computeStreak(loggedDays, date);

  // Lifetime counts drive the achievements, which are not limited to a window.
  const [foodCount, activityCount] = await Promise.all([
    FoodLog.countDocuments({ user: userId }),
    ActivityLog.countDocuments({ user: userId }),
  ]);

  return {
    timezone: tz,
    date,
    isToday: date === today,
    goals: deriveGoals(user),
    food: day.food,
    activity: day.activity,
    waterMl: day.waterMl,
    streak,
    lifetime: { foodCount, activityCount },
    badges: computeBadges({ foodCount, activityCount, streak }),
  };
};

/**
 * One row per local day across [from, to], with the goals once at top level.
 * @param {{ user: object, from: string, to: string, tz: string }} args
 */
const computeRangeSummary = async ({ user, from, to, tz }) => {
  const days = await aggregateRange(user._id, from, to, tz);
  return {
    timezone: tz,
    from,
    to,
    goals: deriveGoals(user),
    days: days.map((d) => ({
      date: d.date,
      food: d.food,
      activity: d.activity,
      waterMl: d.waterMl,
    })),
  };
};

module.exports = {
  computeDaySummary,
  computeRangeSummary,
  computeStreak,
  mergeRows,
  buildFoodPipeline,
  buildActivityPipeline,
  buildWaterPipeline,
  MAX_STREAK_DAYS,
  computeBadges,
  // Re-exported so callers that need "today" in a timezone use one helper.
  todayKey: (tz, now = new Date()) => dayKey(now, tz),
};
