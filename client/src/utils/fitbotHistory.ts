export type FitBotMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isError?: boolean;
};

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

/**
 * Filters out error bubbles and extracts valid non-error messages.
 */
export function getValidMessages(messages: FitBotMessage[]): FitBotMessage[] {
  return messages.filter((m) => !m.isError && m.text.trim().length > 0);
}

/**
 * Converts internal UI messages into the payload format expected by /api/ai-assistant/chat.
 */
export function buildGeminiPayload(messages: FitBotMessage[]): GeminiMessage[] {
  return getValidMessages(messages).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));
}

/**
 * Locates the prompt and preceding valid history for a retry request.
 * Excludes error messages and identifies the failed user turn once.
 */
export function getRetryContext(messages: FitBotMessage[]): {
  prompt: string;
  precedingHistory: FitBotMessage[];
} | null {
  const valid = getValidMessages(messages);
  let userIdx = -1;
  for (let i = valid.length - 1; i >= 0; i--) {
    if (valid[i].role === "user") {
      userIdx = i;
      break;
    }
  }
  if (userIdx === -1) return null;

  return {
    prompt: valid[userIdx].text,
    precedingHistory: valid.slice(0, userIdx),
  };
}

/**
 * Locates the prompt, preceding history, and trimmed UI message array for a regenerate request.
 * Removes only the last assistant turn being regenerated, resending the associated user prompt once.
 */
export function getRegenerateContext(messages: FitBotMessage[]): {
  prompt: string;
  precedingHistory: FitBotMessage[];
  trimmedMessages: FitBotMessage[];
} | null {
  const valid = getValidMessages(messages);
  if (valid.length < 2) return null;

  // The last valid message must be assistant
  const lastMsg = valid[valid.length - 1];
  if (lastMsg.role !== "assistant") return null;

  // Find the user turn that produced this assistant response
  let userIdx = -1;
  for (let i = valid.length - 2; i >= 0; i--) {
    if (valid[i].role === "user") {
      userIdx = i;
      break;
    }
  }
  if (userIdx === -1) return null;

  return {
    prompt: valid[userIdx].text,
    precedingHistory: valid.slice(0, userIdx),
    trimmedMessages: valid.slice(0, valid.length - 1),
  };
}

/**
 * Builds a compact readable session summary for the memory drawer from valid turns.
 */
export function buildSessionSummary(messages: FitBotMessage[], maxTurns = 6): string {
  const valid = getValidMessages(messages);
  return valid
    .slice(-maxTurns)
    .map((m) => `${m.role === "user" ? "User" : "FitBot"}: ${m.text.slice(0, 120)}`)
    .join("\n");
}
