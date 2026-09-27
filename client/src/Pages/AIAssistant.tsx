import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  RotateCcw,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  ArrowDown,
  History,
  Send,
  Bot,
  User as UserIcon,
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
type Message = { id: string; role: "user" | "assistant"; text: string; timestamp: Date };
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

// ── Word/Token Sequential Reveal Variants ──────────────────
const WordContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.018, delayChildren: 0.02 },
  },
};

const WordItem = {
  hidden: { opacity: 0, y: 3 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ── Markdown Parser & Formatter with Plan Cards ─────────────
const RenderMessage = ({ text, isLatest }: { text: string; isLatest: boolean }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inPlanCard = false;
  let planTitle = "";
  let planLines: React.ReactNode[] = [];

  const applyInline = (raw: string): React.ReactNode[] => {
    // Matches inline code (`code`), bold (**text**), italics (*text*)
    const parts = raw.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
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
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return (
          <strong key={i} className="font-semibold text-gray-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <em key={i} className="italic text-gray-800 dark:text-slate-200">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  const renderWordsInText = (rawText: string, keyPrefix: string) => {
    if (!isLatest) {
      return <span>{applyInline(rawText)}</span>;
    }

    const tokens = rawText.split(/(\s+)/);
    return tokens.map((token, wIdx) => {
      if (/^\s+$/.test(token)) {
        return <span key={`${keyPrefix}-${wIdx}`}>{token}</span>;
      }
      return (
        <motion.span
          key={`${keyPrefix}-${wIdx}`}
          variants={WordItem}
          className="inline-block"
        >
          {applyInline(token)}
        </motion.span>
      );
    });
  };

  const flushList = (key: string) => {
    if (!listItems.length) return;
    const target = inPlanCard ? planLines : elements;
    if (listType === "ul") {
      target.push(
        <ul key={key} className="list-none space-y-1.5 my-1.5">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="flex-1 leading-relaxed">{renderWordsInText(item, `ul-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    } else {
      target.push(
        <ol key={key} className="list-none space-y-1.5 my-1.5">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="shrink-0 font-semibold text-emerald-500 text-xs min-w-[18px]">
                {i + 1}.
              </span>
              <span className="flex-1 leading-relaxed">{renderWordsInText(item, `ol-${i}`)}</span>
            </li>
          ))}
        </ol>
      );
    }
    listItems = [];
    listType = null;
  };

  const flushPlanCard = (key: string) => {
    if (inPlanCard && planLines.length > 0) {
      elements.push(
        <CollapsiblePlanCard key={key} title={planTitle || "Suggested Plan"} defaultOpen={true}>
          <div className="space-y-1 text-xs sm:text-sm">
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

    // Check for plan headers: e.g. "### Workout Routine" or "**Weekly Meal Plan**"
    const headerMatch = trimmed.match(/^###?\s+(.+)/);
    const planBlockMatch = trimmed.match(/^\*\*(.+plan|.+routine|.+breakdown|.+workout|.+schedule)\*\*/i);

    if (headerMatch || planBlockMatch) {
      flushList(`list-pre-${idx}`);
      flushPlanCard(`plan-pre-${idx}`);
      inPlanCard = true;
      planTitle = headerMatch ? headerMatch[1] : planBlockMatch![1];
      return;
    }

    // Check for blockquotes: e.g. "> Tip: Drink plenty of water"
    if (trimmed.startsWith(">")) {
      flushList(`quote-list-${idx}`);
      const quoteText = trimmed.replace(/^>\s*/, "");
      const quoteNode = (
        <blockquote
          key={`quote-${idx}`}
          className="my-2 pl-3 border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 py-1.5 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 rounded-r-lg"
        >
          {renderWordsInText(quoteText, `quote-text-${idx}`)}
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
          <p key={idx} className="my-1.5 leading-relaxed">
            {renderWordsInText(trimmed, `p-${idx}`)}
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
  flushPlanCard("final-plan");

  if (!isLatest) {
    return <div className="text-sm leading-relaxed">{elements}</div>;
  }

  return (
    <motion.div
      className="text-sm leading-relaxed"
      variants={WordContainer}
      initial="hidden"
      animate="show"
    >
      {elements}
    </motion.div>
  );
};

// ── Main AIAssistant Component ─────────────────────────────
export default function AIAssistant() {
  const { user, allFoodLogs, allActivityLogs } = useappcontext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechRecognitionRef = useRef<any>(null);

  const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_STRAPI_API_URL || "")?.replace(/\/$/, "");
  const token = localStorage.getItem("token");

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
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 140)}px`;
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
      if (sessionSaved || msgs.length < 2) return;
      const summary = msgs
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "FitBot"}: ${m.text.slice(0, 120)}`)
        .join("\n");
      try {
        await api.post(
          "/api/chathistories",
          {
            data: { summary, messages: msgs.map((m) => ({ role: m.role, text: m.text })) },
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

  // Scroll management
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isFar = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isFar);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  // Copy message text
  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Copied to clipboard!", { duration: 1500 });
    } catch {
      toast.error("Failed to copy text");
    }
  };

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

  // Send message to AI
  const sendMessage = async (text: string, customHistory?: Message[]) => {
    if (!text.trim() || isLoading) return;
    const currentMessages = customHistory || messages;
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

    const historyPayload: GeminiMessage[] = newMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    const combinedContext = [userContext, memoryContext].filter(Boolean).join("\n\n");

    try {
      const res = await fetch(`${API_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: historyPayload,
          userContext: combinedContext,
        }),
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

      if (finalMessages.length % 6 === 0) saveSession(finalMessages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get response. Check your connection.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateLastMessage = () => {
    if (isLoading || messages.length < 2) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove the last assistant message and re-send
    const trimmed = messages.slice(0, messages.length - 1);
    setMessages(trimmed);
    sendMessage(lastUserMsg.text, trimmed.slice(0, trimmed.length - 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewChat = () => {
    if (messages.length >= 2) saveSession(messages);
    setMessages([]);
    setSessionSaved(false);
    setInput("");
    toast.success("Started new chat session");
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
              {pastSessions.length > 0 && (
                <button
                  onClick={() => setShowMemory(!showMemory)}
                  className={`text-xs px-3 py-1.5 rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                    showMemory ? "bg-white text-emerald-950 font-bold" : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                  title="View remembered past sessions"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Memory</span>
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={startNewChat}
                  className="text-xs px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer"
                >
                  New Chat
                </button>
              )}
            </div>
          </div>

          {/* Memory drawer */}
          <AnimatePresence>
            {showMemory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-3 p-3.5 rounded-xl bg-white/15 dark:bg-black/40 backdrop-blur-md border border-white/20 text-white"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    FitBot Memory & Past Coaching Sessions
                  </p>
                  <button
                    onClick={clearMemory}
                    className="text-[10px] text-rose-200 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {pastSessions.slice(0, 5).map((s: any, i) => (
                    <div
                      key={s._id || i}
                      onClick={() => loadPastSessionIntoChat(s)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-emerald-200 font-medium">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : `Session ${i + 1}`}
                        </span>
                        <span className="text-[10px] text-white/60 group-hover:text-white underline">Load</span>
                      </div>
                      <p className="text-[11px] text-white/90 leading-relaxed line-clamp-2">
                        {s.summary?.split("\n")[0] ?? "Coaching conversation"}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
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
              const isAssistant = msg.role === "assistant";

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
                      msg.role === "user" ? "bg-emerald-500" : "bg-violet-600 dark:bg-violet-500"
                    }`}
                  >
                    {msg.role === "user" ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 shadow-xs relative ${
                      msg.role === "user"
                        ? "bg-emerald-500 text-white rounded-tr-sm"
                        : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-sm text-gray-900 dark:text-slate-100"
                    }`}
                  >
                    {isAssistant ? (
                      <RenderMessage text={msg.text} isLatest={isLast && !isLoading} />
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/40 text-[10px]">
                      <span className={msg.role === "user" ? "text-emerald-100" : "text-gray-400 dark:text-slate-500"}>
                        {formatTime(msg.timestamp)}
                      </span>

                      <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            msg.role === "user"
                              ? "hover:bg-emerald-600 text-emerald-100"
                              : "hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400"
                          }`}
                          title="Copy text"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {isAssistant && isLast && !isLoading && (
                          <button
                            onClick={regenerateLastMessage}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-400 transition-colors cursor-pointer"
                            title="Regenerate response"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
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

      {/* Floating Scroll to Bottom button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-28 right-6 z-20 px-3 py-2 rounded-full bg-emerald-500 text-white shadow-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 transition-all cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Latest</span>
          </motion.button>
        )}
      </AnimatePresence>

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
              className={`flex-1 resize-none bg-slate-100 dark:bg-slate-700/60 border rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-all ${
                isListening
                  ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-600 focus:border-emerald-400 dark:focus:border-emerald-500"
              }`}
              style={{ maxHeight: 140 }}
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

            {/* Send Button */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-11 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
              title="Send message (Enter)"
            >
              <Send className="w-4 h-4" />
            </motion.button>
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
