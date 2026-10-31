/**
 * @deprecated Use `client/src/offline` instead.
 * Thin compatibility layer for legacy callers and tests.
 */
import {
  type OfflineMutationKind,
  type AnyOfflinePayload,
  validateMutationPayload,
} from "../offline/types";
import {
  offlineQueueStore,
  startOfflineSync,
  stopOfflineSync,
  enqueue,
  discardItem,
  onReconcile,
} from "../offline";
import api from "../configs/api";

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  data: unknown;
  description?: string;
  timestamp: number;
}

const DEFAULT_COMPAT_USER = "legacy_compat_user";

const ensureActiveUser = () => {
  offlineQueueStore.setCurrentUserId(DEFAULT_COMPAT_USER);
};

const mapEndpointToKind = (endpoint: string): OfflineMutationKind => {
  if (endpoint.includes("/waterlogs")) return "water_add";
  if (endpoint.includes("/weightlogs")) return "weight_log";
  if (endpoint.includes("/foodlogs")) return "food_add";
  return "activity_add";
};

const kindToEndpoint = (kind: OfflineMutationKind): string => {
  switch (kind) {
    case "water_add":
      return "/api/waterlogs";
    case "weight_log":
      return "/api/weightlogs";
    case "food_add":
      return "/api/foodlogs";
    case "activity_add":
      return "/api/activitylogs";
  }
};

/**
 * @deprecated Use `enqueue` from `client/src/offline` instead.
 */
export const enqueueOfflineMutation = async (
  mutation: Omit<QueuedMutation, "id" | "timestamp">
): Promise<QueuedMutation> => {
  ensureActiveUser();

  const kind = mapEndpointToKind(mutation.endpoint);
  const rawPayload =
    mutation.data && typeof mutation.data === "object" && "data" in mutation.data
      ? (mutation.data as { data: unknown }).data
      : mutation.data;

  // Validate or coerce payload to comply with the new typed schema
  let validPayload: AnyOfflinePayload;
  try {
    validPayload = validateMutationPayload(kind, rawPayload);
  } catch {
    // If validation fails in legacy path, pass raw to allow offline storage
    validPayload = rawPayload as AnyOfflinePayload;
  }

  const enqueued = await enqueue(kind, validPayload);

  return {
    id: enqueued.id,
    endpoint: mutation.endpoint,
    method: mutation.method,
    data: mutation.data,
    description: mutation.description,
    timestamp: enqueued.createdAt,
  };
};

/**
 * @deprecated Use `getSnapshot` from `client/src/offline` instead.
 */
export const getOfflineQueue = async (): Promise<QueuedMutation[]> => {
  ensureActiveUser();
  const snapshot = await offlineQueueStore.refreshSnapshot();

  return snapshot.items.map((m) => ({
    id: m.id,
    endpoint: kindToEndpoint(m.kind),
    method: "POST" as const,
    data: m.payload,
    description: (m.payload as { name?: string })?.name,
    timestamp: m.createdAt,
  }));
};

/**
 * @deprecated Use `discardItem` from `client/src/offline` instead.
 */
export const removeOfflineMutation = async (id: string): Promise<void> => {
  await discardItem(id);
};

let isReplayingCompat = false;

/**
 * @deprecated Use `offlineQueueStore.replay()` from `client/src/offline` instead.
 */
export const replayOfflineQueue = async (
  onItemReplayed?: (mutation: QueuedMutation, result: unknown) => void
): Promise<number> => {
  if (isReplayingCompat || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return 0;
  }

  isReplayingCompat = true;
  let replayedCount = 0;

  try {
    ensureActiveUser();
    const queue = await getOfflineQueue();
    if (queue.length === 0) return 0;

    for (const item of queue) {
      try {
        let res;
        if (item.method === "POST") {
          res = await api.post(item.endpoint, item.data);
        } else if (item.method === "PUT") {
          res = await api.put(item.endpoint, item.data);
        } else if (item.method === "PATCH") {
          res = await api.patch(item.endpoint, item.data);
        } else if (item.method === "DELETE") {
          res = await api.delete(item.endpoint);
        }

        await removeOfflineMutation(item.id);
        replayedCount++;
        onItemReplayed?.(item, res?.data);
      } catch (err: unknown) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          break;
        }

        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          await removeOfflineMutation(item.id);
        }
      }
    }
  } finally {
    isReplayingCompat = false;
  }

  return replayedCount;
};

/**
 * @deprecated Offline sync is now managed app-wide via `startOfflineSync` / `stopOfflineSync`.
 */
export const initOfflineSync = (
  onItemReplayed?: (mutation: QueuedMutation, result: unknown) => void
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => {
    replayOfflineQueue(onItemReplayed);
  };

  window.addEventListener("online", handleOnline);

  if (navigator.onLine) {
    replayOfflineQueue(onItemReplayed);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
};

export { startOfflineSync, stopOfflineSync, onReconcile };
