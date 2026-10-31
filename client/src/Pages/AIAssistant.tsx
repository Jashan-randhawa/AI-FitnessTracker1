import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  Check,
  RotateCcw,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  History,
  Send,
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
import api, { API_URL } from "../configs/api";
import toast from "react-hot-toast";
import { FitBotAvatar } from "../components/FitBotAvatar";
import { buildWorkoutPlanActionPayload, type WorkoutPlanAction } from "../schemas/aiPlans.schema";
import type { ProposedChatAction } from "../schemas/chatAction.schema";
import { FITBOT_CONFIG } from "../constants/fitbot";
import {
  type FitBotMessage as Message,
  type FitBotActionState,
  getRetryContext,
  getRegenerateContext,
  formatMemoryContext,
} from "../utils/fitbotHistory";
import { createHandoffState, readHandoff, type HandoffPayload } from "../utils/handoff";
import { getFitBotSuggestions } from "../utils/fitbotSuggestions";
import { useDaySummary } from "../data/summaryStore";
import { localDayKey } from "../utils/localDay";
import { getWeatherObservation } from "../data/weatherStore";
import jsPDF from "jspdf";
import { getAuthToken } from "../configs/authToken";
import { useActiveWorkoutPlan } from "../hooks/fitbot/useActiveWorkoutPlan";
import { usePastSessions } from "../hooks/fitbot/usePastSessions";
import { useChatSessionPersistence } from "../hooks/fitbot/useChatSessionPersistence";
import { useFitBotChat } from "../hooks/fitbot/useFitBotChat";
import { ChatMessageItem } from "../components/fitbot/ChatMessageItem";
import {
  parseMarkdownIntoWorkoutDays,
  QUICK_ACTIONS,
  formatTime,
  playCompletionChime,
  type SpeechRecognitionLike,
  type SpeechRecognitionCtor,
} from "../components/fitbot/fitbotHelpers";


// ── Helpers ───────────────────────────────────────────────
// Note: Message rendering is handled by MarkdownMessage.tsx



// Creates a fresh chat session id. Kept outside the component so render-time
// analysis never sees the impure Date.now() fallback.
const newSessionId = (): string => {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const randomHex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `session-${Date.now()}-${randomHex}`;
    }
  }
  return `session-${Date.now()}-fallback`;
};

