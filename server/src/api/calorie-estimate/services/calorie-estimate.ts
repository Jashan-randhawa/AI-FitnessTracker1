import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.Gemini_API_Key;
    if (!apiKey) throw new Error("GOOGLE_API_KEY environment variable is not set.");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const SYSTEM_PROMPT = `You are a fitness calorie estimation assistant.

Your task:
1. Return the MET (Metabolic Equivalent of Task) value for the given activity.
2. Classify intensity as "low", "medium", or "high".
3. Provide a short, practical fitness tip related to the activity.

Rules:
- Base MET values on established exercise science standards (ACSM/Compendium of Physical Activities).
- Running, HIIT, cycling fast = higher MET (7–12+)
- Walking, yoga, stretching = lower MET (2–4)
- Weight training, swimming = medium MET (4–8)
- For custom/unknown activities, estimate conservatively.

Output ONLY valid JSON (no markdown, no text outside JSON):
{
  "activity": "string",
  "met_value": number,
  "intensity": "low | medium | high",
  "suggestion": "string"
}`;

export interface CalorieEstimateResult {
  activity: string;
  duration: number;
  weight_kg: number;
  calories_burned: number;
  met_value: number;
  intensity: "low" | "medium" | "high";
  suggestion: string;
}

export const estimateCalories = async (
  activity: string,
  durationMinutes: number,
  weightKg: number
): Promise<CalorieEstimateResult> => {
  const userPrompt = `Activity: ${activity}\nDuration: ${durationMinutes} minutes\nWeight: ${weightKg} kg`;

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const raw = response.text ?? "";

  // Strip markdown fences if present, then parse
  const cleaned = raw.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const met: number = Number(parsed.met_value) || 5;

  // calories = MET × weight(kg) × (duration / 60)
  const calories_burned = Math.round(met * weightKg * (durationMinutes / 60));

  return {
    activity: parsed.activity ?? activity,
    duration: durationMinutes,
    weight_kg: weightKg,
    calories_burned,
    met_value: met,
    intensity: parsed.intensity ?? "medium",
    suggestion: parsed.suggestion ?? "",
  };
};
