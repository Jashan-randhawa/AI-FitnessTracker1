import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M12 2a3 3 0 0 1 3 3v6H9V5a3 3 0 0 1 3-3z" />
    <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const BASE_SUGGESTIONS = [
  "What should I eat before a workout?",
  "Create a 7-day meal plan for weight loss",
  "How many calories should I eat daily?",
  "Best exercises to build core strength",
  "How to stay motivated to exercise?",
  "What's a good post-workout meal?",
];

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// ── Word/Token Sequential Reveal Variants ──────────────────
// Fades in words sequentially (opacity: 0, y: 4 -> opacity: 1, y: 0)
// rather than a jarring bulk block render, smoothing out AI latency.
const WordContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.022, delayChildren: 0.03 },
  },
};

const WordItem = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// ── Markdown-like renderer with Word Stagger & Accordion Cards ──
const RenderMessage = ({ text }: { text: string }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inPlanCard = false;
  let planTitle = "";
  let planLines: React.ReactNode[] = [];

  const applyInline = (raw: string): React.ReactNode[] => {
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={i}>{part.slice(1, -1)}</em>;
      return part;
    });
  };

  const renderWordsInText = (rawText: string, keyPrefix: string) => {
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
              <motion.span variants={WordItem} className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 dark:bg-emerald-500" />
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
              <motion.span variants={WordItem} className="shrink-0 font-semibold text-emerald-500 dark:text-emerald-400 min-w-[18px]">{i + 1}.</motion.span>
              <span className="flex-1 leading-relaxed">{renderWordsInText(item, `ol-${i}`)}</span>
            </li>
          ))}
        </ol>
      );
    }
    listItems = []; listType = null;
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
    const headerMatch = trimmed.match(/^###\s+(.+)/) || trimmed.match(/^##\s+(.+)/);
    const planBlockMatch = trimmed.match(/^\*\*(.+plan|.+routine|.+breakdown|.+workout|.+schedule)\*\*/i);

    if (headerMatch || planBlockMatch) {
      flushList(`list-pre-${idx}`);
      flushPlanCard(`plan-pre-${idx}`);
      inPlanCard = true;
      planTitle = headerMatch ? headerMatch[1] : planBlockMatch![1];
      return;
    }

    const bulletMatch = trimmed.match(/^[-•]\s+(.+)/);
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

// ── Main Component ────────────────────────────────────────
export default function AIAssistant() {
  const { user, allFoodLogs, allActivityLogs } = useappcontext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, "");
  const token = localStorage.getItem("token");

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

  // ── Load past sessions from Strapi ───────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/chathistories", { headers: { Authorization: `Bearer ${token}` } });
        const sessions = Array.isArray(data) ? data : (data?.data ?? []);
        setPastSessions(sessions);
        setMemoryLoaded(true);
      } catch { setMemoryLoaded(true); }
    };
    if (token) load();
  }, []);

  // ── Save session when user leaves (or on last message) ──
  const saveSession = useCallback(async (msgs: Message[]) => {
    if (sessionSaved || msgs.length < 2) return;
    const summary = msgs
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "FitBot"}: ${m.text.slice(0, 120)}`)
      .join("\n");
    try {
      await api.post("/api/chathistories", {
        data: { summary, messages: msgs.map((m) => ({ role: m.role, text: m.text })) },
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSessionSaved(true);
    } catch { /* silent */ }
  }, [sessionSaved, token]);

  useEffect(() => {
    return () => { if (messages.length >= 2) saveSession(messages); };
  }, [messages, saveSession]);

  const clearMemory = async () => {
    try {
      await api.delete("/api/chathistories/all", { headers: { Authorization: `Bearer ${token}` } });
      setPastSessions([]);
      toast.success("FitBot memory cleared");
    } catch { toast.error("Failed to clear memory"); }
  };

  // ── Build user context string ────────────────────────────
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
      parts.push(`Today's activities: ${todayActivity.map((l) => `${l.name ?? l.type} ${l.duration}min`).join(", ")}`);
    }
    return parts.join(". ");
  }, [user, todayFood, todayActivity]);

  // ── Past memory context ──────────────────────────────────
  const memoryContext = useMemo(() => {
    if (!pastSessions.length) return "";
    return "Previous coaching sessions summary:\n" +
      pastSessions.slice(0, 3).map((s: any) => s.summary ?? "").filter(Boolean).join("\n\n");
  }, [pastSessions]);

  const systemPrompt = `You are FitBot, a friendly and expert AI fitness coach inside a fitness tracking app.
${userContext ? `\nUser profile & today's data: ${userContext}` : ""}
${memoryContext ? `\n${memoryContext}` : ""}

