const { analyzeFoodImage } = require('../utils/gemini');
const { chatCompletion } = require('./openrouter.service');

const cleanResponse = (raw) =>
  raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/g, '').trim();

const IMAGE_PROMPT =
  'Analyze this food image and return a JSON object with: "dishTitle", "totalCalories", "totalProtein", "totalCarbs", "totalFats", "overallConfidence" (0.0 to 1.0), and "items" (array with name, weightGrams, calories, protein, carbs, fats, confidenceScore). Output ONLY valid JSON.';

/**
 * Fallback parser for OpenRouter responses if Gemini API is unavailable.
 */
const parseOpenRouterResponse = (raw) => {
  const cleaned = cleanResponse(raw);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }

  const { normalizeVisionOutput } = require('../utils/gemini');
  return normalizeVisionOutput(parsed);
};

/**
 * Analyzes a food image buffer.
 * Prefers Gemini Vision with native responseSchema; falls back to OpenRouter if configured.
 * @param {Buffer} buffer - Raw image bytes
 * @param {string} mimeType - e.g. "image/jpeg"
 */
const analyzeImage = async (buffer, mimeType = 'image/jpeg') => {
  const hasGeminiKey = Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);

  if (hasGeminiKey) {
    return analyzeFoodImage(buffer, mimeType);
  }

  // If Gemini key is not set but OpenRouter is available, fallback gracefully
  if (process.env.OPENROUTER_API_KEY) {
    const base64 = buffer.toString('base64');
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
      maxTokens: 500,
    });
    return parseOpenRouterResponse(content);
  }

  // Otherwise invoke Gemini (which will cleanly throw or use mock if testing)
  return analyzeFoodImage(buffer, mimeType);
};

module.exports = { analyzeImage, analyzeFoodImage };
