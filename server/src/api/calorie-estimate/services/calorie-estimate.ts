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

const parseResult = (raw: string, activity: string, durationMinutes: number, weightKg: number): CalorieEstimateResult => {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
  }
  const met: number = Number(parsed.met_value) || 5;
  return {
    activity: parsed.activity ?? activity,
    duration: durationMinutes,
    weight_kg: weightKg,
    calories_burned: Math.round(met * weightKg * (durationMinutes / 60)),
    met_value: met,
    intensity: parsed.intensity ?? "medium",
    suggestion: parsed.suggestion ?? "",
  };
};

export const estimateCalories = async (
  activity: string,
  durationMinutes: number,
  weightKg: number
): Promise<CalorieEstimateResult> => {
  const userPrompt = `Activity: ${activity}\nDuration: ${durationMinutes} minutes\nWeight: ${weightKg} kg`;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!openRouterKey) {
    throw new Error("No AI provider available. Please set OPENROUTER_API_KEY.");
  }

  console.log("[AI] Using OpenRouter for calorie estimate...");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fittrack.app",
      "X-Title": "FitTrack Calorie Estimate",
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${err}`);
  }

  const data = await response.json() as any;
  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseResult(raw, activity, durationMinutes, weightKg);
};
