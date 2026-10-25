import type { User } from "../assets/types";

export interface DerivedGoals {
  calorieLimit: number;
  calorieBurnGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterGoal: number;
}

export const DEFAULT_CALORIE_INTAKE = 2000;
export const DEFAULT_CALORIE_BURN = 400;
export const DEFAULT_WATER_GOAL = 2500;

/**
 * Derives daily macro and water targets for a user.
 * If individual macro goals are unset or 0, derives them from dailycaloriesintake:
 * - 30% protein (4 kcal/g)
 * - 40% carbs (4 kcal/g)
 * - 30% fat (9 kcal/g)
 * Water defaults to 2500 ml if unset.
 */
export const deriveGoals = (user?: User | null): DerivedGoals => {
  const calorieLimit =
    user?.dailycaloriesintake && user.dailycaloriesintake > 0
      ? user.dailycaloriesintake
      : DEFAULT_CALORIE_INTAKE;

  const calorieBurnGoal =
    user?.dailycaloriesburned && user.dailycaloriesburned > 0
      ? user.dailycaloriesburned
      : DEFAULT_CALORIE_BURN;

  const defaultProtein = Math.round((calorieLimit * 0.3) / 4);
  const defaultCarbs = Math.round((calorieLimit * 0.4) / 4);
  const defaultFat = Math.round((calorieLimit * 0.3) / 9);

  const proteinGoal =
    user?.dailyproteingoal && user.dailyproteingoal > 0
      ? user.dailyproteingoal
      : defaultProtein;

  const carbsGoal =
    user?.dailycarbsgoal && user.dailycarbsgoal > 0
      ? user.dailycarbsgoal
      : defaultCarbs;

  const fatGoal =
    user?.dailyfatgoal && user.dailyfatgoal > 0
      ? user.dailyfatgoal
      : defaultFat;

  const waterGoal =
    user?.dailywatergoal && user.dailywatergoal > 0
      ? user.dailywatergoal
      : DEFAULT_WATER_GOAL;

  return {
    calorieLimit,
    calorieBurnGoal,
    proteinGoal,
    carbsGoal,
    fatGoal,
    waterGoal,
  };
};

export interface GoalSuggestionInput {
  age?: number;
  weight?: number;
  height?: number;
  gender?: "male" | "female" | "other" | string;
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "very_active" | string;
  goal?: "lose" | "maintain" | "gain" | string;
}

export interface GoalSuggestionResult {
  calorieIntake: number;
  calorieBurn: number;
  explanation: string;
}

/**
 * Deterministic BMR and goal suggestion formula (Mifflin-St Jeor).
 */
export const calculateGoalSuggestion = (input: GoalSuggestionInput): GoalSuggestionResult | null => {
  const { age, weight, height, gender = "other", activityLevel = "moderate", goal = "maintain" } = input;
  if (!age || !weight || !height || age <= 0 || weight <= 0 || height <= 0) {
    return null;
  }

  // Mifflin-St Jeor Equation
  let bmr: number;
  if (gender === "male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else if (gender === "female") {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  } else {
    // Unspecified / other midpoint
    bmr = 10 * weight + 6.25 * height - 5 * age - 78;
  }

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const multiplier = activityMultipliers[activityLevel] || 1.55;
  const tdee = bmr * multiplier;

  let targetCalories = tdee;
  if (goal === "lose") {
    targetCalories = tdee - 500;
  } else if (goal === "gain") {
    targetCalories = tdee + 350;
  }

  // Safe bounds: Clinical minimum 1200 kcal (female/other), 1500 kcal (male); max 4000 kcal
  const minSafe = gender === "male" ? 1500 : 1200;
  const clampedCalories = Math.round(Math.min(4000, Math.max(minSafe, targetCalories)));

  const burnSuggestions: Record<string, number> = {
    sedentary: 300,
    light: 350,
    moderate: 450,
    active: 550,
    very_active: 650,
  };
  const calorieBurn = burnSuggestions[activityLevel] || 400;

  const goalDescriptions: Record<string, string> = {
    lose: "500 kcal deficit for weight loss",
    gain: "350 kcal surplus for muscle gain",
    maintain: "maintenance calories",
  };
  const goalDesc = goalDescriptions[goal] || "maintenance";

  return {
    calorieIntake: clampedCalories,
    calorieBurn,
    explanation: `Based on your profile (BMR: ${Math.round(bmr)} kcal, TDEE: ${Math.round(tdee)} kcal), targeted for ${goalDesc}.`,
  };
};
