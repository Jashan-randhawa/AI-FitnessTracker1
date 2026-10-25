/**
 * Outdoor environment context for AI requests (Phase 3).
 *
 * Turns a validated observation into one <environment> block for the system
 * prompt. The block has three parts: server-generated local time and part of
 * day, the usable observation, and a deterministic outdoor risk with guidance.
 * The model is told to use these values as given, not to recalculate them.
 *
 * Rules:
 * - Local time always comes from the server, using the validated X-Timezone.
 * - A stale, unverified, or malformed observation is never used for risk.
 * - Risk is 'low' only when temperature and AQI are both known and fresh.
 *   Missing data never counts as safe.
 * - Only enum values and numbers from the schema reach the prompt, never
 *   free text. Coordinates and place names are not in the contract.
 */

const { parseEnvironment } = require('../schemas/environment.schema');
const { resolveTimeZone, formatLocalTime } = require('./fitnessContext.service');
const { dayKey } = require('../utils/localDay');
const logger = require('../utils/logger');

const OBSERVATION_MAX_AGE_MS = 3 * 60 * 60 * 1000;
const OBSERVATION_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/**
 * Explicit AQI standard. Only US EPA is implemented, and it matches the
 * us_aqi value Open-Meteo returns. Set AQI_STANDARD to choose another standard
 * once a table for it exists. An unknown value fails at startup.
 */
const AQI_STANDARDS = {
  us_epa: [
    { max: 50, category: 'good', risk: 'low' },
    { max: 100, category: 'moderate', risk: 'low' },
    { max: 150, category: 'unhealthy_for_sensitive_groups', risk: 'moderate' },
    { max: 200, category: 'unhealthy', risk: 'high' },
    { max: 300, category: 'very_unhealthy', risk: 'high' },
    { max: 500, category: 'hazardous', risk: 'high' },
  ],
};

const AQI_STANDARD = process.env.AQI_STANDARD || 'us_epa';
if (!AQI_STANDARDS[AQI_STANDARD]) {
  throw new Error(`Unknown AQI_STANDARD "${AQI_STANDARD}". Supported: ${Object.keys(AQI_STANDARDS).join(', ')}`);
}

/**
 * Heuristic outdoor thresholds in °C and percent. They are not clinical
 * limits. Review them before relying on them for safety decisions.
 */
const TEMPERATURE_THRESHOLDS = {
  heatHigh: 38,
  heatModerate: 32,
  coldHigh: -10,
  coldModerate: 0,
};
const PRECIPITATION_RISK_PERCENT = 60;

const CONDITION_RISK = {
  clear: 'low',
  mainly_clear: 'low',
  partly_cloudy: 'low',
  overcast: 'low',
  fog: 'moderate',
  drizzle: 'moderate',
  rain: 'moderate',
  snow: 'moderate',
  freezing_precipitation: 'high',
  thunderstorm: 'high',
};

const RISK_ORDER = ['low', 'moderate', 'high'];
const maxRisk = (a, b) => (RISK_ORDER.indexOf(a) >= RISK_ORDER.indexOf(b) ? a : b);

const classifyAqi = (aqi, standard = AQI_STANDARD) => {
  const bands = AQI_STANDARDS[standard];
  return bands.find((band) => aqi <= band.max);
};

const partOfDay = (hour) => {
  if (hour >= 5 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 16) return 'afternoon';
  if (hour >= 17 && hour <= 20) return 'evening';
  return 'night';
};

/** Drops values that contradict each other. Returns the cleaned set and what was dropped. */
const resolveContradictions = (observations) => {
  const cleaned = { ...observations };
  const dropped = [];

  const clearSky = cleaned.condition === 'clear' || cleaned.condition === 'mainly_clear';
  if (clearSky && cleaned.precipitationProbability >= PRECIPITATION_RISK_PERCENT) {
    delete cleaned.condition;
    dropped.push('condition (clear conditions with high precipitation probability)');
  }
  if (cleaned.condition === 'snow' && cleaned.temperatureC > 10) {
    delete cleaned.condition;
    dropped.push('condition (snow reported above 10 °C)');
  }
  return { cleaned, dropped };
}

