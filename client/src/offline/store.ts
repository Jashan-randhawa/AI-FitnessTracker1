import {
  type QueuedMutation,
  type OfflineMutationKind,
  type OfflineQueueSnapshot,
  type ReconciliationEvent,
  type AnyOfflinePayload,
  validateMutationPayload,
  generateIdempotencyKey,
} from "./types";
import {
  type OfflineStorageAdapter,
  createDefaultStorageAdapter,
  migrateLegacyStorage,
} from "./storage";
import { replayUserQueue } from "./engine";
import { localDayKey } from "../utils/localDay";

export interface EnqueueOptions {
  localTempId?: string;
  eventDate?: string;
  localDay?: string;
  autoReplay?: boolean;
  userId?: string;
}

const EMPTY_SNAPSHOT: OfflineQueueSnapshot = {
  counts: {
    total: 0,
    pending: 0,
    syncing: 0,
    failed: 0,
    needs_auth: 0,
    conflict: 0,
    expired: 0,
  },
  items: [],
  failed: [],
  conflict: [],
  expired: [],
  isReplaying: false,
};

class OfflineQueueStore {
  private adapter: OfflineStorageAdapter;
  private currentUserId: string | null = null;
  private listeners = new Set<() => void>();
  private reconcileListeners = new Set<(event: ReconciliationEvent) => void>();
  private snapshot: OfflineQueueSnapshot = EMPTY_SNAPSHOT;
  private channel: BroadcastChannel | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isReplayingState = false;
  private isStarted = false;

  constructor(adapter?: OfflineStorageAdapter) {
    this.adapter = adapter || createDefaultStorageAdapter();
    this.initBroadcastChannel();
  }

  public setAdapter(adapter: OfflineStorageAdapter) {
    this.adapter = adapter;
    this.refreshSnapshot();
  }

  public setCurrentUserId(userId: string | null) {
    this.currentUserId = userId;
  }

