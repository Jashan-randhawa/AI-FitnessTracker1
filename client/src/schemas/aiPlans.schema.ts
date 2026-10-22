import { z } from "zod";

/**
 * Zod Schemas and Normalization Utilities for FitTrack Structured AI Plans
 * (Meal Plans & Activity / Workout Plans)
 */

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export const INTENSITIES = ["low", "medium", "high"] as const;

export type MealType = (typeof MEAL_TYPES)[number];
export type IntensityType = (typeof INTENSITIES)[number];

// ==========================================
// 1. MEAL PLAN SCHEMAS
// ==========================================

export const MealSchema = z.object({
  name: z.string().min(1, "Meal name cannot be empty").max(150),
  calories: z.coerce.number().int().nonnegative().max(5000).default(0),
  protein: z.coerce.number().nonnegative().max(500).default(0),
  carbs: z.coerce.number().nonnegative().max(1000).default(0),
  fat: z.coerce.number().nonnegative().max(500).default(0),
  mealType: z
    .string()
    .transform((val) => {
      const lower = String(val || "").toLowerCase().trim();
      return (MEAL_TYPES as readonly string[]).includes(lower) ? (lower as MealType) : "snack";
    })
    .default("snack"),
  description: z.string().max(500).default(""),
});

export const DayPlanSchema = z.object({
  day: z.string().min(1, "Day title cannot be empty"),
  meals: z.array(MealSchema).min(1, "Each day must contain at least one meal"),
  totalCalories: z.coerce.number().int().nonnegative().optional(),
});

export const MealPlanArraySchema = z.array(DayPlanSchema).min(1, "Meal plan must contain at least one day");

export type Meal = z.infer<typeof MealSchema>;
export type DayPlan = {
  day: string;
  meals: Meal[];
  totalCalories: number;
};

// ==========================================
// 2. ACTIVITY / WORKOUT PLAN SCHEMAS
// ==========================================

export const PlannedActivitySchema = z.object({
  name: z.string().min(1, "Activity name cannot be empty").max(150),
  type: z.string().min(1).default("custom"),
  duration: z.coerce.number().int().positive().max(720).default(30),
  caloriesBurned: z.coerce.number().int().nonnegative().max(5000).default(0),
  intensity: z
    .string()
    .transform((val) => {
      const lower = String(val || "").toLowerCase().trim();
      return (INTENSITIES as readonly string[]).includes(lower) ? (lower as IntensityType) : "medium";
    })
    .default("medium"),
  targetMuscles: z
    .array(z.string())
    .or(
      z.string().transform((str) =>
        str
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      )
    )
    .default([]),
  notes: z.string().default(""),
  warmup: z.string().optional().default(""),
  cooldown: z.string().optional().default(""),
});

export const ActivityDayPlanSchema = z.object({
  day: z.string().min(1, "Day title cannot be empty"),
  activities: z.array(PlannedActivitySchema).min(1, "Each day must contain at least one activity"),
  totalDuration: z.coerce.number().int().nonnegative().optional(),
  totalCaloriesBurned: z.coerce.number().int().nonnegative().optional(),
  recoveryFocus: z.string().default("Hydration and rest"),
});

export const ActivityPlanArraySchema = z
  .array(ActivityDayPlanSchema)
  .min(1, "Activity plan must contain at least one day");

export type PlannedActivity = z.infer<typeof PlannedActivitySchema>;
export type ActivityDayPlan = {
  day: string;
  activities: PlannedActivity[];
  totalDuration: number;
  totalCaloriesBurned: number;
  recoveryFocus: string;
};

// ==========================================
// 3. WORKOUT PLAN MUTATION / ACTION SCHEMA
// ==========================================

export const WorkoutPlanDaySchema = z.object({
  day: z.string().min(1, "Day title cannot be empty").max(80),
  focus: z.string().max(200).default(""),
  duration: z.string().or(z.number().transform((n) => `${n} min`)).default("30 min"),
  exercises: z.array(z.any()).default([]),
});

export const WorkoutPlanActionSchema = z.object({
  title: z.string().min(1, "Plan title cannot be empty").max(120).default("My Workout Plan"),
  goal: z.string().max(100).default(""),
  level: z.string().max(50).default("all levels"),
  daysPerWeek: z.coerce.number().int().min(1).max(7).default(4),
  split: z.string().max(100).default(""),
  days: z.array(WorkoutPlanDaySchema).min(1, "Workout plan must include days array"),
  isActive: z.boolean().default(true),
});