/**
 * Freshness of an observation. A missing or future timestamp is 'unverified',
 * which is different from 'stale'.
 */
const freshnessOf = (observedAt, now) => {
  if (!observedAt) return 'unverified';
  const ageMs = now.getTime() - observedAt.getTime();
  if (ageMs < -OBSERVATION_MAX_FUTURE_SKEW_MS) return 'unverified';
  if (ageMs > OBSERVATION_MAX_AGE_MS) return 'stale';
  return 'fresh';
};

/**
 * Computes outdoor risk from usable, fresh observations.
 * @returns {{ risk: 'low'|'moderate'|'high'|'unknown', factors: string[], aqiCategory: string|null }}
 */
const assessRisk = (usable) => {
  let risk = 'low';
  const factors = [];
  let aqiCategory = null;

  const t = usable.temperatureC;
  if (t !== undefined) {
    if (t >= TEMPERATURE_THRESHOLDS.heatHigh) { risk = maxRisk(risk, 'high'); factors.push('extreme heat'); }
    else if (t >= TEMPERATURE_THRESHOLDS.heatModerate) { risk = maxRisk(risk, 'moderate'); factors.push('hot'); }
    else if (t <= TEMPERATURE_THRESHOLDS.coldHigh) { risk = maxRisk(risk, 'high'); factors.push('extreme cold'); }
    else if (t <= TEMPERATURE_THRESHOLDS.coldModerate) { risk = maxRisk(risk, 'moderate'); factors.push('freezing'); }
  }

  if (usable.condition !== undefined) {
    const level = CONDITION_RISK[usable.condition];
    risk = maxRisk(risk, level);
    if (level !== 'low') factors.push(`${usable.condition.replace(/_/g, ' ')} conditions`);
  }

  if (usable.precipitationProbability >= PRECIPITATION_RISK_PERCENT) {
    risk = maxRisk(risk, 'moderate');
    factors.push('likely precipitation');
  }

  if (usable.aqi !== undefined) {
    const band = classifyAqi(usable.aqi);
    aqiCategory = band.category;
    risk = maxRisk(risk, band.risk);
    if (band.risk !== 'low') factors.push(`air quality ${band.category.replace(/_/g, ' ')}`);
  }

  const hasAnything = Object.keys(usable).length > 0;
  // Low risk needs both temperature and AQI, so the absence of either cannot pass as safe.
  if (!hasAnything || (risk === 'low' && (usable.temperatureC === undefined || usable.aqi === undefined))) {
    return { risk: 'unknown', factors, aqiCategory };
  }
  return { risk, factors, aqiCategory };
};

/**
 * Validates and assesses a raw `environment` value.
 * @param {{ raw: unknown, now?: Date }} args
 */
const evaluateEnvironment = ({ raw, now = new Date() }) => {
  const parsed = parseEnvironment(raw);
  const base = {
    present: parsed.present,
    malformed: parsed.malformed,
    freshness: 'unverified',
    risk: 'unknown',
    factors: [],
    observations: {},
    aqiCategory: null,
    observedAt: parsed.observedAt,
    // True when the request carried at least one valid observation value.
    reported: Object.keys(parsed.observations).length > 0,
    dropped: [...parsed.rejected],
  };

  if (!parsed.present || parsed.malformed) return base;

  const freshness = freshnessOf(parsed.observedAt, now);
  if (freshness !== 'fresh') {
    // Values are not used for risk, so they are not reported as current.
    return { ...base, freshness, observations: {} };
  }

  const { cleaned, dropped } = resolveContradictions(parsed.observations);
  const assessment = assessRisk(cleaned);
  return {
    ...base,
    freshness,
    risk: assessment.risk,
    factors: assessment.factors,
    aqiCategory: assessment.aqiCategory,
    observations: cleaned,
    dropped: [...base.dropped, ...dropped],
  };
};

