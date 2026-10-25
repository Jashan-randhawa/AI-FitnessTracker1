/**
 * Shared server-side fitness context (Phase 2).
 *
 * One trusted, user-scoped snapshot of profile, goals, today's totals, a
 * seven-day trend, streak, and the active workout plan. Numbers come from the
 * existing summary and goal code (computeDaySummary, computeRangeSummary,
 * deriveGoals), so AI features cannot disagree with the dashboard.
 *
 * Contract (CONTEXT_SCHEMA_VERSION 1):
 *   {
 *     schemaVersion: 1,
 *     generatedAt: ISO string,
 *     localTime: { date: 'YYYY-MM-DD', time: 'HH:mm', timeZone, timeZoneSource },
 *     profile: { goal, weightKg, heightCm, age, goals, goalsSet },
 *     today: { status, date, food, activity, waterMl, streakDays },
 *     trend: { status, days[], averages, loggedDays },
 *     plan: { status, plan },
 *   }
 * Section `status` values: 'ok' (data present, may be empty), 'none' (plan
 * only: no active plan), 'unavailable' (the lookup failed; values are null).
 * In `today` and `trend`, a category with no entries is `null`, never 0.
 *
 * Identity: the caller passes the authenticated user (req.user). Every query is
 * scoped to user._id. No user id is read from the request body or the context.
 *
 * Nothing here is sent to a model directly. serializeFitnessContext turns the
 * object into bounded, sanitized text for prompt builders.
 */

const WorkoutPlan = require('../models/WorkoutPlan');
const { computeDaySummary, computeRangeSummary } = require('./summary.service');
const { deriveGoals } = require('../utils/goals');
const { isValidTimeZone, dayKey, addDays } = require('../utils/localDay');
const { sanitizeUntrustedText } = require('../prompts/fitbot.prompt');
const logger = require('../utils/logger');

const CONTEXT_SCHEMA_VERSION = 1;
const DEFAULT_TIME_ZONE = 'UTC';
const TREND_DAYS = 7;
// Minimum logged days before weekly patterns are described. Below this, the context says
// the evidence is insufficient so the model does not generalise from a few entries.
const EVIDENCE_MIN_DAYS = { food: 4, activity: 3, water: 4 };
const MAX_PLAN_DAYS = 7;
const MAX_PROMPT_CHARS = 2000;
const TRUNCATION_NOTE = 'Some context was omitted to keep this prompt bounded.';
const GOAL_VALUES = ['lose', 'maintain', 'gain'];
const PLAN_FIELDS =
  'title goal level daysPerWeek split days.day days.focus days.duration days.exercises updatedAt';

// Plausible ranges mirror the client's validateNumericMetric bounds.
const WEIGHT_RANGE = [20, 400];
const HEIGHT_RANGE = [50, 260];
const AGE_RANGE = [10, 120];

const isPositiveNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const numberInRange = (value, [min, max]) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;

/** Free text from the user (plan titles and names) is untrusted: flatten and strip tags. */
const cleanText = (value, maxLen) => {
  if (typeof value !== 'string') return null;
  const flat = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  const text = sanitizeUntrustedText(flat, maxLen);
  return text.length > 0 ? text : null;
};

const average = (values) =>
  values.length === 0
    ? null
    : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

/**
 * Resolves the X-Timezone header. Absent or empty means UTC ('default').
 * An invalid zone also falls back to UTC, marked 'fallback', instead of failing
 * the whole context. The summary endpoints still return 400 for bad headers.
 */
const resolveTimeZone = (raw) => {
  if (raw === undefined || raw === null || raw === '') {
    return { timeZone: DEFAULT_TIME_ZONE, source: 'default' };
  }
  const candidate = typeof raw === 'string' ? raw.trim() : '';
  if (candidate && isValidTimeZone(candidate)) {
    return { timeZone: candidate, source: 'header' };
  }
  return { timeZone: DEFAULT_TIME_ZONE, source: 'fallback' };
};

