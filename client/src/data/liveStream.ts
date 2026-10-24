import api, { API_BASE_URL } from "../configs/api";

/**
 * Keeps this tab in step with the server. It exchanges the login token for a
 * single-use stream ticket, opens Server-Sent Events, and calls onChange for
 * every change event. On connection loss it reconnects with backoff and asks
 * for a fresh ticket each time. Returns a function that stops everything.
 */
export const startLiveUpdates = (onChange: () => void): (() => void) => {
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let attempt = 0;
  let hadConnection = false;

  const scheduleReconnect = () => {
    if (stopped) return;
    attempt += 1;
    const delay = Math.min(3000 * 2 ** (attempt - 1), 60000);
    timer = setTimeout(connect, delay);
  };

  const connect = async () => {
    if (stopped) return;
    try {
      const { data } = await api.post<{ ticket: string }>("/api/events/ticket");
      if (stopped) return;
      source = new EventSource(
        `${API_BASE_URL}/api/events?ticket=${encodeURIComponent(data.ticket)}`
      );
      source.addEventListener("ready", () => {
        attempt = 0;
        // Changes made while disconnected were missed; refresh once on reconnect.
        if (hadConnection) onChange();
        hadConnection = true;
      });
      source.addEventListener("change", () => onChange());
      source.onerror = () => {
        source?.close();
        source = null;
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    source?.close();
    source = null;
  };
};
