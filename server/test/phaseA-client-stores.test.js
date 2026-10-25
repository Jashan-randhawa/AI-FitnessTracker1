const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

/**
 * Helper to compile and load client TypeScript modules in the Node.js test runner.
 */
const loadTsModule = (relPath) => {
  const filename = path.resolve(__dirname, relPath);
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputText, filename);
  return mod.exports;
};

describe('Phase A — Dashboard Tip Freshness & Weather Store Unit Tests', () => {
  let computeTipSignature;
  let parseStoredTip;
  let serializeStoredTip;
  let shouldRefreshTip;
  let TIP_THROTTLE_MS;

  let sanitizeWeatherObservation;
  let isWeatherObservationFresh;
  let formatWeatherBadgeText;
  let OBSERVATION_MAX_AGE_MS;

  before(() => {
    const tipMod = loadTsModule('../../client/src/utils/dashboardTip.ts');
    computeTipSignature = tipMod.computeTipSignature;
    parseStoredTip = tipMod.parseStoredTip;
    serializeStoredTip = tipMod.serializeStoredTip;
    shouldRefreshTip = tipMod.shouldRefreshTip;
    TIP_THROTTLE_MS = tipMod.TIP_THROTTLE_MS;

    const weatherMod = loadTsModule('../../client/src/data/weatherStore.ts');
    sanitizeWeatherObservation = weatherMod.sanitizeWeatherObservation;
    isWeatherObservationFresh = weatherMod.isWeatherObservationFresh;
    formatWeatherBadgeText = weatherMod.formatWeatherBadgeText;
    OBSERVATION_MAX_AGE_MS = weatherMod.OBSERVATION_MAX_AGE_MS;
  });

  describe('G3: Dashboard Tip Signature & Throttle Logic', () => {
    it('computes "0:0:0" for empty or missing summary', () => {
      assert.equal(computeTipSignature(null), '0:0:0');
      assert.equal(computeTipSignature(undefined), '0:0:0');
      assert.equal(computeTipSignature({}), '0:0:0');
    });

    it('computes signature from meals, activity count, and waterMl', () => {
      const summary = {
        food: { meals: 3 },
        activity: { count: 2 },
        waterMl: 1500,
      };
      assert.equal(computeTipSignature(summary), '3:2:1500');
    });

    it('signature changes when food, activity, or water changes', () => {
      const base = { food: { meals: 1 }, activity: { count: 1 }, waterMl: 500 };
      const updatedFood = { food: { meals: 2 }, activity: { count: 1 }, waterMl: 500 };
      const updatedActivity = { food: { meals: 1 }, activity: { count: 2 }, waterMl: 500 };
      const updatedWater = { food: { meals: 1 }, activity: { count: 1 }, waterMl: 750 };

      assert.notEqual(computeTipSignature(base), computeTipSignature(updatedFood));
      assert.notEqual(computeTipSignature(base), computeTipSignature(updatedActivity));
      assert.notEqual(computeTipSignature(base), computeTipSignature(updatedWater));
    });

    it('parses structured JSON stored tip and legacy string', () => {
      const structured = JSON.stringify({
        tip: 'Stay hydrated during squats!',
        signature: '1:1:500',
        timestamp: 1700000000000,
      });
      const parsed = parseStoredTip(structured);
      assert.equal(parsed.tip, 'Stay hydrated during squats!');
      assert.equal(parsed.signature, '1:1:500');
      assert.equal(parsed.timestamp, 1700000000000);

      const legacy = parseStoredTip('Legacy raw tip string');
      assert.equal(legacy.tip, 'Legacy raw tip string');
      assert.equal(legacy.signature, '');
      assert.equal(legacy.timestamp, 0);

      assert.equal(parseStoredTip(null), null);
    });

    it('serializes tip data correctly', () => {
      const serialized = serializeStoredTip('Hydrate well', '2:1:1000', 1700000000000);
      const obj = JSON.parse(serialized);
      assert.equal(obj.tip, 'Hydrate well');
      assert.equal(obj.signature, '2:1:1000');
      assert.equal(obj.timestamp, 1700000000000);
    });

    it('shouldRefreshTip returns true if no stored tip exists', () => {
      assert.equal(shouldRefreshTip(null, '1:1:500'), true);
      assert.equal(shouldRefreshTip({ tip: '', signature: '', timestamp: 0 }, '1:1:500'), true);
    });

    it('shouldRefreshTip returns false if signature is unchanged, regardless of elapsed time', () => {
      const stored = { tip: 'Old tip', signature: '1:1:500', timestamp: 1000 };
      const now = 1000 + 10 * 3600 * 1000; // 10 hours later
      assert.equal(shouldRefreshTip(stored, '1:1:500', now), false);
    });

    it('shouldRefreshTip returns false if signature changed but 30 minutes have not elapsed', () => {
      const now = 1700000000000;
      const stored = { tip: 'Old tip', signature: '1:1:500', timestamp: now - 15 * 60 * 1000 }; // 15 mins ago
      // Signature changed to 2:1:500
      assert.equal(shouldRefreshTip(stored, '2:1:500', now), false);
    });

    it('shouldRefreshTip returns true if signature changed and at least 30 minutes have elapsed', () => {
      const now = 1700000000000;
      const stored = { tip: 'Old tip', signature: '1:1:500', timestamp: now - 31 * 60 * 1000 }; // 31 mins ago
      assert.equal(shouldRefreshTip(stored, '2:1:500', now), true);
    });
  });

  describe('G1: Weather Observation Store & Sanitization Logic', () => {
    it('sanitizes observations and strictly removes coordinates/location data', () => {
      const input = {
        temperatureC: 24.5,
        condition: 'partly_cloudy',
        precipitationProbability: 15,
        aqi: 42,
        observedAt: '2026-10-25T08:30:00.000Z',
        latitude: 28.6139,
        longitude: 77.2090,
        city: 'New Delhi',
        region: 'DL',
      };

      const sanitized = sanitizeWeatherObservation(input);
      assert.equal(sanitized.temperatureC, 24.5);
      assert.equal(sanitized.condition, 'partly_cloudy');
      assert.equal(sanitized.precipitationProbability, 15);
      assert.equal(sanitized.aqi, 42);
      assert.equal(sanitized.observedAt, '2026-10-25T08:30:00.000Z');

      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'latitude'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'longitude'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'city'), false);
      assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'region'), false);
    });

    it('rejects invalid or empty weather observations', () => {
      assert.equal(sanitizeWeatherObservation(null), null);
      assert.equal(sanitizeWeatherObservation('invalid'), null);
      assert.equal(sanitizeWeatherObservation({ dummy: 'none' }), null);
    });

    it('validates freshness (< 3 hours old)', () => {
      const now = Date.now();
      const freshObs = {
        observedAt: new Date(now - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };
      const staleObs = {
        observedAt: new Date(now - 3.5 * 60 * 60 * 1000).toISOString(), // 3.5 hours ago
      };

      assert.equal(isWeatherObservationFresh(freshObs, OBSERVATION_MAX_AGE_MS, now), true);
      assert.equal(isWeatherObservationFresh(staleObs, OBSERVATION_MAX_AGE_MS, now), false);
      assert.equal(isWeatherObservationFresh(null, OBSERVATION_MAX_AGE_MS, now), false);
      assert.equal(isWeatherObservationFresh({}, OBSERVATION_MAX_AGE_MS, now), false);
    });

    it('formats weather badge text correctly', () => {
      const now = new Date('2026-10-25T14:35:00.000Z').getTime();
      const obsTime = new Date('2026-10-25T14:30:00.000Z');
      const obs = {
        observedAt: obsTime.toISOString(),
      };

      const badge = formatWeatherBadgeText(obs, OBSERVATION_MAX_AGE_MS, now);
      const hours = String(obsTime.getHours()).padStart(2, '0');
      const minutes = String(obsTime.getMinutes()).padStart(2, '0');
      assert.equal(badge, `Using weather from ${hours}:${minutes}`);

      const staleObs = {
        observedAt: new Date(now - 5 * 3600 * 1000).toISOString(),
      };
      assert.equal(
        formatWeatherBadgeText(staleObs, OBSERVATION_MAX_AGE_MS, now),
        'No recent weather - plan assumes indoor options'
      );
      assert.equal(
        formatWeatherBadgeText(null, OBSERVATION_MAX_AGE_MS, now),
        'No recent weather - plan assumes indoor options'
      );
    });
  });
});
