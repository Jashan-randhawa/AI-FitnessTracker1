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
  Bot,
  User as UserIcon,
  Volume2,
  VolumeX,
  Square,
  Download,
  X,
  Search,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";
import toast from "react-hot-toast";
import CollapsiblePlanCard from "../components/animations/CollapsiblePlanCard";

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
      <div key={key} className="overflow-x-auto my-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-100/90 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 font-semibold">
            <tr>
              {tableHeaders.map((header, hIdx) => (
                <th key={hIdx} className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                  {applyInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {tableRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
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

  return (
    <motion.div
      key={msg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 group ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
          msg.role === "user"
            ? "bg-emerald-500"
            : msg.isError
            ? "bg-rose-500"
            : "bg-violet-600 dark:bg-violet-500"
        }`}
      >
        {msg.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div
        className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-xs relative ${
          msg.role === "user"
            ? "bg-emerald-500 text-white rounded-tr-sm"
            : msg.isError
            ? "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-tl-sm"
            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-sm text-gray-900 dark:text-slate-100"
        }`}
      >
        {msg.isError ? (
          <div>
            <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        ) : isAssistant ? (
          <RenderMessage text={msg.text} isLatest={isLast && !isLoading} />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        )}

        {!msg.isError && (
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/40 text-[10px]">
            <div className="flex items-center gap-2">
              <span className={msg.role === "user" ? "text-emerald-100" : "text-gray-400 dark:text-slate-500"}>
                {formatTime(msg.timestamp)}
              </span>
              {isSpeakingThis && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium animate-pulse">
                  <Volume2 className="w-3 h-3" />
                  <span>Speaking…</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              {/* Copy message button */}
              <button
                onClick={() => onCopy(msg.id, msg.text)}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  msg.role === "user"
                    ? "hover:bg-emerald-600 text-emerald-100"
                    : "hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400"
                }`}
                title="Copy text"
              >
                {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Text-to-Speech (FitBot Read Aloud) */}
              {isAssistant && (
                <button
                  onClick={() => onSpeakToggle(msg.id, msg.text)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isSpeakingThis
                      ? "bg-emerald-500/20 text-emerald-500"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400"
                  }`}
                  title={isSpeakingThis ? "Stop speaking" : "Listen (Read aloud)"}
                >
                  {isSpeakingThis ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              )}

              {/* Regenerate latest assistant response */}
              {isAssistant && isLast && !isLoading && (
                <button
                  onClick={onRegenerate}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400 transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
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

  // Auto-resize input textarea smoothly
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      const newHeight = Math.min(inputRef.current.scrollHeight, 140);
      inputRef.current.style.height = `${newHeight}px`;
      inputRef.current.style.overflowY = inputRef.current.scrollHeight > 140 ? "auto" : "hidden";
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

  // Smooth scroll management
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(true);
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
  const sendMessage = async (text: string, customHistory?: Message[]) => {
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

    // Remove the last assistant message and re-send
    const trimmed = valid.slice(0, valid.length - 1);
    setMessages(trimmed);
    sendMessage(lastUserMsg.text, trimmed.slice(0, trimmed.length - 1));
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
    const dateStr = new Date().toISOString().split("T")[0];
    let exportContent = `# FitBot AI Fitness & Nutrition Coaching Session (${dateStr})\n\n`;
    if (user?.username) exportContent += `User: ${user.username}\n`;
    if (user?.goal) exportContent += `Goal: ${user.goal} weight\n`;
    exportContent += `\n---\n\n`;

    valid.forEach((m) => {
      exportContent += `### ${m.role === "user" ? "You" : "FitBot"} (${formatTime(m.timestamp)})\n\n${m.text}\n\n`;
    });

    const blob = new Blob([exportContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FitBot-Coaching-${dateStr}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported conversation as Markdown!");
  };

  const cardCls = "bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50";

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4.5rem)] lg:h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white relative">
      {/* Header */}
      <div className="page-header-ai shrink-0 shadow-md z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white border border-white/20 shadow-inner">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  FitBot
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/25 border border-emerald-300/30 text-emerald-100">
                    AI Coach
                  </span>
                </h1>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/90">
                    {memoryLoaded && pastSessions.length > 0
                      ? `${pastSessions.length} session${pastSessions.length > 1 ? "s" : ""} remembered`
                      : "Online & context-aware"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className="text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1.5"
                title={soundEnabled ? "Mute response chime" : "Unmute response chime"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
              </button>

              {/* Export Conversation */}
              {messages.length > 0 && (
                <button
                  onClick={exportConversation}
                  className="text-xs p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1.5"
                  title="Export chat as Markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}

              {/* Memory Trigger Button */}
              {pastSessions.length > 0 && (
                <button
                  ref={memoryBtnRef}
                  onClick={handleToggleMemory}
                  className={`text-xs px-2.5 py-1.5 rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                    showMemory ? "bg-white text-emerald-950 font-bold shadow-md" : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                  title="View remembered past sessions"
                >
                  <History className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Memory</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-400 text-emerald-950 font-bold">
                    {pastSessions.length}
                  </span>
                </button>
              )}

              {/* New Chat */}
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  className="text-xs px-2.5 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer"
                >
                  New Chat
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Memory Flyout Drawer (Positioned directly right below the Memory icon) */}
      <AnimatePresence>
        {showMemory && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            {/* Subtle Click-away Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/25 dark:bg-black/50 backdrop-blur-[1px] pointer-events-auto"
              onClick={() => setShowMemory(false)}
            />

            {/* Floating Flyout Window */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              style={
                flyoutPosition
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
              className="pointer-events-auto flex flex-col rounded-2xl bg-slate-900/98 dark:bg-slate-900/98 border border-slate-700/80 shadow-2xl backdrop-blur-2xl text-white overflow-hidden ring-1 ring-white/10"
            >
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
                        className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer group flex items-start gap-3"
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
              <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-[10px] text-slate-400 shrink-0">
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
        className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm border border-emerald-500/20">
                🤖
              </div>
              <h2 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">
                Hey, I'm FitBot!
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-sm">
                Your personal AI fitness and nutrition coach. I adapt to your goals, calorie balance, and past workouts.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-gray-700 dark:text-slate-300 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all duration-150 cursor-pointer shadow-xs hover:shadow-md"
                  >
                    {s}
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
                className="flex gap-3 items-center"
              >
                <div className="ai-orb-organic-pulse shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white bg-violet-600">
                  <Bot className="w-4 h-4 animate-spin-slow" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xs">
                  <div className="flex gap-1.5 items-center h-4">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                    <span className="text-xs text-slate-400 ml-2">FitBot is thinking…</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>



      {/* Quick Context Action Chips */}
      {messages.length > 0 && !isLoading && (
        <div className="px-4 py-1.5 overflow-x-auto no-scrollbar shrink-0 bg-slate-100/70 dark:bg-slate-900/40 border-t border-slate-200/60 dark:border-slate-800">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.prompt)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shadow-2xs"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input Section */}
      <div className={`${cardCls} px-4 py-3.5 shrink-0 border-t`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-2.5 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening... speak now" : "Ask FitBot anything (workouts, meal ideas, macros)…"}
              rows={1}
              className={`flex-1 resize-none bg-slate-100 dark:bg-slate-700/60 border rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                isListening
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-600 focus:border-emerald-400 dark:focus:border-emerald-500"
              }`}
              style={{
                maxHeight: 140,
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            />

            {/* Voice Input Button */}
            {isSpeechSupported && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={toggleListening}
                type="button"
                className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                  isListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-md"
                    : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-emerald-500"
                }`}
                title={isListening ? "Stop listening" : "Speak to FitBot"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </motion.button>
            )}

            {/* Send or Stop Generation Button */}
            {isLoading ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={stopGeneration}
                type="button"
                className="shrink-0 w-11 h-11 bg-rose-500 hover:bg-rose-600 rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
                title="Stop generating response"
              >
                <Square className="w-4 h-4 fill-current" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="shrink-0 w-11 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mt-2 px-1">
            <span>Press Enter to send · Shift+Enter for newline</span>
            <span>FitBot v1.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
