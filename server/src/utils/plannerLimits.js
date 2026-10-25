/**
 * Deterministic limits applied to AI-generated plans after schema validation (Phase 5).
 *
 * Calories are recomputed from the items in each day. The model's own `totalCalories`
 * field is ignored, so a plan cannot pass a limit by mislabelling its total.
 *
 * limits (built by plannerContext.service.js):
 *   { kind: 'meal', day1Kcal, laterKcal, tolerance }
 *     Day 1 is capped at day1Kcal, every later day at laterKcal. Each cap allows
 *     `tolerance` above the budget (1.1 = 10%), matching the prompt's ±10% wording.
 *     Only an upper limit is enforced. A lower bound would conflict with the
 *     safe-harbour rules, which depend on information the profile does not hold.
 *   { kind: 'activity', noHighIntensityDay1 }
 *     With two or more consecutive training days, Day 1 must not contain a
 *     high-intensity activity. The streak is a reason for caution, not a reason
 *     to prescribe hard work.
 */

const MEAL_TOLERANCE = 1.1;

/**
 * @param {Array<object>} days normalised plan days from safeParseMealPlan or safeParseActivityPlan
 * @param {object} [limits]
 * @returns {{ success: true } | { success: false, kind: 'constraint', error: string }}
 */
const checkPlannerLimits = (days, limits) => {
  if (!limits || !Array.isArray(days)) return { success: true };

  if (limits.kind === 'meal') {
    const tolerance = typeof limits.tolerance === 'number' ? limits.tolerance : MEAL_TOLERANCE;
    for (let i = 0; i < days.length; i++) {
      const budget = i === 0 ? limits.day1Kcal : limits.laterKcal;
      const allowed = Math.round(budget * tolerance);
      const meals = Array.isArray(days[i].meals) ? days[i].meals : [];
      const total = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      if (total > allowed) {
        return {
          success: false,
          kind: 'constraint',
          error: `Day ${i + 1} totals ${total} kcal, above the ${allowed} kcal limit for that day.`,
        };
      }
    }
  }

  if (limits.kind === 'activity' && limits.noHighIntensityDay1) {
    const activities = Array.isArray(days[0]?.activities) ? days[0].activities : [];
    if (activities.some((a) => a.intensity === 'high')) {
      return {
        success: false,
        kind: 'constraint',
        error: 'Day 1 includes a high-intensity activity, but the user has recent consecutive training days. Use low or medium intensity on Day 1.',
      };
    }
  }

  return { success: true };
};

module.exports = { checkPlannerLimits, MEAL_TOLERANCE };
