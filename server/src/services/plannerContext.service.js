/**
 * Server-side planning context for the meal and activity planners (Phase 5).
 *
 * Builds on the shared fitness context (fitnessContext.service.js), so the same
 * summary, goal and plan code feeds the coach and the planners. It adds only what
 * planning needs on top: a calorie budget for the plan, and the names of today's
 * logged food (names only, no ids, notes or raw documents).
 *
 * Fail-closed: if today's totals or the trend cannot be loaded, the builder returns
 * { ok: false } and the planner request is refused. Planning without knowing what
 * the user has already eaten could exceed their limits. The activity planner also
 * fails closed when the active plan lookup fails.
 *
 * Budget rules (documented in docs/fitbot-phase-5-adaptive-planners.md):
 *   - Target: the goal calorie limit. A requested target (client preference, 800 to
 *     5000 kcal) can only lower it, never raise it above the goal.
 *   - Day 1 of a meal plan = remaining calories today, capped at the daily target.
 *     Nothing logged means remaining = the full target. Logged food reduces it.
 *   - Unusable today (remaining under MIN_USEFUL_BUDGET_KCAL, or already over target):
 *     Day 1 is planned as tomorrow at the full daily target, with no extra meals today.
 *   - Later days = the daily target.
 *
 * Read-only: nothing here writes to the database. Planned meals and workouts are
 * never logged as completed.
 */

const FoodLog = require('../models/FoodLog');
const { utcWindowFor, dayKey } = require('../utils/localDay');
const { buildFitnessContext, serializeFitnessContext } = require('./fitnessContext.service');
const { sanitizeUntrustedText } = require('../prompts/fitbot.prompt');
const { MEAL_TOLERANCE } = require('../utils/plannerLimits');
const logger = require('../utils/logger');

const PLANNER_KINDS = { mealPlan: 'meal', activityPlan: 'activity', workoutPlan: 'activity' };
const MIN_USEFUL_BUDGET_KCAL = 300;
const TARGET_RANGE = [800, 5000];
const CONSECUTIVE_LIMIT_DAYS = 2;
const MAX_FOOD_NAMES = 8;
const MAX_FOOD_NAME_CHARS = 40;
const FOOD_SCAN_LIMIT = 200;
const BASE_MAX_CHARS = 1500; // shared serializer budget; planner lines add at most ~900 more

const failed = (reason) => {
  logger.warn('[PlannerContext] planning context unavailable', { reason });
  return { ok: false, reason };
};

/** A requested calorie target is a number inside the allowed range, or null. */
const targetFromRequest = (raw) =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= TARGET_RANGE[0] && raw <= TARGET_RANGE[1]
    ? Math.round(raw)
    : null;

/** Food names are user text: flatten, strip context tags, and cap the length. */
const cleanFoodName = (name) => {
  if (typeof name !== 'string') return null;
  const flat = name.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  const text = sanitizeUntrustedText(flat, MAX_FOOD_NAME_CHARS);
  return text.length > 0 ? text : null;
};

/**
 * Keeps only entries whose local day (in tz) is `date`. The query window is a
 * little wider than a day, so this filter is what makes the list exact.
 * Pure, so it can be tested without a database.
 */
const foodNamesForDay = (docs, date, tz) =>
  docs
    .filter((d) => {
      const when = d.date || d.createdAt;
      return when ? dayKey(new Date(when), tz) === date : false;
    })
    .map((d) => d.name);

/** Today's food entries for one user, in local day `date`. Reads only. */
const loadTodayFoodNames = async ({ userId, date, tz }) => {
  const { start, end } = utcWindowFor(date, date);
  const docs = await FoodLog.find({
    user: userId,
    $or: [
      { date: { $gte: start, $lt: end } },
      { date: { $exists: false }, createdAt: { $gte: start, $lt: end } },
      { date: null, createdAt: { $gte: start, $lt: end } },
    ],
  })
    .sort({ date: 1 })
    .limit(FOOD_SCAN_LIMIT)
    .select('name date createdAt')
    .lean();
  return foodNamesForDay(docs, date, tz);
};

const foodLine = (food, names) => {
  if (!food) return 'Food logged today: none.';
  const cleaned = names.map(cleanFoodName).filter(Boolean);
  if (cleaned.length === 0) return `Food logged today: ${food.meals} meal(s), names not available.`;
  const shown = cleaned.slice(0, MAX_FOOD_NAMES).join(', ');
  const more = cleaned.length > MAX_FOOD_NAMES ? ` and ${cleaned.length - MAX_FOOD_NAMES} more` : '';
  return `Food logged today (already eaten, not part of the plan): ${shown}${more}.`;
};

