const { z } = require('zod');

/**
 * Zod Schemas and Normalization Utilities for FitTrack Structured AI Plans
 * (Meal Plans & Activity / Workout Plans)
 */

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const INTENSITIES = ['low', 'medium', 'high'];

// ==========================================
// 1. MEAL PLAN SCHEMAS
// ==========================================

const MealSchema = z.object({
  name: z.string().min(1, 'Meal name cannot be empty').max(150),
  calories: z.coerce.number().int().nonnegative().max(5000).default(0),
  protein: z.coerce.number().nonnegative().max(500).default(0),
  carbs: z.coerce.number().nonnegative().max(1000).default(0),
  fat: z.coerce.number().nonnegative().max(500).default(0),
  mealType: z
    .string()
    .transform((val) => {
      const lower = String(val || '').toLowerCase().trim();
      return MEAL_TYPES.includes(lower) ? lower : 'snack';
    })
    .default('snack'),
  description: z.string().max(500).default(''),
});

const DayPlanSchema = z.object({
  day: z.string().min(1, 'Day title cannot be empty'),
  meals: z.array(MealSchema).min(1, 'Each day must contain at least one meal'),
  totalCalories: z.coerce.number().int().nonnegative().optional(),
});

const MealPlanArraySchema = z.array(DayPlanSchema).min(1, 'Meal plan must contain at least one day');

// ==========================================
// 2. ACTIVITY / WORKOUT PLAN SCHEMAS
// ==========================================

const PlannedActivitySchema = z.object({
  name: z.string().min(1, 'Activity name cannot be empty').max(150),
  type: z.string().min(1).default('custom'),
  duration: z.coerce.number().int().positive().max(720).default(30),
  caloriesBurned: z.coerce.number().int().nonnegative().max(5000).default(0),
  intensity: z
    .string()
    .transform((val) => {
      const lower = String(val || '').toLowerCase().trim();
      return INTENSITIES.includes(lower) ? lower : 'medium';
    })
    .default('medium'),
  targetMuscles: z
    .array(z.string())
    .or(
      z.string().transform((str) =>
        str
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
    .default([]),
  notes: z.string().default(''),
  warmup: z.string().optional().default(''),
  cooldown: z.string().optional().default(''),
});

const ActivityDayPlanSchema = z.object({
  day: z.string().min(1, 'Day title cannot be empty'),
  activities: z.array(PlannedActivitySchema).min(1, 'Each day must contain at least one activity'),
  totalDuration: z.coerce.number().int().nonnegative().optional(),
  totalCaloriesBurned: z.coerce.number().int().nonnegative().optional(),
  recoveryFocus: z.string().default('Hydration and rest'),
});

const ActivityPlanArraySchema = z
  .array(ActivityDayPlanSchema)
  .min(1, 'Activity plan must contain at least one day');

// ==========================================
// 3. WORKOUT PLAN MUTATION / ACTION SCHEMA
// ==========================================

const WorkoutPlanDaySchema = z.object({
  day: z.string().min(1, 'Day title cannot be empty').max(80),
  focus: z.string().max(200).default(''),
  duration: z.string().or(z.number().transform((n) => `${n} min`)).default('30 min'),
  exercises: z.array(z.any()).default([]),
});

const WorkoutPlanActionSchema = z.object({
  title: z.string().min(1, 'Plan title cannot be empty').max(120).default('My Workout Plan'),
  goal: z.string().max(100).default(''),
  level: z.string().max(50).default('all levels'),
  daysPerWeek: z.coerce.number().int().min(1).max(7).default(4),
  split: z.string().max(100).default(''),
  days: z.array(WorkoutPlanDaySchema).min(1, 'Workout plan must include days array'),
  isActive: z.boolean().default(true),
});

// ==========================================
// 4. EXTRACTION & PARSING HELPERS
// ==========================================

/**
 * Extracts and parses JSON from text, accommodating code blocks and wrapper objects.
 * @param {unknown} input
 * @returns {unknown}
 */
const extractRawJson = (input) => {
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();

  // Try extracting from fenced markdown ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fencedMatch && fencedMatch[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch {
      // Continue to next extraction strategy
    }
  }

  // Try extracting outermost JSON array or object
  const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // Continue
    }
  }

  // Fallback to strip fences and parse directly
  const cleaned = trimmed.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

