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

/**
 * Deterministic BMR and goal suggestion formula (Mifflin-St Jeor).
 *
 * @param {{ age?: number, weight?: number, height?: number, gender?: string, activityLevel?: string, goal?: string }} input
 * @returns {{ calorieIntake: number, calorieBurn: number, explanation: string } | null}
 */
const calculateGoalSuggestion = (input = {}) => {
  const { age, weight, height, gender = 'other', activityLevel = 'moderate', goal = 'maintain' } = input;
  if (!age || !weight || !height || age <= 0 || weight <= 0 || height <= 0) {
    return null;
  }

  // Mifflin-St Jeor Equation
  let bmr;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === 'female') {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // Unspecified / other midpoint
    bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  }

  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const multiplier = activityMultipliers[activityLevel] || 1.55;
  const tdee = bmr * multiplier;

  let targetCalories = tdee;
  if (goal === 'lose') {
    targetCalories = tdee - 500;
  } else if (goal === 'gain') {
    targetCalories = tdee + 350;
  }

  // Safe bounds: Clinical minimum 1200 kcal (female/other), 1500 kcal (male); max 4000 kcal
  const minSafe = gender === 'male' ? 1500 : 1200;
  const clampedCalories = Math.round(Math.min(4000, Math.max(minSafe, targetCalories)));

  const burnSuggestions = {
    sedentary: 300,
    light: 350,
    moderate: 450,
    active: 550,
    very_active: 650,
  };
  const calorieBurn = burnSuggestions[activityLevel] || 400;

  const goalDescriptions = {
    lose: '500 kcal deficit for weight loss',
    gain: '350 kcal surplus for muscle gain',
    maintain: 'maintenance calories',
  };
  const goalDesc = goalDescriptions[goal] || 'maintenance';

  return {
    calorieIntake: clampedCalories,
    calorieBurn,
    explanation: `Based on your profile (BMR: ${Math.round(bmr)} kcal, TDEE: ${Math.round(tdee)} kcal), targeted for ${goalDesc}.`,
  };
};

module.exports = {
  deriveGoals,
  calculateGoalSuggestion,
  DEFAULT_CALORIE_INTAKE,
  DEFAULT_CALORIE_BURN,
  DEFAULT_WATER_GOAL,
};
