import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import toast from "react-hot-toast";
import {
  subscribe,
  getSnapshot,
  startOfflineSync,
  stopOfflineSync,
  onReconcile,
  retryItem,
  discardItem,
  retryAll,
  type OfflineQueueSnapshot,
  type ReconciliationEvent,
} from "./index";
import { useappcontext } from "../Context/AppContext";

interface OfflineSyncContextValue {
  snapshot: OfflineQueueSnapshot;
  isOnline: boolean;
  isSheetOpen: boolean;
  setIsSheetOpen: (open: boolean) => void;
  syncNow: () => Promise<void>;
  retryMutation: (id: string) => Promise<void>;
  discardMutation: (id: string) => Promise<void>;
  retryAllMutations: () => Promise<void>;
  promptLogoutWithWarning: (onConfirmLogout: () => Promise<void> | void) => void;
  cancelLogoutPrompt: () => void;
  confirmLogoutPrompt: () => Promise<void>;
  isLogoutWarningOpen: boolean;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export const OfflineSyncProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useappcontext();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLogoutWarningOpen, setIsLogoutWarningOpen] = useState(false);
  const pendingLogoutCallbackRef = useRef<(() => Promise<void> | void) | null>(null);

  // Sync batch toast tracking: fire at most one toast per replay batch
  const replayedCountRef = useRef(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Listen to reconciliation events and debounce sync batch success toast
  useEffect(() => {
    return onReconcile((_event: ReconciliationEvent) => {
      replayedCountRef.current += 1;

      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = setTimeout(() => {
        const count = replayedCountRef.current;
        replayedCountRef.current = 0;
        if (count > 0) {
          toast.success(
            `Synced ${count} offline ${count === 1 ? "entry" : "entries"} to cloud ☁️`,
            { id: "offline-sync-batch-success" }
          );
        }
      }, 600);
    });
  }, []);

  // Start engine triggers when authenticated user is present
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      stopOfflineSync();
      return;
    }
    startOfflineSync(userId);
    return () => {
      // Don't purge on unmount, just pause triggers
    };
  }, [userId]);

  const syncNow = useCallback(async () => {
    return await retryAll();
  }, []);

  const retryMutation = useCallback(async (id: string) => {
    await retryItem(id);
  }, []);

  const discardMutation = useCallback(async (id: string) => {
    await discardItem(id);
  }, []);

  const retryAllMutations = useCallback(async () => {
    await retryAll();
  }, []);

  const promptLogoutWithWarning = useCallback(
    (onConfirmLogout: () => Promise<void> | void) => {
      if (snapshot.counts.total > 0) {
        pendingLogoutCallbackRef.current = onConfirmLogout;
        setIsLogoutWarningOpen(true);
      } else {
        onConfirmLogout();
      }
    },
    [snapshot.counts.total]
  );

  const cancelLogoutPrompt = useCallback(() => {
    pendingLogoutCallbackRef.current = null;
    setIsLogoutWarningOpen(false);
  }, []);

  const confirmLogoutPrompt = useCallback(async () => {
    setIsLogoutWarningOpen(false);
    if (pendingLogoutCallbackRef.current) {
      const cb = pendingLogoutCallbackRef.current;
      pendingLogoutCallbackRef.current = null;
      await cb();
    }
  }, []);

  const value: OfflineSyncContextValue = {
    snapshot,
    isOnline,
    isSheetOpen,
    setIsSheetOpen,
    syncNow,
    retryMutation,
    discardMutation,
    retryAllMutations,
    promptLogoutWithWarning,
    cancelLogoutPrompt,
    confirmLogoutPrompt,
    isLogoutWarningOpen,
  };

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

const DEFAULT_CONTEXT_FALLBACK: OfflineSyncContextValue = {
  snapshot: {
    counts: { total: 0, pending: 0, syncing: 0, failed: 0, needs_auth: 0, conflict: 0, expired: 0 },
    items: [],
    failed: [],
    conflict: [],
    expired: [],
    isReplaying: false,
  },
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSheetOpen: false,
  setIsSheetOpen: () => {},
  syncNow: async () => {},
  retryMutation: async () => {},
  discardMutation: async () => {},
  retryAllMutations: async () => {},
  promptLogoutWithWarning: (cb) => cb(),
  cancelLogoutPrompt: () => {},
  confirmLogoutPrompt: async () => {},
  isLogoutWarningOpen: false,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useOfflineSync = (): OfflineSyncContextValue => {
  const ctx = useContext(OfflineSyncContext);
  return ctx || DEFAULT_CONTEXT_FALLBACK;
};