Guidelines:
- Give personalized, actionable advice based on the user's profile and logged data.
- Be encouraging and supportive, not preachy.
- Keep responses concise but thorough.
- Use bullet points for lists and steps.
- Reference their actual data when relevant (e.g. "You've burned 200 kcal today...").
- If you remember past sessions, refer to them naturally.`;

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim(), timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const geminiHistory: GeminiMessage[] = newMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch(`${STRAPI_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: geminiHistory, systemInstruction: systemPrompt }),
      });
      const data = await res.json();
      const reply = data.reply || "I couldn't generate a response. Please try again.";
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", text: reply, timestamp: new Date() };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      // Auto-save after every 6th message
      if (finalMessages.length % 6 === 0) saveSession(finalMessages);
    } catch {
      toast.error("Failed to get response. Check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const startNewChat = () => {
    if (messages.length >= 2) saveSession(messages);
    setMessages([]);
    setSessionSaved(false);
    setInput("");
  };

  const cardCls = `bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/50`;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4.5rem)] lg:h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white">

      {/* Header */}
      <div className="page-header-ai shrink-0 shadow-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white border border-white/20 shadow-inner">
                <BotIcon />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">FitBot</h1>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/90">
                    {memoryLoaded && pastSessions.length > 0 ? `${pastSessions.length} session${pastSessions.length > 1 ? "s" : ""} remembered` : "Online"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Memory panel toggle */}
              {pastSessions.length > 0 && (
                <button
                  onClick={() => setShowMemory(!showMemory)}
                  className="text-xs px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer"
                >
                  🧠 Memory
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

          {/* Memory panel */}
          {showMemory && (
            <div className="mt-3 p-3 rounded-xl bg-white/15 dark:bg-black/30 backdrop-blur-md border border-white/20 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white">🧠 FitBot remembers your past sessions</p>
                <button onClick={clearMemory} className="text-[10px] text-rose-200 hover:text-white underline cursor-pointer">Clear memory</button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {pastSessions.slice(0, 3).map((s: any, i) => (
                  <p key={i} className="text-[11px] text-white/80 leading-relaxed line-clamp-2">
                    {s.summary?.split("\n")[0] ?? "Past session"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">

          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-3xl mb-4">🤖</div>
              <h2 className="text-lg font-bold mb-1">Hey, I'm FitBot!</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-xs">
                Your AI fitness coach. {pastSessions.length > 0 ? "I remember our previous conversations and" : "Ask me anything about"} nutrition, workouts, and wellness.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:scale-[1.03] hover:shadow-md transition-all duration-200 cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white ${msg.role === "user" ? "bg-emerald-500" : "bg-violet-500"}`}>
                  {msg.role === "user" ? <UserIcon /> : <BotIcon />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-emerald-500 text-white rounded-tr-md" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-md"}`}>
                  {msg.role === "assistant" ? <RenderMessage text={msg.text} /> : <p className="text-sm">{msg.text}</p>}
                  <p className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-emerald-100" : "text-gray-400 dark:text-slate-500"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-3"
              >
                <div className="ai-orb-organic-pulse shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-white">
                  <BotIcon />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1.5 items-center h-5">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`${cardCls} px-4 py-4 shrink-0`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask FitBot anything…"
              rows={1}
              className="flex-1 resize-none bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-500 transition-colors"
              style={{ maxHeight: 120 }}
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-11 h-11 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <SendIcon />
            </motion.button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2 text-center">
            Enter to send · Shift+Enter for new line · Conversations are saved for coaching context
          </p>
        </div>
      </div>
    </div>
  );
}
