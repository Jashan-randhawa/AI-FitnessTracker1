import { useCallback, useEffect, useRef, useState } from "react";
import api from "../../configs/api";
import { authHeaders } from "../../configs/authToken";
import {
  type FitBotMessage as Message,
  buildSessionSummary,
  getValidMessages,
} from "../../utils/fitbotHistory";
import type { PastSession } from "./usePastSessions";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Options {
  /** Returns the current chat session id. Read at save time, not render time. */
  getSessionId: () => string;
  /** The live message list, used for the unmount and pagehide saves. */
  messages: Message[];
  token: string | null;
  apiUrl: string;
  setPastSessions: React.Dispatch<React.SetStateAction<PastSession[]>>;
}

/**
 * Persists the FitBot conversation as a chat session.
 *
 * - `saveSession` is idempotent per session id: a monotonically increasing
 *   revision is sent, and if a save is already in flight the newest snapshot
 *   is queued and written once the current request finishes.
 * - A keepalive fetch is sent on `pagehide` so a refresh or tab close still
 *   writes the latest turn.
 * - The conversation is saved again when the page unmounts during SPA navigation.
 */
export function useChatSessionPersistence({
  getSessionId,
  messages,
  token,
  apiUrl,
  setPastSessions,
}: Options) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveRevisionRef = useRef(0);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<{ msgs: Message[]; revision: number } | null>(null);

  const saveSession = useCallback(
    async (msgs: Message[]) => {
      const validMsgs = getValidMessages(msgs);
      if (validMsgs.length < 1) return;

      saveRevisionRef.current += 1;
      const currentRevision = saveRevisionRef.current;
      const currentSessionId = getSessionId();

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
        const { data: savedDoc } = await api.post("/api/chathistories", {
          data: {
            sessionId: currentSessionId,
            revision: currentRevision,
            summary,
            messages: messagesPayload,
          },
        });

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
    [getSessionId, setPastSessions]
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
        const summary = buildSessionSummary(valid, 6);
        const messagesPayload = valid.map((m) => ({ role: m.role, text: m.text }));
        const body = JSON.stringify({
          data: {
            sessionId: getSessionId(),
            revision: saveRevisionRef.current + 1,
            summary,
            messages: messagesPayload,
          },
        });
        try {
          fetch(`${apiUrl}/api/chathistories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
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
  }, [messages, token, apiUrl, getSessionId]);

  // Save when unmounting inside SPA navigation
  useEffect(() => {
    return () => {
      const valid = getValidMessages(messages);
      if (valid.length >= 1) {
        saveSession(messages);
      }
    };
  }, [messages, saveSession]);

  return { saveSession, saveStatus, setSaveStatus, saveRevisionRef };
}