/**
 * Unwraps outer dictionary envelopes like { plan: [...] }, { days: [...] }, { mealPlan: [...] }
 * @param {unknown} parsed
 * @returns {unknown}
 */
const unwrapPlanArray = (parsed) => {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.plan)) return parsed.plan;
    if (Array.isArray(parsed.days)) return parsed.days;
    if (Array.isArray(parsed.mealPlan)) return parsed.mealPlan;
    if (Array.isArray(parsed.meals)) return parsed.meals;
    if (Array.isArray(parsed.workoutPlan)) return parsed.workoutPlan;
    if (Array.isArray(parsed.activities)) return parsed.activities;
  }
  return parsed;
};

/**
 * Safely parses and normalizes a structured Meal Plan.
 * Returns { success: true, data: DayPlan[] } or { success: false, error: string }
 *
 * @param {unknown} input
 * @returns {{ success: boolean, data?: Array<{ day: string, meals: Array<any>, totalCalories: number }>, error?: string }}
 */
const safeParseMealPlan = (input) => {
  const parsed = extractRawJson(input);
  if (!parsed) {
    return { success: false, error: 'Failed to parse JSON string from AI response.' };
  }

  const unwrapped = unwrapPlanArray(parsed);
  const result = MealPlanArraySchema.safeParse(unwrapped);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  // Normalize totalCalories calculation if omitted or mismatched
  const normalized = result.data.map((dayPlan, index) => {
    const computedCalories = dayPlan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    return {
      day: dayPlan.day || `Day ${index + 1}`,
      meals: dayPlan.meals,
      totalCalories: dayPlan.totalCalories && dayPlan.totalCalories > 0 ? dayPlan.totalCalories : computedCalories,
    };
  });

  return { success: true, data: normalized };
};

/**
 * Safely parses and normalizes a structured Activity / Workout Plan.
 * Returns { success: true, data: ActivityDayPlan[] } or { success: false, error: string }
 *
 * @param {unknown} input
 * @returns {{ success: boolean, data?: Array<{ day: string, activities: Array<any>, totalDuration: number, totalCaloriesBurned: number, recoveryFocus: string }>, error?: string }}
 */
const safeParseActivityPlan = (input) => {
  const parsed = extractRawJson(input);
  if (!parsed) {
    return { success: false, error: 'Failed to parse JSON string from AI response.' };
  }

  const unwrapped = unwrapPlanArray(parsed);
  const result = ActivityPlanArraySchema.safeParse(unwrapped);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }

  // Normalize totals and recovery focus
  const normalized = result.data.map((dayPlan, index) => {
    const computedDuration = dayPlan.activities.reduce((sum, a) => sum + (a.duration || 0), 0);
    const computedCalories = dayPlan.activities.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);
    return {
      day: dayPlan.day || `Day ${index + 1}`,
      activities: dayPlan.activities,
      totalDuration: dayPlan.totalDuration && dayPlan.totalDuration > 0 ? dayPlan.totalDuration : computedDuration,
      totalCaloriesBurned: dayPlan.totalCaloriesBurned && dayPlan.totalCaloriesBurned > 0 ? dayPlan.totalCaloriesBurned : computedCalories,
      recoveryFocus: dayPlan.recoveryFocus || 'Hydration and rest',
    };
  });

  return { success: true, data: normalized };
};

module.exports = {
  MealSchema,
  DayPlanSchema,
  MealPlanArraySchema,
  PlannedActivitySchema,
  ActivityDayPlanSchema,
  ActivityPlanArraySchema,
  WorkoutPlanDaySchema,
  WorkoutPlanActionSchema,
  extractRawJson,
  unwrapPlanArray,
  safeParseMealPlan,
  safeParseActivityPlan,
};
