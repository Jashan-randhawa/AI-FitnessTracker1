import type { ProposedChatAction } from "../../schemas/chatAction.schema";
import {
} from "../../utils/fitbotHistory";

export const ActionConfirmationCard = ({
  action,
  status,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  action: ProposedChatAction;
  status: "pending" | "logging" | "logged" | "dismissed";
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) => {
  if (status === "dismissed") return null;

  if (status === "logged") {
    return (
      <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-base">💧</span>
          <div>
            <span className="font-bold text-emerald-800 dark:text-emerald-300">
              Logged {action.amountMl} ml water
            </span>
            {action.label && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 ml-1.5">
                ({action.label})
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 transition-colors cursor-pointer"
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/50 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-base shrink-0 mt-0.5">
          💧
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900 dark:text-white">
            Log Water Intake
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
            <span className="font-bold text-cyan-700 dark:text-cyan-300">{action.amountMl} ml</span>
            {action.label ? ` • ${action.label}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={onDismiss}
          disabled={status === "logging"}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={status === "logging"}
          className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-xs font-bold text-white shadow-xs shadow-cyan-600/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {status === "logging" ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Logging…</span>
            </>
          ) : (
            <>
              <span>✓ Confirm & Log</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ── Memoized Chat Message Item ─────────────────────────────

