import { useCallback, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../../configs/api";
import { getAuthToken } from "../../configs/authToken";
import { useappcontext } from "../../Context/AppContext";
import { chatAiAssistant } from "../../services/aiAssistantClient";
import { invalidateSummaries } from "../../data/summaryStore";
import { playCompletionChime } from "../../components/fitbot/fitbotHelpers";
import {
  type FitBotMessage as Message,
  buildGeminiPayload,
  getValidMessages,
} from "../../utils/fitbotHistory";

interface Options {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  saveSession: (msgs: Message[]) => Promise<void> | void;
  scrollToBottom: (smooth?: boolean) => void;
  isNearBottomRef: React.MutableRefObject<boolean>;
  memoryContext: Parameters<typeof chatAiAssistant>[0]["memoryContext"];
  soundEnabled: boolean;
}

/**
 * Owns the FitBot request lifecycle: sending a turn, applying the reply,
 * refreshing dashboard lists after executed actions, and error/abort handling.
 * Stale completions are ignored via the active request id.
 *
 * Cancellation and the in-flight check are exposed as functions so the page
 * never touches the underlying refs directly.
 */
export function useFitBotChat({
  messages,
  setMessages,
  setInput,
  saveSession,
  scrollToBottom,
  isNearBottomRef,
  memoryContext,
  soundEnabled,
}: Options) {
  const { setAllFoodLogs, setAllActivityLogs } = useappcontext();
  const [isLoading, setIsLoading] = useState(false);
  const isSendingRef = useRef(false);
  const activeRequestIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        const token = getAuthToken();
        if (token) {
          const hasFood = data.executedActions.some((a) => a.action === "logMealItem");
          const hasWorkout = data.executedActions.some(
            (a) => a.action === "logWorkoutSession" || a.action === "swapExerciseInPlan"
          );
          if (hasFood) {
            api
              .get("/api/foodlogs")
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
                setAllFoodLogs(list);
              })
              .catch(() => {});
          }
          if (hasWorkout) {
            api
              .get("/api/activitylogs")
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

  /** Aborts the in-flight request, if any, and resets the request state. */
  const cancelActiveRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    activeRequestIdRef.current = null;
    isSendingRef.current = false;
    setIsLoading(false);
  }, []);

  /** True while a turn is in flight. Read at call time, so it stays fresh. */
  const isSending = useCallback(() => isSendingRef.current, []);

  return { sendMessage, isLoading, cancelActiveRequest, isSending };
}
