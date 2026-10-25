const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

/**
 * Loads a client TypeScript module into the Node.js test runner by transpiling in memory.
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

describe('Phase B — Cross-Page Hand-offs (G5) & FitBot Live Chips (G6)', () => {
  let readHandoff;
  let createHandoffState;
  let MAX_PREFILL_LENGTH;

  let getFitBotSuggestions;
  let BASE_SUGGESTIONS;

  before(() => {
    const handoffMod = loadTsModule('../../client/src/utils/handoff.ts');
    readHandoff = handoffMod.readHandoff;
    createHandoffState = handoffMod.createHandoffState;
    MAX_PREFILL_LENGTH = handoffMod.MAX_PREFILL_LENGTH;

    const suggestionsMod = loadTsModule('../../client/src/utils/fitbotSuggestions.ts');
    getFitBotSuggestions = suggestionsMod.getFitBotSuggestions;
    BASE_SUGGESTIONS = suggestionsMod.BASE_SUGGESTIONS;
  });

  describe('G5: Typed Hand-off Contract & Router State Validation', () => {
    it('accepts valid handoff with allowed intents', () => {
      const intents = ['indoor_alternative', 'plan_rest_of_today', 'plan_tomorrow', 'ask_followup'];
      for (const intent of intents) {
        const state = createHandoffState('weather', intent, 'Sample prefill');
        const parsed = readHandoff(state);
        assert.ok(parsed);
        assert.equal(parsed.source, 'weather');
        assert.equal(parsed.intent, intent);
        assert.equal(parsed.prefill, 'Sample prefill');
      }
    });

    it('rejects missing, null, undefined, and non-object states', () => {
      assert.equal(readHandoff(null), null);
      assert.equal(readHandoff(undefined), null);
      assert.equal(readHandoff('string'), null);
      assert.equal(readHandoff(123), null);
      assert.equal(readHandoff([]), null);
      assert.equal(readHandoff({}), null);
      assert.equal(readHandoff({ handoff: null }), null);
      assert.equal(readHandoff({ handoff: 'not an object' }), null);
    });

    it('rejects unknown or invalid intents', () => {
      assert.equal(readHandoff({ handoff: { intent: 'delete_account' } }), null);
      assert.equal(readHandoff({ handoff: { intent: 'inject_prompt' } }), null);
      assert.equal(readHandoff({ handoff: { intent: '' } }), null);
    });

    it('truncates oversized prefill text to MAX_PREFILL_LENGTH', () => {
      const oversized = 'A'.repeat(800);
      const state = {
        handoff: {
          source: 'dashboard',
          intent: 'ask_followup',
          prefill: oversized,
        },
      };
      const parsed = readHandoff(state);
      assert.ok(parsed);
      assert.equal(parsed.prefill.length, MAX_PREFILL_LENGTH);
    });

    it('truncates oversized source text to MAX_SOURCE_LENGTH', () => {
      const oversizedSource = 'S'.repeat(100);
      const state = {
        handoff: {
          source: oversizedSource,
          intent: 'plan_rest_of_today',
        },
      };
      const parsed = readHandoff(state);
      assert.ok(parsed);
      assert.equal(parsed.source.length, 50);
    });

    it('omits prefill when blank or whitespace only', () => {
      const state = {
        handoff: {
          source: 'dashboard',
          intent: 'plan_tomorrow',
          prefill: '   ',
        },
      };
      const parsed = readHandoff(state);
      assert.ok(parsed);
      assert.equal(parsed.prefill, undefined);
    });
  });

  describe('G6: FitBot Live Suggestion Chips Pure Function', () => {
    it('returns BASE_SUGGESTIONS when summary is null or undefined', () => {
      const chips = getFitBotSuggestions(null, null);
      assert.equal(chips.length, 6);
      assert.deepEqual(chips, BASE_SUGGESTIONS.slice(0, 6));
    });

    it('suggests breakfast when no meals are logged', () => {
      const summary = {
        food: { calories: 0, meals: 0, protein: 0, carbs: 0, fat: 0 },
        activity: { count: 1, burnedKcal: 200, minutes: 20 },
        waterMl: 1000,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2500 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("What's a healthy breakfast idea?"));
    });

    it('suggests dinner ideas for remaining calories when budget is ample', () => {
      const summary = {
        food: { calories: 1200, meals: 2, protein: 50, carbs: 120, fat: 40 },
        activity: { count: 1, burnedKcal: 300, minutes: 30 },
        waterMl: 2000,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("Dinner ideas for my remaining calories"));
    });

    it('suggests calorie balancing when daily limit is exceeded', () => {
      const summary = {
        food: { calories: 2300, meals: 3, protein: 100, carbs: 250, fat: 70 },
        activity: { count: 1, burnedKcal: 200, minutes: 20 },
        waterMl: 2000,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("How to balance calories after going over target?"));
    });

    it('suggests water tips when hydration is below target', () => {
      const summary = {
        food: { calories: 1000, meals: 1, protein: 30, carbs: 100, fat: 30 },
        activity: { count: 1, burnedKcal: 200, minutes: 20 },
        waterMl: 500,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2500 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("How do I hit my water goal?"));
    });

    it('suggests quick workout when no activity is logged', () => {
      const summary = {
        food: { calories: 1000, meals: 1, protein: 30, carbs: 100, fat: 30 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 2500,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2500 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("Suggest a quick 20-minute workout"));
    });

    it('suggests recovery tips when workout goal is achieved', () => {
      const summary = {
        food: { calories: 1000, meals: 1, protein: 30, carbs: 100, fat: 30 },
        activity: { count: 2, burnedKcal: 500, minutes: 50 },
        waterMl: 2500,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2500 },
      };
      const chips = getFitBotSuggestions(summary, null);
      assert.ok(chips.includes("Post-workout recovery and stretching tips"));
    });

    it('suggests indoor workout when weather has rain, heat, or poor AQI', () => {
      const summary = {
        food: { calories: 1000, meals: 1, protein: 30, carbs: 100, fat: 30 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 1000,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const rainyWeather = { condition: 'rain', temperatureC: 18 };
      const heatWeather = { condition: 'clear', temperatureC: 38 };
      const badAqiWeather = { condition: 'clear', aqi: 180 };

      assert.ok(getFitBotSuggestions(summary, rainyWeather).includes("Indoor workout for today"));
      assert.ok(getFitBotSuggestions(summary, heatWeather).includes("Indoor workout for today"));
      assert.ok(getFitBotSuggestions(summary, badAqiWeather).includes("Indoor workout for today"));
    });

    it('always caps chips at 6 and contains no duplicates', () => {
      const summary = {
        food: { calories: 500, meals: 1, protein: 20, carbs: 50, fat: 15 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 200,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, { condition: 'thunderstorm' });
      assert.equal(chips.length, 6);
      const uniqueChips = new Set(chips);
      assert.equal(uniqueChips.size, 6);
    });
  });
});