/** Local wall-clock time as HH:mm in the given zone (24-hour, never "24:xx"). */
const formatLocalTime = (now, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
};

const buildProfile = (user) => {
  const goals = deriveGoals(user);
  return {
    goal: GOAL_VALUES.includes(user.goal) ? user.goal : null,
    weightKg: numberInRange(user.weight, WEIGHT_RANGE),
    heightCm: numberInRange(user.height, HEIGHT_RANGE),
    age: (() => {
      const age = numberInRange(user.age, AGE_RANGE);
      return age === null ? null : Math.floor(age);
    })(),
    goals,
    // Tells a consumer whether a target was set by the user or is a default.
    goalsSet: {
      calorieIntake: isPositiveNumber(user.dailycaloriesintake),
      calorieBurn: isPositiveNumber(user.dailycaloriesburned),
      protein: isPositiveNumber(user.dailyproteingoal),
      carbs: isPositiveNumber(user.dailycarbsgoal),
      fat: isPositiveNumber(user.dailyfatgoal),
      water: isPositiveNumber(user.dailywatergoal),
    },
  };
};

const buildToday = (summary) => ({
  status: 'ok',
  date: summary.date,
  food:
    summary.food.meals > 0
      ? {
          calories: summary.food.calories,
          protein: summary.food.protein,
          carbs: summary.food.carbs,
          fat: summary.food.fat,
          meals: summary.food.meals,
        }
      : null,
  activity:
    summary.activity.count > 0
      ? {
          burnedKcal: summary.activity.burnedKcal,
          minutes: summary.activity.minutes,
          sessions: summary.activity.count,
        }
      : null,
  waterMl: summary.waterMl > 0 ? summary.waterMl : null,
  streakDays: summary.streak,
});

const unavailableToday = (date) => ({
  status: 'unavailable',
  date,
  food: null,
  activity: null,
  waterMl: null,
  streakDays: null,
});

/**
 * Consecutive days with logged activity, counted back from today. If today has
 * no activity yet, the run is counted from yesterday, so a morning user does not
 * see a broken run. Returns null when there is no run.
 */
const consecutiveTraining = (days) => {
  if (days.length === 0) return null;
  let index = days.length - 1;
  let endsOn = 'today';
  if (!days[index].activity) {
    index -= 1;
    endsOn = 'yesterday';
  }
  let count = 0;
  while (index >= 0 && days[index].activity) {
    count += 1;
    index -= 1;
  }
  return count > 0 ? { days: count, endsOn } : null;
};

const buildTrend = (range) => {
  const days = range.days.map((d) => ({
    date: d.date,
    food: d.food.meals > 0 ? { calories: d.food.calories, meals: d.food.meals } : null,
    activity:
      d.activity.count > 0
        ? { burnedKcal: d.activity.burnedKcal, sessions: d.activity.count }
        : null,
    waterMl: d.waterMl > 0 ? d.waterMl : null,
  }));

  const foodDays = days.filter((d) => d.food);
  const activityDays = days.filter((d) => d.activity);
  const waterDays = days.filter((d) => d.waterMl !== null);

  return {
    status: 'ok',
    days,
    consecutiveTraining: consecutiveTraining(days),
    evidence: {
      food: foodDays.length >= EVIDENCE_MIN_DAYS.food,
      activity: activityDays.length >= EVIDENCE_MIN_DAYS.activity,
      water: waterDays.length >= EVIDENCE_MIN_DAYS.water,
    },
    // Averages are over logged days only. Days with no entries are excluded.
    averages: {
      foodCaloriesPerLoggedDay: average(foodDays.map((d) => d.food.calories)),
      burnedKcalPerLoggedDay: average(activityDays.map((d) => d.activity.burnedKcal)),
      waterMlPerLoggedDay: average(waterDays.map((d) => d.waterMl)),
    },
    loggedDays: {
      food: foodDays.length,
      activity: activityDays.length,
      water: waterDays.length,
    },
  };
};

