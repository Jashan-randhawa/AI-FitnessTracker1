import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Copy,
  Check,
  RotateCcw,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  History,
  Send,
  User as UserIcon,
  Volume2,
  VolumeX,
  Square,
  Download,
  X,
  Search,
  MessageSquare,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useappcontext } from "../Context/AppContext";
import type { WaterEntry } from "../assets/types";
import api from "../configs/api";
import toast from "react-hot-toast";
import { FitBotAvatar } from "../components/FitBotAvatar";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { buildWorkoutPlanActionPayload, type WorkoutPlanAction } from "../schemas/aiPlans.schema";
import { chatAiAssistant } from "../services/aiAssistantClient";
import type { ProposedChatAction } from "../schemas/chatAction.schema";
import { FITBOT_CONFIG } from "../constants/fitbot";
import {
  type FitBotMessage as Message,
  type FitBotActionState,
  buildGeminiPayload,
  getRetryContext,
  getRegenerateContext,
  buildSessionSummary,
  getValidMessages,
  formatMemoryContext,
} from "../utils/fitbotHistory";
import { createHandoffState, readHandoff, type HandoffPayload } from "../utils/handoff";
import { getFitBotSuggestions } from "../utils/fitbotSuggestions";
import { useDaySummary, invalidateSummaries } from "../data/summaryStore";
import { localDayKey } from "../utils/localDay";
import { getWeatherObservation } from "../data/weatherStore";
import jsPDF from "jspdf";

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((err: SpeechRecognitionErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ── Helpers ───────────────────────────────────────────────
// ── Helper to parse workout routine markdown into structured days ─────────
const parseMarkdownIntoWorkoutDays = (markdown: string) => {
  const lines = markdown.split("\n");
  const days: Array<{ day: string; focus: string; duration: string; exercises: unknown[] }> = [];
  let currentDay: { day: string; focus: string; duration: string; exercises: unknown[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const dayMatch = trimmed.match(
      /^(?:#+\s*|\*\*)?(Day\s*\d+[^:*]*|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:[:*#\s-]*)(.*)/i
    );
    if (dayMatch) {
      if (currentDay) {
        days.push(currentDay);
      }
      currentDay = {
        day: dayMatch[1].replace(/[*#]/g, "").trim(),
        focus: dayMatch[2] ? dayMatch[2].replace(/[*#]/g, "").trim() : "Workout & Conditioning",
        duration: "45 min",
        exercises: [],
      };
    } else if (
      currentDay &&
      (trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+\./.test(trimmed))
    ) {
      const exerciseText = trimmed.replace(/^[-*]|\d+\.\s*/, "").replace(/[*_]/g, "").trim();
      if (exerciseText) {
        currentDay.exercises.push({ name: exerciseText, sets: "3", reps: "10-12" });
      }
    }
  }
  if (currentDay) {
    days.push(currentDay);
  }

  if (days.length === 0) {
    days.push({
      day: "Day 1",
      focus: "Full Body Workout",
      duration: "45 min",
      exercises: [{ name: "Routine as specified in chat", sets: "3", reps: "10" }],
    });
  }

  return days;
};



const QUICK_ACTIONS = [
  { label: "🥗 Meal Ideas", prompt: "Suggest healthy meal ideas based on my daily calories remaining" },
  { label: "💪 20-min Workout", prompt: "Give me a quick 20-minute home workout with warm-up" },
  { label: "📊 Analyze Today", prompt: "Analyze my calories and activity logs today and give feedback" },
  { label: "💧 Hydration Check", prompt: "How much water should I drink today based on my workouts?" },
  { label: "🎯 Goal Progress", prompt: "Review my fitness goal and recommend the next milestone" },
];

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// ── Web Audio API Subtle Chime ─────────────────────────────
const playCompletionChime = () => {
  try {
    const winAudio = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = winAudio.AudioContext || winAudio.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.035, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // Second note: B5 (987.77 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, now + 0.08);
    gain2.gain.setValueAtTime(0.035, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.24);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
};



// Note: Message rendering is handled by MarkdownMessage.tsx



// ── Confirmed Chat Action Confirmation Card (Phase D / G2) ──
const ActionConfirmationCard = ({
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
interface ChatMessageItemProps {
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

const ChatMessageItem = React.memo(({
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
// Creates a fresh chat session id. Kept outside the component so render-time
// analysis never sees the impure Date.now() fallback.
const newSessionId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `session-${Date.now()}`;

export default function AIAssistant() {
  const { user, setAllWaterLogs, setAllFoodLogs, setAllActivityLogs } = useappcontext();
  const location = useLocation();
  const navigate = useNavigate();

  const todayKey = useMemo(() => localDayKey(), []);
  const daySummary = useDaySummary(todayKey);
  const weatherObs = useMemo(() => getWeatherObservation(), []);

  const [planConfirmModal, setPlanConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    payload: WorkoutPlanAction | null;
    status: "idle" | "saving" | "saved" | "error";
    error?: string;
  }>({
    isOpen: false,
    title: "",
    payload: null,
    status: "idle",
  });

  const [messages, setMessages] = useState<Message[]>([]);

  const handleOpenPlanConfirm = useCallback((title: string, markdown: string) => {
    const days = parseMarkdownIntoWorkoutDays(markdown);
    const result = buildWorkoutPlanActionPayload(title, days, {
      goal: "AI Coach Recommendation",
      level: "all levels",
      split: "weekly",
    });
    if (result.success) {
      setPlanConfirmModal({
        isOpen: true,
        title: result.data.title,
        payload: result.data,
        status: "idle",
      });
    } else {
      toast.error(`Could not format plan: ${result.error}`);
    }
  }, []);

  const handleConfirmSavePlan = async () => {
    if (!planConfirmModal.payload) return;
    setPlanConfirmModal((prev) => ({ ...prev, status: "saving" }));
    try {
      const res = await api.post("/api/workout-plans", planConfirmModal.payload);
      if (res.data?.success) {
        setPlanConfirmModal((prev) => ({ ...prev, status: "saved" }));
        toast.success("Workout plan saved to your profile!");
        setTimeout(() => {
          setPlanConfirmModal({ isOpen: false, title: "", payload: null, status: "idle" });
        }, 1500);
      } else {
        setPlanConfirmModal((prev) => ({ ...prev, status: "error", error: "Failed to save plan." }));
        toast.error("Failed to save workout plan.");
      }
    } catch (err: unknown) {
      const axiosErr = axios.isAxiosError(err) ? err : null;
      const resData = axiosErr?.response?.data as { message?: string } | undefined;
      const msg = resData?.message || (err instanceof Error ? err.message : "Failed to save plan.");
      setPlanConfirmModal((prev) => ({ ...prev, status: "error", error: msg }));
      toast.error(msg);
    }
  };

  const handleConfirmAction = useCallback(async (
    msgId: string,
    actionIndex: number,
    action: ProposedChatAction
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.proposedActions) return m;
        const updated = [...m.proposedActions];
        updated[actionIndex] = { ...updated[actionIndex], status: "logging" };
        return { ...m, proposedActions: updated };
      })
    );

    try {
      if (action.type === "log_water") {
        const actionIdempotencyKey =
          action.idempotencyKey || `water_${msgId}_${actionIndex}_${Date.now()}`;

        const { data } = await api.post(
          "/api/waterlogs",
          {
            data: {
              amount: action.amountMl,
              date: new Date().toISOString(),
              idempotencyKey: actionIdempotencyKey,
            },
          },
          {
            headers: {
              "Idempotency-Key": actionIdempotencyKey,
            },
          }
        );

        const created = data;
        const loggedId = created?._id || created?.id;

        if (loggedId && setAllWaterLogs) {
          setAllWaterLogs((prev: WaterEntry[]) => [
            {
              id: String(loggedId),
              amount: action.amountMl,
              date: created?.date || new Date().toISOString(),
            },
            ...prev,
          ]);
        }

        toast.success(`Logged ${action.amountMl} ml water! 💧`);

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId || !m.proposedActions) return m;
            const updated = [...m.proposedActions];
            updated[actionIndex] = {
              ...updated[actionIndex],
              status: "logged",
              loggedId: String(loggedId),
            };
            return { ...m, proposedActions: updated };
          })
        );
      }
    } catch {
      toast.error("Failed to log water. Please try again.");
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.proposedActions) return m;
          const updated = [...m.proposedActions];
          updated[actionIndex] = { ...updated[actionIndex], status: "pending" };
          return { ...m, proposedActions: updated };
        })
      );
    }
  }, [setAllWaterLogs]);

  const handleDismissAction = useCallback((msgId: string, actionIndex: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.proposedActions) return m;
        const updated = [...m.proposedActions];
        updated[actionIndex] = { ...updated[actionIndex], status: "dismissed" };
        return { ...m, proposedActions: updated };
      })
    );
  }, []);

  const handleUndoAction = useCallback(async (
    msgId: string,
    actionIndex: number,
    loggedId: string
  ) => {
    try {
      await api.delete(`/api/waterlogs/${loggedId}`);
      if (setAllWaterLogs) {
        setAllWaterLogs((prev: WaterEntry[]) => prev.filter((w) => String(w.id) !== String(loggedId)));
      }
      toast("Water log removed.");
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.proposedActions) return m;
          const updated = [...m.proposedActions];
          updated[actionIndex] = { ...updated[actionIndex], status: "pending", loggedId: undefined };
          return { ...m, proposedActions: updated };
        })
      );
    } catch {
      toast.error("Failed to undo water log.");
    }
  }, [setAllWaterLogs]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<Array<Record<string, unknown> & { sessionId?: string; _id?: string; summary?: string; createdAt?: string; updatedAt?: string; revision?: number; messages?: Array<{ role?: string; text?: string; proposedActions?: FitBotActionState[] }> }>>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memorySearch, setMemorySearch] = useState("");
  const memoryBtnRef = useRef<HTMLButtonElement>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; right: number; width: number } | null>(null);

  const updateFlyoutPosition = useCallback(() => {
    if (!memoryBtnRef.current) return;
    const rect = memoryBtnRef.current.getBoundingClientRect();
    const screenW = window.innerWidth;
    const flyoutWidth = Math.min(384, screenW - 24);
    let right = screenW - rect.right;
    if (right < 12) right = 12;
    if (screenW - right < flyoutWidth + 12) {
      right = screenW - flyoutWidth - 12;
    }
    if (right < 12) right = 12;

    setFlyoutPosition({
      top: rect.bottom + 8,
      right,
      width: flyoutWidth,
    });
  }, []);

  const handleToggleMemory = () => {
    if (!showMemory && memoryBtnRef.current) {
      const rect = memoryBtnRef.current.getBoundingClientRect();
      const screenW = window.innerWidth;
      const flyoutWidth = Math.min(384, screenW - 24);
      let right = screenW - rect.right;
      if (right < 12) right = 12;
      if (screenW - right < flyoutWidth + 12) {
        right = screenW - flyoutWidth - 12;
      }
      if (right < 12) right = 12;
      setFlyoutPosition({
        top: rect.bottom + 8,
        right,
        width: flyoutWidth,
      });
    }
    setShowMemory((prev) => !prev);
  };

  useEffect(() => {
    if (showMemory) {
      updateFlyoutPosition();
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setShowMemory(false);
      };
      window.addEventListener("keydown", handleGlobalKeyDown);
      window.addEventListener("resize", updateFlyoutPosition);
      window.addEventListener("scroll", updateFlyoutPosition, true);
      return () => {
        window.removeEventListener("keydown", handleGlobalKeyDown);
        window.removeEventListener("resize", updateFlyoutPosition);
        window.removeEventListener("scroll", updateFlyoutPosition, true);
      };
    }
  }, [showMemory, updateFlyoutPosition]);
  // Stable session identifier & revision tracking (FitBot Phase 2)
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  });
  const sessionIdRef = useRef<string>(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveRevisionRef = useRef(0);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<{ msgs: Message[]; revision: number } | null>(null);

  // Concurrency synchronous lock & active request identity
  const isSendingRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("fitbot_sound") !== "false";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_STRAPI_API_URL || "")?.replace(/\/$/, "");
  const token = localStorage.getItem("token");

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("fitbot_sound", String(next));
      if (next) playCompletionChime();
      return next;
    });
  };

  // Active workout plan for plan-scheduled chip suggestions (Phase G / N7)
  const [activePlan, setActivePlan] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/workout-plans/active")
      .then((res) => {
        if (isMounted && res.data?.plan) {
          setActivePlan(res.data.plan);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const todayPlanDay = useMemo(() => {
    if (!activePlan?.days || !Array.isArray(activePlan.days) || activePlan.days.length === 0) {
      return null;
    }
    const todayIndex = new Date().getDay() % activePlan.days.length;
    return activePlan.days[todayIndex] || null;
  }, [activePlan]);

  // Live deterministic suggestions based on day summary, weather, and active plan (Phase B / G6 & Phase G / N7)
  const suggestions = useMemo(() => {
    return getFitBotSuggestions(
      daySummary.data,
      weatherObs,
      todayPlanDay ? { planDayScheduled: true, focus: todayPlanDay.focus, day: todayPlanDay.day } : null
    );
  }, [daySummary.data, weatherObs, todayPlanDay]);

  // Handle incoming router hand-offs (Phase B / G5)
  const activeHandoff = useMemo<HandoffPayload | null>(() => {
    const handoff = readHandoff(location.state);
    return handoff && handoff.intent === "ask_followup" && handoff.prefill ? handoff : null;
  }, [location.state]);
  const [appliedHandoff, setAppliedHandoff] = useState<HandoffPayload | null>(null);
  // Apply the prefill during render when a new hand-off arrives (avoids setState in an effect).
  if (activeHandoff && activeHandoff !== appliedHandoff) {
    setAppliedHandoff(activeHandoff);
    setInput(activeHandoff.prefill ?? "");
  }
  useEffect(() => {
    if (!activeHandoff) return;
    if (inputRef.current) {
      inputRef.current.focus();
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [activeHandoff, location.pathname, navigate]);

  // Auto-resize input textarea smoothly within compact bounds, enabling smooth scrolling when overflowing
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
      const maxHeight = isMobile ? 76 : 96;
      const minHeight = isMobile ? 36 : 38;
      const scrollH = inputRef.current.scrollHeight;
      const newHeight = Math.min(scrollH, maxHeight);
      inputRef.current.style.height = `${Math.max(newHeight, minHeight)}px`;
      inputRef.current.style.overflowY = scrollH > maxHeight ? "auto" : "hidden";
    }
  }, [input]);

  // Load past sessions from backend
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/chathistories", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sessions = Array.isArray(data) ? data : data?.data ?? [];
        setPastSessions(sessions);
        setMemoryLoaded(true);
      } catch {
        setMemoryLoaded(true);
      }
    };
    if (token) load();
  }, [token]);

  // Save session idempotently using stable sessionId
  const saveSession = useCallback(
    async (msgs: Message[]) => {
      const validMsgs = getValidMessages(msgs);
      if (validMsgs.length < 1) return;

      saveRevisionRef.current += 1;
      const currentRevision = saveRevisionRef.current;
      const currentSessionId = sessionIdRef.current;

      // Queue latest snapshot if another save is already in-flight
      if (isSavingRef.current) {
        pendingSaveRef.current = { msgs, revision: currentRevision };
        return;
      }

      isSavingRef.current = true;
      setSaveStatus("saving");

      const summary = buildSessionSummary(validMsgs, 6);
      const messagesPayload = validMsgs.map((m) => ({ role: m.role, text: m.text }));

      try {
        const { data: savedDoc } = await api.post(
          "/api/chathistories",
          {
            data: {
              sessionId: currentSessionId,
              revision: currentRevision,
              summary,
              messages: messagesPayload,
            },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSaveStatus("saved");

        if (savedDoc) {
          setPastSessions((prev) => {
            const existingIdx = prev.findIndex(
              (s) => (s.sessionId && s.sessionId === currentSessionId) || s._id === savedDoc._id
            );
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...savedDoc };
              return updated;
            }
            return [savedDoc, ...prev];
          });
        }
      } catch (err) {
        console.warn("[FitBot] Session snapshot save failed:", err);
        setSaveStatus("error");
      } finally {
        isSavingRef.current = false;
        if (pendingSaveRef.current) {
          const next = pendingSaveRef.current;
          pendingSaveRef.current = null;
          saveSessionRef.current(next.msgs);
        }
      }
    },
    [token]
  );

  // Lets the queued-save path reach the latest saveSession without a self-reference.
  const saveSessionRef = useRef(saveSession);
  useEffect(() => {
    saveSessionRef.current = saveSession;
  }, [saveSession]);

  // Guaranteed persistence on navigation/refresh via pagehide
  useEffect(() => {
    const handlePageHide = () => {
      const valid = getValidMessages(messages);
      if (valid.length >= 1 && token) {
        const currentSessionId = sessionIdRef.current;
        const summary = buildSessionSummary(valid, 6);
        const messagesPayload = valid.map((m) => ({ role: m.role, text: m.text }));
        const body = JSON.stringify({
          data: {
            sessionId: currentSessionId,
            revision: saveRevisionRef.current + 1,
            summary,
            messages: messagesPayload,
          },
        });
        try {
          fetch(`${API_URL}/api/chathistories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body,
            keepalive: true,
          }).catch(() => {});
        } catch {
          // ignore pagehide network error
        }
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [messages, token, API_URL]);

  // Save when unmounting inside SPA navigation
  useEffect(() => {
    return () => {
      const valid = getValidMessages(messages);
      if (valid.length >= 1) {
        saveSession(messages);
      }
    };
  }, [messages, saveSession]);

  const clearMemory = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all saved FitBot memory? This permanently deletes your saved coaching history and resets past context."
      )
    ) {
      return;
    }

    try {
      await api.delete("/api/chathistories/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPastSessions([]);
      toast.success("FitBot memory cleared");
    } catch {
      toast.error("Failed to clear memory");
    }
  };

  const deleteSingleSession = async (session: { sessionId?: string; _id?: string }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetId = session.sessionId || session._id;
    if (!targetId) return;

    try {
      await api.delete(`/api/chathistories/session/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPastSessions((prev) =>
        prev.filter((s) => (s.sessionId ? s.sessionId !== targetId : s._id !== targetId))
      );
      toast.success("Session removed from memory");

      // If the deleted session was currently loaded into chat, reset current session identifier
      if (sessionIdRef.current === targetId) {
        const freshId = newSessionId();
        setSessionId(freshId);
        sessionIdRef.current = freshId;
        saveRevisionRef.current = 0;
        setSaveStatus("idle");
      }
    } catch {
      toast.error("Failed to delete session");
    }
  };

  const loadPastSessionIntoChat = (session: { sessionId?: string; _id?: string; messages?: Array<{ role?: string; text?: string; proposedActions?: FitBotActionState[] }>; updatedAt?: string; createdAt?: string; revision?: number }) => {
    // Invalidate any active generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeRequestIdRef.current = null;
    isSendingRef.current = false;
    setIsLoading(false);

    if (Array.isArray(session.messages) && session.messages.length > 0) {
      const formatted: Message[] = session.messages.map((m: { role?: string; text?: string; proposedActions?: FitBotActionState[] }, i: number) => ({
        id: `${session.sessionId || session._id || Date.now()}-${i}`,
        role: m.role === "user" ? "user" : "assistant",
        text: m.text || "",
        timestamp: new Date(session.updatedAt || session.createdAt || Date.now()),
        proposedActions: m.proposedActions,
      }));
      setMessages(formatted);
      const sId = session.sessionId || session._id || newSessionId();
      setSessionId(sId);
      sessionIdRef.current = sId;
      saveRevisionRef.current = session.revision || 1;
      setSaveStatus("saved");
      setShowMemory(false);
      toast.success("Loaded previous conversation!");
    } else {
      toast("No messages recorded in this session.", { icon: "ℹ️" });
    }
  };

  // FitBot's profile and daily data come from the server context. The client sends none.

  // Build bounded, sanitized memory context string from past sessions
  const memoryContext = useMemo(
    () => formatMemoryContext(pastSessions, 3, 900),
    [pastSessions]
  );

  // Filtered memory sessions based on search
  const filteredSessions = useMemo(() => {
    if (!memorySearch.trim()) return pastSessions;
    const q = memorySearch.toLowerCase();
    return pastSessions.filter((s: { summary?: string; messages?: Array<{ text?: string }> }) => {
      const summaryMatch = (s.summary || "").toLowerCase().includes(q);
      const msgMatch = Array.isArray(s.messages) && s.messages.some((m: { text?: string }) => (m.text || "").toLowerCase().includes(q));
      return summaryMatch || msgMatch;
    });
  }, [pastSessions, memorySearch]);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  // Smooth scroll management — scroll the specific messages container directly!
  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

    const scrollTickingRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (scrollTickingRef.current) return;
    scrollTickingRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current;
      if (el) {
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
        const isNear = distanceFromBottom <= 120;
        isNearBottomRef.current = isNear;
        setShowScrollBottom((prev) => (prev !== !isNear ? !isNear : prev));
      }
      scrollTickingRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages, isLoading, scrollToBottom]);

  // Copy message text
  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Copied to clipboard!", { duration: 1500 });
    } catch {
      toast.error("Failed to copy text");
    }
  }, []);

  // Text-to-Speech (FitBot Read Aloud)
  const toggleSpeakMessage = useCallback((id: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Text-to-speech is not supported in this browser.");
      return;
    }
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();

    // Strip markdown formatting & tables for clean, natural speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\|[^\n]+\|/g, "")
      .replace(/[#*`_~>[\]]/g, "")
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  // Speech-to-Text Voice Input (Web Speech API)
  const isSpeechSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleListening = () => {
    if (!isSpeechSupported) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const win = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Speech recognition is not supported in this browser.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast("Listening to your voice...", { icon: "🎙️", duration: 1800 });
      };

      recognition.onresult = (event: { results: { [idx: number]: { [idx: number]: { transcript: string } } } }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Stop generation in flight
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeRequestIdRef.current = null;
    isSendingRef.current = false;
    setIsLoading(false);
    toast("Stopped generating response", { icon: "⏹️" });
  };

  // Send message to AI
  const sendMessage = async (text: string, customHistory?: Message[], sendOptions?: { regenerate?: boolean }) => {
    if (!text.trim() || isSendingRef.current) return;
    isSendingRef.current = true;

    // Unique request ID to ignore stale completions
    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    activeRequestIdRef.current = requestId;

    const currentMessages = getValidMessages(customHistory || messages);
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };
    const newMessages = [...currentMessages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    isNearBottomRef.current = true;
    scrollToBottom(true);

    // Persist snapshot of user turn
    saveSession(newMessages);

    const historyPayload = buildGeminiPayload(newMessages);
    abortControllerRef.current = new AbortController();

    try {
      const data = await chatAiAssistant({
        messages: historyPayload,
        memoryContext,
        options: {
          regenerate: Boolean(sendOptions?.regenerate),
        },
        signal: abortControllerRef.current.signal,
      });

      // Ignore if superseded or cancelled
      if (activeRequestIdRef.current !== requestId) return;

      if (activeRequestIdRef.current !== requestId) return;

      const reply = data.reply || "I couldn't generate a response. Please try again.";
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: reply,
        timestamp: new Date(),
        executedActions: data.executedActions,
        proposedActions:
          Array.isArray(data.proposedActions) && data.proposedActions.length > 0
            ? data.proposedActions.map((action) => ({
                action,
                status: "pending" as const,
              }))
            : undefined,
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      // Phase 2: Live state refresh for dashboard macro rings & workout lists
      if (Array.isArray(data.executedActions) && data.executedActions.length > 0) {
        invalidateSummaries();
        const token = localStorage.getItem("token");
        if (token) {
          const hasFood = data.executedActions.some((a) => a.action === "logMealItem");
          const hasWorkout = data.executedActions.some(
            (a) => a.action === "logWorkoutSession" || a.action === "swapExerciseInPlan"
          );
          if (hasFood) {
            api
              .get("/api/foodlogs", { headers: { Authorization: `Bearer ${token}` } })
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
                setAllFoodLogs(list);
              })
              .catch(() => {});
          }
          if (hasWorkout) {
            api
              .get("/api/activitylogs", { headers: { Authorization: `Bearer ${token}` } })
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
                setAllActivityLogs(list);
              })
              .catch(() => {});
          }
        }
      }

      if (soundEnabled) playCompletionChime();

      // Persist snapshot of completed turn
      saveSession(finalMessages);
    } catch (err: unknown) {
      if (activeRequestIdRef.current !== requestId) return;

      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to get response. Check your connection.";
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: `⚠️ I had trouble connecting (${msg}).`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages([...newMessages, errorMsg]);
      toast.error(msg);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        abortControllerRef.current = null;
        setIsLoading(false);
        isSendingRef.current = false;
        activeRequestIdRef.current = null;
      }
    }
  };

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const retryLastMessage = useCallback(() => {
    if (isSendingRef.current || isLoading) return;
    const retryCtx = getRetryContext(messages);
    if (!retryCtx) return;
    sendMessageRef.current(retryCtx.prompt, retryCtx.precedingHistory);
  }, [messages, isLoading]);

  const regenerateLastMessage = useCallback(() => {
    if (isSendingRef.current || isLoading) return;
    const regenCtx = getRegenerateContext(messages);
    if (!regenCtx) return;
    setMessages(regenCtx.trimmedMessages);
    sendMessageRef.current(regenCtx.prompt, regenCtx.precedingHistory, { regenerate: true });
  }, [isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage(input);
    } else if (e.key === "Escape") {
      if (isListening) toggleListening();
      if (showMemory) setShowMemory(false);
    }
  };

  const startNewChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeRequestIdRef.current = null;
    isSendingRef.current = false;
    setIsLoading(false);

    if (speakingId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
    }

    if (messages.length >= 1) {
      saveSession(messages);
    }

    const newId = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setSessionId(newId);
    sessionIdRef.current = newId;
    saveRevisionRef.current = 0;
    setSaveStatus("idle");
    setMessages([]);
    setInput("");
    toast.success("Started new chat session");
  };

  const exportConversation = () => {
    const valid = messages.filter((m) => !m.isError);
    if (valid.length === 0) {
      toast("No messages to export", { icon: "ℹ️" });
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const contentW = pageW - marginX * 2;
      const dateStr = new Date().toISOString().split("T")[0];
      const displayDate = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // ── Header Banner ──
      doc.setFillColor(124, 58, 237); // violet-600
      doc.rect(0, 0, pageW, 26, "F");

      // FitBot Title & Subtitle
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("FitBot — AI Coaching Consultation", marginX, 11);

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const userSubtitle = user?.username ? `${user.username}  ·  ` : "";
      doc.text(`${userSubtitle}Personal Fitness & Nutrition Consultation Report  ·  ${displayDate}`, marginX, 19);

      // ── User Context Cards ──
      const stats = [
        { label: "USER", val: user?.username || "Athlete" },
        { label: "GOAL", val: user?.goal ? `${user.goal} weight` : "Fitness & Health" },
        { label: "DAILY TARGET", val: user?.dailycaloriesintake ? `${user.dailycaloriesintake} kcal` : "Adaptive" },
        { label: "MESSAGES", val: `${valid.length} items` },
      ];
      const boxW = contentW / 4;
      let bx = marginX;
      stats.forEach((s) => {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.roundedRect(bx, 31, boxW - 2, 16, 2, 2, "FD");

        doc.setTextColor(100, 116, 139); // slate-500
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.text(s.label, bx + (boxW - 2) / 2, 36.5, { align: "center" });

        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text(s.val, bx + (boxW - 2) / 2, 42.5, { align: "center" });

        bx += boxW;
      });

      let currentY = 53;

      // ── Render Each Message ──
      valid.forEach((m) => {
        const isUser = m.role === "user";
        const roleLabel = isUser ? (user?.username ? user.username.toUpperCase() : "YOU") : "FITBOT AI";
        const timeStr = formatTime(new Date(m.timestamp));

        // Clean raw markdown syntax for clean PDF presentation
        const cleanedText = m.text
          .replace(/^###\s+/gm, "")
          .replace(/^##\s+/gm, "")
          .replace(/^#\s+/gm, "")
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/__(.*?)__/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .trim();

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        const lines: string[] = doc.splitTextToSize(cleanedText, contentW - 6);
        const lineHeight = 4.2;

        // If not enough room for header and at least 2 lines, advance page
        if (currentY + 20 > pageH - 18) {
          doc.addPage();
          currentY = 16;
        }

        // Message Sender Badge & Timestamp
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const badgeW = Math.max(20, doc.getTextWidth(roleLabel) + 6);

        doc.setFillColor(isUser ? 241 : 243, isUser ? 245 : 232, isUser ? 249 : 255);
        doc.roundedRect(marginX, currentY, badgeW, 6, 1.5, 1.5, "F");

        doc.setTextColor(isUser ? 71 : 109, isUser ? 85 : 40, isUser ? 105 : 217);
        doc.text(roleLabel, marginX + badgeW / 2, currentY + 4.2, { align: "center" });

        doc.setTextColor(148, 163, 184); // slate-400
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(timeStr, pageW - marginX, currentY + 4.2, { align: "right" });

        currentY += 9;

        // Message Body Lines (handles multi-page overflow cleanly)
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");

        for (let i = 0; i < lines.length; i++) {
          if (currentY + lineHeight > pageH - 18) {
            doc.addPage();
            currentY = 16;
          }
          doc.text(lines[i], marginX + 2, currentY);
          currentY += lineHeight;
        }

        // Light divider after message
        currentY += 4;
        if (currentY < pageH - 18) {
          doc.setDrawColor(241, 245, 249); // slate-100
          doc.line(marginX, currentY, pageW - marginX, currentY);
          currentY += 5;
        }
      });

      // ── Footer on all pages ──
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
        doc.text("FitTrack · FitBot Coaching Consultation Report", marginX, pageH - 7);
        doc.text(`Page ${i} of ${totalPages}`, pageW - marginX, pageH - 7, { align: "right" });
      }

      doc.save(`FitBot-Coaching-Session-${dateStr}.pdf`);
      toast.success("Exported conversation as PDF!");
    } catch (err) {
      console.error("PDF export failed:", err);
      toast.error("Failed to generate PDF");
    }
  };

  const cardCls = "bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50";

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white relative overflow-hidden">
      {/* Header */}
      <div className="page-header-ai shrink-0 shadow-md z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="hidden sm:inline-flex shrink-0">
                <FitBotAvatar size="md" state={isLoading ? "thinking" : "idle"} />
              </div>
              <div className="sm:hidden inline-flex shrink-0">
                <FitBotAvatar size="sm" state={isLoading ? "thinking" : "idle"} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1 sm:gap-1.5 leading-tight">
                  {FITBOT_CONFIG.NAME}
                  <span className="text-[9px] sm:text-[10px] font-semibold px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-400/25 border border-emerald-300/30 text-emerald-100 shrink-0">
                    {FITBOT_CONFIG.ROLE}
                  </span>
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-400 rounded-full animate-pulse shrink-0" />
                  <span className="text-[10px] sm:text-xs text-white/90 truncate max-w-[90px] xs:max-w-[130px] sm:max-w-none">
                    {memoryLoaded && pastSessions.length > 0
                      ? `${pastSessions.length} session${pastSessions.length > 1 ? "s" : ""} remembered`
                      : "Online & context-aware"}
                  </span>
                  {saveStatus === "saving" && (
                    <span className="text-[10px] text-emerald-200/90 font-medium animate-pulse shrink-0">
                      · Saving…
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-[10px] text-emerald-300 font-medium shrink-0">
                      · Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <button
                      onClick={() => saveSession(messages)}
                      className="text-[10px] text-rose-300 hover:text-white underline font-medium cursor-pointer shrink-0"
                      title="Click to retry saving conversation"
                    >
                      · Save failed (Retry)
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className="w-7 h-7 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
                title={soundEnabled ? "Mute response chime" : "Unmute response chime"}
                aria-label={soundEnabled ? "Mute response chime" : "Unmute response chime"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
              </button>

              {/* Export Conversation (PDF) */}
              {messages.length > 0 && (
                <button
                  onClick={exportConversation}
                  className="w-7 h-7 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
                  title="Export chat as PDF"
                  aria-label="Export chat as PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Export PDF</span>
                </button>
              )}

              {/* Memory Trigger Button */}
              {pastSessions.length > 0 && (
                <button
                  ref={memoryBtnRef}
                  onClick={handleToggleMemory}
                  className={`h-7 sm:h-auto px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 active:scale-95 focus-visible:ring-2 focus-visible:ring-white ${
                    showMemory ? "bg-white text-emerald-950 font-bold shadow-md" : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                  title="View remembered past sessions"
                  aria-label="View remembered past sessions"
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-xs">Memory</span>
                  <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full bg-emerald-400 text-emerald-950 font-bold">
                    {pastSessions.length}
                  </span>
                </button>
              )}

              {/* New Chat */}
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  className="h-7 w-7 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer flex items-center justify-center gap-1 text-xs active:scale-95 focus-visible:ring-2 focus-visible:ring-white"
                  title="Start new conversation"
                  aria-label="Start new conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Chat</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Memory Drawer: Mobile Bottom Sheet (< sm) or Desktop Floating Popover (>= sm) */}
      <AnimatePresence>
        {showMemory && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Subtle Click-away Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-[2px] pointer-events-auto"
              onClick={() => setShowMemory(false)}
            />

            {/* Flyout Window / Mobile Bottom Sheet */}
            <motion.div
              initial={
                typeof window !== "undefined" && window.innerWidth < 640
                  ? { opacity: 0, y: "100%" }
                  : { opacity: 0, y: -8, scale: 0.96 }
              }
              animate={
                typeof window !== "undefined" && window.innerWidth < 640
                  ? { opacity: 1, y: 0 }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={
                typeof window !== "undefined" && window.innerWidth < 640
                  ? { opacity: 0, y: "100%" }
                  : { opacity: 0, y: -8, scale: 0.96 }
              }
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={
                typeof window !== "undefined" && window.innerWidth < 640
                  ? {
                      position: "fixed",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      width: "100%",
                      maxHeight: "82vh",
                    }
                  : flyoutPosition
                  ? {
                      position: "fixed",
                      top: `${flyoutPosition.top}px`,
                      right: `${flyoutPosition.right}px`,
                      width: `${flyoutPosition.width}px`,
                      maxHeight: `calc(100vh - ${flyoutPosition.top + 20}px)`,
                      transformOrigin: "top right",
                    }
                  : {
                      position: "fixed",
                      top: "70px",
                      right: "16px",
                      width: "384px",
                      maxWidth: "calc(100vw - 24px)",
                      transformOrigin: "top right",
                    }
              }
              className="pointer-events-auto flex flex-col rounded-t-3xl sm:rounded-2xl bg-slate-900/98 dark:bg-slate-900/98 border-t sm:border border-slate-700/80 shadow-2xl backdrop-blur-2xl text-white overflow-hidden ring-1 ring-white/10"
            >
              {/* Mobile Drag Indicator */}
              <div className="sm:hidden w-10 h-1 rounded-full bg-slate-600 mx-auto mt-2.5 mb-1 shrink-0" />

              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    FitBot Memory
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  {pastSessions.length > 0 && (
                    <button
                      onClick={clearMemory}
                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                      title="Clear all memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowMemory(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Privacy Notice Banner */}
              <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 leading-relaxed shrink-0">
                FitBot uses recent session summaries to personalize advice. You can delete individual sessions or clear all memory at any time.
              </div>

              {/* Search bar inside Flyout */}
              {pastSessions.length > 1 && (
                <div className="p-3 border-b border-slate-800/80 shrink-0 bg-slate-950/20">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memorySearch}
                      onChange={(e) => setMemorySearch(e.target.value)}
                      placeholder="Search past coaching sessions…"
                      className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Session List */}
              <div className="p-2.5 overflow-y-auto space-y-1.5 no-scrollbar max-h-96 flex-1">
                {filteredSessions.length === 0 ? (
                  <div className="py-8 text-center px-4">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
                    <p className="text-xs font-medium text-slate-400">
                      {memorySearch ? "No sessions match your search" : "No past sessions remembered yet"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      FitBot automatically remembers your chats and goals as you talk.
                    </p>
                  </div>
                ) : (
                  filteredSessions.map((s: { sessionId?: string; _id?: string; summary?: string; createdAt?: string; messages?: Array<{ text?: string }> }, i: number) => {
                    const sessionDate = s.createdAt
                      ? new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                      : `Session ${i + 1}`;
                    const previewText = s.summary?.split("\n")[0] || s.messages?.[0]?.text || "Coaching consultation";
                    const msgCount = Array.isArray(s.messages) ? s.messages.length : null;

                    return (
                      <div
                        key={s._id || i}
                        onClick={() => loadPastSessionIntoChat(s)}
                        className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 active:scale-[0.98] transition-all cursor-pointer group flex items-start gap-3"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 transition-colors">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-semibold text-emerald-400">
                              {sessionDate}
                            </span>
                            {msgCount && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-700 text-slate-300">
                                {msgCount} msgs
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-200 group-hover:text-white line-clamp-2 leading-relaxed transition-colors">
                            {previewText}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 self-center">
                          <button
                            type="button"
                            onClick={(e) => deleteSingleSession(s, e)}
                            className="p-1 rounded-md hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors opacity-70 group-hover:opacity-100 cursor-pointer"
                            title="Delete this session from memory"
                            aria-label="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-400 shrink-0 safe-area-pb">
                <span>Click to load into chat</span>
                <span className="text-emerald-400 font-medium">{pastSessions.length} total saved</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Messages Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="FitBot conversation history"
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 no-scrollbar relative transform-gpu [will-change:scroll-position]"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center py-6 sm:py-10 text-center px-1"
            >
              <FitBotAvatar size="lg" className="mb-3 sm:mb-4" />
              <h2 className="text-lg sm:text-xl font-bold mb-1 text-gray-900 dark:text-white">
                {FITBOT_CONFIG.GREETING}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-4 sm:mb-5 max-w-xs sm:max-w-sm">
                {FITBOT_CONFIG.DESCRIPTION}
              </p>
              {/* Planner Shortcuts Hand-offs (Phase B / G5) */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/planner", {
                      state: createHandoffState(
                        "fitbot",
                        "plan_rest_of_today",
                        "Plan meals for today tailored to my coaching conversation."
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-pink-200 dark:border-pink-800/60 bg-pink-50 dark:bg-pink-950/20 text-xs font-semibold text-pink-700 dark:text-pink-300 hover:bg-pink-100 dark:hover:bg-pink-900/40 transition-colors cursor-pointer"
                >
                  <span>🥗</span> Open Meal Planner &rarr;
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate("/activity-planner", {
                      state: createHandoffState(
                        "fitbot",
                        "indoor_alternative",
                        "Plan a workout routine tailored to my coaching conversation."
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <span>💪</span> Open Activity Planner &rarr;
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-md"
                  >
                    <span className="line-clamp-2">{s}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Chat Messages */}
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;

              return (
                <ChatMessageItem
                  key={msg.id}
                  msg={msg}
                  isLast={isLast}
                  isLoading={isLoading}
                  isCopied={copiedId === msg.id}
                  isSpeaking={speakingId === msg.id}
                  onCopy={handleCopy}
                  onRegenerate={regenerateLastMessage}
                  onSpeakToggle={toggleSpeakMessage}
                  onRetry={retryLastMessage}
                  onSavePlan={handleOpenPlanConfirm}
                  onConfirmAction={handleConfirmAction}
                  onDismissAction={handleDismissAction}
                  onUndoAction={handleUndoAction}
                />
              );
            })}
          </AnimatePresence>

          {/* Typing Indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2 }}
                className="flex gap-2.5 sm:gap-3.5 items-center py-1"
              >
                <FitBotAvatar size="sm" state="thinking" className="shrink-0" />
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-xs px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-xs">
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                    <span className="text-xs text-slate-400 ml-2">FitBot is thinking…</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Jump to Bottom Button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => {
              isNearBottomRef.current = true;
              scrollToBottom(true);
            }}
            className="absolute bottom-16 sm:bottom-20 right-3 sm:right-4 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Scroll to latest message"
            title="Scroll to latest message"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Quick Context Action Chips */}
      {messages.length > 0 && !isLoading && (
        <div className="px-2.5 sm:px-4 py-1.5 overflow-x-auto touch-pan-x no-scrollbar shrink-0 bg-slate-100/70 dark:bg-slate-900/40 border-t border-slate-200/60 dark:border-slate-800">
          <div className="max-w-2xl mx-auto flex items-center gap-1.5 sm:gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input Section */}
      <div className={`${cardCls} px-2.5 py-2 sm:px-4 sm:py-2.5 shrink-0 border-t shadow-sm sticky bottom-0 z-30 lg:safe-area-pb bg-white/95 dark:bg-slate-900/95 backdrop-blur-md`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-1.5 sm:gap-2.5 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                isNearBottomRef.current = true;
                setTimeout(() => scrollToBottom(true), 150);
              }}
              placeholder={isListening ? "Listening… speak now" : ""}
              rows={1}
              className={`chat-input-scrollable flex-1 resize-none bg-slate-100 dark:bg-slate-700/60 border rounded-xl px-3 py-2 text-[16px] sm:text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all leading-snug ${
                isListening
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-600 focus:border-emerald-400 dark:focus:border-emerald-500"
              }`}
              style={{
                minHeight: 38,
                maxHeight: 110,
              }}
            />

            {/* Voice Input Button */}
            {isSpeechSupported && (
              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={toggleListening}
                type="button"
                className={`shrink-0 w-9 h-9 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                  isListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-md"
                    : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-emerald-500"
                }`}
                title={isListening ? "Stop listening" : "Speak to FitBot"}
                aria-label={isListening ? "Stop listening" : "Speak to FitBot"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </motion.button>
            )}

            {/* Send or Stop Generation Button */}
            {isLoading ? (
              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={stopGeneration}
                type="button"
                className="shrink-0 w-9 h-9 sm:w-9 sm:h-9 bg-rose-500 hover:bg-rose-600 rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
                title="Stop generating response"
                aria-label="Stop generating response"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.90 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="shrink-0 w-9 h-9 sm:w-9 sm:h-9 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          <div className="hidden sm:flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-1.5 px-1">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>FitBot v{FITBOT_CONFIG.VERSION}</span>
          </div>
        </div>
      </div>

      {/* Plan Preview & Confirmation Modal */}
      <AnimatePresence>
        {planConfirmModal.isOpen && planConfirmModal.payload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>📋</span> Confirm Workout Plan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Preview the plan structure before saving to your profile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPlanConfirmModal({ isOpen: false, title: "", payload: null, status: "idle" })
                  }
                  className="p-1 rounded-lg text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Plan Title: {planConfirmModal.payload.title}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex gap-3">
                    <span>Days: {planConfirmModal.payload.days?.length || 0}</span>
                    <span>Level: {planConfirmModal.payload.level}</span>
                    <span>Split: {planConfirmModal.payload.split}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Routine Breakdown:
                  </div>
                  {planConfirmModal.payload?.days?.map((d: { day: string; focus: string; duration: string; exercises?: unknown[] }, idx: number) => (
                    <div
                      key={idx}
                      className="border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="font-semibold text-gray-800 dark:text-slate-200 flex justify-between">
                        <span>{d.day} — {d.focus}</span>
                        <span className="text-slate-400 text-[11px]">{d.duration}</span>
                      </div>
                      {Boolean(d.exercises && d.exercises.length > 0) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {d.exercises!.length} exercise{d.exercises!.length > 1 ? "s" : ""} included
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {planConfirmModal.status === "error" && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900">
                    {planConfirmModal.error || "An error occurred while saving."}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={planConfirmModal.status === "saving"}
                  onClick={() =>
                    setPlanConfirmModal({ isOpen: false, title: "", payload: null, status: "idle" })
                  }
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={planConfirmModal.status === "saving" || planConfirmModal.status === "saved"}
                  onClick={handleConfirmSavePlan}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shadow-sm shadow-emerald-500/20"
                >
                  {planConfirmModal.status === "saving" ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Plan…</span>
                    </>
                  ) : planConfirmModal.status === "saved" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Confirm & Save to My Plans</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}