export type WorkoutPlanAction = z.infer<typeof WorkoutPlanActionSchema>;

// ==========================================
// 4. EXTRACTION & PARSING HELPERS
// ==========================================

export const extractRawJson = (input: unknown): unknown => {
  if (typeof input !== "string") return input;
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
  const cleaned = trimmed.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

export const unwrapPlanArray = (parsed: unknown): unknown => {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.plan)) return obj.plan;
    if (Array.isArray(obj.days)) return obj.days;
    if (Array.isArray(obj.mealPlan)) return obj.mealPlan;
    if (Array.isArray(obj.meals)) return obj.meals;
    if (Array.isArray(obj.workoutPlan)) return obj.workoutPlan;
    if (Array.isArray(obj.activities)) return obj.activities;
  }
  return parsed;
};

/**
 * Safely parses and normalizes a structured Meal Plan.
 * Returns { success: true, data: DayPlan[] } or { success: false, error: string }
 */
export const safeParseMealPlan = (
  input: unknown
): { success: true; data: DayPlan[] } | { success: false; error: string } => {
  const parsed = extractRawJson(input);
  if (!parsed) {
    return { success: false, error: "Failed to parse JSON string from AI response." };
  }

  const unwrapped = unwrapPlanArray(parsed);
  const result = MealPlanArraySchema.safeParse(unwrapped);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const normalized: DayPlan[] = result.data.map((dayPlan, index) => {
    const computedCalories = dayPlan.meals.reduce((sum, m) => sum + (m.calories || 0), 0);
    return {
      day: dayPlan.day || `Day ${index + 1}`,
      meals: dayPlan.meals,
      totalCalories:
        dayPlan.totalCalories && dayPlan.totalCalories > 0 ? dayPlan.totalCalories : computedCalories,
    };
  });

  return { success: true, data: normalized };
};

/**
 * Safely parses and normalizes a structured Activity / Workout Plan.
 * Returns { success: true, data: ActivityDayPlan[] } or { success: false, error: string }
 */
export const safeParseActivityPlan = (
  input: unknown
): { success: true; data: ActivityDayPlan[] } | { success: false; error: string } => {
  const parsed = extractRawJson(input);
  if (!parsed) {
    return { success: false, error: "Failed to parse JSON string from AI response." };
  }

  const unwrapped = unwrapPlanArray(parsed);
  const result = ActivityPlanArraySchema.safeParse(unwrapped);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  const normalized: ActivityDayPlan[] = result.data.map((dayPlan, index) => {
    const computedDuration = dayPlan.activities.reduce((sum, a) => sum + (a.duration || 0), 0);
    const computedCalories = dayPlan.activities.reduce((sum, a) => sum + (a.caloriesBurned || 0), 0);
    return {
      day: dayPlan.day || `Day ${index + 1}`,
      activities: dayPlan.activities,
      totalDuration:
        dayPlan.totalDuration && dayPlan.totalDuration > 0 ? dayPlan.totalDuration : computedDuration,
      totalCaloriesBurned:
        dayPlan.totalCaloriesBurned && dayPlan.totalCaloriesBurned > 0
          ? dayPlan.totalCaloriesBurned
          : computedCalories,
      recoveryFocus: dayPlan.recoveryFocus || "Hydration and rest",
    };
  });

  return { success: true, data: normalized };
};

/**
 * Converts a structured or markdown-derived plan into a validated WorkoutPlanAction payload.
 */
export const buildWorkoutPlanActionPayload = (
  title: string,
  days: Array<{ day: string; focus?: string; duration?: string; exercises?: unknown[] }>,
  options?: { goal?: string; level?: string; split?: string }
): { success: true; data: WorkoutPlanAction } | { success: false; error: string } => {
  const rawPayload = {
    title: title || "AI Workout Routine",
    goal: options?.goal || "fitness",
    level: options?.level || "all levels",
    daysPerWeek: days.length || 4,
    split: options?.split || "full body",
    days: days.map((d, i) => ({
      day: d.day || `Day ${i + 1}`,
      focus: d.focus || "General Conditioning",
      duration: d.duration || "45 min",
      exercises: Array.isArray(d.exercises) ? d.exercises : [],
    })),
    isActive: true,
  };

  const validated = WorkoutPlanActionSchema.safeParse(rawPayload);
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  return { success: true, data: validated.data };
};
