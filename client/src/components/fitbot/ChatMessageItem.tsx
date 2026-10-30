import React from "react";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import { formatTime } from "./fitbotHelpers";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  RotateCcw,
  UserIcon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { FitBotAvatar } from "../../components/FitBotAvatar";
import { MarkdownMessage } from "../../components/MarkdownMessage";
import type { ProposedChatAction } from "../../schemas/chatAction.schema";
import { FITBOT_CONFIG } from "../../constants/fitbot";
import {
  type FitBotMessage as Message,
} from "../../utils/fitbotHistory";

export interface ChatMessageItemProps {
  msg: Message;
  isLast: boolean;
  isLoading: boolean;
  isCopied: boolean;
  isSpeaking: boolean;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onSpeakToggle: (id: string, text: string) => void;
  onRetry: () => void;
  onSavePlan?: (title: string, markdown: string) => void;
  onConfirmAction?: (msgId: string, actionIndex: number, action: ProposedChatAction) => void;
  onDismissAction?: (msgId: string, actionIndex: number) => void;
  onUndoAction?: (msgId: string, actionIndex: number, loggedId: string) => void;
}

export const ChatMessageItem = React.memo(({
  msg,
  isLast,
  isLoading,
  isCopied,
  isSpeaking,
  onCopy,
  onRegenerate,
  onSpeakToggle,
  onRetry,
  onSavePlan,
  onConfirmAction,
  onDismissAction,
  onUndoAction,
}: ChatMessageItemProps) => {
  const isAssistant = msg.role === "assistant";

  if (isAssistant) {
    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex gap-2.5 sm:gap-3.5 items-start w-full group py-1 transform-gpu"
      >
        <FitBotAvatar
          size="sm"
          state={msg.isError ? "error" : "idle"}
          className="mt-0.5 shrink-0"
        />

        <div className="flex-1 min-w-0">
          {/* Header row: FitBot, AI Coach role badge, Timestamp */}
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
            <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
              {FITBOT_CONFIG.NAME}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              {FITBOT_CONFIG.ROLE}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
              {formatTime(msg.timestamp)}
            </span>
            {isSpeaking && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium animate-pulse">
                <Volume2 className="w-3 h-3 shrink-0" />
                <span>Speaking…</span>
              </span>
            )}
          </div>

          {/* Unboxed Content */}
          {msg.isError ? (
            <div className="rounded-xl p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200">
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{msg.text}</p>
              <button
                onClick={onRetry}
                disabled={isLoading}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer active:scale-95 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Request</span>
              </button>
            </div>
          ) : (
            <div className="w-full text-slate-800 dark:text-slate-200">
              <MarkdownMessage content={msg.text} onSavePlan={onSavePlan} />
              {/* Phase 2: Action Executed Pill Badge */}
              {Array.isArray(msg.executedActions) && msg.executedActions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {msg.executedActions.map((action, aIdx) => (
                    <span
                      key={aIdx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Action Executed: {action.action === "logMealItem" ? `Logged ${action.foodName || "Meal"}` : action.action === "logWorkoutSession" ? `Logged ${action.exerciseName || "Workout"}` : action.action === "swapExerciseInPlan" ? `Swapped ${action.targetExercise}` : action.action}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(msg.proposedActions) && msg.proposedActions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {msg.proposedActions.map((item, aIdx) => (
                    <ActionConfirmationCard
                      key={aIdx}
                      action={item.action}
                      status={item.status}
                      onConfirm={() => onConfirmAction?.(msg.id, aIdx, item.action)}
                      onDismiss={() => onDismissAction?.(msg.id, aIdx)}
                      onUndo={() => item.loggedId && onUndoAction?.(msg.id, aIdx, item.loggedId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions row: Copy, Speak, Regenerate */}
          {!msg.isError && (
            <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
              <button
                onClick={() => onCopy(msg.id, msg.text)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Copy response"
                title="Copy response"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[11px] text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onSpeakToggle(msg.id, msg.text)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isSpeaking
                    ? "bg-emerald-500/15 text-emerald-500 font-medium"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                aria-label={isSpeaking ? "Stop speaking" : "Listen (Read aloud)"}
                title={isSpeaking ? "Stop speaking" : "Listen (Read aloud)"}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{isSpeaking ? "Stop" : "Listen"}</span>
              </button>

              {isLast && !isLoading && (
                <button
                  onClick={onRegenerate}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label="Regenerate response"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // User Message (Right-aligned compact bubble)
  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-2 sm:gap-3 flex-row-reverse items-end w-full group py-1 transform-gpu"
    >
      <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white shadow-xs bg-emerald-500 mb-1">
        <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </div>

      <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-3.5 py-2.5 sm:px-4 sm:py-3 bg-emerald-500 text-white shadow-xs">
        <p className="text-[15px] sm:text-[16px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        <div className="flex items-center justify-end gap-1.5 mt-1 text-[11px] text-emerald-100/90">
          <span>{formatTime(msg.timestamp)}</span>
          <button
            onClick={() => onCopy(msg.id, msg.text)}
            className="p-1 rounded-md hover:bg-emerald-600 text-emerald-100 transition-all cursor-pointer active:scale-90"
            aria-label="Copy user message"
            title="Copy"
          >
            {isCopied ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

ChatMessageItem.displayName = "ChatMessageItem";

// ── Main AIAssistant Component ─────────────────────────────

