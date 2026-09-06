const { chatCompletion } = require('./openrouter.service');

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

const cleanResponse = (raw) =>
  raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/g, '').trim();

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
};

const parseResult = (raw, fallbackName) => {
  const cleaned = cleanResponse(raw);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid nutrition format.');
  }

  const calories = Math.round(toNonNegativeNumber(parsed.calories));
  if (!parsed.name || calories <= 0) {
    throw new Error('Could not estimate nutrition for that food.');
  }

  return {
    name: String(parsed.name).trim() || fallbackName,
    calories,
    protein: Math.round(toNonNegativeNumber(parsed.protein) * 10) / 10,
    carbs: Math.round(toNonNegativeNumber(parsed.carbs) * 10) / 10,
    fat: Math.round(toNonNegativeNumber(parsed.fat) * 10) / 10,
  };
};

/**
 * @param {string} foodText
 */
const estimateFood = async (foodText) => {
  console.log('[AI] Using OpenRouter for food estimate...');
  const content = await chatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Food entry: ${foodText}` },
    ],
    title: 'FitTrack Food Estimate',
    maxTokens: 200,
  });

  return parseResult(content, foodText);
};

module.exports = { estimateFood };
