import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import api from "../configs/api";
import toast from "react-hot-toast";
import CollapsiblePlanCard from "../components/animations/CollapsiblePlanCard";
import { FitBotAvatar } from "../components/FitBotAvatar";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { FITBOT_CONFIG } from "../constants/fitbot";
import jsPDF from "jspdf";

// ── Helpers ───────────────────────────────────────────────
const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

const isToday = (dateStr: string) =>
  new Date(dateStr).toDateString() === new Date().toDateString();

// ── Types ─────────────────────────────────────────────────
type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isError?: boolean;
};

type GeminiMessage = { role: "user" | "model"; parts: { text: string }[] };

const BASE_SUGGESTIONS = [
  "What should I eat before a workout?",
  "Create a 7-day meal plan for weight loss",
  "How many calories should I eat daily?",
  "Best exercises to build core strength",
  "How to stay motivated to exercise?",
  "What's a good post-workout meal?",
];

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
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

// Helper to identify if a heading represents a structured multi-day/week plan or workout routine
const isPlanCardHeader = (title: string): boolean => {
  const clean = title.replace(/[:*#]/g, "").trim();
  // Only turn substantial workout or meal routines/plans into collapsible cards
  return /^\s*(?:\d+[- ]*(?:day|week|month)|weekly|daily|full|custom)?\s*(?:workout|meal|exercise|training|nutrition)\s*(?:plan|routine|schedule|breakdown|program)/i.test(clean);
};

// ── Markdown Parser with Tables & Plan Cards ────────────────
const RenderMessage = React.memo(({ text }: { text: string; isLatest?: boolean }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inPlanCard = false;
  let planTitle = "";
  let planLines: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const applyInline = (raw: string): React.ReactNode[] => {
    if (!raw) return [];

    // Tokenize by inline code (`...`), bold with optional trailing colon (**...**:?), italics (*...* or _..._)
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*:?|\*[^*]+\*)/g;
    const parts = raw.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;

      // Inline Code: `code`
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/80 font-mono text-xs text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-600 mx-0.5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold text, e.g. **text** or **text**: or **text:**
      if (part.startsWith("**")) {
        const endsWithColon = part.endsWith(":");
        const cleanEnd = endsWithColon ? part.slice(0, -1) : part;

        if (cleanEnd.endsWith("**") && cleanEnd.length >= 4) {
          const innerText = cleanEnd.slice(2, -2).trim();
          const hasColon = endsWithColon || innerText.endsWith(":");
          const displayText = endsWithColon && !innerText.endsWith(":") ? `${innerText}:` : innerText;

          if (hasColon) {
            return (
              <strong
                key={i}
                className="font-bold text-emerald-600 dark:text-emerald-400 mr-1.5 inline"
              >
                {displayText}
              </strong>
            );
          }

          return (
            <strong key={i} className="font-bold text-gray-900 dark:text-white inline">
              {displayText}
            </strong>
          );
        }
      }

      // Italics: *text*
      if (part.startsWith("*") && part.endsWith("*") && part.length >= 2 && !part.startsWith("**")) {
        return (
          <em key={i} className="italic text-gray-700 dark:text-slate-300">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Regular text (including the text that appears after **)
      return (
        <span key={i} className="text-gray-800 dark:text-slate-200">
          {part}
        </span>
      );
    });
  };

  const flushList = (key: string) => {
    if (!listItems.length) return;
    const target = inPlanCard ? planLines : elements;
    if (listType === "ul") {
      target.push(
        <ul key={key} className="list-none space-y-2 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-2xs" />
              <span className="flex-1 leading-relaxed text-gray-800 dark:text-slate-200">
                {applyInline(item)}
              </span>
            </li>
          ))}
        </ul>
      );
    } else {
      target.push(
        <ol key={key} className="list-none space-y-2 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="shrink-0 font-bold text-emerald-500 text-xs min-w-[20px] mt-0.5">
                {i + 1}.
              </span>
              <span className="flex-1 leading-relaxed text-gray-800 dark:text-slate-200">
                {applyInline(item)}
              </span>
            </li>
          ))}
        </ol>
      );
    }
    listItems = [];
    listType = null;
  };

  const flushTable = (key: string) => {
    if (!inTable || tableHeaders.length === 0) {
      inTable = false;
      tableHeaders = [];
      tableRows = [];
      return;
    }
    const target = inPlanCard ? planLines : elements;
    target.push(
      <div key={key} className="overflow-x-auto my-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs -mx-0.5 sm:mx-0 [webkit-overflow-scrolling:touch]">
        <table className="w-full text-[11px] sm:text-xs text-left border-collapse min-w-full">
          <thead className="bg-slate-100/90 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 font-semibold">
            <tr>
              {tableHeaders.map((header, hIdx) => (
                <th key={hIdx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap sm:whitespace-normal">
                  {applyInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1.5 sm:px-3 sm:py-2 text-slate-700 dark:text-slate-300">
                    {applyInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  const flushPlanCard = (key: string) => {
    flushList(`plan-inner-list-${key}`);
    flushTable(`plan-inner-tbl-${key}`);
    if (inPlanCard && planLines.length > 0) {
      elements.push(
        <CollapsiblePlanCard key={key} title={planTitle || "Suggested Plan"} defaultOpen={true}>
          <div className="space-y-1.5 text-xs sm:text-sm text-gray-800 dark:text-slate-200">
            {planLines}
          </div>
        </CollapsiblePlanCard>
      );
      planLines = [];
      inPlanCard = false;
      planTitle = "";
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check for markdown table row: e.g. "| Day | Workout | Sets |"
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList(`tbl-list-${idx}`);
      const rawCols = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // Check if this is separator row like "|---|---|---|"
      const isSeparator = rawCols.every((col) => /^:?-+:?$/.test(col));
      if (isSeparator) {
        inTable = true;
        return;
      }

      if (!inTable && tableHeaders.length === 0) {
        tableHeaders = rawCols;
        inTable = true;
      } else {
        tableRows.push(rawCols);
      }
      return;
    } else {
      flushTable(`table-end-${idx}`);
    }

    // Check for H1, H2, H3 or standalone bold headers
    const h1Match = trimmed.match(/^#\s+(.+)/);
    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h3Match = trimmed.match(/^###\s+(.+)/);
    const boldHeaderMatch = trimmed.match(/^\*\*([^*]+)\*\*$/);

    if (h1Match) {
      flushList(`list-h1-${idx}`);
      flushTable(`tbl-h1-${idx}`);
      flushPlanCard(`plan-h1-${idx}`);
      elements.push(
        <h1 key={`h1-${idx}`} className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mt-3 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-700">
          {applyInline(h1Match[1])}
        </h1>
      );
      return;
    }

    if (h2Match) {
      flushList(`list-h2-${idx}`);
      flushTable(`tbl-h2-${idx}`);
      flushPlanCard(`plan-h2-${idx}`);
      elements.push(
        <h2 key={`h2-${idx}`} className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mt-3 mb-1.5">
          {applyInline(h2Match[1])}
        </h2>
      );
      return;
    }

    if (h3Match || boldHeaderMatch) {
      const headerText = h3Match ? h3Match[1] : boldHeaderMatch![1];
      if (isPlanCardHeader(headerText)) {
        flushList(`list-pre-${idx}`);
        flushTable(`tbl-pre-${idx}`);
        flushPlanCard(`plan-pre-${idx}`);
        inPlanCard = true;
        planTitle = headerText.replace(/[:*]/g, "").trim();
        return;
      } else {
        flushList(`list-h3-${idx}`);
        flushTable(`tbl-h3-${idx}`);
        flushPlanCard(`plan-h3-${idx}`);
        elements.push(
          <div key={`h3-${idx}`} className="mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {applyInline(headerText)}
            </h3>
          </div>
        );
        return;
      }
    }

    // Check for blockquotes: e.g. "> Tip: Drink plenty of water"
    if (trimmed.startsWith(">")) {
      flushList(`quote-list-${idx}`);
      flushTable(`quote-tbl-${idx}`);
      const quoteText = trimmed.replace(/^>\s*/, "");
      const quoteNode = (
        <blockquote
          key={`quote-${idx}`}
          className="my-2 pl-3 border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 py-1.5 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 rounded-r-lg"
        >
          {applyInline(quoteText)}
        </blockquote>
      );
      if (inPlanCard) planLines.push(quoteNode);
      else elements.push(quoteNode);
      return;
    }

    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);

    if (bulletMatch) {
      if (listType === "ol") flushList(`flush-ol-${idx}`);
      listType = "ul";
      listItems.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (listType === "ul") flushList(`flush-ul-${idx}`);
      listType = "ol";
      listItems.push(numberedMatch[1]);
    } else {
      flushList(`flush-${idx}`);
      if (trimmed) {
        const paragraphNode = (
          <p key={idx} className="my-1.5 leading-relaxed text-gray-800 dark:text-slate-200">
            {applyInline(trimmed)}
          </p>
        );
        if (inPlanCard) {
          planLines.push(paragraphNode);
        } else {
          elements.push(paragraphNode);
        }
      }
    }
  });

  flushList("final-list");
  flushTable("final-table");
  flushPlanCard("final-plan");

  return <div className="text-sm leading-relaxed space-y-1">{elements}</div>;
});

RenderMessage.displayName = "RenderMessage";

// ── Memoized Chat Message Item ─────────────────────────────
interface ChatMessageItemProps {
  msg: Message;
  isLast: boolean;
  isLoading: boolean;
  copiedId: string | null;
  speakingId: string | null;
  onCopy: (id: string, text: string) => void;
  onRegenerate: () => void;
  onSpeakToggle: (id: string, text: string) => void;
  onRetry: () => void;
}

const ChatMessageItem = React.memo(({
  msg,
  isLast,
  isLoading,
  copiedId,
  speakingId,
  onCopy,
  onRegenerate,
  onSpeakToggle,
  onRetry,
}: ChatMessageItemProps) => {
  const isAssistant = msg.role === "assistant";
  const isSpeakingThis = speakingId === msg.id;

  if (isAssistant) {
    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex gap-2.5 sm:gap-3.5 items-start w-full group py-1"
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
            {isSpeakingThis && (
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
              <MarkdownMessage content={msg.text} />
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
                {copiedId === msg.id ? (
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
                  isSpeakingThis
                    ? "bg-emerald-500/15 text-emerald-500 font-medium"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                aria-label={isSpeakingThis ? "Stop speaking" : "Listen (Read aloud)"}
                title={isSpeakingThis ? "Stop speaking" : "Listen (Read aloud)"}
              >
                {isSpeakingThis ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{isSpeakingThis ? "Stop" : "Listen"}</span>
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
      className="flex gap-2 sm:gap-3 flex-row-reverse items-end w-full group py-1"
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
            {copiedId === msg.id ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
});

ChatMessageItem.displayName = "ChatMessageItem";

// ── Main AIAssistant Component ─────────────────────────────
export default function AIAssistant() {
  const { user, allFoodLogs, allActivityLogs } = useappcontext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
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
  const [sessionSaved, setSessionSaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("fitbot_sound") !== "false";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<any>(null);
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

  // Filter today's dynamic logs
  const todayFood = useMemo(
    () => (allFoodLogs || []).filter((l) => isToday(resolveDate(l))),
    [allFoodLogs]
  );
  const todayActivity = useMemo(
    () => (allActivityLogs || []).filter((l) => isToday(resolveDate(l))),
    [allActivityLogs]
  );

  const suggestions = useMemo(() => {
    const dynamic: string[] = [];
    if (todayFood.length === 0) dynamic.push("What's a healthy breakfast idea?");
    if (todayActivity.length === 0) dynamic.push("Suggest a quick 20-minute workout");
    const total = [...dynamic, ...BASE_SUGGESTIONS];
    return total.slice(0, 6);
  }, [todayFood, todayActivity]);

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

  // Save session when leaving or upon conversation milestone
  const saveSession = useCallback(
    async (msgs: Message[]) => {
      const validMsgs = msgs.filter((m) => !m.isError);
      if (sessionSaved || validMsgs.length < 2) return;
      const summary = validMsgs
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "FitBot"}: ${m.text.slice(0, 120)}`)
        .join("\n");
      try {
        await api.post(
          "/api/chathistories",
          {
            data: { summary, messages: validMsgs.map((m) => ({ role: m.role, text: m.text })) },
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSessionSaved(true);
      } catch {
        // silent
      }
    },
    [sessionSaved, token]
  );

  useEffect(() => {
    return () => {
      if (messages.length >= 2) saveSession(messages);
    };
  }, [messages, saveSession]);

  const clearMemory = async () => {
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

  const loadPastSessionIntoChat = (session: any) => {
    if (Array.isArray(session.messages) && session.messages.length > 0) {
      const formatted: Message[] = session.messages.map((m: any, i: number) => ({
        id: `${session._id || session.id || Date.now()}-${i}`,
        role: m.role === "user" ? "user" : "assistant",
        text: m.text || "",
        timestamp: new Date(session.createdAt || Date.now()),
      }));
      setMessages(formatted);
      setShowMemory(false);
      toast.success("Loaded previous conversation!");
    } else {
      toast("No messages recorded in this session.", { icon: "ℹ️" });
    }
  };

  // Build live user context string
  const userContext = useMemo(() => {
    const parts: string[] = [];
    if (user?.username) parts.push(`User: ${user.username}`);
    if (user?.goal) parts.push(`Goal: ${user.goal} weight`);
    if (user?.weight) parts.push(`Weight: ${user.weight}kg`);
    if (user?.height) parts.push(`Height: ${user.height}cm`);
    if (user?.age) parts.push(`Age: ${user.age}`);
    if (user?.dailycaloriesintake) parts.push(`Daily calorie target: ${user.dailycaloriesintake} kcal`);
    if (todayFood.length) {
      const totalCal = todayFood.reduce((s, l) => s + (l.calories ?? 0), 0);
      parts.push(`Today's food: ${todayFood.map((l) => l.name).join(", ")} (${totalCal} kcal total)`);
    }
    if (todayActivity.length) {
      parts.push(
        `Today's activities: ${todayActivity
          .map((l) => `${l.name ?? l.type} ${l.duration}min`)
          .join(", ")}`
      );
    }
    return parts.join(". ");
  }, [user, todayFood, todayActivity]);

  const memoryContext = useMemo(() => {
    if (!pastSessions.length) return "";
    return (
      "Previous coaching sessions summary:\n" +
      pastSessions
        .slice(0, 3)
        .map((s: any) => s.summary ?? "")
        .filter(Boolean)
        .join("\n\n")
    );
  }, [pastSessions]);

  // Filtered memory sessions based on search
  const filteredSessions = useMemo(() => {
    if (!memorySearch.trim()) return pastSessions;
    const q = memorySearch.toLowerCase();
    return pastSessions.filter((s: any) => {
      const summaryMatch = (s.summary || "").toLowerCase().includes(q);
      const msgMatch = Array.isArray(s.messages) && s.messages.some((m: any) => (m.text || "").toLowerCase().includes(q));
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

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNear = distanceFromBottom <= 120;
    isNearBottomRef.current = isNear;
    setShowScrollBottom(!isNear);
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
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        toast("Listening to your voice...", { icon: "🎙️", duration: 1800 });
      };

      recognition.onresult = (event: any) => {
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
    setIsLoading(false);
    toast("Stopped generating response", { icon: "⏹️" });
  };

  // Send message to AI
  const sendMessage = async (text: string, customHistory?: Message[], sendOptions?: { regenerate?: boolean }) => {
    if (!text.trim() || isLoading) return;
    const currentMessages = (customHistory || messages).filter((m) => !m.isError);
    const userMsg: Message = {
      id: Date.now().toString(),
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

    const historyPayload: GeminiMessage[] = newMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const combinedContext = [userContext, memoryContext].filter(Boolean).join("\n\n");
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: historyPayload,
          userContext: combinedContext,
          ...(sendOptions?.regenerate ? { regenerate: true } : {}),
        }),
        signal: abortControllerRef.current.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `AI assistant request failed (${res.status})`);
      }

      const reply = data.reply || "I couldn't generate a response. Please try again.";
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: reply,
        timestamp: new Date(),
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      if (soundEnabled) playCompletionChime();
      if (finalMessages.length % 6 === 0) saveSession(finalMessages);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to get response. Check your connection.";
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: `⚠️ I had trouble connecting (${msg}).`,
        timestamp: new Date(),
        isError: true,
      };
      setMessages([...newMessages, errorMsg]);
      toast.error(msg);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const retryLastMessage = useCallback(() => {
    const valid = messages.filter((m) => !m.isError);
    const lastUser = [...valid].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    const history = valid.slice(0, valid.length - 1);
    sendMessage(lastUser.text, history);
  }, [messages]);

  const regenerateLastMessage = useCallback(() => {
    if (isLoading || messages.length < 2) return;
    const valid = messages.filter((m) => !m.isError);
    const lastUserMsg = [...valid].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message and re-send with cache bypass
    const trimmed = valid.slice(0, valid.length - 1);
    setMessages(trimmed);
    sendMessage(lastUserMsg.text, trimmed.slice(0, trimmed.length - 1), { regenerate: true });
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
    if (messages.length >= 2) saveSession(messages);
    if (speakingId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
    }
    setMessages([]);
    setSessionSaved(false);
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
                  filteredSessions.map((s: any, i: number) => {
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
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 shrink-0 self-center transition-colors" />
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
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 overscroll-contain no-scrollbar relative"
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
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-4 sm:mb-6 max-w-xs sm:max-w-sm">
                {FITBOT_CONFIG.DESCRIPTION}
              </p>
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
                  copiedId={copiedId}
                  speakingId={speakingId}
                  onCopy={handleCopy}
                  onRegenerate={regenerateLastMessage}
                  onSpeakToggle={toggleSpeakMessage}
                  onRetry={retryLastMessage}
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
      <div className={`${cardCls} px-2.5 py-2 sm:px-4 sm:py-2.5 shrink-0 border-t shadow-sm`}>
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
              placeholder={isListening ? "Listening... speak now" : "Ask FitBot anything (workouts, food, macros)…"}
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
    </div>
  );
}
