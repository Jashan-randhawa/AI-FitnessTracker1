/**
 * Unified AI Assistant Client Service (FitBot Plan §4 #6)
 *
 * Replaces direct, fragmented raw `fetch` calls across pages (AIAssistant, MealPlanner,
 * ActivityPlanner, Weather, Dashboard) with a centralized, resilient client supporting:
 * - Proper token propagation
 * - Base URL normalization
 * - Request cancellation via AbortSignal
 * - Structured plan validation & repair integration
 * - Consistent error formatting
 */

import api from "../configs/api";
import type { EnvironmentPayload } from "../utils/environmentPayload";
import {
  safeParseMealPlan,
  safeParseActivityPlan,
  type DayPlan,
  type ActivityDayPlan,
} from "../schemas/aiPlans.schema";

export interface AiChatMessage {
  role: "user" | "assistant" | "model";
  parts?: Array<{ text: string }>;
  content?: string;
  text?: string;
}

export interface AiChatOptions {
  expectJson?: boolean;
  planType?: "mealPlan" | "activityPlan" | string;
  skipCache?: boolean;
  regenerate?: boolean;
  model?: string;
  maxTokens?: number;
  /** Requested daily calorie target for meal plans. The server caps it at the user's goal. */
  targetCalories?: number;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  userContext?: string | Record<string, unknown>;
  memoryContext?: string;
  options?: AiChatOptions;
  /** Optional observed weather. Omitted from the request when not provided. */
  environment?: EnvironmentPayload;
  signal?: AbortSignal;
}

export interface AiChatResponse {
  success: boolean;
  reply: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  model?: string;
  cached?: boolean;
}

const getApiBaseUrl = (): string => {
  const fromApi = api.defaults.baseURL;
  if (fromApi && typeof fromApi === "string") {
    return fromApi.replace(/\/$/, "");
  }
  const envUrl =
    import.meta.env.VITE_API_URL || import.meta.env.VITE_STRAPI_API_URL || "";
  return String(envUrl).replace(/\/$/, "");
};

/**
 * Executes a chat completion request to /api/ai-assistant/chat.
 */
export async function chatAiAssistant(req: AiChatRequest): Promise<AiChatResponse> {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem("token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // The server uses this for local-time context. Raw fetch skips the axios interceptor,
  // so it is set here explicitly.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) headers["X-Timezone"] = tz;
  } catch {
    // Without Intl timezone support the server falls back to UTC.
  }

  const payload: Record<string, unknown> = {
    messages: req.messages,
    userContext: req.userContext,
    memoryContext: req.memoryContext,
    options: req.options,
  };
  // Added only when given, so other requests keep their existing shape.
  if (req.environment) payload.environment = req.environment;

  const response = await fetch(`${baseUrl}/api/ai-assistant/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: req.signal,
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const errorMsg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `AI Assistant error (${response.status})`;
    throw new Error(errorMsg);
  }

  return {
    success: true,
    reply: typeof data.reply === "string" ? data.reply : "",
    usage: (data.usage as AiChatResponse["usage"]) || null,
    model: typeof data.model === "string" ? data.model : undefined,
    cached: Boolean(data.cached),
  };
}

/**
 * Generates and validates a structured 3-7 day meal plan with Zod schema verification.
 */
export async function generateStructuredMealPlan(
  prompt: string,
  options: { signal?: AbortSignal; skipCache?: boolean; targetCalories?: number } = {}
): Promise<DayPlan[]> {
  const res = await chatAiAssistant({
    messages: [{ role: "user", parts: [{ text: prompt }] }],
    options: {
      expectJson: true,
      planType: "mealPlan",
      skipCache: options.skipCache,
      targetCalories: options.targetCalories,
    },
    signal: options.signal,
  });

  if (!res.reply) {
    throw new Error("Received empty meal plan response from AI assistant.");
  }

  const parsed = safeParseMealPlan(res.reply);
  if (!parsed.success) {
    throw new Error(`AI generated an invalid meal plan structure: ${parsed.error}`);
  }

  return parsed.data;
}

/**
 * Generates and validates a structured activity/workout plan with Zod schema verification.
 */
export async function generateStructuredActivityPlan(
  prompt: string,
  options: { signal?: AbortSignal; skipCache?: boolean } = {}
): Promise<ActivityDayPlan[]> {
  const res = await chatAiAssistant({
    messages: [{ role: "user", parts: [{ text: prompt }] }],
    options: {
      expectJson: true,
      planType: "activityPlan",
      skipCache: options.skipCache,
    },
    signal: options.signal,
  });

  if (!res.reply) {
    throw new Error("Received empty workout plan response from AI assistant.");
  }

  const parsed = safeParseActivityPlan(res.reply);
  if (!parsed.success) {
    throw new Error(`AI generated an invalid activity plan structure: ${parsed.error}`);
  }

  return parsed.data;
}

/**
 * Generates a concise fitness tip for the user dashboard.
 */
export async function fetchDailyFitnessTip(
  userContextStr: string,
  options: { signal?: AbortSignal } = {}
): Promise<string> {
  const prompt = `Give me ONE short, actionable fitness tip for today (max 2 sentences). ${
    userContextStr ? `User context: ${userContextStr}.` : ""
  }`;

  const res = await chatAiAssistant({
    messages: [{ role: "user", parts: [{ text: prompt }] }],
    signal: options.signal,
  });

  return res.reply.trim();
}

/**
 * Generates weather-tailored workout suggestions.
 */
export async function fetchWeatherWorkoutSuggestions(
  weatherPrompt: string,
  options: { signal?: AbortSignal; environment?: EnvironmentPayload } = {}
): Promise<string> {
  const res = await chatAiAssistant({
    messages: [{ role: "user", parts: [{ text: weatherPrompt }] }],
    environment: options.environment,
    signal: options.signal,
  });

  return res.reply.trim();
}
