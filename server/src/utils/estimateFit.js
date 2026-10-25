/**
 * Deterministic estimation fit calculation (Phase E / G4).
 *
 * Compares an estimated food/meal against today's remaining calories and macros
 * from the shared fitness context, without calling an LLM.
 */

const computeEstimateFit = (estimate, fitnessContext) => {
  if (!estimate || typeof estimate.calories !== 'number' || Number.isNaN(estimate.calories)) {
    return null;
  }
  if (
    !fitnessContext ||
    !fitnessContext.profile ||
    !fitnessContext.profile.goals ||
    typeof fitnessContext.profile.goals.calorieLimit !== 'number'
  ) {
    return null;
  }

  const goals = fitnessContext.profile.goals;
  const loggedFood = fitnessContext.today?.food || {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  const remainingCalories = Math.max(0, goals.calorieLimit - (loggedFood.calories || 0));
  const remainingProtein = Math.max(0, goals.proteinGoal - (loggedFood.protein || 0));
  const remainingCarbs = Math.max(0, goals.carbsGoal - (loggedFood.carbs || 0));
  const remainingFat = Math.max(0, goals.fatGoal - (loggedFood.fat || 0));

  const calPct =
    remainingCalories > 0
      ? Math.round((estimate.calories / remainingCalories) * 100)
      : 100;

  const proteinPct =
    typeof estimate.protein === 'number' && remainingProtein > 0
      ? Math.round((estimate.protein / remainingProtein) * 100)
      : null;

  let message = '';
  if (remainingCalories <= 0) {
    message = `You have reached your ${goals.calorieLimit} kcal calorie target for today.`;
  } else if (estimate.calories > remainingCalories) {
    message = `Exceeds remaining daily calories by ${estimate.calories - remainingCalories} kcal.`;
  } else {
    message = `Uses ${calPct}% of your remaining calories (${remainingCalories} kcal left).`;
    if (proteinPct !== null && proteinPct > 0) {
      message += ` Provides ${proteinPct}% of remaining protein.`;
    }
  }

  return {
    remainingCalories,
    remainingProtein,
    remainingCarbs,
    remainingFat,
    caloriePercentageOfRemaining: calPct,
    proteinPercentageOfRemaining: proteinPct,
    message,
  };
};

module.exports = { computeEstimateFit };
