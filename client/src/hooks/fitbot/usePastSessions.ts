import { useEffect, useState } from "react";
import api from "../../configs/api";

export type PastSession = Record<string, unknown> & {
  sessionId?: string;
  _id?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
  messages?: Array<{ role?: string; text?: string; proposedActions?: unknown[] }>;
};

/**
 * Loads saved FitBot chat sessions for the signed-in user. Returns the list
 * and its setter (used when sessions are saved or cleared), plus a flag that
 * is true once the first load has finished, successful or not.
 */
export function usePastSessions(token: string | null) {
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [memoryLoaded, setMemoryLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/chathistories");
        const sessions = Array.isArray(data) ? data : data?.data ?? [];
        setPastSessions(sessions);
        setMemoryLoaded(true);
      } catch {
        setMemoryLoaded(true);
      }
    };
    if (token) load();
  }, [token]);

  return { pastSessions, setPastSessions, memoryLoaded, setMemoryLoaded };
}