export default function AIAssistant() {
  const { user, setAllWaterLogs } = useappcontext();
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

  const [aiUsage, setAiUsage] = useState<{
    percentUsed: number;
    isExhausted: boolean;
    remainingTokens: number;
    remainingCalls: number;
    resetAt: string;
  } | null>(null);

  const refreshAiUsage = useCallback(() => {
    api
      .get("/api/ai/usage")
      .then((res) => {
        if (!res.data) return;
        setAiUsage({
          percentUsed: res.data.percentUsed ?? 0,
          isExhausted: Boolean(res.data.isExhausted),
          remainingTokens: res.data.remainingTokens ?? 0,
          remainingCalls: res.data.remainingCalls ?? 0,
          resetAt: res.data.resetAt ?? "",
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/ai/usage")
      .then((res) => {
        if (!isMounted || !res.data) return;
        setAiUsage({
          percentUsed: res.data.percentUsed ?? 0,
          isExhausted: Boolean(res.data.isExhausted),
          remainingTokens: res.data.remainingTokens ?? 0,
          remainingCalls: res.data.remainingCalls ?? 0,
          resetAt: res.data.resetAt ?? "",
        });
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

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
  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const sessionIdRef = useRef<string>(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);


  // Concurrency synchronous lock & active request identity
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

  const token = getAuthToken();
  const { pastSessions, setPastSessions, memoryLoaded } = usePastSessions(token);

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
  const activePlan = useActiveWorkoutPlan();

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

  // Save session idempotently and keep it in sync on pagehide / unmount
  const getSessionId = useCallback(() => sessionIdRef.current, []);
  const { saveSession, saveStatus, setSaveStatus, saveRevisionRef } = useChatSessionPersistence({
    getSessionId,
    messages,
    token,
    apiUrl: API_URL,
    setPastSessions,
  });

  const clearMemory = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all saved FitBot memory? This permanently deletes your saved coaching history and resets past context."
      )
    ) {
      return;
    }

    try {
      await api.delete("/api/chathistories/all");
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
      await api.delete(`/api/chathistories/session/${targetId}`);
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
    cancelActiveRequest();

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

  // Chat request lifecycle: sends a turn, handles replies, errors and cancellation.
  const { sendMessage, isLoading, cancelActiveRequest, isSending } =
    useFitBotChat({
      messages,
      setMessages,
      setInput,
      saveSession,
      scrollToBottom,
      isNearBottomRef,
      memoryContext,
      soundEnabled,
    });

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
    cancelActiveRequest();
    toast("Stopped generating response", { icon: "⏹️" });
  };

  const retryLastMessage = useCallback(() => {
    if (isSending() || isLoading) return;
    const retryCtx = getRetryContext(messages);
    if (!retryCtx) return;
    sendMessage(retryCtx.prompt, retryCtx.precedingHistory);
  }, [messages, isLoading, isSending, sendMessage]);

  const regenerateLastMessage = useCallback(() => {
    if (isSending() || isLoading) return;
    const regenCtx = getRegenerateContext(messages);
    if (!regenCtx) return;
    setMessages(regenCtx.trimmedMessages);
    sendMessage(regenCtx.prompt, regenCtx.precedingHistory, { regenerate: true });
  }, [isLoading, messages, isSending, sendMessage]);

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
    cancelActiveRequest();

    if (speakingId) {
      window.speechSynthesis?.cancel();
      setSpeakingId(null);
    }

    if (messages.length >= 1) {
      saveSession(messages);
    }

    const newId = newSessionId();
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
          {/* AI Daily Budget Banner */}
          {aiUsage?.isExhausted ? (
            <div
              role="alert"
              aria-live="polite"
              data-testid="ai-budget-exhausted-banner"
              className="mb-2 p-2.5 sm:p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">⏳</span>
                <div>
                  <span className="font-semibold">Daily AI budget reached:</span>{" "}
                  <span>
                    You have reached your daily AI usage limit. Quota resets at{" "}
                    {aiUsage.resetAt ? formatTime(new Date(aiUsage.resetAt)) : "midnight UTC"}.
                  </span>
                </div>
              </div>
            </div>
          ) : aiUsage && aiUsage.percentUsed >= 80 ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="ai-budget-warning-banner"
              className="mb-2 p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden="true">⚠️</span>
                <div>
                  <span className="font-semibold">AI usage today:</span>{" "}
                  <span>
                    {aiUsage.percentUsed}% used ({aiUsage.remainingTokens.toLocaleString()} tokens remaining). Resets at{" "}
                    {aiUsage.resetAt ? formatTime(new Date(aiUsage.resetAt)) : "midnight UTC"}.
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex gap-1.5 sm:gap-2.5 items-end">
            <textarea
              ref={inputRef}
              value={input}
              disabled={Boolean(aiUsage?.isExhausted)}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                isNearBottomRef.current = true;
                setTimeout(() => scrollToBottom(true), 150);
              }}
              placeholder={
                aiUsage?.isExhausted
                  ? "Daily AI quota reached. Resets at midnight UTC."
                  : isListening
                    ? "Listening… speak now"
                    : ""
              }
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
                disabled={Boolean(aiUsage?.isExhausted)}
                type="button"
                className={`shrink-0 w-9 h-9 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border ${
                  isListening
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-md"
                    : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:text-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
                title={aiUsage?.isExhausted ? "Daily AI budget exceeded" : (isListening ? "Stop listening" : "Speak to FitBot")}
                aria-label={aiUsage?.isExhausted ? "Daily AI budget exceeded" : (isListening ? "Stop listening" : "Speak to FitBot")}
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
                onClick={() => {
                  sendMessage(input);
                  refreshAiUsage();
                }}
                disabled={Boolean(aiUsage?.isExhausted) || !input.trim()}
                className="shrink-0 w-9 h-9 sm:w-9 sm:h-9 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center text-white transition-colors cursor-pointer shadow-xs"
                title={aiUsage?.isExhausted ? "Daily AI budget exceeded" : "Send message"}
                aria-label={aiUsage?.isExhausted ? "Daily AI budget exceeded" : "Send message"}
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