import {
  type QueuedMutation,
  type OfflineMutationKind,
  validateMutationPayload,
  generateIdempotencyKey,
} from "./types";
import { localDayKey } from "../utils/localDay";

export interface OfflineStorageAdapter {
  getQueue(userId: string): Promise<QueuedMutation[]>;
  saveItem(item: QueuedMutation): Promise<void>;
  updateItem(item: QueuedMutation): Promise<void>;
  removeItem(id: string): Promise<void>;
  hasItem(id: string): Promise<boolean>;
  deleteQueue(userId: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class MemoryStorageAdapter implements OfflineStorageAdapter {
  private store = new Map<string, QueuedMutation>();

  async getQueue(userId: string): Promise<QueuedMutation[]> {
    return Array.from(this.store.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveItem(item: QueuedMutation): Promise<void> {
    this.store.set(item.id, { ...item });
  }

  async updateItem(item: QueuedMutation): Promise<void> {
    this.store.set(item.id, { ...item });
  }

  async removeItem(id: string): Promise<void> {
    this.store.delete(id);
  }

  async hasItem(id: string): Promise<boolean> {
    return this.store.has(id);
  }

  async deleteQueue(userId: string): Promise<void> {
    for (const [id, item] of this.store.entries()) {
      if (item.userId === userId) {
        this.store.delete(id);
      }
    }
  }

  async clearAll(): Promise<void> {
    this.store.clear();
  }
}

const DB_NAME = "fittrack_offline_v2";
const STORE_NAME = "mutations_v2";
const DB_VERSION = 1;

export class IndexedDBStorageAdapter implements OfflineStorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private fallbackMemory: MemoryStorageAdapter | null = null;

  private async openDB(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      throw new Error("IndexedDB is not supported");
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
              store.createIndex("userId", "userId", { unique: false });
              store.createIndex("createdAt", "createdAt", { unique: false });
            }
          };

          request.onsuccess = () => resolve(request.result);
          request.onerror = () => {
            this.dbPromise = null;
            reject(request.error);
          };
        } catch (err) {
          this.dbPromise = null;
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  private getFallback(): MemoryStorageAdapter {
    if (!this.fallbackMemory) {
      this.fallbackMemory = new MemoryStorageAdapter();
    }
    return this.fallbackMemory;
  }

  async getQueue(userId: string): Promise<QueuedMutation[]> {
    try {
      const db = await this.openDB();
      return await new Promise<QueuedMutation[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as QueuedMutation[];
          const userItems = all
            .filter((item) => item.userId === userId)
            .sort((a, b) => a.createdAt - b.createdAt);
          resolve(userItems);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().getQueue(userId);
    }
  }

  async saveItem(item: QueuedMutation): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      await this.getFallback().saveItem(item);
    }
  }

  async updateItem(item: QueuedMutation): Promise<void> {
    return this.saveItem(item);
  }

  async removeItem(id: string): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      await this.getFallback().removeItem(id);
    }
  }

  async hasItem(id: string): Promise<boolean> {
    try {
      const db = await this.openDB();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(Boolean(req.result));
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFallback().hasItem(id);
    }
  }

  async deleteQueue(userId: string): Promise<void> {
    try {
      const db = await this.openDB();
      const items = await this.getQueue(userId);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        for (const item of items) {
          store.delete(item.id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      await this.getFallback().deleteQueue(userId);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      await this.getFallback().clearAll();
    }
  }
}

/**
 * Creates the default storage adapter for the runtime environment.
 */
export const createDefaultStorageAdapter = (): OfflineStorageAdapter => {
  if (typeof window !== "undefined" && window.indexedDB) {
    return new IndexedDBStorageAdapter();
  }
  return new MemoryStorageAdapter();
};

interface LegacyQueueItem {
  id?: string;
  endpoint?: string;
  method?: string;
  data?: unknown;
  description?: string;
  timestamp?: number;
}

const LEGACY_STORAGE_KEY = "fittrack_offline_queue";
const LEGACY_DB_NAME = "fittrack_offline_db";
const LEGACY_STORE_NAME = "mutations";

const mapEndpointToKind = (endpoint = ""): OfflineMutationKind | null => {
  if (endpoint.includes("/waterlogs")) return "water_add";
  if (endpoint.includes("/weightlogs")) return "weight_log";
  if (endpoint.includes("/foodlogs")) return "food_add";
  if (endpoint.includes("/activitylogs")) return "activity_add";
  return null;
};

/**
 * One-time migration: reads legacy 'fittrack_offline_queue' (localStorage) and
 * 'fittrack_offline_db' store 'mutations', converts valid items, then DELETES legacy data.
 */
export const migrateLegacyStorage = async (
  userId: string,
  storage: OfflineStorageAdapter
): Promise<number> => {
  if (!userId) return 0;
  let migratedCount = 0;

  // 1. Migrate localStorage legacy queue
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LegacyQueueItem[];
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const kind = mapEndpointToKind(item.endpoint);
            if (!kind) continue;

            const payloadRaw =
              item.data && typeof item.data === "object" && "data" in item.data
                ? (item.data as { data: unknown }).data
                : item.data;

            try {
              const validated = validateMutationPayload(kind, payloadRaw);
              const createdAt = item.timestamp || Date.now();
              const eventDate =
                (validated as { date?: string }).date || new Date(createdAt).toISOString();
              const localDay =
                kind === "weight_log"
                  ? (validated as { localDay?: string }).localDay || localDayKey(new Date(createdAt))
                  : undefined;

              const newItem: QueuedMutation = {
                id: item.id || `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                userId,
                kind,
                payload: validated,
                idempotencyKey: generateIdempotencyKey(),
                createdAt,
                eventDate,
                localDay,
                status: "pending",
                attempts: 0,
                nextAttemptAt: 0,
              };

              await storage.saveItem(newItem);
              migratedCount++;
            } catch {
              // Ignore invalid legacy payloads
            }
          }
        }
      }
    } catch {
      // Ignore parse/read errors
    } finally {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        // Ignore removal error
      }
    }
  }

  // 2. Migrate IndexedDB legacy store if present
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.open(LEGACY_DB_NAME);
        req.onerror = () => resolve();
        req.onsuccess = async () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
            db.close();
            try {
              indexedDB.deleteDatabase(LEGACY_DB_NAME);
            } catch {
              // Ignore
            }
            return resolve();
          }

          try {
            const tx = db.transaction(LEGACY_STORE_NAME, "readonly");
            const store = tx.objectStore(LEGACY_STORE_NAME);
            const getAllReq = store.getAll();

            getAllReq.onsuccess = async () => {
              const items = (getAllReq.result || []) as LegacyQueueItem[];
              for (const item of items) {
                const kind = mapEndpointToKind(item.endpoint);
                if (!kind) continue;

                const payloadRaw =
                  item.data && typeof item.data === "object" && "data" in item.data
                    ? (item.data as { data: unknown }).data
                    : item.data;

                try {
                  const validated = validateMutationPayload(kind, payloadRaw);
                  const createdAt = item.timestamp || Date.now();
                  const eventDate =
                    (validated as { date?: string }).date || new Date(createdAt).toISOString();
                  const localDay =
                    kind === "weight_log"
                      ? (validated as { localDay?: string }).localDay ||
                        localDayKey(new Date(createdAt))
                      : undefined;

                  const newItem: QueuedMutation = {
                    id:
                      item.id ||
                      `migrated-idb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    userId,
                    kind,
                    payload: validated,
                    idempotencyKey: generateIdempotencyKey(),
                    createdAt,
                    eventDate,
                    localDay,
                    status: "pending",
                    attempts: 0,
                    nextAttemptAt: 0,
                  };

                  await storage.saveItem(newItem);
                  migratedCount++;
                } catch {
                  // Ignore invalid
                }
              }
              db.close();
              try {
                indexedDB.deleteDatabase(LEGACY_DB_NAME);
              } catch {
                // Ignore
              }
              resolve();
            };

            getAllReq.onerror = () => {
              db.close();
              resolve();
            };
          } catch {
            db.close();
            resolve();
          }
        };
      });
    } catch {
      // Ignore
    }
  }

  return migratedCount;
};