const unavailableTrend = () => ({
  status: 'unavailable',
  days: [],
  consecutiveTraining: null,
  evidence: null,
  averages: null,
  loggedDays: null,
});

const buildPlan = (plan) => {
  if (!plan) return { status: 'none', plan: null };
  const days = Array.isArray(plan.days) ? plan.days : [];
  return {
    status: 'ok',
    plan: {
      title: cleanText(plan.title, 60),
      goal: cleanText(plan.goal, 40),
      level: cleanText(plan.level, 40),
      daysPerWeek: numberInRange(plan.daysPerWeek, [1, 7]),
      split: cleanText(plan.split, 60),
      totalDays: days.length,
      days: days.slice(0, MAX_PLAN_DAYS).map((d) => ({
        day: cleanText(d?.day, 20),
        focus: cleanText(d?.focus, 60),
        duration: cleanText(d?.duration, 20),
        exerciseCount: Array.isArray(d?.exercises) ? d.exercises.length : 0,
      })),
    },
  };
};

/** Active plan for one user. Mirrors GET /api/workout-plans/active. */
const findActivePlan = (userId) =>
  WorkoutPlan.findOne({ user: userId, isActive: true })
    .sort({ updatedAt: -1 })
    .select(PLAN_FIELDS)
    .lean();

/** Runs fn and turns a synchronous throw into a rejected promise, for allSettled. */
const attempt = (fn) => new Promise((resolve) => resolve(fn()));

/**
 * Builds the context for one authenticated user.
 *
 * Query count is fixed: one day summary (its aggregations and two counts), one
 * seven-day range summary, and one plan lookup. Nothing scales with history.
 *
 * @param {{ user: object, timeZone?: string, now?: Date, deps?: object }} args
 *   `user` is the authenticated user document (req.user). `timeZone` is the raw
 *   X-Timezone value. `deps` is for tests and overrides the three loaders.
 * @returns {Promise<object>} the context object described in the file header
 */
const buildFitnessContext = async ({ user, timeZone, now = new Date(), deps = {} }) => {
  if (!user || !user._id) {
    throw new Error('buildFitnessContext requires an authenticated user');
  }

  const loadDay = deps.computeDaySummary || computeDaySummary;
  const loadRange = deps.computeRangeSummary || computeRangeSummary;
  const loadPlan = deps.findActivePlan || findActivePlan;

  const { timeZone: tz, source } = resolveTimeZone(timeZone);
  const today = dayKey(now, tz);
  const trendFrom = addDays(today, -(TREND_DAYS - 1));

  const [day, range, plan] = await Promise.allSettled([
    attempt(() => loadDay({ user, date: today, tz, today })),
    attempt(() => loadRange({ user, from: trendFrom, to: today, tz })),
    attempt(() => loadPlan(user._id)),
  ]);

  const failed = (name, result) => {
    if (result.status === 'rejected') {
      // Log the error name only: messages can echo query details.
      logger.warn('[FitnessContext] section unavailable', {
        section: name,
        error: result.reason?.name || 'Error',
      });
    }
  };
  failed('today', day);
  failed('trend', range);
  failed('plan', plan);

  const planSection =
    plan.status === 'fulfilled'
      ? buildPlan(plan.value)
      : { status: 'unavailable', plan: null };

  return {
    schemaVersion: CONTEXT_SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    localTime: {
      date: today,
      time: formatLocalTime(now, tz),
      timeZone: tz,
      timeZoneSource: source,
    },
    profile: buildProfile(user),
    today: day.status === 'fulfilled' ? buildToday(day.value) : unavailableToday(today),
    trend: range.status === 'fulfilled' ? buildTrend(range.value) : unavailableTrend(),
    plan: planSection,
  };
};

// ---------------------------------------------------------------------------
// Serialization for prompts
// ---------------------------------------------------------------------------

