const { chatCompletion } = require('./openrouter.service');

const cleanResponse = (raw) =>
  raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/g, '').trim();

const IMAGE_PROMPT =
  'Identify the food in this image and return ONLY a valid JSON object with these exact keys: "name" (string, concise food name), "calories" (number, estimated kcal), "protein" (number, grams), "carbs" (number, grams), "fat" (number, grams). Estimates for the visible portion. No explanation, no markdown, no extra text.';

const parseAndValidate = (raw) => {
  const cleaned = cleanResponse(raw);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }
  if (!parsed.name || typeof parsed.calories !== 'number' || parsed.calories <= 0) {
    throw new Error('Could not identify food in the image. Please try a clearer photo.');
  }
  return {
    name: String(parsed.name).trim(),
    calories: Math.round(parsed.calories),
    protein: typeof parsed.protein === 'number' ? Math.round(parsed.protein * 10) / 10 : 0,
    carbs: typeof parsed.carbs === 'number' ? Math.round(parsed.carbs * 10) / 10 : 0,
    fat: typeof parsed.fat === 'number' ? Math.round(parsed.fat * 10) / 10 : 0,
  };
};

/**
 * @param {Buffer} buffer raw image bytes (from multer memory storage)
 * @param {string} mimeType e.g. "image/jpeg"
 */
const analyzeImage = async (buffer, mimeType) => {
  const base64 = buffer.toString('base64');

  console.log('[AI] Using OpenRouter for image analysis...');
  const content = await chatCompletion({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: IMAGE_PROMPT },
        ],
      },
    ],
    title: 'FitTrack Image Analysis',
    maxTokens: 200,
  });

  return parseAndValidate(content);
};

module.exports = { analyzeImage };
