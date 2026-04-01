import { useState, useRef, useEffect } from "react";
import { useTheme } from "../Context/Themecontext";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
};

type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M12 2a3 3 0 0 1 3 3v6H9V5a3 3 0 0 1 3-3z" />
    <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const SUGGESTIONS = [
  "What should I eat before a workout?",
  "Create a 7-day meal plan for weight loss",
  "How many calories should I eat daily?",
  "Best exercises to build core strength",
  "How to stay motivated to exercise?",
  "What's a good post-workout meal?",
];

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

const TypingIndicator = () => (
  <div className="flex items-end gap-2.5">
    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white shadow-md shadow-emerald-500/20">
      <BotIcon />
    </div>
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
      <div className="flex gap-1.5 items-center h-5">
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
      </div>
    </div>
  </div>
);

const MessageBubble = ({ msg }: { msg: Message }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
          isUser
            ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            : "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
        }`}
      >
        {isUser ? <UserIcon /> : <BotIcon />}
      </div>

      <div className={`max-w-[75%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-emerald-500 text-white rounded-br-sm"
              : "bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-bl-sm"
          }`}
        >
          {msg.text}
        </div>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
};

const AIAssistant = () => {
  const { theme } = useTheme();
  const { user } = useappcontext();
  const isDark = theme.toString() === "dark";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Hi${user?.username ? ` ${user.username}` : ""}! 👋 I'm FitBot, your personal fitness and nutrition AI assistant.\n\nI can help you with:\n• Personalized meal plans & nutrition advice\n• Workout recommendations & exercise tips\n• Calorie tracking guidance\n• Motivation & wellness support\n\nWhat would you like to know today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const buildHistory = (msgs: Message[]): GeminiMessage[] =>
    msgs
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

  const buildUserContext = () => {
    if (!user) return undefined;
    const parts: string[] = [];
    if (user.username) parts.push(`Name: ${user.username}`);
    if ((user as any).goal) parts.push(`Goal: ${(user as any).goal}`);
    if ((user as any).weight) parts.push(`Weight: ${(user as any).weight}kg`);
    if ((user as any).age) parts.push(`Age: ${(user as any).age}`);
    return parts.length > 0 ? parts.join(", ") : undefined;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const history = buildHistory(updatedMessages);
      const { data } = await api.post("/api/ai-assistant/chat", {
        messages: history,
        userContext: buildUserContext(),
      });

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "Sorry, I ran into an error. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const showSuggestions = messages.length <= 1 && !isLoading;

  return (
    <div
      className={`flex flex-col h-screen pt-14 lg:pt-0 ${isDark ? "bg-slate-900" : "bg-slate-50"} transition-colors duration-200`}
    >
      {/* Header */}
      <div className="shrink-0 px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25">
          <BotIcon />
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white leading-tight">
            FitBot AI Assistant
          </h1>
          <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            Online · Powered by Gemini
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5 flex flex-col gap-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && <TypingIndicator />}

        {/* Suggestion chips */}
        {showSuggestions && (
          <div className="flex flex-wrap gap-2 mt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-200 cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 lg:px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about fitness or nutrition…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-slate-400 resize-none outline-none leading-relaxed max-h-[140px] py-0.5"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer mb-0.5"
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AIAssistant;