const or = (value, fallback) => (value === null || value === undefined ? fallback : value);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const profileLine = (profile) => {
  const parts = [];
  const missing = [];
  if (profile.goal) parts.push(`goal ${profile.goal} weight`);
  else missing.push('goal');
  if (profile.weightKg !== null) parts.push(`weight ${profile.weightKg} kg`);
  else missing.push('weight');
  if (profile.heightCm !== null) parts.push(`height ${profile.heightCm} cm`);
  else missing.push('height');
  if (profile.age !== null) parts.push(`age ${profile.age} years`);
  else missing.push('age');
  const known = parts.length ? parts.join(', ') : 'none';
  // Name the gaps only when there are some, so a complete profile does not end in "Not provided: .".
  const gaps = missing.length ? ` Not provided: ${missing.join(', ')}.` : '';
  return `Profile: ${known}.${gaps}`;
};

const targetsLine = (profile) => {
  const g = profile.goals;
  const s = profile.goalsSet;
  const label = (isSet) => (isSet ? 'set' : 'default');
  return (
    `Targets: calorie intake ${g.calorieLimit} kcal (${label(s.calorieIntake)}), ` +
    `calorie burn ${g.calorieBurnGoal} kcal (${label(s.calorieBurn)}), ` +
    `protein ${g.proteinGoal} g (${label(s.protein)}), ` +
    `carbs ${g.carbsGoal} g (${label(s.carbs)}), ` +
    `fat ${g.fatGoal} g (${label(s.fat)}), ` +
    `water ${g.waterGoal} ml (${label(s.water)}).`
  );
};

const todayLine = (today, goals) => {
  if (today.status === 'unavailable') return 'Today so far: unavailable.';
  const food = today.food
    ? `food ${today.food.calories} kcal over ${plural(today.food.meals, 'meal')} ` +
      `(protein ${today.food.protein} g, carbs ${today.food.carbs} g, fat ${today.food.fat} g)`
    : 'no food logged';
  const activity = today.activity
    ? `activity ${today.activity.burnedKcal} kcal burned in ${today.activity.minutes} min ` +
      `over ${plural(today.activity.sessions, 'session')}`
    : 'no activity logged';
  const water =
    today.waterMl !== null
      ? `water ${today.waterMl} ml of ${goals.waterGoal} ml goal`
      : `no water logged yet (goal ${goals.waterGoal} ml)`;
  const streak = `streak ${plural(today.streakDays, 'day')}`;

  // Remaining targets are shown only when food has been logged. With nothing logged,
  // "remaining" would be a guess.
  const kcalDelta = today.food ? goals.calorieLimit - today.food.calories : null;
  const kcalText =
    kcalDelta === null
      ? null
      : kcalDelta >= 0
        ? `${kcalDelta} kcal left`
        : `${-kcalDelta} kcal over target`;
  const proteinLeft = today.food ? Math.max(0, goals.proteinGoal - today.food.protein) : null;
  const remaining = today.food
    ? `Remaining today: ${kcalText}, protein ${proteinLeft} g left.`
    : 'Remaining today: unknown, because no food is logged yet.';

  return `Today so far: ${food}; ${activity}; ${water}; ${streak}. ${remaining}`;
};

const trainingLine = (trend) => {
  if (trend.status === 'unavailable') return 'Recent training: unavailable.';
  const run = trend.consecutiveTraining;
  if (!run) return `Recent training: no activity logged in the last ${TREND_DAYS} days.`;
  const when = run.endsOn === 'today' ? 'through today' : 'through yesterday';
  return `Recent training: ${plural(run.days, 'consecutive day')} with logged activity, ${when}.`;
};

const trendLine = (trend) => {
  if (trend.status === 'unavailable') return `Last ${TREND_DAYS} days: unavailable.`;
  const first = trend.days[0]?.date;
  const last = trend.days[trend.days.length - 1]?.date;
  const a = trend.averages;
  const l = trend.loggedDays;
  const e = trend.evidence;
  const avg = (value, unit) => (value === null ? 'no average' : `average ${value} ${unit}`);
  const verdict = (ok) => (ok ? 'sufficient' : 'insufficient');
  return (
    `Last ${TREND_DAYS} days (${first} to ${last}): ` +
    `food logged on ${l.food} days (${avg(a.foodCaloriesPerLoggedDay, 'kcal per logged day')}); ` +
    `activity on ${l.activity} days (${avg(a.burnedKcalPerLoggedDay, 'kcal burned per logged day')}); ` +
    `water on ${l.water} days (${avg(a.waterMlPerLoggedDay, 'ml per logged day')}). ` +
    `Evidence for weekly patterns: food ${verdict(e.food)}, activity ${verdict(e.activity)}, ` +
    `water ${verdict(e.water)}.`
  );
};