/**
 * Builds the planning context for one authenticated request.
 *
 * @param {{
 *   user: object, timeZone?: string, planType: string,
 *   requestedCalories?: number, now?: Date, deps?: object
 * }} args
 * @returns {Promise<
 *   { ok: true, text: string, limits: object, budget: object } |
 *   { ok: false, reason: string }
 * >}
 */
const buildPlannerContext = async ({
  user,
  timeZone,
  planType,
  requestedCalories,
  now = new Date(),
  deps = {},
}) => {
  const kind = PLANNER_KINDS[planType];
  if (!kind) return failed('unsupported planType');

  let ctx;
  let foodNames = [];
  try {
    ctx = await buildFitnessContext({ user, timeZone, now, deps });
    if (ctx.today.status !== 'ok' || ctx.trend.status !== 'ok') return failed('core data unavailable');
    if (kind === 'activity' && ctx.plan.status === 'unavailable') return failed('plan unavailable');
    if (kind === 'meal') {
      const loadNames = deps.loadTodayFoodNames || loadTodayFoodNames;
      foodNames = await loadNames({
        userId: user._id,
        date: ctx.localTime.date,
        tz: ctx.localTime.timeZone,
      });
    }
  } catch (err) {
    return failed(err?.name || 'Error');
  }

  const goals = ctx.profile.goals;
  const requested = targetFromRequest(requestedCalories);
  const dailyTarget = requested === null ? goals.calorieLimit : Math.min(requested, goals.calorieLimit);
  const food = ctx.today.food;
  const eaten = food ? food.calories : 0;
  const remainingKcal = goals.calorieLimit - eaten;
  const todayUsable = remainingKcal >= MIN_USEFUL_BUDGET_KCAL;
  const day1Kcal = todayUsable ? Math.min(dailyTarget, remainingKcal) : dailyTarget;

  const base = serializeFitnessContext(ctx, { maxChars: BASE_MAX_CHARS }).text;
  const lines = [];
  let limits;

  if (kind === 'meal') {
    lines.push('Planner request: meal plan.');
    lines.push(foodLine(food, foodNames));
    if (todayUsable) {
      lines.push(
        `Calorie budget: Day 1 (remaining today) ${day1Kcal} kcal; each later day ${dailyTarget} kcal. ` +
          'These are upper limits.'
      );
    } else {
      const why = remainingKcal <= 0
        ? 'today is already at or over the calorie target'
        : `only ${remainingKcal} kcal remain today, too little for a full plan`;
      lines.push(
        `Calorie budget: ${why}. Plan Day 1 as tomorrow at ${dailyTarget} kcal, with no extra meals for today. ` +
          `Each later day ${dailyTarget} kcal. These are upper limits.`
      );
    }
    lines.push(
      food
        ? `Remaining macros today: protein ${Math.max(0, goals.proteinGoal - food.protein)} g, ` +
          `carbs ${Math.max(0, goals.carbsGoal - food.carbs)} g, fat ${Math.max(0, goals.fatGoal - food.fat)} g.`
        : 'Remaining macros today: full targets apply, because nothing is logged yet.'
    );
    if (requested !== null) {
      lines.push(
        `Requested daily target: ${requested} kcal${requested > goals.calorieLimit ? ' (capped at your goal)' : ''}.`
      );
    }
    limits = {
      kind: 'meal',
      day1Kcal,
      laterKcal: dailyTarget,
      tolerance: MEAL_TOLERANCE,
    };
  } else {
    const run = ctx.trend.consecutiveTraining;
    const streakLimit = Boolean(run && run.days >= CONSECUTIVE_LIMIT_DAYS);
    lines.push('Planner request: activity plan.');
    lines.push(
      streakLimit
        ? `Planning limit: ${run.days} consecutive training days (${run.endsOn}), so Day 1 must not include high-intensity activities.`
        : 'Planning limit: no streak-based limit.'
    );
    limits = { kind: 'activity', noHighIntensityDay1: streakLimit };
  }

  const text = [base, ...lines].join('\n');
  const budget = {
    remainingKcal,
    day1Kcal,
    dailyTarget,
    todayUsable,
    requestedKcal: requested,
  };
  return { ok: true, text, limits, budget };
};

module.exports = {
  buildPlannerContext,
  foodNamesForDay,
  loadTodayFoodNames,
  targetFromRequest,
  cleanFoodName,
  PLANNER_KINDS,
  MIN_USEFUL_BUDGET_KCAL,
  TARGET_RANGE,
};
