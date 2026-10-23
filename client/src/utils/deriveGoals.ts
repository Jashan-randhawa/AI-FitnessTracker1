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