const describeObservation = (evaluation, timeZone) => {
  const obs = evaluation.observations;
  const when = evaluation.observedAt
    ? `${dayKey(evaluation.observedAt, timeZone)} ${formatLocalTime(evaluation.observedAt, timeZone)}`
    : null;

  if (!evaluation.present || evaluation.malformed || !evaluation.reported) {
    return 'Outdoor observation: not provided.';
  }
  if (evaluation.freshness === 'stale') {
    return `Outdoor observation from ${when} local is too old to use. Current conditions are unknown.`;
  }
  if (evaluation.freshness === 'unverified') {
    return 'Outdoor observation was provided without a valid timestamp, so it is not used. Current conditions are unknown.';
  }

  const parts = [];
  parts.push(obs.temperatureC !== undefined ? `${obs.temperatureC} °C` : 'temperature not reported');
  parts.push(obs.condition !== undefined ? obs.condition.replace(/_/g, ' ') : 'condition not reported');
  parts.push(
    obs.precipitationProbability !== undefined
      ? `precipitation probability ${obs.precipitationProbability}%`
      : 'precipitation probability not reported'
  );
  parts.push(
    obs.aqi !== undefined
      ? `US AQI ${obs.aqi} (${evaluation.aqiCategory.replace(/_/g, ' ')})`
      : 'air quality not reported'
  );
  return `Outdoor observation at ${when} local: ${parts.join(', ')}.`;
};

const GUIDANCE = {
  high: 'Outdoor guidance: recommend indoor alternatives. Do not suggest outdoor sessions.',
  moderate:
    'Outdoor guidance: if you suggest outdoor work, keep it low to moderate intensity and short, add hydration and rest breaks, and name the main concern.',
  low: 'Outdoor guidance: outdoor work is reasonable under the observation above. Still apply normal safety advice.',
  unknown:
    'Outdoor guidance: conditions could not be verified. Do not describe them as safe. Prefer indoor options and suggest checking current local conditions before going outside.',
};

/**
 * Builds the <environment> block for the system prompt.
 * Call this only when the request includes an `environment` key. Requests
 * without one never reach this function, so their prompt is unchanged.
 *
 * @param {{ raw: unknown, timeZone?: string, now?: Date }} args
 * @returns {{ text: string, evaluation: object, timeZone: string, timeZoneSource: string }}
 */
const buildEnvironmentContext = ({ raw, timeZone, now = new Date() }) => {
  const { timeZone: tz, source } = resolveTimeZone(timeZone);
  const date = dayKey(now, tz);
  const time = formatLocalTime(now, tz);
  const evaluation = evaluateEnvironment({ raw, now });

  if (evaluation.dropped.length > 0) {
    // Log field names only. Values are never logged.
    logger.warn('[Environment] ignored invalid or contradictory observation fields', {
      fields: evaluation.dropped,
    });
  }

  const lines = [
    `Local time: ${date} ${time} (${tz}). Part of day: ${partOfDay(Number(time.slice(0, 2)))}.`,
    describeObservation(evaluation, tz),
    `Outdoor risk: ${evaluation.risk}.`,
    GUIDANCE[evaluation.risk],
    'These values are computed by the server. Use them as given and do not recalculate them. Health-safety rules still apply.',
  ];

  return {
    text: `<environment>\n${lines.join('\n')}\n</environment>`,
    evaluation,
    timeZone: tz,
    timeZoneSource: source,
  };
};

module.exports = {
  OBSERVATION_MAX_AGE_MS,
  OBSERVATION_MAX_FUTURE_SKEW_MS,
  AQI_STANDARD,
  AQI_STANDARDS,
  TEMPERATURE_THRESHOLDS,
  PRECIPITATION_RISK_PERCENT,
  classifyAqi,
  partOfDay,
  freshnessOf,
  resolveContradictions,
  assessRisk,
  evaluateEnvironment,
  buildEnvironmentContext,
};
