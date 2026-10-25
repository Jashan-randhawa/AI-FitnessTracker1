/**
 * Utilities for Dashboard AI Tip caching, signature derivation, and throttle logic (Phase A / G3).
 */

export const TIP_THROTTLE_MS = 30 * 60 * 1000; // 30 minutes

export interface TipSignatureSource {
  food?: { meals?: number };
  activity?: { count?: number };
  waterMl?: number;
}

export interface StoredTipData {
  tip: string;
  signature: string;
  timestamp: number;
}

/**
 * Computes a coarse state signature from today's food meals, activity count, and water totals.
 */
export const computeTipSignature = (summary?: TipSignatureSource | null): string => {
  if (!summary) return "0:0:0";
  const meals = summary.food?.meals ?? 0;
  const activities = summary.activity?.count ?? 0;
  const water = summary.waterMl ?? 0;
  return `${meals}:${activities}:${water}`;
};

/**
 * Parses cached tip data from sessionStorage, supporting backwards compatibility
 * with legacy raw text strings.
 */
export const parseStoredTip = (raw: string | null): StoredTipData | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.tip === "string") {
      return {
        tip: parsed.tip,
        signature: typeof parsed.signature === "string" ? parsed.signature : "",
        timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : 0,
      };
    }
  } catch {
    // Legacy raw string in cache
  }

  return {
    tip: raw,
    signature: "",
    timestamp: 0,
  };
};

/**
 * Serializes tip data for storage.
 */
export const serializeStoredTip = (
  tip: string,
  signature: string,
  timestamp: number = Date.now()
): string => {
  return JSON.stringify({ tip, signature, timestamp });
};

/**
 * Determines whether a new tip should be fetched:
 * 1. If no cached tip exists -> true
 * 2. If signature has NOT changed -> false (reuse cached tip)
 * 3. If signature changed -> true ONLY IF at least throttleMs (30 minutes) have elapsed since last fetch
 */
export const shouldRefreshTip = (
  stored: StoredTipData | null,
  currentSignature: string,
  nowMs: number = Date.now(),
  throttleMs: number = TIP_THROTTLE_MS
): boolean => {
  if (!stored || !stored.tip) return true;
  // If the log counts have not changed, reuse cached tip
  if (stored.signature === currentSignature) return false;
  // Signature changed: regenerate only when throttle window has elapsed
  return nowMs - stored.timestamp >= throttleMs;
};
