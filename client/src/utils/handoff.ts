/**
 * Cross-page context hand-off contracts and validation helpers (Phase B / G5).
 *
 * Rules:
 * - Server context remains authoritative; hand-offs are client-side navigation hints only.
 * - Targets pre-fill editable fields and NEVER auto-submit.
 * - Malformed, oversized, or unknown intents are rejected.
 */

export type HandoffIntent =
  | "indoor_alternative"
  | "plan_rest_of_today"
  | "plan_tomorrow"
  | "ask_followup";

export interface HandoffPayload {
  source: string;
  intent: HandoffIntent;
  prefill?: string;
}

const ALLOWED_INTENTS = new Set<HandoffIntent>([
  "indoor_alternative",
  "plan_rest_of_today",
  "plan_tomorrow",
  "ask_followup",
]);

export const MAX_PREFILL_LENGTH = 500;
export const MAX_SOURCE_LENGTH = 50;

/**
 * Safely parses and validates navigation state, discarding unknown or malformed payloads.
 */
export const readHandoff = (routerState: unknown): HandoffPayload | null => {
  if (!routerState || typeof routerState !== "object") return null;

  const state = routerState as Record<string, unknown>;
  const raw = state.handoff;
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;
  if (typeof obj.intent !== "string" || !ALLOWED_INTENTS.has(obj.intent as HandoffIntent)) {
    return null;
  }

  const intent = obj.intent as HandoffIntent;
  const source =
    typeof obj.source === "string" && obj.source.trim()
      ? obj.source.trim().slice(0, MAX_SOURCE_LENGTH)
      : "unknown";

  let prefill: string | undefined;
  if (typeof obj.prefill === "string" && obj.prefill.trim()) {
    prefill = obj.prefill.trim().slice(0, MAX_PREFILL_LENGTH);
  }

  return {
    source,
    intent,
    ...(prefill ? { prefill } : {}),
  };
};

/**
 * Helper to construct router state with a typed handoff payload.
 */
export const createHandoffState = (
  source: string,
  intent: HandoffIntent,
  prefill?: string
): { handoff: HandoffPayload } => {
  return {
    handoff: {
      source: source.trim().slice(0, MAX_SOURCE_LENGTH),
      intent,
      ...(prefill && prefill.trim()
        ? { prefill: prefill.trim().slice(0, MAX_PREFILL_LENGTH) }
        : {}),
    },
  };
};