const planLine = (plan) => {
  if (plan.status === 'none') return 'Active workout plan: none.';
  if (plan.status === 'unavailable') return 'Active workout plan: unavailable.';
  const p = plan.plan;
  const header =
    `Active workout plan: "${or(p.title, 'untitled')}" ` +
    `(${or(p.daysPerWeek, '?')} days per week, split ${or(p.split, 'unspecified')}).`;
  const days = p.days
    .map(
      (d) =>
        `${or(d.day, 'Day')}: ${or(d.focus, 'focus unspecified')} ` +
        `(${or(d.duration, 'duration unspecified')}, ${plural(d.exerciseCount, 'exercise')})`
    )
    .join('; ');
  const shown = p.totalDays > p.days.length ? ` First ${p.days.length} of ${p.totalDays} days shown.` : '';
  return `${header} Days: ${days || 'none listed'}.${shown}`;
};

/**
 * Turns a context object into prompt text. Lines are added in priority order
 * (local time, profile, targets, today, trend, plan). Lines are added whole, so
 * text is never cut mid-line. When a line would overflow, it and everything
 * after it are dropped and a truncation note is added.
 *
 * @param {object} ctx
 * @param {{ maxChars?: number }} [options]
 * @returns {{ text: string, truncated: boolean }}
 */
const serializeFitnessContext = (ctx, { maxChars = MAX_PROMPT_CHARS } = {}) => {
  const lines = [
    `Local time: ${ctx.localTime.date} ${ctx.localTime.time} (${ctx.localTime.timeZone}).`,
    profileLine(ctx.profile),
    targetsLine(ctx.profile),
    todayLine(ctx.today, ctx.profile.goals),
    trainingLine(ctx.trend),
    trendLine(ctx.trend),
    planLine(ctx.plan),
  ];

  const joined = (arr) => arr.join('\n');
  const kept = [];
  let truncated = false;

  for (const line of lines) {
    if (joined([...kept, line]).length <= maxChars) {
      kept.push(line);
    } else {
      truncated = true;
      break;
    }
  }

  if (truncated) {
    while (kept.length && joined([...kept, TRUNCATION_NOTE]).length > maxChars) {
      kept.pop();
    }
    if (joined([TRUNCATION_NOTE]).length <= maxChars) kept.push(TRUNCATION_NOTE);
  }

  return { text: joined(kept), truncated };
};

/**
 * Builds the bounded fitness-context text for one request. Never throws: a total
 * failure becomes an explicit "unavailable" line, not an empty or zero context.
 * @returns {Promise<string>}
 */
const buildFitnessPromptContext = async ({ user, timeZone, now = new Date(), deps = {} }) => {
  try {
    const ctx = await buildFitnessContext({ user, timeZone, now, deps });
    return serializeFitnessContext(ctx).text;
  } catch (err) {
    logger.warn('[FitnessContext] context unavailable for this request', { error: err?.name || 'Error' });
    return 'Fitness data: unavailable for this request.';
  }
};

module.exports = {
  EVIDENCE_MIN_DAYS,
  buildFitnessPromptContext,
  CONTEXT_SCHEMA_VERSION,
  DEFAULT_TIME_ZONE,
  TREND_DAYS,
  MAX_PLAN_DAYS,
  MAX_PROMPT_CHARS,
  TRUNCATION_NOTE,
  resolveTimeZone,
  formatLocalTime,
  findActivePlan,
  buildFitnessContext,
  serializeFitnessContext,
};
