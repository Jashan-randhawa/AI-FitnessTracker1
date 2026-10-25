/**
 * Builds the `environment` request field for AI calls (Phase 3).
 *
 * Only the observation fields the model needs are included. Coordinates,
 * place names, and device data are never added. The server validates every
 * field again and sets the local time itself, so this client value is never
 * trusted as the time of day.
 */

export type EnvironmentCondition =
  | "clear"
  | "mainly_clear"
  | "partly_cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "freezing_precipitation"
  | "snow"
  | "thunderstorm";

export interface EnvironmentPayload {
  temperatureC?: number;
  condition?: EnvironmentCondition;
  precipitationProbability?: number;
  aqi?: number;
  /** When the client fetched the observation, as ISO 8601 with an offset (UTC `Z`). */
  observedAt?: string;
}

/** Maps Open-Meteo WMO weather codes to the server's condition enumeration. */
const WMO_TO_CONDITION: Record<number, EnvironmentCondition> = {
  0: "clear",
  1: "mainly_clear",
  2: "partly_cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "freezing_precipitation",
  57: "freezing_precipitation",
  61: "rain",
  63: "rain",
  65: "rain",
  66: "freezing_precipitation",
  67: "freezing_precipitation",
  71: "snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "rain",
  81: "rain",
  82: "rain",
  85: "snow",
  86: "snow",
  95: "thunderstorm",
  96: "thunderstorm",
  99: "thunderstorm",
};

/** Unknown codes return undefined, so the condition is omitted rather than guessed. */
export const wmoToCondition = (code: unknown): EnvironmentCondition | undefined =>
  typeof code === "number" ? WMO_TO_CONDITION[code] : undefined;

export interface EnvironmentSource {
  current: { temperature: number; iconCode: number };
  hourly: Array<{ precipProb: number }>;
  aqi: { usAqi: number } | null;
  fetchedAt: string;
}

/**
 * Builds the payload from the page's weather state. Missing values are left
 * out, not filled in. The current hour's precipitation probability is the
 * first hourly point, because the hourly list starts at the current hour.
 */
export const toEnvironmentPayload = (source: EnvironmentSource): EnvironmentPayload => {
  const payload: EnvironmentPayload = {};
  if (Number.isFinite(source.current.temperature)) payload.temperatureC = source.current.temperature;

  const condition = wmoToCondition(source.current.iconCode);
  if (condition) payload.condition = condition;

  const precip = source.hourly[0]?.precipProb;
  if (typeof precip === "number" && Number.isFinite(precip)) {
    payload.precipitationProbability = Math.round(precip);
  }

  if (source.aqi && Number.isFinite(source.aqi.usAqi)) payload.aqi = Math.round(source.aqi.usAqi);

  payload.observedAt = source.fetchedAt;
  return payload;
};
