const SYSTEM_PROMPT = `You are a nutrition estimation assistant.
Given a food entry text, estimate nutrition for one realistic serving.

Return ONLY valid JSON with exact keys:
{
  "name": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number
}

Rules:
- Keep numbers realistic and non-negative.
- calories should be total kcal for the serving.
- protein, carbs, fat should be grams.
- If portion is unclear, assume a common serving size.
- No markdown, no explanations, no extra keys.`;

export interface FoodEstimateResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ParsedFoodEstimate {
  name?: unknown;
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fat?: unknown;
}

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const cleanResponse = (raw: string): string =>
  raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/g, "").trim();

const toNonNegativeNumber = (value: unknown): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
};

const parseResult = (raw: string, fallbackName: string): FoodEstimateResult => {
  const cleaned = cleanResponse(raw);
  let parsed: ParsedFoodEstimate;
  try {
    parsed = JSON.parse(cleaned) as ParsedFoodEstimate;
  } catch {
    throw new Error("AI returned invalid nutrition format.");
  }

  const calories = Math.round(toNonNegativeNumber(parsed.calories));
  if (!parsed.name || calories <= 0) {
    throw new Error("Could not estimate nutrition for that food.");
  }

  return {
    name: String(parsed.name).trim() || fallbackName,
    calories,
    protein: Math.round(toNonNegativeNumber(parsed.protein) * 10) / 10,
    carbs: Math.round(toNonNegativeNumber(parsed.carbs) * 10) / 10,
    fat: Math.round(toNonNegativeNumber(parsed.fat) * 10) / 10,
  };
};

const estimateWithOpenRouter = async (foodText: string): Promise<FoodEstimateResult> => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key not set.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fittrack.app",
      "X-Title": "FitTrack Food Estimate",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Food entry: ${foodText}` },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter estimate failed: ${err}`);
  }

  const data = (await response.json()) as OpenRouterChatResponse;
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseResult(text, foodText);
};

export const estimateFood = async (foodText: string): Promise<FoodEstimateResult> => {
  console.log("[AI] Using OpenRouter for food estimate...");
  return await estimateWithOpenRouter(foodText);
};
