import React from "react";
import { useOfflineSync } from "../../offline/OfflineSyncContext";
import {
  Cloud,
  CloudOff,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";

export interface SyncStatusIndicatorProps {
  className?: string;
  variant?: "badge" | "compact" | "pill" | "bottomNav";
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  className = "",
  variant = "pill",
}) => {
  const { snapshot, isOnline, setIsSheetOpen } = useOfflineSync();
  const { counts, isReplaying } = snapshot;

  // Determine current display state
  let state: "synced" | "offline" | "syncing" | "waiting" | "needs_auth" | "attention" = "synced";
  let label = "Synced";
  let ariaAnnouncement = "All changes synced";
  let icon = <Cloud className="w-3.5 h-3.5 text-emerald-500" />;
  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50";

  if (counts.needs_auth > 0) {
    state = "needs_auth";
    label = "Sign in to sync";
    ariaAnnouncement = "Authentication needed to sync offline entries";
    icon = <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />;
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50";
  } else if (counts.failed > 0 || counts.expired > 0 || counts.conflict > 0) {
    const attentionCount = counts.failed + counts.expired + counts.conflict;
    state = "attention";
    label = `${attentionCount} need attention`;
    ariaAnnouncement = `${attentionCount} offline changes need attention`;
    icon = <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
    badgeColor = "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/50";
  } else if (isReplaying || counts.syncing > 0) {
    state = "syncing";
    label = counts.syncing > 1 ? `Syncing ${counts.syncing}` : "Syncing...";
    ariaAnnouncement = "Syncing offline entries with server";
    icon = <RefreshCw className="w-3.5 h-3.5 text-blue-500 motion-safe:animate-spin" />;
    badgeColor = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50";
  } else if (!isOnline) {
    state = "offline";
    label = counts.total > 0 ? `${counts.total} will sync later` : "Offline";
    ariaAnnouncement = "Device is offline. Changes will sync later.";
    icon = <CloudOff className="w-3.5 h-3.5 text-amber-500" />;
    badgeColor = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50";
  } else if (counts.pending > 0) {
    state = "waiting";
    label = `${counts.pending} waiting`;
    ariaAnnouncement = `${counts.pending} offline changes waiting to sync`;
    icon = <Clock className="w-3.5 h-3.5 text-amber-500" />;
    badgeColor = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50";
  }

  // When completely synced and online, keep subtle/minimal or hidden
  if (state === "synced") {
    if (variant === "bottomNav") {
      return null;
    }
    if (variant === "compact") {
      return (
        <button
          onClick={() => setIsSheetOpen(true)}
          aria-label="Offline sync status: Synced"
          title="Sync status: All changes synced"
          className={`p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${className}`}
        >
          <span className="sr-only" aria-live="polite">
            {ariaAnnouncement}
          </span>
          <Cloud className="w-4 h-4 text-emerald-500/80" />
        </button>
      );
    }
  }

  return (
    <>
      <span className="sr-only" aria-live="polite" role="status">
        {ariaAnnouncement}
      </span>

      <button
        onClick={() => setIsSheetOpen(true)}
        aria-label={`Sync status: ${label}. Tap to view offline queue.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer select-none ${badgeColor} ${className}`}
      >
        {icon}
        <span>{label}</span>
      </button>
    </>
  );
};
