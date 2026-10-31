import api from "../configs/api";
import { browserTimeZone, localDayKey } from "../utils/localDay";
import {
  type QueuedMutation,
  type ReconciliationEvent,
  type WaterPayload,
  type WeightPayload,
  type FoodPayload,
  validateMutationPayload,
} from "./types";
import type { OfflineStorageAdapter } from "./storage";

/**
 * Client-side retention window: items older than 14 days are marked expired and preserved
 * in local storage for user review/discard. The server accepts logs up to 30 days
 * (OFFLINE_MAX_AGE_DAYS), so valid client items will never be rejected by the server boundary.
 */
export const EXPIRY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

export type ReplayReconcileCallback = (event: ReconciliationEvent) => void;

export interface ReplayOptions {
  onReconcile?: ReplayReconcileCallback;
  onQueueUpdated?: () => void;
  forceItemIds?: string[];
}

/**
 * Derives endpoint and request body from the mutation kind and payload.
 * Sensitive data and tokens are never stored; endpoints and methods are strictly derived.
 */
export const deriveRequest = (
  item: QueuedMutation
): { endpoint: string; body: unknown } => {
  switch (item.kind) {
    case "water_add": {
      const p = item.payload as WaterPayload;
      return {
        endpoint: "/api/waterlogs",
        body: {
          data: {
            amount: p.amount,
            date: p.date || item.eventDate,
          },
        },
      };
    }
    case "weight_log": {
      const p = item.payload as WeightPayload;
      const day = item.localDay || p.localDay || localDayKey(new Date(item.eventDate));
      return {
        endpoint: "/api/weightlogs",
        body: {
          data: {
            weightKg: p.weightKg,
            date: p.date || item.eventDate,
            localDay: day,
            notes: p.notes,
            source: p.source || "offline-sync",
          },
        },
      };
    }
    case "food_add": {
      const p = item.payload as FoodPayload;
      const normMeal = p.mealType || p.mealtype || "snack";
      return {
        endpoint: "/api/foodlogs",
        body: {
          data: {
            name: p.name,
            calories: p.calories,
            protein: p.protein ?? null,
            carbs: p.carbs ?? null,
            fat: p.fat ?? null,
            mealType: normMeal,
            mealtype: normMeal,
            date: p.date || item.eventDate,
            aiGenerated: p.aiGenerated,
          },
        },
      };
    }
    case "activity_add": {
      return {
        endpoint: "/api/activitylogs",
        body: {
          data: item.payload,
        },
      };
    }
    default:
      throw new Error(`Unsupported mutation kind: ${(item as { kind: string }).kind}`);
  }
};

let activeReplayPromise: Promise<number> | null = null;

/**
 * Replays queued mutations for a given user.
 * Multi-tab safe via navigator.locks when available.
 */
export const replayUserQueue = async (
  userId: string,
  storage: OfflineStorageAdapter,
  options: ReplayOptions = {}
): Promise<number> => {
  if (!userId) return 0;

  // Single-flight within the same tab
  if (activeReplayPromise) {
    return activeReplayPromise;
  }

  const runReplay = async (): Promise<number> => {
    // Multi-tab locking
    if (
      typeof navigator !== "undefined" &&
      navigator.locks &&
      typeof navigator.locks.request === "function"
    ) {
      return await navigator.locks.request(
        "fittrack_offline_replay_lock",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            // Another tab is replaying
            return 0;
          }
          return await executeReplayLoop(userId, storage, options);
        }
      );
    }
    return await executeReplayLoop(userId, storage, options);
  };

  activeReplayPromise = runReplay().finally(() => {
    activeReplayPromise = null;
  });

  return activeReplayPromise;
};

