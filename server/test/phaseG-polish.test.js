process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const mongoose = require('mongoose');

const IdempotencyKey = require('../src/models/IdempotencyKey');
const WaterLog = require('../src/models/WaterLog');
const waterlogController = require('../src/controllers/waterlog.controller');

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

describe('Phase G: Polish & Durability (N5-N7)', () => {
  let getFitBotSuggestions;
  let shouldRefreshTip;
  let TIP_THROTTLE_MS;
  let computeTipSignature;

  before(() => {
    const suggestionsMod = loadTsModule('../../client/src/utils/fitbotSuggestions.ts');
    getFitBotSuggestions = suggestionsMod.getFitBotSuggestions;

    const tipMod = loadTsModule('../../client/src/utils/dashboardTip.ts');
    shouldRefreshTip = tipMod.shouldRefreshTip;
    TIP_THROTTLE_MS = tipMod.TIP_THROTTLE_MS;
    computeTipSignature = tipMod.computeTipSignature;
  });

  describe('N5: Dashboard tip freshness & 30-minute re-check logic', () => {
    it('defines TIP_THROTTLE_MS as exactly 30 minutes', () => {
      assert.equal(TIP_THROTTLE_MS, 30 * 60 * 1000);
    });

    it('reuses cached tip when summary signature remains identical even after 30+ minutes', () => {
      const stored = {
        tip: 'Stay hydrated today!',
        signature: '2:1:1500',
        timestamp: 1000000,
      };
      const now = 1000000 + 40 * 60 * 1000; // 40 minutes later
      const refresh = shouldRefreshTip(stored, '2:1:1500', now);
      assert.equal(refresh, false);
    });

    it('delays refresh when signature changed within the 30-minute throttle window', () => {
      const stored = {
        tip: 'Stay hydrated today!',
        signature: '2:1:1500',
        timestamp: 1000000,
      };
      const now = 1000000 + 15 * 60 * 1000; // 15 minutes later (< 30m)
      const refresh = shouldRefreshTip(stored, '3:1:1500', now);
      assert.equal(refresh, false);
    });

    it('triggers refresh when signature changed and 30+ minutes have elapsed', () => {
      const stored = {
        tip: 'Stay hydrated today!',
        signature: '2:1:1500',
        timestamp: 1000000,
      };
      const now = 1000000 + 31 * 60 * 1000; // 31 minutes later (>= 30m)
      const refresh = shouldRefreshTip(stored, '3:1:1500', now);
      assert.equal(refresh, true);
    });
  });

  describe('N6: Durable water idempotency model and controller', () => {
    it('IdempotencyKey model validates schema fields and TTL index', () => {
      const record = new IdempotencyKey({
        key: 'act_12345',
        user: new mongoose.Types.ObjectId(),
        response: { id: 'w1', amount: 350 },
      });
      const err = record.validateSync();
      assert.equal(err, undefined);
      assert.equal(record.key, 'act_12345');
      assert.equal(record.response.amount, 350);

      // Check TTL index
      const indexes = IdempotencyKey.schema.indexes();
      const userKeyIndex = indexes.find(
        (idx) => idx[0] && idx[0].user === 1 && idx[0].key === 1
      );
      assert.ok(userKeyIndex);
      assert.equal(userKeyIndex[1]?.unique, true);
    });

    it('recovers response from persistent database store even when in-memory cache is cold', async () => {
      const userId = new mongoose.Types.ObjectId();
      const mockUser = { _id: userId };
      const testKey = `cold_restart_key_${Date.now()}`;

      let waterLogCreateCalled = false;
      const origWaterCreate = WaterLog.create;
      const origIdemFindOne = IdempotencyKey.findOne;
      const origReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

      WaterLog.create = async () => {
        waterLogCreateCalled = true;
        return { _id: new mongoose.Types.ObjectId(), toJSON: () => ({ id: 'new' }) };
      };

      // Simulates DB having the key from a previous server process before restart
      IdempotencyKey.findOne = async (query) => {
        if (String(query.user) === String(userId) && query.key === testKey) {
          return {
            key: testKey,
            user: userId,
            response: { id: 'persisted_water_id_99', amount: 500 },
          };
        }
        return null;
      };

      try {
        const req = {
          user: mockUser,
          headers: { 'idempotency-key': testKey },
          body: { data: { amount: 500 } },
        };
        let responseData = null;
        let statusCode = 200;
        const res = {
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            responseData = data;
            return this;
          },
        };

        await waterlogController.create(req, res);

        assert.equal(waterLogCreateCalled, false, 'Must NOT create new WaterLog if key exists in DB');
        assert.equal(statusCode, 200);
        assert.equal(responseData.id, 'persisted_water_id_99');
        assert.equal(responseData.amount, 500);
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });
        WaterLog.create = origWaterCreate;
        IdempotencyKey.findOne = origIdemFindOne;
      }
    });
  });

  describe('N7: Plan-scheduled suggestion chip rule', () => {
    it('generates a scheduled workout tip when a plan day is scheduled with a focus', () => {
      const summary = {
        food: { calories: 1500, meals: 2, protein: 90, carbs: 180, fat: 50 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 1200,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const planContext = { planDayScheduled: true, focus: 'Upper Body Power' };
      const chips = getFitBotSuggestions(summary, null, planContext);

      assert.ok(
        chips.includes("Tips for today's Upper Body Power workout"),
        `Expected chip not found in ${JSON.stringify(chips)}`
      );
    });

    it('generates a general scheduled workout tip when plan day is scheduled without a focus', () => {
      const summary = {
        food: { calories: 1500, meals: 2, protein: 90, carbs: 180, fat: 50 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 1200,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, null, { planDayScheduled: true });

      assert.ok(
        chips.includes("Tips for today's scheduled workout"),
        `Expected chip not found in ${JSON.stringify(chips)}`
      );
    });

    it('accepts boolean true as planContext argument for planDayScheduled', () => {
      const summary = {
        food: { calories: 1500, meals: 2, protein: 90, carbs: 180, fat: 50 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 1200,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, null, true);

      assert.ok(
        chips.includes("Tips for today's scheduled workout"),
        `Expected chip not found in ${JSON.stringify(chips)}`
      );
    });

    it('does not add scheduled workout tip when planDayScheduled is false or undefined', () => {
      const summary = {
        food: { calories: 1500, meals: 2, protein: 90, carbs: 180, fat: 50 },
        activity: { count: 0, burnedKcal: 0, minutes: 0 },
        waterMl: 1200,
        goals: { calorieLimit: 2000, calorieBurnGoal: 400, waterGoal: 2000 },
      };
      const chips = getFitBotSuggestions(summary, null, { planDayScheduled: false });

      assert.equal(
        chips.some((c) => c.includes("scheduled workout")),
        false
      );
    });
  });
});
