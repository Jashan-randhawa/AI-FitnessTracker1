const { chatCompletion } = require('./openrouter.service');

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

const parseResult = (raw, activity, durationMinutes, weightKg) => {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
  }
  const met = Number(parsed.met_value) || 5;
  return {
    activity: parsed.activity ?? activity,
    duration: durationMinutes,
    weight_kg: weightKg,
    calories_burned: Math.round(met * weightKg * (durationMinutes / 60)),
    met_value: met,
    intensity: parsed.intensity ?? 'medium',
    suggestion: parsed.suggestion ?? '',
  };
};

/**
 * @param {string} activity
 * @param {number} durationMinutes
 * @param {number} weightKg
 */
const estimateCalories = async (activity, durationMinutes, weightKg) => {
  const userPrompt = `Activity: ${activity}\nDuration: ${durationMinutes} minutes\nWeight: ${weightKg} kg`;

  console.log('[AI] Using OpenRouter for calorie estimate...');
  const content = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    title: 'FitTrack Calorie Estimate',
    maxTokens: 200,
  });

  return parseResult(content, activity, durationMinutes, weightKg);
};

module.exports = { estimateCalories };
