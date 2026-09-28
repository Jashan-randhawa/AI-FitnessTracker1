export type ChatCompletionFn = (params: {
  messages: any[];
  title?: string;
  maxTokens?: number;
  model?: string;
}) => Promise<string | { text?: string; content?: string }>;

export interface EstimatorCache {
  get: <T>(key: string) => Promise<T | null> | T | null;
  set: <T>(key: string, value: T, ttlMs?: number) => Promise<void> | void;
  has?: (key: string) => Promise<boolean> | boolean;
}

export interface ActivityEstimateParams {
  name: string;
  minutes: number;
  weightKg: number;
}

export interface ActivityEstimateResult {
  activity: string;
  duration: number;
  weight_kg: number;
  calories_burned: number;
  met_value: number;
  intensity: 'low' | 'medium' | 'high';
  suggestion: string;
  disclaimer: string;
}

export interface FoodEstimateResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  disclaimer: string;
}

export interface FoodImageParams {
  buffer?: Buffer | Uint8Array;
  base64?: string;
  mimeType: string;
}

export interface EstimatorOptions {
  chat: ChatCompletionFn;
  cache?: EstimatorCache;
  /** Cache time-to-live in milliseconds (default: 5 minutes = 300,000 ms) */
  ttlMs?: number;
  /** Optional custom disclaimer text */
  disclaimer?: string;
}
