/**
 * Server-side port of client/src/utils/deriveGoals.ts. This is now the single
 * implementation the summary endpoints use; the client reads the result
 * instead of deriving its own copy (Phase 3).
 *
 * Keep the defaults and macro split identical to the client until the
 * client copy is removed, or parity tests will fail.
 */

const DEFAULT_CALORIE_INTAKE = 2000;
const DEFAULT_CALORIE_BURN = 400;
const DEFAULT_WATER_GOAL = 2500;

const positiveOr = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const deriveGoals = (user) => {
  const calorieLimit = positiveOr(user?.dailycaloriesintake, DEFAULT_CALORIE_INTAKE);
  const calorieBurnGoal = positiveOr(user?.dailycaloriesburned, DEFAULT_CALORIE_BURN);

  return {
    calorieLimit,
    calorieBurnGoal,
    proteinGoal: positiveOr(user?.dailyproteingoal, Math.round((calorieLimit * 0.3) / 4)),
    carbsGoal: positiveOr(user?.dailycarbsgoal, Math.round((calorieLimit * 0.4) / 4)),
    fatGoal: positiveOr(user?.dailyfatgoal, Math.round((calorieLimit * 0.3) / 9)),
    waterGoal: positiveOr(user?.dailywatergoal, DEFAULT_WATER_GOAL),
  };
};

module.exports = { deriveGoals, DEFAULT_CALORIE_INTAKE, DEFAULT_CALORIE_BURN, DEFAULT_WATER_GOAL };
