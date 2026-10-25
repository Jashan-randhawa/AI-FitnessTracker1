import type { ProposedChatAction } from "../schemas/chatAction.schema";

export type FitBotActionState = {
  action: ProposedChatAction;
  status: "pending" | "logging" | "logged" | "dismissed";
  loggedId?: string;
};

export type FitBotMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isError?: boolean;
  proposedActions?: FitBotActionState[];
};

export type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export type NormalizedFitBotContext = {
  profile?: {
    goal?: "lose" | "maintain" | "gain";
    weightKg?: number;
    heightCm?: number;
    age?: number;
    dailyCalorieTarget?: number;
    dailyBurnTarget?: number;
  };
  todayNutrition?: {
    loggedCount: number;
    totalCalories: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFat?: number;
    items?: string[];
    provenance: string;
  };
  todayActivity?: {
    loggedCount: number;
    totalDurationMinutes: number;
    totalCaloriesBurned: number;
    items?: string[];
    provenance: string;
  };
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
    .map((m) => `${m.role === "user" ? "User" : "FitBot"}: ${sanitizeContextString(m.text, 120)}`)
    .join("\n");
}

/**
 * Safely compares two dates using the local calendar day (YYYY-MM-DD),
 * preventing timezone discrepancies where UTC midnight shifts days.
 */
export function isSameCalendarDay(
  date1: unknown,
  date2: unknown = new Date()
): boolean {
  if (!date1 || !date2) return false;
  try {
    const d1 = date1 instanceof Date ? date1 : new Date(String(date1));
    const d2 = date2 instanceof Date ? date2 : new Date(String(date2));
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes untrusted strings to remove XML-like tags and control characters.
 */
export function sanitizeContextString(val: unknown, maxLen = 200): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/[<>]/g, "") // Strip brackets to prevent XML tag breakouts
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * Validates that a numeric value is finite and within domain boundaries.
 */
export function validateNumericMetric(
  val: unknown,
  min: number,
  max: number
): number | null {
  if (typeof val === "string" && val.trim() !== "") {
    val = Number(val);
  }
  if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
    return null;
  }
  if (val < min || val > max) {
    return null;
  }
  return Math.round(val * 10) / 10;
}

export type ContextUserProfile = {
  goal?: string;
  weight?: unknown;
  height?: unknown;
  age?: unknown;
  dailycaloriesintake?: unknown;
  dailycaloriesburned?: unknown;
} | null | undefined;

export type ContextFoodLog = {
  name?: string;
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
};

export type ContextActivityLog = {
  name?: string;
  type?: string;
  duration?: unknown;
  calories?: unknown;
  caloriesBurned?: unknown;
};

/**
 * Builds a typed, verified, and minimal context object along with a safe prompt string.
 * Calculates totals in application code and assigns explicit provenance tags.
 */