const executeReplayLoop = async (
  userId: string,
  storage: OfflineStorageAdapter,
  options: ReplayOptions
): Promise<number> => {
  const queue = await storage.getQueue(userId);
  if (queue.length === 0) return 0;

  let replayedCount = 0;
  const now = Date.now();
  const tz = browserTimeZone();
  const forceSet = new Set(options.forceItemIds || []);

  for (const item of queue) {
    // 1. Expiry check: items older than 14 days become expired and are preserved for user review
    if (now - item.createdAt > EXPIRY_MAX_AGE_MS) {
      if (item.status !== "expired") {
        item.status = "expired";
        item.lastErrorCode = "EXPIRED_MAX_AGE";
        item.lastErrorMessage = "Item expired after 14 days offline";
        await storage.updateItem(item);
        options.onQueueUpdated?.();
      }
      continue;
    }

    // 2. Skip items that require manual review or auth, unless explicitly forced
    const isForced = forceSet.has(item.id);
    if (!isForced) {
      if (
        item.status === "failed" ||
        item.status === "needs_auth" ||
        item.status === "expired"
      ) {
        continue;
      }
      if (item.nextAttemptAt && item.nextAttemptAt > now) {
        continue;
      }
    }

    // 3. Payload validation check before replay (guards against storage corruption/tampering)
    try {
      validateMutationPayload(item.kind, item.payload);
    } catch (valErr) {
      item.status = "failed";
      item.lastErrorCode = "INVALID_PAYLOAD";
      item.lastErrorMessage =
        valErr instanceof Error ? valErr.message : "Payload validation failed";
      await storage.updateItem(item);
      options.onQueueUpdated?.();
      continue;
    }

    // Mark syncing if item still exists in storage
    if (!(await storage.hasItem(item.id))) {
      continue;
    }
    item.status = "syncing";
    await storage.updateItem(item);
    options.onQueueUpdated?.();

    try {
      const { endpoint, body } = deriveRequest(item);

      const res = await api.post(endpoint, body, {
        headers: {
          "Idempotency-Key": item.idempotencyKey,
          "X-Timezone": tz,
        },
        skipToast: true,
        suppressGlobalToasts: true,
      });

      // 4. Success outcome (2xx)
      const resHeaders = (res.headers || {}) as Record<string, string | undefined>;
      const xConflict = resHeaders["x-conflict"] || resHeaders["X-Conflict"];
      const isConflict = String(xConflict || "").toLowerCase().includes("stale-ignored");

      const replayedHeader =
        resHeaders["idempotency-replayed"] || resHeaders["Idempotency-Replayed"];
      const isReplayed = String(replayedHeader || "").toLowerCase() === "true";

      await storage.removeItem(item.id);
      replayedCount++;
      options.onQueueUpdated?.();

      options.onReconcile?.({
        kind: item.kind,
        idempotencyKey: item.idempotencyKey,
        localTempId: item.localTempId,
        serverEntry: res.data,
        replayed: isReplayed,
        conflict: isConflict,
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: {
            error?: { code?: string; message?: string };
            code?: string;
            message?: string;
            retryAfterSeconds?: number;
          };
          headers?: Record<string, string | undefined>;
        };
        code?: string;
        message?: string;
      };

      const status = axiosErr.response?.status;
      const resData = axiosErr.response?.data;
      const resHeaders = axiosErr.response?.headers || {};
      const errorCode = resData?.error?.code || resData?.code;
      const errorMessage =
        resData?.error?.message || resData?.message || axiosErr.message || "Request failed";

      const stillExists = await storage.hasItem(item.id);
      if (!stillExists) {
        continue; // Discarded during flight
      }

      // Case A: 401 or 403 or failed token refresh -> needs_auth, STOP replay immediately
      if (status === 401 || status === 403) {
        item.status = "needs_auth";
        item.lastErrorCode = errorCode || (status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
        item.lastErrorMessage = errorMessage;
        await storage.updateItem(item);
        options.onQueueUpdated?.();
        break; // Stop replay entirely
      }

      // Case B: 400 or 422 Client Error -> failed with error code, preserved for review
      if (status === 400 || status === 422) {
        item.status = "failed";
        item.lastErrorCode =
          errorCode || (status === 422 ? "IDEMPOTENCY_KEY_REUSED" : "BAD_REQUEST");
        item.lastErrorMessage = errorMessage;
        await storage.updateItem(item);
        options.onQueueUpdated?.();
        continue; // Keep failed item and proceed to next
      }

      // Case C: 409 IDEMPOTENCY_IN_PROGRESS -> server claim in-flight, short delay
      if (status === 409) {
        const retryHeader = resHeaders["retry-after"] || resHeaders["Retry-After"];
        const retrySec = Number(retryHeader) || 2;
        item.status = "pending";
        item.nextAttemptAt = Date.now() + retrySec * 1000;
        item.lastErrorCode = "IDEMPOTENCY_IN_PROGRESS";
        item.lastErrorMessage = errorMessage;
        await storage.updateItem(item);
        options.onQueueUpdated?.();
        break; // Pause replay loop to retry shortly
      }

      // Case D: 429 or 5xx -> server limit or outage, backoff honoring Retry-After
      if (status === 429 || (status && status >= 500 && status < 600)) {
        const retryHeader = resHeaders["retry-after"] || resHeaders["Retry-After"];
        const retrySec =
          resData?.retryAfterSeconds || (retryHeader ? Number(retryHeader) : undefined);

        const expBackoff = Math.min(1000 * Math.pow(2, item.attempts), MAX_BACKOFF_MS);
        const jitter = Math.random() * 1000;
        const delayMs = retrySec ? Math.max(retrySec * 1000, 1000) : expBackoff + jitter;

        item.attempts += 1;
        item.status = "pending";
        item.nextAttemptAt = Date.now() + delayMs;
        item.lastErrorCode = errorCode || (status === 429 ? "RATE_LIMIT" : "SERVER_ERROR");
        item.lastErrorMessage = errorMessage;
        await storage.updateItem(item);
        options.onQueueUpdated?.();
        break; // Break loop until backoff expires
      }

      // Case E: Network error or timeout (no response or network dropped)
      const expBackoff = Math.min(1000 * Math.pow(2, item.attempts), MAX_BACKOFF_MS);
      const jitter = Math.random() * 1000;
      const delayMs = expBackoff + jitter;

      item.attempts += 1;
      item.status = "pending";
      item.nextAttemptAt = Date.now() + delayMs;
      item.lastErrorCode = "NETWORK_ERROR";
      item.lastErrorMessage = errorMessage;
      await storage.updateItem(item);
      options.onQueueUpdated?.();
      break; // Network down, stop replay
    }
  }

  return replayedCount;
};
