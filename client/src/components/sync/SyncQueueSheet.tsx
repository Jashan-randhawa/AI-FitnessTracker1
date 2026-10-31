import React, { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { useOfflineSync } from "../../offline/OfflineSyncContext";
import {
  type QueuedMutation,
  type WaterPayload,
  type WeightPayload,
  type FoodPayload,
  type ActivityPayload,
} from "../../offline/types";
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  WifiOff,
  CheckCircle2,
  Droplet,
  Scale,
  Utensils,
  Dumbbell,
  ShieldAlert,
} from "lucide-react";

const getMutationDetails = (item: QueuedMutation): { icon: typeof Droplet; title: string; subtitle: string } => {
  switch (item.kind) {
    case "water_add": {
      const p = item.payload as WaterPayload;
      return {
        icon: Droplet,
        title: "Water Log",
        subtitle: `${p?.amount ?? 0} ml`,
      };
    }
    case "weight_log": {
      const p = item.payload as WeightPayload;
      return {
        icon: Scale,
        title: "Weight Entry",
        subtitle: `${p?.weightKg ?? 0} kg${item.localDay ? ` · ${item.localDay}` : ""}`,
      };
    }
    case "food_add": {
      const p = item.payload as FoodPayload;
      return {
        icon: Utensils,
        title: p?.name || "Meal Entry",
        subtitle: `${p?.calories ?? 0} kcal${p?.mealType ? ` · ${p.mealType}` : ""}`,
      };
    }
    case "activity_add": {
      const p = item.payload as ActivityPayload;
      return {
        icon: Dumbbell,
        title: p?.name || "Workout",
        subtitle: `${p?.duration ?? 0} min${p?.calories ? ` · ${p.calories} kcal` : ""}`,
      };
    }
    default:
      return {
        icon: Clock,
        title: "Offline Mutation",
        subtitle: item.kind,
      };
  }
};

const formatTime = (timestamp: number): string => {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export const SyncQueueSheet: React.FC = () => {
  const {
    snapshot,
    isOnline,
    isSheetOpen,
    setIsSheetOpen,
    syncNow,
    retryMutation,
    discardMutation,
    retryAllMutations,
  } = useOfflineSync();

  const [confirmingDiscardId, setConfirmingDiscardId] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryAll = async () => {
    setIsRetrying(true);
    try {
      await retryAllMutations();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSyncNow = async () => {
    setIsRetrying(true);
    try {
      await syncNow();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleConfirmDiscard = async (id: string) => {
    await discardMutation(id);
    setConfirmingDiscardId(null);
  };

  const items = snapshot.items;
  const hasFailedOrExpired = snapshot.counts.failed > 0 || snapshot.counts.expired > 0 || snapshot.counts.needs_auth > 0;

  return (
    <BottomSheet
      isOpen={isSheetOpen}
      onClose={() => {
        setIsSheetOpen(false);
        setConfirmingDiscardId(null);
      }}
      title="Offline Sync Queue"
      className="max-w-xl mx-auto"
    >
      <div className="space-y-4 pt-1 pb-4">
        {/* Status Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            {isOnline ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <WifiOff className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isOnline ? "Device is Online" : "Device is Offline"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {items.length === 0
                  ? "All entries are synced to the cloud."
                  : `${items.length} ${items.length === 1 ? "entry" : "entries"} stored locally.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasFailedOrExpired && (
              <button
                onClick={handleRetryAll}
                disabled={isRetrying || !isOnline}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition-colors cursor-pointer"
              >
                Retry All
              </button>
            )}
            {isOnline && items.length > 0 && !hasFailedOrExpired && (
              <button
                onClick={handleSyncNow}
                disabled={isRetrying || snapshot.isReplaying}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${snapshot.isReplaying ? "animate-spin" : ""}`} />
                <span>Sync Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Queue is empty</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Any changes made while offline or during server reconnects will automatically appear here.
            </p>
          </div>
        ) : (
          /* Item List */
          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
            {items.map((item) => {
              const { icon: Icon, title, subtitle } = getMutationDetails(item);
              const isConfirming = confirmingDiscardId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 shadow-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {subtitle} · {formatTime(item.createdAt)}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {item.status === "syncing" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Syncing
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          <Clock className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                      {item.status === "needs_auth" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Sign in to sync
                        </span>
                      )}
                      {item.status === "conflict" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Conflict
                        </span>
                      )}
                      {item.status === "expired" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          Expired
                        </span>
                      )}
                      {item.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informational Explanations */}
                  {item.status === "conflict" && (
                    <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-[11px] text-purple-700 dark:text-purple-300">
                      A newer weigh-in for that day was kept.
                    </div>
                  )}

                  {item.status === "expired" && (
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400">
                      Item expired after 14 days offline.
                    </div>
                  )}

                  {item.status === "failed" && item.lastErrorMessage && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400">
                      {item.lastErrorMessage}
                    </div>
                  )}

                  {/* Item Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                    {isConfirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Discard entry?
                        </span>
                        <button
                          onClick={() => handleConfirmDiscard(item.id)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmingDiscardId(null)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {(item.status === "failed" ||
                          item.status === "needs_auth" ||
                          item.status === "expired") && (
                          <button
                            onClick={() => retryMutation(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmingDiscardId(item.id)}
                          title="Discard entry"
                          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Discard</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
