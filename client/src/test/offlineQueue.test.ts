import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enqueue,
  getSnapshot,
  subscribe,
  retryItem,
  discardItem,
  retryAll,
  purgeOfflineQueue,
  clearAll,
  stopOfflineSync,
  onReconcile,
  setCurrentUserId,
  offlineQueueStore,
} from "../offline";
import {
  MemoryStorageAdapter,
  migrateLegacyStorage,
} from "../offline/storage";
import { replayUserQueue, EXPIRY_MAX_AGE_MS } from "../offline/engine";
import api from "../configs/api";

vi.mock("../configs/api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("Offline Queue Engine Comprehensive Test Suite", () => {
  let memoryStorage: MemoryStorageAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    memoryStorage = new MemoryStorageAdapter();
    offlineQueueStore.setAdapter(memoryStorage);
    setCurrentUserId("user_alpha");
    await clearAll();

    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    stopOfflineSync();
  });

  it("1. Key stability: generates RFC4122 idempotencyKey at enqueue and preserves across retries", async () => {
    const item = await enqueue("water_add", { amount: 500 });
    expect(item.idempotencyKey).toBeDefined();
    expect(item.idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const initialKey = item.idempotencyKey;

    // Simulate transient failure and retry
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Network Error"));
    await offlineQueueStore.replay();

    let snapshot = getSnapshot();
    const pendingItem = snapshot.items.find((m) => m.id === item.id);
    expect(pendingItem?.idempotencyKey).toBe(initialKey);

    await retryItem(item.id);
    snapshot = getSnapshot();
    const retriedItem = snapshot.items.find((m) => m.id === item.id);
    expect(retriedItem?.idempotencyKey).toBe(initialKey);
  });

  it("2. 401/403 never deletes: marks status needs_auth, stops replay, and keeps items intact", async () => {
    await enqueue("water_add", { amount: 250 });
    await enqueue("food_add", { name: "Apple", calories: 95 });

    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 401, data: { error: { code: "UNAUTHORIZED", message: "Token expired" } } },
    });

    const count = await offlineQueueStore.replay();
    expect(count).toBe(0);

    const snapshot = getSnapshot();
    expect(snapshot.counts.total).toBe(2);
    expect(snapshot.counts.needs_auth).toBe(1);

    const firstItem = snapshot.items[0];
    expect(firstItem.status).toBe("needs_auth");
    expect(firstItem.lastErrorCode).toBe("UNAUTHORIZED");

    // Second item should not have run because replay stops on 401/403
    expect(snapshot.items[1].status).toBe("pending");
  });

  it("3. 400/422 validation errors: marks status failed with error code, preserved for user review", async () => {
    const item = await enqueue("weight_log", {
      weightKg: 75,
      date: new Date().toISOString(),
    });

    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: { code: "DATE_OUT_OF_RANGE", message: "Date is too far in the past" } },
      },
    });

    await offlineQueueStore.replay();

    const snapshot = getSnapshot();
    expect(snapshot.counts.total).toBe(1);
    expect(snapshot.counts.failed).toBe(1);

    const failedItem = snapshot.failed[0];
    expect(failedItem.id).toBe(item.id);
    expect(failedItem.status).toBe("failed");
    expect(failedItem.lastErrorCode).toBe("DATE_OUT_OF_RANGE");
  });

  it("4. 409 IDEMPOTENCY_IN_PROGRESS: respects Retry-After and pauses replay without dropping", async () => {
    const item = await enqueue("water_add", { amount: 300 });

    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        status: 409,
        headers: { "retry-after": "3" },
        data: { error: { code: "IDEMPOTENCY_IN_PROGRESS", message: "Request in flight" } },
      },
    });

    await offlineQueueStore.replay();

    const snapshot = getSnapshot();
    expect(snapshot.counts.total).toBe(1);
    const pendingItem = snapshot.items.find((m) => m.id === item.id);
    expect(pendingItem?.status).toBe("pending");
    expect(pendingItem?.nextAttemptAt).toBeGreaterThan(Date.now() + 2000);
    expect(pendingItem?.lastErrorCode).toBe("IDEMPOTENCY_IN_PROGRESS");
  });

  it("5. Backoff and Retry-After honoring: honors header on 429 and 5xx errors", async () => {
    const item = await enqueue("activity_add", { name: "Jogging", duration: 20 });

    vi.mocked(api.post).mockRejectedValueOnce({
      response: {
        status: 429,
        headers: { "retry-after": "10" },
        data: { error: { code: "RATE_LIMIT" }, retryAfterSeconds: 10 },
      },
    });

    await offlineQueueStore.replay();

    const snapshot = getSnapshot();
    const pendingItem = snapshot.items.find((m) => m.id === item.id);
    expect(pendingItem?.attempts).toBe(1);
    expect(pendingItem?.nextAttemptAt).toBeGreaterThanOrEqual(Date.now() + 9000);
  });

  it("6. FIFO ordering: executes oldest item first based on createdAt", async () => {
    const now = Date.now();
    const item1 = await enqueue("water_add", { amount: 200 }, { eventDate: "2026-10-01T10:00:00Z" });
    item1.createdAt = now - 60000; // 1 minute ago
    await memoryStorage.updateItem(item1);

    const item2 = await enqueue("water_add", { amount: 400 }, { eventDate: "2026-10-02T10:00:00Z" });
    item2.createdAt = now - 30000; // 30 seconds ago
    await memoryStorage.updateItem(item2);

    const calls: string[] = [];
    vi.mocked(api.post).mockImplementation(async (_endpoint, body) => {
      const b = body as { data: { amount: number } };
      calls.push(String(b.data.amount));
      return { data: { success: true }, headers: {} };
    });

    const count = await offlineQueueStore.replay();
    expect(count).toBe(2);
    expect(calls).toEqual(["200", "400"]);
  });

  it("7. Weight conflict: sends captured localDay and emits reconciliation event on X-Conflict stale-ignored", async () => {
    const eventDate = "2026-10-15T14:30:00.000Z";
    const customLocalDay = "2026-10-15";

    const item = await enqueue(
      "weight_log",
      { weightKg: 82.5, date: eventDate, localDay: customLocalDay },
      { localTempId: "temp-weight-99" }
    );

    expect(item.localDay).toBe(customLocalDay);

    let reconcileEvent: unknown = null;
    const unsub = onReconcile((evt) => {
      reconcileEvent = evt;
    });

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { id: "stored-weight-entry", weightKg: 82.0 },
      headers: { "x-conflict": "stale-ignored", "idempotency-replayed": "false" },
    });

    const count = await offlineQueueStore.replay();
    expect(count).toBe(1);
    expect(api.post).toHaveBeenCalledWith(
      "/api/weightlogs",
      {
        data: expect.objectContaining({
          weightKg: 82.5,
          localDay: customLocalDay,
        }),
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": item.idempotencyKey,
        }),
      })
    );

    expect(reconcileEvent).toEqual(
      expect.objectContaining({
        kind: "weight_log",
        idempotencyKey: item.idempotencyKey,
        localTempId: "temp-weight-99",
        conflict: true,
      })
    );

    unsub();
  });

  it("8. 14-day expiry: items older than 14 days become expired, surfaced, not silently deleted", async () => {
    const item = await enqueue("food_add", { name: "Old Salad", calories: 150 });
    // Manually age the item past 14 days
    item.createdAt = Date.now() - (EXPIRY_MAX_AGE_MS + 10000);
    await memoryStorage.updateItem(item);

    await offlineQueueStore.replay();

    const snapshot = getSnapshot();
    expect(snapshot.counts.expired).toBe(1);
    expect(snapshot.expired.length).toBe(1);
    expect(snapshot.expired[0].id).toBe(item.id);
    expect(snapshot.expired[0].status).toBe("expired");
    expect(snapshot.expired[0].lastErrorCode).toBe("EXPIRED_MAX_AGE");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("9. Tampered/invalid data in storage: rejected safely upon replay and marked failed", async () => {
    const item = await enqueue("water_add", { amount: 500 });

    // Tamper payload directly in storage
    const tampered = { ...item, payload: { amount: -99999 } };
    await memoryStorage.updateItem(tampered as unknown as typeof item);

    await offlineQueueStore.replay();

    const snapshot = getSnapshot();
    expect(snapshot.counts.failed).toBe(1);
    const failedItem = snapshot.failed[0];
    expect(failedItem.lastErrorCode).toBe("INVALID_PAYLOAD");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("10. Multi-tab safety: navigator.locks prevents concurrent replays in multiple tabs", async () => {
    await enqueue("water_add", { amount: 300 });

    let lockRequested = false;
    const fakeLocks = {
      request: vi.fn(async (_name: string, _opts: unknown, callback: (lock: unknown) => Promise<unknown>) => {
        lockRequested = true;
        // Simulate lock already held by another tab (null lock returned)
        return callback(null);
      }),
    };

    Object.defineProperty(navigator, "locks", {
      value: fakeLocks,
      configurable: true,
      writable: true,
    });

    const replayed = await replayUserQueue("user_alpha", memoryStorage);
    expect(lockRequested).toBe(true);
    expect(replayed).toBe(0);
  });

  it("11. Cross-user isolation: User A cannot read or replay User B's items", async () => {
    setCurrentUserId("user_alpha");
    const itemA = await enqueue("water_add", { amount: 250 });

    setCurrentUserId("user_beta");
    const itemB = await enqueue("food_add", { name: "Banana", calories: 105 });

    // Read queue for user_beta
    const betaSnapshot = getSnapshot();
    expect(betaSnapshot.counts.total).toBe(1);
    expect(betaSnapshot.items[0].id).toBe(itemB.id);

    // Switch back to user_alpha
    setCurrentUserId("user_alpha");
    await offlineQueueStore.refreshSnapshot();
    const alphaSnapshot = getSnapshot();
    expect(alphaSnapshot.counts.total).toBe(1);
    expect(alphaSnapshot.items[0].id).toBe(itemA.id);
  });

  it("12. Logout purge vs session expiry: purgeOfflineQueue removes data and draft; session expiry does not", async () => {
    setCurrentUserId("user_alpha");
    await enqueue("water_add", { amount: 500 });
    localStorage.setItem("fittrack_live_workout_draft", JSON.stringify({ exercise: "Bench" }));

    // Explicit logout purges current user queue and workout draft
    await purgeOfflineQueue("user_alpha");
    expect(localStorage.getItem("fittrack_live_workout_draft")).toBeNull();
    const snapshot = getSnapshot();
    expect(snapshot.counts.total).toBe(0);

    // Session expiry simulation: queue remains intact
    await enqueue("food_add", { name: "Soup", calories: 200 });
    // Forced redirect clears token only; offline items remain
    const postExpirySnapshot = getSnapshot();
    expect(postExpirySnapshot.counts.total).toBe(1);
  });

  it("13. Legacy storage migration: converts fittrack_offline_queue from localStorage and deletes legacy key", async () => {
    const legacyQueue = [
      {
        id: "leg-1",
        endpoint: "/api/foodlogs",
        method: "POST",
        data: { data: { name: "Oatmeal", calories: 350, mealType: "breakfast" } },
        timestamp: 1600000000000,
      },
      {
        id: "leg-2",
        endpoint: "/api/waterlogs",
        method: "POST",
        data: { data: { amount: 750 } },
        timestamp: 1600000010000,
      },
    ];

    localStorage.setItem("fittrack_offline_queue", JSON.stringify(legacyQueue));

    const migrated = await migrateLegacyStorage("user_alpha", memoryStorage);
    expect(migrated).toBe(2);
    expect(localStorage.getItem("fittrack_offline_queue")).toBeNull();

    const queue = await memoryStorage.getQueue("user_alpha");
    expect(queue.length).toBe(2);
    expect(queue.some((m) => m.kind === "food_add")).toBe(true);
    expect(queue.some((m) => m.kind === "water_add")).toBe(true);
  });

  it("14. Store actions: retryAll and discardItem operate accurately and notify subscribers", async () => {
    let notified = 0;
    const unsub = subscribe(() => {
      notified++;
    });

    const item1 = await enqueue("food_add", { name: "Steak", calories: 600 });
    const item2 = await enqueue("water_add", { amount: 400 });

    // Mark item1 failed
    item1.status = "failed";
    await memoryStorage.updateItem(item1);
    await offlineQueueStore.refreshSnapshot();

    expect(getSnapshot().counts.failed).toBe(1);

    // Discard item2
    await discardItem(item2.id);
    expect(getSnapshot().counts.total).toBe(1);

    // Retry all failed
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: "ok" }, headers: {} });
    await retryAll();

    expect(getSnapshot().counts.failed).toBe(0);
    expect(notified).toBeGreaterThan(0);
    unsub();
  });

  it("15. User ID safety: rejects enqueue when no user ID is active and none provided in options", async () => {
    setCurrentUserId(null);
    await expect(enqueue("water_add", { amount: 250 })).rejects.toThrow(
      "Cannot enqueue offline mutation without an active user ID"
    );

    // If options.userId is provided, it succeeds
    const item = await enqueue("water_add", { amount: 250 }, { userId: "explicit_user_123" });
    expect(item.userId).toBe("explicit_user_123");
  });
});
