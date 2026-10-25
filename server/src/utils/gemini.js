const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

/**
 * Native Gemini responseSchema for deterministic JSON food analysis output.
 * Output shape:
 * {
 *   dishTitle: string,
 *   totalCalories: number,
 *   totalProtein: number,
 *   totalCarbs: number,
 *   totalFats: number,
 *   overallConfidence: number (0.0 to 1.0),
 *   items: [{ name, weightGrams, calories, protein, carbs, fats, confidenceScore }]
 * }
 */
const FoodSnapSchema = {
  type: SchemaType.OBJECT,
  properties: {
    dishTitle: {
      type: SchemaType.STRING,
      description: 'Concise title or overall name of the meal/dish',
    },
    totalCalories: {
      type: SchemaType.NUMBER,
      description: 'Total estimated calories in kcal',
    },
    totalProtein: {
      type: SchemaType.NUMBER,
      description: 'Total protein in grams',
    },
    totalCarbs: {
      type: SchemaType.NUMBER,
      description: 'Total carbohydrates in grams',
    },
    totalFats: {
      type: SchemaType.NUMBER,
      description: 'Total fats in grams',
    },
    overallConfidence: {
      type: SchemaType.NUMBER,
      description: 'Overall detection confidence score between 0.0 and 1.0',
    },
    items: {
      type: SchemaType.ARRAY,
      description: 'Breakdown of individual food items and ingredients in the dish',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: 'Name of the ingredient or component',
          },
          weightGrams: {
            type: SchemaType.NUMBER,
            description: 'Estimated weight in grams',
          },
          calories: {
            type: SchemaType.NUMBER,
            description: 'Calories in kcal',
          },
          protein: {
            type: SchemaType.NUMBER,
            description: 'Protein in grams',
          },
          carbs: {
            type: SchemaType.NUMBER,
            description: 'Carbohydrates in grams',
          },
          fats: {
            type: SchemaType.NUMBER,
            description: 'Fats in grams',
          },
          confidenceScore: {
            type: SchemaType.NUMBER,
            description: 'Confidence score for this item between 0.0 and 1.0',
          },
        },
        required: [
          'name',
          'weightGrams',
          'calories',
          'protein',
          'carbs',
          'fats',
          'confidenceScore',
        ],
      },
    },
  },
  required: [
    'dishTitle',
    'totalCalories',
    'totalProtein',
    'totalCarbs',
    'totalFats',
    'overallConfidence',
    'items',
  ],
};

// Mock handler for testing without network/API keys
let mockVisionHandler = null;

const setGeminiVisionMock = (handler) => {
  mockVisionHandler = handler;
};

const clearGeminiVisionMock = () => {
  mockVisionHandler = null;
};

/**
 * Validates and normalizes raw parsed JSON into the strict Phase 1 format.
 */
const normalizeVisionOutput = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }

  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => {
        const weight = Number(item.weightGrams ?? item.estimatedGrams) || 0;
        const cal = Number(item.calories) || 0;
        const prot = Number(item.protein) || 0;
        const carb = Number(item.carbs) || 0;
        const fat = Number(item.fats ?? item.fat) || 0;
        const conf =
          typeof item.confidenceScore === 'number'
            ? Math.max(0, Math.min(1, item.confidenceScore))
            : 0.8;

        return {
          name: String(item.name || 'Food item').trim(),
          weightGrams: Math.round(weight),
          estimatedGrams: Math.round(weight),
          calories: Math.round(cal),
          protein: Math.round(prot * 10) / 10,
          carbs: Math.round(carb * 10) / 10,
          fats: Math.round(fat * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          confidenceScore: conf,
        };
      })
    : [];

  const calculatedCalories =
    items.length > 0 ? items.reduce((s, i) => s + i.calories, 0) : 0;
  const calculatedProtein =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10
      : 0;
  const calculatedCarbs =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10
      : 0;
  const calculatedFats =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.fats, 0) * 10) / 10
      : 0;

  const totalCalories =
    typeof raw.totalCalories === 'number' && raw.totalCalories > 0
      ? Math.round(raw.totalCalories)
      : (typeof raw.calories === 'number' && raw.calories > 0
          ? Math.round(raw.calories)
          : calculatedCalories);

  const totalProtein =
    typeof raw.totalProtein === 'number'
      ? Math.round(raw.totalProtein * 10) / 10
      : (typeof raw.protein === 'number'
          ? Math.round(raw.protein * 10) / 10
          : calculatedProtein);

  const totalCarbs =
    typeof raw.totalCarbs === 'number'
      ? Math.round(raw.totalCarbs * 10) / 10
      : (typeof raw.carbs === 'number'
          ? Math.round(raw.carbs * 10) / 10
          : calculatedCarbs);

  const totalFats =
    typeof raw.totalFats === 'number'
      ? Math.round(raw.totalFats * 10) / 10
      : (typeof raw.fat === 'number'
          ? Math.round(raw.fat * 10) / 10
          : calculatedFats);

  const dishTitle = String(
    raw.dishTitle || raw.name || items[0]?.name || 'Analyzed Meal'
  ).trim();

  let overallConfidence =
    typeof raw.overallConfidence === 'number'
      ? Math.max(0, Math.min(1, raw.overallConfidence))
      : (items.length > 0
          ? items.reduce((s, i) => s + i.confidenceScore, 0) / items.length
          : 0.8);
  overallConfidence = Math.round(overallConfidence * 100) / 100;

  if (totalCalories <= 0 && items.length === 0) {
    throw new Error('Could not identify food in the image. Please try a clearer photo.');
  }

  return {
    dishTitle,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFats,
    overallConfidence,
    items,
    // Backward compatibility aliases
    name: dishTitle,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFats,
    totalMacros: {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fats: totalFats,
    },
  };
};

/**
 * Analyzes a food image buffer using Gemini Vision with deterministic responseSchema.
 * @param {Buffer} buffer - In-memory image buffer
 * @param {string} mimeType - e.g. "image/jpeg", "image/png"
 */
const analyzeFoodImage = async (buffer, mimeType = 'image/jpeg') => {
  if (mockVisionHandler) {
    const mockRaw = await mockVisionHandler(buffer, mimeType);
    return normalizeVisionOutput(mockRaw);
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please set GOOGLE_API_KEY.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: FoodSnapSchema,
    },
  });

  const prompt =
    'Analyze this meal image. Identify the dish, estimate the total macros (calories, protein, carbs, fats), ' +
    'break down each detected food item with estimated portion weight in grams and confidence score (0.0 to 1.0), ' +
    'and provide an overall confidence score.';

  const response = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    },
    prompt,
  ]);

  const text = response.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }

  return normalizeVisionOutput(parsed);
};

module.exports = {
  FoodSnapSchema,
  analyzeFoodImage,
  normalizeVisionOutput,
  setGeminiVisionMock,
  clearGeminiVisionMock,
};