export function buildNormalizedContext(params: {
  user?: ContextUserProfile;
  foodLogs?: ContextFoodLog[];
  activityLogs?: ContextActivityLog[];
}): {
  contextString: string;
  contextObject: NormalizedFitBotContext;
} {
  const { user, foodLogs = [], activityLogs = [] } = params;
  const contextLines: string[] = [];

  // 1. User Profile Normalization
  const profileParts: string[] = [];
  const normalizedProfile: NormalizedFitBotContext["profile"] = {};

  if (user) {
    if (user.goal && ["lose", "maintain", "gain"].includes(user.goal)) {
      normalizedProfile.goal = user.goal as "lose" | "maintain" | "gain";
      profileParts.push(`Goal: ${user.goal} weight`);
    }

    const weight = validateNumericMetric(user.weight, 20, 400);
    if (weight !== null) {
      normalizedProfile.weightKg = weight;
      profileParts.push(`Weight: ${weight}kg`);
    }

    const height = validateNumericMetric(user.height, 50, 260);
    if (height !== null) {
      normalizedProfile.heightCm = height;
      profileParts.push(`Height: ${height}cm`);
    }

    const age = validateNumericMetric(user.age, 10, 120);
    if (age !== null) {
      normalizedProfile.age = Math.floor(age);
      profileParts.push(`Age: ${Math.floor(age)}`);
    }

    const calorieTarget = validateNumericMetric(user.dailycaloriesintake, 500, 10000);
    if (calorieTarget !== null) {
      normalizedProfile.dailyCalorieTarget = Math.round(calorieTarget);
      profileParts.push(`Daily calorie target: ${Math.round(calorieTarget)} kcal`);
    }

    const burnTarget = validateNumericMetric(user.dailycaloriesburned, 0, 5000);
    if (burnTarget !== null) {
      normalizedProfile.dailyBurnTarget = Math.round(burnTarget);
      profileParts.push(`Daily burn target: ${Math.round(burnTarget)} kcal`);
    }
  }

  if (profileParts.length > 0) {
    contextLines.push(`[User Profile] ${profileParts.join(" | ")}`);
  }

  // 2. Today's Nutrition Normalization (Calculated in Application Code)
  let normalizedNutrition: NormalizedFitBotContext["todayNutrition"] = undefined;
  if (Array.isArray(foodLogs) && foodLogs.length > 0) {
    let totalCal = 0;
    let totalProt = 0;
    let totalCarb = 0;
    let totalFat = 0;
    const foodNames: string[] = [];

    for (const log of foodLogs) {
      const cal = validateNumericMetric(log.calories, 0, 5000) ?? 0;
      totalCal += cal;

      const prot = validateNumericMetric(log.protein, 0, 500);
      if (prot !== null) totalProt += prot;

      const carb = validateNumericMetric(log.carbs, 0, 1000);
      if (carb !== null) totalCarb += carb;

      const fat = validateNumericMetric(log.fat, 0, 500);
      if (fat !== null) totalFat += fat;

      if (log.name && foodNames.length < 5) {
        foodNames.push(sanitizeContextString(log.name, 40));
      }
    }

    normalizedNutrition = {
      loggedCount: foodLogs.length,
      totalCalories: Math.round(totalCal),
      totalProtein: Math.round(totalProt),
      totalCarbs: Math.round(totalCarb),
      totalFat: Math.round(totalFat),
      items: foodNames,
      provenance: "Recorded in App",
    };

    const macroDetails: string[] = [];
    if (totalProt > 0) macroDetails.push(`${Math.round(totalProt)}g protein`);
    if (totalCarb > 0) macroDetails.push(`${Math.round(totalCarb)}g carbs`);
    if (totalFat > 0) macroDetails.push(`${Math.round(totalFat)}g fat`);

    const macroStr = macroDetails.length ? ` (${macroDetails.join(", ")})` : "";
    const itemsStr = foodNames.length ? ` [${foodNames.join(", ")}]` : "";

    contextLines.push(
      `[Recorded in App] Today's Nutrition: ${Math.round(totalCal)} kcal total consumed across ${foodLogs.length} items${itemsStr}${macroStr}`
    );
  }

  // 3. Today's Activity Normalization (Calculated in Application Code)
  let normalizedActivity: NormalizedFitBotContext["todayActivity"] = undefined;
  if (Array.isArray(activityLogs) && activityLogs.length > 0) {
    let totalMins = 0;
    let totalBurned = 0;
    const activityNames: string[] = [];

    for (const log of activityLogs) {
      const duration = validateNumericMetric(log.duration, 1, 720) ?? 0;
      totalMins += duration;

      const burned = validateNumericMetric(log.calories ?? log.caloriesBurned, 0, 5000) ?? 0;
      totalBurned += burned;

      if (activityNames.length < 5) {
        const rawName = log.name || log.type || "workout";
        const cleanName = sanitizeContextString(rawName, 30);
        activityNames.push(`${cleanName} (${Math.round(duration)}m)`);
      }
    }

    normalizedActivity = {
      loggedCount: activityLogs.length,
      totalDurationMinutes: Math.round(totalMins),
      totalCaloriesBurned: Math.round(totalBurned),
      items: activityNames,
      provenance: "Recorded in App",
    };

    const itemsStr = activityNames.length ? ` [${activityNames.join(", ")}]` : "";

    contextLines.push(
      `[Recorded in App] Today's Activity: ${Math.round(totalBurned)} kcal burned across ${Math.round(totalMins)} active minutes${itemsStr}`
    );
  }

  return {
    contextString: contextLines.join("\n"),
    contextObject: {
      profile: normalizedProfile,
      todayNutrition: normalizedNutrition,
      todayActivity: normalizedActivity,
    },
  };
}

/**
 * Formats recent session summaries into a bounded, sanitized memory string.
 * Strips XML brackets and enforces character caps.
 */
export function formatMemoryContext(
  pastSessions: Array<{ summary?: string; sessionId?: string }>,
  maxSessions = 3,
  maxTotalChars = 900
): string {
  if (!Array.isArray(pastSessions) || pastSessions.length === 0) {
    return "";
  }

  const cleanSummaries: string[] = [];
  let totalChars = 0;

  for (const s of pastSessions) {
    if (!s || typeof s.summary !== "string") continue;
    const clean = sanitizeContextString(s.summary, 300);
    if (!clean) continue;

    if (totalChars + clean.length > maxTotalChars && cleanSummaries.length > 0) {
      break;
    }

    cleanSummaries.push(`- ${clean}`);
    totalChars += clean.length;

    if (cleanSummaries.length >= maxSessions) {
      break;
    }
  }

  if (cleanSummaries.length === 0) return "";
  return `[Past Conversation Memory]\n${cleanSummaries.join("\n")}`;
}