  private initBroadcastChannel() {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.channel = new BroadcastChannel("fittrack_offline_channel");
        this.channel.onmessage = (evt) => {
          if (
            evt.data &&
            (evt.data.userId === this.currentUserId || !evt.data.userId)
          ) {
            this.refreshSnapshot();
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  private broadcastChange() {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: "OFFLINE_QUEUE_CHANGED",
          userId: this.currentUserId,
        });
      } catch {
        // Ignore broadcast failure
      }
    }
  }

  public getSnapshot = (): OfflineQueueSnapshot => {
    return this.snapshot;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public onReconcile = (
    listener: (event: ReconciliationEvent) => void
  ): (() => void) => {
    this.reconcileListeners.add(listener);
    return () => {
      this.reconcileListeners.delete(listener);
    };
  };

  private emitReconcile(event: ReconciliationEvent) {
    for (const listener of this.reconcileListeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener error from interrupting replay
      }
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  }

  public async refreshSnapshot(): Promise<OfflineQueueSnapshot> {
    if (!this.currentUserId) {
      this.snapshot = EMPTY_SNAPSHOT;
      this.notify();
      return this.snapshot;
    }

    const items = await this.adapter.getQueue(this.currentUserId);
    const failed = items.filter((m) => m.status === "failed");
    const conflict = items.filter((m) => m.status === "conflict");
    const expired = items.filter((m) => m.status === "expired");

    const counts = {
      total: items.length,
      pending: items.filter((m) => m.status === "pending").length,
      syncing: items.filter((m) => m.status === "syncing").length,
      failed: failed.length,
      needs_auth: items.filter((m) => m.status === "needs_auth").length,
      conflict: conflict.length,
      expired: expired.length,
    };

    this.snapshot = {
      counts,
      items,
      failed,
      conflict,
      expired,
      isReplaying: this.isReplayingState,
    };

    this.scheduleNextAttempt(items);
    this.notify();
    return this.snapshot;
  }

  private scheduleNextAttempt(items: QueuedMutation[]) {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    const pendingWithRetry = items.filter(
      (m) => m.status === "pending" && m.nextAttemptAt && m.nextAttemptAt > Date.now()
    );

    if (pendingWithRetry.length === 0) return;

    const earliest = Math.min(...pendingWithRetry.map((m) => m.nextAttemptAt));
    const delay = Math.max(earliest - Date.now(), 500);

    this.timerId = setTimeout(() => {
      this.timerId = null;
      if (this.currentUserId) {
        this.replay();
      }
    }, delay);
  }

  public async startOfflineSync(userId: string): Promise<void> {
    if (!userId) return;
    this.currentUserId = userId;

    if (!this.isStarted) {
      this.isStarted = true;
      if (typeof window !== "undefined") {
        window.addEventListener("online", this.handleOnline);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
      }
    }

    // Run one-time legacy migration
    await migrateLegacyStorage(userId, this.adapter);
    await this.refreshSnapshot();

    // Trigger initial replay if online
    if (typeof navigator === "undefined" || navigator.onLine) {
      this.replay();
    }
  }

  public stopOfflineSync(): void {
    if (this.isStarted) {
      this.isStarted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("online", this.handleOnline);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      }
    }

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.currentUserId = null;
    this.snapshot = EMPTY_SNAPSHOT;
    this.notify();
  }

  private handleOnline = () => {
    if (this.currentUserId) {
      this.replay();
    }
  };

  private handleVisibilityChange = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      this.currentUserId
    ) {
      this.replay();
    }
  };

  public async enqueue<T extends AnyOfflinePayload>(
    kind: OfflineMutationKind,
    payload: T,
    options: EnqueueOptions = {}
  ): Promise<QueuedMutation<T>> {
    const activeUserId = options.userId || this.currentUserId;
    if (!activeUserId) {
      throw new Error("Cannot enqueue offline mutation without an active user ID");
    }

    // Validate payload immediately at enqueue
    const validated = validateMutationPayload(kind, payload) as T;
    const now = Date.now();
    const eventDate = options.eventDate || (payload as { date?: string }).date || new Date(now).toISOString();

    const localDay =
      kind === "weight_log"
        ? options.localDay ||
          (payload as { localDay?: string }).localDay ||
          localDayKey(new Date(eventDate))
        : undefined;

    const item: QueuedMutation<T> = {
      id: `mut-${now}-${Math.random().toString(36).slice(2, 7)}`,
      userId: activeUserId,
      kind,
      payload: validated,
      idempotencyKey: generateIdempotencyKey(),
      createdAt: now,
      eventDate,
      localDay,
      status: "pending",
      attempts: 0,
      nextAttemptAt: 0,
      localTempId: options.localTempId,
    };

    await this.adapter.saveItem(item as QueuedMutation);
    await this.refreshSnapshot();
    this.broadcastChange();

    // Trigger replay if explicitly requested and online
    if (options.autoReplay && (typeof navigator === "undefined" || navigator.onLine)) {
      this.replay();
    }

    return item;
  }

  public async retryItem(id: string): Promise<void> {
    if (!this.currentUserId) return;
    const items = await this.adapter.getQueue(this.currentUserId);
    const item = items.find((m) => m.id === id);
    if (!item) return;

    item.status = "pending";
    item.attempts = 0;
    item.nextAttemptAt = 0;
    item.lastErrorCode = undefined;
    item.lastErrorMessage = undefined;

    await this.adapter.updateItem(item);
    await this.refreshSnapshot();
    this.broadcastChange();

    await this.replay([id]);
  }

  public async discardItem(id: string): Promise<void> {
    if (!this.currentUserId) return;
    await this.adapter.removeItem(id);
    await this.refreshSnapshot();
    this.broadcastChange();
  }

  public async retryAll(): Promise<void> {
    if (!this.currentUserId) return;
    const items = await this.adapter.getQueue(this.currentUserId);
    const idsToRetry: string[] = [];

    for (const item of items) {
      if (
        item.status === "failed" ||
        item.status === "needs_auth" ||
        item.status === "expired"
      ) {
        item.status = "pending";
        item.attempts = 0;
        item.nextAttemptAt = 0;
        item.lastErrorCode = undefined;
        item.lastErrorMessage = undefined;
        await this.adapter.updateItem(item);
        idsToRetry.push(item.id);
      }
    }

    await this.refreshSnapshot();
    this.broadcastChange();

    if (idsToRetry.length > 0) {
      await this.replay(idsToRetry);
    }
  }

  public async replay(forceItemIds?: string[]): Promise<number> {
    if (!this.currentUserId) return 0;

    this.isReplayingState = true;
    this.snapshot = { ...this.snapshot, isReplaying: true };
    this.notify();

    try {
      const count = await replayUserQueue(this.currentUserId, this.adapter, {
        forceItemIds,
        onReconcile: (event) => this.emitReconcile(event),
        onQueueUpdated: () => this.refreshSnapshot(),
      });
      return count;
    } finally {
      this.isReplayingState = false;
      await this.refreshSnapshot();
      this.broadcastChange();
    }
  }

  public async purgeOfflineQueue(userId?: string): Promise<void> {
    const targetUserId = userId || this.currentUserId;
    if (targetUserId) {
      await this.adapter.deleteQueue(targetUserId);
    }

    // Clean legacy storage and draft
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("fittrack_offline_queue");
        localStorage.removeItem("fittrack_live_workout_draft");
      } catch {
        // Ignore
      }
    }

    if (typeof window !== "undefined" && window.indexedDB) {
      try {
        indexedDB.deleteDatabase("fittrack_offline_db");
      } catch {
        // Ignore
      }
    }

    await this.refreshSnapshot();
    this.broadcastChange();
  }

  public async clearAll(): Promise<void> {
    await this.adapter.clearAll();
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("fittrack_offline_queue");
        localStorage.removeItem("fittrack_live_workout_draft");
      } catch {
        // Ignore
      }
    }
    await this.refreshSnapshot();
    this.broadcastChange();
  }
}

export const offlineQueueStore = new OfflineQueueStore();

export const {
  subscribe,
  getSnapshot,
  startOfflineSync,
  stopOfflineSync,
  enqueue,
  retryItem,
  discardItem,
  retryAll,
  purgeOfflineQueue,
  clearAll,
  setCurrentUserId,
  onReconcile,
} = {
  subscribe: offlineQueueStore.subscribe.bind(offlineQueueStore),
  getSnapshot: offlineQueueStore.getSnapshot.bind(offlineQueueStore),
  startOfflineSync: offlineQueueStore.startOfflineSync.bind(offlineQueueStore),
  stopOfflineSync: offlineQueueStore.stopOfflineSync.bind(offlineQueueStore),
  enqueue: offlineQueueStore.enqueue.bind(offlineQueueStore),
  retryItem: offlineQueueStore.retryItem.bind(offlineQueueStore),
  discardItem: offlineQueueStore.discardItem.bind(offlineQueueStore),
  retryAll: offlineQueueStore.retryAll.bind(offlineQueueStore),
  purgeOfflineQueue: offlineQueueStore.purgeOfflineQueue.bind(offlineQueueStore),
  clearAll: offlineQueueStore.clearAll.bind(offlineQueueStore),
  setCurrentUserId: offlineQueueStore.setCurrentUserId.bind(offlineQueueStore),
  onReconcile: offlineQueueStore.onReconcile.bind(offlineQueueStore),
};
