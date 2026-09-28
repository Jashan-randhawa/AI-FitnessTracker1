import {
  EstimatorOptions,
  ActivityEstimateParams,
  ActivityEstimateResult,
  FoodEstimateResult,
  FoodImageParams,
} from './types';
import {
  CALORIE_ESTIMATE_PROMPT_V1,
  FOOD_ESTIMATE_PROMPT_V1,
  IMAGE_ANALYSIS_PROMPT_V1,
} from './prompts';
import { MemoryCache } from './cache';

const DEFAULT_DISCLAIMER =
  'Outputs are AI-generated nutritional/fitness estimates and should not be used as medical advice.';

const cleanLlmResponse = (raw: string): string => {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
};

const extractJson = <T = any>(raw: string): T => {
  const cleaned = cleanLlmResponse(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error(`AI returned invalid JSON: ${raw.slice(0, 150)}`);
  }
};

const toNonNegative = (val: unknown): number => {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export class NutritionEstimator {
  private chat: EstimatorOptions['chat'];
  private cache: NonNullable<EstimatorOptions['cache']>;
  private ttlMs: number;
  private disclaimer: string;

  constructor(options: EstimatorOptions) {
    if (!options?.chat || typeof options.chat !== 'function') {
      throw new Error('createEstimator requires a valid chat function.');
    }
    this.chat = options.chat;
    this.cache = options.cache || new MemoryCache();
    this.ttlMs = options.ttlMs ?? 300000; // 5 min
    this.disclaimer = options.disclaimer ?? DEFAULT_DISCLAIMER;
  }

  private async executeChat(messages: any[], title: string, maxTokens = 250): Promise<string> {
    const res = await this.chat({ messages, title, maxTokens });
    if (typeof res === 'string') return res;
    return res.text || res.content || '';
  }

  async activity(params: ActivityEstimateParams): Promise<ActivityEstimateResult> {
    const { name, minutes, weightKg } = params;
    if (!name || typeof name !== 'string') {
      throw new Error('Activity name is required.');
    }
    if (!minutes || minutes <= 0) {
      throw new Error('Valid duration in minutes is required.');
    }

    const cacheKey = `act:${name.toLowerCase().trim()}:${minutes}:${weightKg}`;
    const cached = await this.cache.get<ActivityEstimateResult>(cacheKey);
    if (cached) return cached;

    const userPrompt = `Activity: ${name}\nDuration: ${minutes} minutes\nWeight: ${weightKg} kg`;
    const responseText = await this.executeChat(
      [
        { role: 'system', content: CALORIE_ESTIMATE_PROMPT_V1 },
        { role: 'user', content: userPrompt },
      ],
      'FitTrack Calorie Estimate'
    );

    const parsed = extractJson(responseText);
    const met = Number(parsed.met_value) || 5;
    const intensity =
      parsed.intensity === 'low' || parsed.intensity === 'high' ? parsed.intensity : 'medium';

    const result: ActivityEstimateResult = {
      activity: String(parsed.activity || name).trim(),
      duration: minutes,
      weight_kg: weightKg,
      calories_burned: Math.round(met * weightKg * (minutes / 60)),
      met_value: met,
      intensity,
      suggestion: String(parsed.suggestion || ''),
      disclaimer: this.disclaimer,
    };

    await this.cache.set(cacheKey, result, this.ttlMs);
    return result;
  }

  async foodFromText(foodText: string): Promise<FoodEstimateResult> {
    if (!foodText || typeof foodText !== 'string' || !foodText.trim()) {
      throw new Error('Food description is required.');
    }

    const normalized = foodText.toLowerCase().trim();
    const cacheKey = `food:${normalized}`;
    const cached = await this.cache.get<FoodEstimateResult>(cacheKey);
    if (cached) return cached;

    const responseText = await this.executeChat(
      [
        { role: 'system', content: FOOD_ESTIMATE_PROMPT_V1 },
        { role: 'user', content: `Food entry: ${foodText}` },
      ],
      'FitTrack Food Estimate'
    );

    const parsed = extractJson(responseText);
    const calories = Math.round(toNonNegative(parsed.calories));
    if (!parsed.name || calories <= 0) {
      throw new Error('Could not estimate nutrition for that food.');
    }

    const result: FoodEstimateResult = {
      name: String(parsed.name).trim() || foodText,
      calories,
      protein: Math.round(toNonNegative(parsed.protein) * 10) / 10,
      carbs: Math.round(toNonNegative(parsed.carbs) * 10) / 10,
      fat: Math.round(toNonNegative(parsed.fat) * 10) / 10,
      disclaimer: this.disclaimer,
    };

    await this.cache.set(cacheKey, result, this.ttlMs);
    return result;
  }

  async foodFromImage(params: FoodImageParams): Promise<FoodEstimateResult> {
    const { buffer, base64: rawBase64, mimeType } = params;
    const base64 = rawBase64 || (buffer ? Buffer.from(buffer).toString('base64') : '');

    if (!base64) {
      throw new Error('Image data is required.');
    }

    const responseText = await this.executeChat(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: IMAGE_ANALYSIS_PROMPT_V1 },
          ],
        },
      ],
      'FitTrack Image Analysis'
    );

    const parsed = extractJson(responseText);
    const calories = Math.round(toNonNegative(parsed.calories));
    if (!parsed.name || calories <= 0) {
      throw new Error('Could not identify food in the image. Please try a clearer photo.');
    }

    return {
      name: String(parsed.name).trim(),
      calories,
      protein: Math.round(toNonNegative(parsed.protein) * 10) / 10,
      carbs: Math.round(toNonNegative(parsed.carbs) * 10) / 10,
      fat: Math.round(toNonNegative(parsed.fat) * 10) / 10,
      disclaimer: this.disclaimer,
    };
  }
}

export function createEstimator(options: EstimatorOptions): NutritionEstimator {
  return new NutritionEstimator(options);
}
