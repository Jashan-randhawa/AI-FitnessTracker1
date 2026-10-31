import { z } from "zod";

export type OfflineMutationKind = "water_add" | "weight_log" | "food_add" | "activity_add";

export type OfflineMutationStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "needs_auth"
  | "conflict"
  | "expired";

export const WaterPayloadSchema = z.object({
  amount: z.number().finite().min(1, "amount must be at least 1 ml").max(10000, "amount cannot exceed 10000 ml"),
  date: z.string().optional(),
});
export type WaterPayload = z.infer<typeof WaterPayloadSchema>;

export const WeightPayloadSchema = z.object({
  weightKg: z.number().finite().min(20, "weightKg must be at least 20 kg").max(400, "weightKg cannot exceed 400 kg"),
  date: z.string().min(1, "date is required"),
  localDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "localDay must be in YYYY-MM-DD format").optional(),
  notes: z.string().max(500, "notes cannot exceed 500 characters").optional(),
  source: z.string().max(50).optional(),
});
export type WeightPayload = z.infer<typeof WeightPayloadSchema>;

export const FoodPayloadSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100, "name cannot exceed 100 characters"),
  calories: z.number().finite().min(0, "calories cannot be negative").max(20000, "calories cannot exceed 20000"),
  protein: z.number().finite().min(0).max(2000).nullable().optional(),
  carbs: z.number().finite().min(0).max(2000).nullable().optional(),
  fat: z.number().finite().min(0).max(2000).nullable().optional(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  mealtype: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
  date: z.string().optional(),
  aiGenerated: z.boolean().optional(),
});
export type FoodPayload = z.infer<typeof FoodPayloadSchema>;

export const ActivitySetSchema = z.object({
  setNumber: z.number().optional(),
  weight: z.number().optional(),
  reps: z.number().optional(),
  completed: z.boolean().optional(),
});

export const ActivityExerciseSchema = z.object({
  name: z.string().optional(),
  sets: z.array(ActivitySetSchema).optional(),
});

export const ActivityPayloadSchema = z.object({
  name: z.string().trim().max(100, "name cannot exceed 100 characters").optional().default("Workout"),
  duration: z.number().finite().min(0).max(1440, "duration cannot exceed 1440 minutes").optional().default(0),
  calories: z.number().finite().min(0).max(10000).optional(),
  caloriesBurned: z.number().finite().min(0).max(10000).optional(),
  type: z.string().max(50).optional(),
  intensity: z.enum(["low", "medium", "high"]).optional(),
  source: z.string().max(50).optional(),
  date: z.string().optional(),
  exercises: z.array(ActivityExerciseSchema).optional(),
  sets: z.array(ActivitySetSchema).optional(),
});
export type ActivityPayload = z.infer<typeof ActivityPayloadSchema>;

export type AnyOfflinePayload = WaterPayload | WeightPayload | FoodPayload | ActivityPayload;

export interface QueuedMutation<T = unknown> {
  id: string;
  userId: string;
  kind: OfflineMutationKind;
  payload: T;
  idempotencyKey: string;
  createdAt: number; // ms timestamp
  eventDate: string; // ISO date
  localDay?: string; // Captured at enqueue (especially for weight)
  status: OfflineMutationStatus;
  attempts: number;
  nextAttemptAt: number; // ms timestamp
  lastErrorCode?: string;
  lastErrorMessage?: string;
  conflictData?: unknown;
  replayed?: boolean;
  localTempId?: string; // Optimistic temporary ID
}

export interface ReconciliationEvent {
  kind: OfflineMutationKind;
  idempotencyKey: string;
  localTempId?: string;
  serverEntry: unknown;
  replayed: boolean;
  conflict?: boolean;
}

export interface OfflineQueueCounts {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
  needs_auth: number;
  conflict: number;
  expired: number;
}

export interface OfflineQueueSnapshot {
  counts: OfflineQueueCounts;
  items: QueuedMutation[];
  failed: QueuedMutation[];
  conflict: QueuedMutation[];
  expired: QueuedMutation[];
  isReplaying: boolean;
}

/**
 * Validates payload for a given mutation kind using strict zod schemas.
 */
export const validateMutationPayload = (kind: OfflineMutationKind, payload: unknown): AnyOfflinePayload => {
  switch (kind) {
    case "water_add":
      return WaterPayloadSchema.parse(payload);
    case "weight_log":
      return WeightPayloadSchema.parse(payload);
    case "food_add":
      return FoodPayloadSchema.parse(payload);
    case "activity_add":
      return ActivityPayloadSchema.parse(payload);
    default:
      throw new Error(`Unknown mutation kind: ${kind as string}`);
  }
};

/**
 * Generates an 8-128 char RFC4122 v4 UUID idempotency key with safe fallback.
 */
export const generateIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
