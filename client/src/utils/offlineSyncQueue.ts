import api from '../configs/api';
import toast from 'react-hot-toast';

export interface QueuedMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data: unknown;
  description?: string;
  timestamp: number;
}

const DB_NAME = 'fittrack_offline_db';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;
const LOCAL_STORAGE_KEY = 'fittrack_offline_queue';

/**
 * Opens IndexedDB database with fallbacks.
 */
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * LocalStorage fallback helpers
 */
const getLocalStorageQueue = (): QueuedMutation[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalStorageQueue = (queue: QueuedMutation[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota errors
  }
};

/**
 * Enqueues a workout or food mutation into the offline store.
 */
export const enqueueOfflineMutation = async (
  mutation: Omit<QueuedMutation, 'id' | 'timestamp'>
): Promise<QueuedMutation> => {
  const queuedItem: QueuedMutation = {
    ...mutation,
    id: `mut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(queuedItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage
    const current = getLocalStorageQueue();
    current.push(queuedItem);
    saveLocalStorageQueue(current);
  }

  return queuedItem;
};

/**
 * Retrieves all pending offline mutations.
 */
export const getOfflineQueue = async (): Promise<QueuedMutation[]> => {
  try {
    const db = await openDB();
    return await new Promise<QueuedMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return getLocalStorageQueue();
  }
};

/**
 * Removes a mutation from the offline queue after successful replay.
 */
export const removeOfflineMutation = async (id: string): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const current = getLocalStorageQueue();
    const filtered = current.filter((m) => m.id !== id);
    saveLocalStorageQueue(filtered);
  }
};

let isReplaying = false;

/**
 * Replays all pending mutations sequentially over the API.
 */
export const replayOfflineQueue = async (
  onItemReplayed?: (mutation: QueuedMutation, result: unknown) => void
): Promise<number> => {
  if (isReplaying || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 0;
  }

  isReplaying = true;
  let replayedCount = 0;

  try {
    const queue = await getOfflineQueue();
    if (queue.length === 0) return 0;

    toast.loading(`Replaying ${queue.length} offline workout changes...`, {
      id: 'replay-toast',
    });

    for (const item of queue) {
      try {
        let res;
        if (item.method === 'POST') {
          res = await api.post(item.endpoint, item.data);
        } else if (item.method === 'PUT') {
          res = await api.put(item.endpoint, item.data);
        } else if (item.method === 'PATCH') {
          res = await api.patch(item.endpoint, item.data);
        } else if (item.method === 'DELETE') {
          res = await api.delete(item.endpoint);
        }

        await removeOfflineMutation(item.id);
        replayedCount++;
        onItemReplayed?.(item, res?.data);
      } catch (err: unknown) {
        // Stop replay if network is truly down
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }

        // Drop invalid mutations (e.g. 400 Bad Request, 404 Not Found, 422 Unprocessable)
        // so they do not poison the offline queue indefinitely. Keep 429 and 5xx to retry later.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          await removeOfflineMutation(item.id);
        }
      }
    }

    if (replayedCount > 0) {
      toast.success(`Synced ${replayedCount} workout sessions to cloud!`, {
        id: 'replay-toast',
      });
    } else {
      toast.dismiss('replay-toast');
    }
  } finally {
    isReplaying = false;
  }

  return replayedCount;
};

/**
 * Subscribes to browser window 'online' event to automatically replay queued mutations.
 */
export const initOfflineSync = (
  onItemReplayed?: (mutation: QueuedMutation, result: unknown) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    replayOfflineQueue(onItemReplayed);
  };

  window.addEventListener('online', handleOnline);

  // Check immediately if online and items exist
  if (navigator.onLine) {
    replayOfflineQueue(onItemReplayed);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
};
