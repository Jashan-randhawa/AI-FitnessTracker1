import React, { useState } from "react";
import { useOfflineSync } from "../../offline/OfflineSyncContext";
import { AlertTriangle, RefreshCw } from "lucide-react";

export const LogoutWarningModal: React.FC = () => {
  const {
    isLogoutWarningOpen,
    cancelLogoutPrompt,
    confirmLogoutPrompt,
    snapshot,
    isOnline,
    syncNow,
  } = useOfflineSync();

  const [isSyncingFirst, setIsSyncingFirst] = useState(false);

  if (!isLogoutWarningOpen) return null;

  const count = snapshot.counts.total;

  const handleSyncFirst = async () => {
    setIsSyncingFirst(true);
    try {
      await syncNow();
      // If all synced, proceed with logout
      const currentSnapshot = snapshot;
      if (currentSnapshot.counts.total === 0) {
        await confirmLogoutPrompt();
      }
    } finally {
      setIsSyncingFirst(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-2xl p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="logout-warning-title" className="text-sm font-bold text-slate-900 dark:text-white">
              Unsynced Changes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You have {count} unsynced {count === 1 ? "entry" : "entries"}.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Logging out will permanently discard your local offline entries to protect your privacy on shared devices.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          {isOnline && (
            <button
              onClick={handleSyncFirst}
              disabled={isSyncingFirst}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirst ? "animate-spin" : ""}`} />
              <span>{isSyncingFirst ? "Syncing..." : "Sync First"}</span>
            </button>
          )}

          <button
            onClick={confirmLogoutPrompt}
            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
          >
            Discard and Log Out
          </button>

          <button
            onClick={cancelLogoutPrompt}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
