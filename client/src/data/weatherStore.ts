import type { EnvironmentPayload } from "../utils/environmentPayload";

export const WEATHER_STORAGE_KEY = "fittrack_latest_weather_observation";
export const OBSERVATION_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours

let inMemoryObservation: EnvironmentPayload | null = null;

/**
 * Sanitizes an observation payload to guarantee that coordinates, place names,
 * and arbitrary metadata are NEVER stored or passed to AI planners.
 */
export const sanitizeWeatherObservation = (raw: unknown): EnvironmentPayload | null => {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const clean: EnvironmentPayload = {};
  if (typeof obj.temperatureC === "number" && Number.isFinite(obj.temperatureC)) {
    clean.temperatureC = obj.temperatureC;
  }
  if (typeof obj.condition === "string") {
    clean.condition = obj.condition as EnvironmentPayload["condition"];
  }
  if (typeof obj.precipitationProbability === "number" && Number.isFinite(obj.precipitationProbability)) {
    clean.precipitationProbability = Math.round(obj.precipitationProbability);
  }
  if (typeof obj.aqi === "number" && Number.isFinite(obj.aqi)) {
    clean.aqi = Math.round(obj.aqi);
  }
  if (typeof obj.observedAt === "string" && !Number.isNaN(new Date(obj.observedAt).getTime())) {
    clean.observedAt = obj.observedAt;
  }

  // Require at least an observation timestamp or temperature
  if (clean.observedAt === undefined && clean.temperatureC === undefined) {
    return null;
  }

  return clean;
};

/**
 * Saves the latest weather observation to in-memory store and sessionStorage.
 */
export const saveWeatherObservation = (payload: EnvironmentPayload | null | undefined): void => {
  const sanitized = sanitizeWeatherObservation(payload);
  inMemoryObservation = sanitized;

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      if (sanitized) {
        window.sessionStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(sanitized));
      } else {
        window.sessionStorage.removeItem(WEATHER_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota or security errors
    }
  }
};

/**
 * Retrieves the latest weather observation from memory or sessionStorage.
 */
export const getWeatherObservation = (): EnvironmentPayload | null => {
  if (inMemoryObservation) {
    return inMemoryObservation;
  }

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const raw = window.sessionStorage.getItem(WEATHER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeWeatherObservation(parsed);
        inMemoryObservation = sanitized;
        return sanitized;
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
};

/**
 * Checks whether an observation is fresh (< 3 hours old and not in the future).
 */
export const isWeatherObservationFresh = (
  obs: EnvironmentPayload | null | undefined,
  maxAgeMs: number = OBSERVATION_MAX_AGE_MS,
  nowMs: number = Date.now()
): boolean => {
  if (!obs || !obs.observedAt) return false;
  const obsTime = new Date(obs.observedAt).getTime();
  if (Number.isNaN(obsTime)) return false;

  const ageMs = nowMs - obsTime;
  // Accept if age is within maxAgeMs and not more than 5 minutes in the future (clock drift)
  return ageMs >= -5 * 60 * 1000 && ageMs < maxAgeMs;
};

/**
 * Returns the observation only if fresh, otherwise null.
 */
export const getFreshWeatherObservation = (
  maxAgeMs: number = OBSERVATION_MAX_AGE_MS,
  nowMs: number = Date.now()
): EnvironmentPayload | null => {
  const obs = getWeatherObservation();
  if (obs && isWeatherObservationFresh(obs, maxAgeMs, nowMs)) {
    return obs;
  }
  return null;
};

/**
 * Helper to format badge text for the UI.
 * e.g., 'Using weather from 14:30' or 'No recent weather - plan assumes indoor options'.
 */
export const formatWeatherBadgeText = (
  obs: EnvironmentPayload | null | undefined,
  maxAgeMs: number = OBSERVATION_MAX_AGE_MS,
  nowMs: number = Date.now()
): string => {
  if (obs && isWeatherObservationFresh(obs, maxAgeMs, nowMs) && obs.observedAt) {
    try {
      const date = new Date(obs.observedAt);
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `Using weather from ${hours}:${minutes}`;
    } catch {
      // Fallback
    }
  }
  return "No recent weather - plan assumes indoor options";
};
