const { z } = require('zod');

/**
 * Outdoor observation contract for AI requests (Phase 3).
 *
 * Accepts only the observation fields a recommendation needs. There is no
 * field for coordinates, place names, or device data, so none can reach the
 * model. Unknown keys are dropped, not rejected.
 *
 * Validation is per field. A bad field is omitted and reported, and the
 * other valid fields are kept. Invalid input never turns into a fabricated
 * condition, and an absent field is never read as "safe".
 */

const CONDITIONS = [
  'clear',
  'mainly_clear',
  'partly_cloudy',
  'overcast',
  'fog',
  'drizzle',
  'rain',
  'freezing_precipitation',
  'snow',
  'thunderstorm',
];

const EnvironmentSchema = z.object({
  temperatureC: z.number().finite().min(-60).max(60).optional(),
  condition: z.enum(CONDITIONS).optional(),
  // Whole percentages only: 12.5 or 150 are impossible values.
  precipitationProbability: z.number().int().min(0).max(100).optional(),
  // US EPA AQI runs 0-500.
  aqi: z.number().int().min(0).max(500).optional(),
  // Must carry an explicit offset, so the instant is unambiguous.
  observedAt: z.iso.datetime({ offset: true }).optional(),
});

const OBSERVATION_FIELDS = ['temperatureC', 'condition', 'precipitationProbability', 'aqi'];

/**
 * Parses the raw `environment` body value.
 * @param {unknown} raw
 * @returns {{
 *   present: boolean,
 *   malformed: boolean,
 *   observations: { temperatureC?: number, condition?: string, precipitationProbability?: number, aqi?: number },
 *   observedAt: Date | null,
 *   rejected: string[],
 * }}
 */
const parseEnvironment = (raw) => {
  const empty = { present: raw !== undefined, malformed: false, observations: {}, observedAt: null, rejected: [] };
  if (raw === undefined || raw === null) return { ...empty, present: false };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ...empty, malformed: true };

  const observations = {};
  const rejected = [];

  for (const field of OBSERVATION_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) continue;
    const result = EnvironmentSchema.shape[field].safeParse(raw[field]);
    if (result.success) observations[field] = result.data;
    else rejected.push(field);
  }

  let observedAt = null;
  if (raw.observedAt !== undefined && raw.observedAt !== null) {
    const result = EnvironmentSchema.shape.observedAt.safeParse(raw.observedAt);
    if (result.success) observedAt = new Date(result.data);
    else rejected.push('observedAt');
  }

  return { present: true, malformed: false, observations, observedAt, rejected };
};

module.exports = { CONDITIONS, EnvironmentSchema, parseEnvironment };
