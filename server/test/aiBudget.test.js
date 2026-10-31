const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const AiUsageDaily = require('../src/models/AiUsageDaily');
const {
  VALID_AI_FEATURES,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_CALL_BUDGET,
  DEFAULT_ADMIN_MULTIPLIER,
  BUDGET_EXCEEDED_CODE,
  DEFAULT_FALLBACK_FLOORS,
  setUsageModel,
  getUsageModel,
  getUtcDay,
  getNextUtcMidnight,
  getRetryAfterSeconds,
  getFailMode,
  normalizeUsage,
  estimateCost,
  getBudgetForUser,
  checkBudget,
  recordUsage,
  buildBudgetExceededResponse,
  sendBudgetExceeded,
} = require('../src/services/aiBudget.service');

/**
 * Creates an in-memory usage store simulating MongoDB findOne and findOneAndUpdate
 */
const createInMemoryUsageStore = () => {
  const records = new Map(); // key: `${userId}:${day}`

  return {
    records,
    findOne: (filter) => {
      const key = `${filter.user}:${filter.day}`;
      const rec = records.get(key) ? JSON.parse(JSON.stringify(records.get(key))) : null;
      return {
        lean: async () => rec,
        then: (resolve) => resolve(rec),
      };
    },
    findOneAndUpdate: async (filter, update, options = {}) => {
      const key = `${filter.user}:${filter.day}`;
      let doc = records.get(key);

      if (!doc) {
        if (!options.upsert) {
          return null;
        }
        doc = {
          user: filter.user,
          day: filter.day,
          calls: 0,
          tokens: 0,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCalls: 0,
          unknownUsageCalls: 0,
          timeouts: 0,
          failures: 0,
          features: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          ...(update.$setOnInsert || {}),
        };
        records.set(key, doc);
      }

      if (update.$inc) {
        for (const [path, val] of Object.entries(update.$inc)) {
          if (path.startsWith('features.')) {
            const parts = path.split('.');
            const feat = parts[1];
            const field = parts[2];
            doc.features = doc.features || {};
            doc.features[feat] = doc.features[feat] || {
              calls: 0,
              tokens: 0,
              promptTokens: 0,
              completionTokens: 0,
              estimatedCalls: 0,
              unknownUsageCalls: 0,
              timeouts: 0,
              failures: 0,
            };
            doc.features[feat][field] = (doc.features[feat][field] || 0) + val;
          } else {
            doc[path] = (doc[path] || 0) + val;
          }
        }
      }

      doc.updatedAt = new Date();
      return JSON.parse(JSON.stringify(doc));
    },
  };
};

describe('AI Budget Service & Daily Usage Ledger', () => {
  let envBackup;

  beforeEach(() => {
    envBackup = { ...process.env };
    delete process.env.AI_DAILY_TOKEN_BUDGET;
    delete process.env.AI_DAILY_CALL_BUDGET;
    delete process.env.AI_FEATURE_BUDGETS;
    delete process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER;
    delete process.env.AI_FALLBACK_COST_TOKENS;
    delete process.env.AI_BUDGET_FAIL_MODE;
  });

  afterEach(() => {
    process.env = envBackup;
    setUsageModel(null);
  });

  describe('1. normalizeUsage', () => {
    it('normalizes OpenRouter / OpenAI usage shape (snake_case)', () => {
      const raw = {
        prompt_tokens: 120,
        completion_tokens: 45,
        total_tokens: 165,
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 120,
        completionTokens: 45,
        tokens: 165,
      });
    });

    it('normalizes nested OpenRouter usage shape', () => {
      const raw = {
        usage: {
          prompt_tokens: 80,
          completion_tokens: 20,
          total_tokens: 100,
        },
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 80,
        completionTokens: 20,
        tokens: 100,
      });
    });

    it('normalizes Gemini usageMetadata shape', () => {
      const raw = {
        promptTokenCount: 110,
        candidatesTokenCount: 35,
        totalTokenCount: 145,
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 110,
        completionTokens: 35,
        tokens: 145,
      });
    });

    it('normalizes nested Gemini usageMetadata shape', () => {
      const raw = {
        usageMetadata: {
          promptTokenCount: 200,
          candidatesTokenCount: 50,
          totalTokenCount: 250,
        },
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 200,
        completionTokens: 50,
        tokens: 250,
      });
    });

    it("normalizes the app's internal camelCase usage shape", () => {
      const raw = {
        promptTokens: 150,
        completionTokens: 60,
        tokens: 210,
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 150,
        completionTokens: 60,
        tokens: 210,
      });
    });

    it('derives total tokens when total is omitted but components are provided', () => {
      const raw = {
        promptTokens: 40,
        completionTokens: 30,
      };
      const result = normalizeUsage(raw);
      assert.deepEqual(result, {
        promptTokens: 40,
        completionTokens: 30,
        tokens: 70,
      });
    });

    it('returns null for missing data, null, undefined, empty objects, and non-numeric totals', () => {
      assert.equal(normalizeUsage(null), null);
      assert.equal(normalizeUsage(undefined), null);
      assert.equal(normalizeUsage({}), null);
      assert.equal(normalizeUsage('invalid'), null);
      assert.equal(normalizeUsage({ prompt_tokens: 'foo', completion_tokens: 'bar' }), null);
      assert.equal(normalizeUsage({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }), null);
      assert.equal(normalizeUsage({ tokens: -5 }), null);
    });
  });

  describe('2. estimateCost', () => {
    it('never returns 0 tokens even for zero inputs or empty objects', () => {
      const res1 = estimateCost({ feature: 'fitbot_chat', inputChars: 0, maxTokens: 0 });
      assert.ok(res1.tokens > 0, 'tokens must be greater than 0');
      assert.equal(res1.estimated, true);

      const res2 = estimateCost({});
      assert.ok(res2.tokens > 0, 'tokens must be greater than 0');
      assert.equal(res2.estimated, true);
    });

    it('uses conservative ~chars/4 for input tokens', () => {
      const chars = 4000;
      const res = estimateCost({ feature: 'fitbot_chat', inputChars: chars });
      assert.equal(res.promptTokens, 1000); // 4000 / 4
      assert.ok(res.tokens >= 1000);
      assert.equal(res.estimated, true);
    });

    it('enforces feature-specific floors', () => {
      const foodSnapRes = estimateCost({ feature: 'food_snap', inputChars: 10, maxTokens: 50 });
      assert.ok(foodSnapRes.tokens >= DEFAULT_FALLBACK_FLOORS.food_snap);

      const chatRes = estimateCost({ feature: 'fitbot_chat', inputChars: 10, maxTokens: 50 });
      assert.ok(chatRes.tokens >= DEFAULT_FALLBACK_FLOORS.fitbot_chat);
    });

    it('respects AI_FALLBACK_COST_TOKENS environment override', () => {
      process.env.AI_FALLBACK_COST_TOKENS = '3000';
      const res = estimateCost({ feature: 'calorie_estimate', inputChars: 10 });
      assert.ok(res.tokens >= 3000, `Expected tokens >= 3000, got ${res.tokens}`);

      process.env.AI_FALLBACK_COST_TOKENS = JSON.stringify({
        calorie_estimate: 2200,
        default: 1000,
      });
      const resJson = estimateCost({ feature: 'calorie_estimate', inputChars: 10 });
      assert.ok(resJson.tokens >= 2200, `Expected tokens >= 2200, got ${resJson.tokens}`);
    });
  });

  describe('3. getBudgetForUser', () => {
    it('returns default limits for normal users when env is unset', () => {
      const user = { _id: '507f1f77bcf86cd799439011', isAdmin: false };
      const budget = getBudgetForUser(user);

      assert.equal(budget.tokenBudget, DEFAULT_TOKEN_BUDGET);
      assert.equal(budget.callBudget, DEFAULT_CALL_BUDGET);
      assert.equal(budget.multiplier, 1);
      assert.equal(budget.isAdmin, false);
      assert.deepEqual(budget.featureBudgets, {});
    });

    it('applies admin multiplier for isAdmin accounts', () => {
      const admin = { _id: '507f1f77bcf86cd799439099', isAdmin: true };
      const budget = getBudgetForUser(admin);

      assert.equal(budget.tokenBudget, DEFAULT_TOKEN_BUDGET * DEFAULT_ADMIN_MULTIPLIER);
      assert.equal(budget.callBudget, DEFAULT_CALL_BUDGET * DEFAULT_ADMIN_MULTIPLIER);
      assert.equal(budget.multiplier, DEFAULT_ADMIN_MULTIPLIER);
      assert.equal(budget.isAdmin, true);
    });

    it('applies admin multiplier when user.role === "admin"', () => {
      const adminRole = { _id: '507f1f77bcf86cd799439099', role: 'admin' };
      const budget = getBudgetForUser(adminRole);
      assert.equal(budget.isAdmin, true);
      assert.equal(budget.multiplier, DEFAULT_ADMIN_MULTIPLIER);
    });

    it('reads custom values from environment variables', () => {
      process.env.AI_DAILY_TOKEN_BUDGET = '20000';
      process.env.AI_DAILY_CALL_BUDGET = '50';
      process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER = '5';
      process.env.AI_FEATURE_BUDGETS = JSON.stringify({ fitbot_chat: 10000, food_snap: 5000 });

      const user = { _id: 'user1', isAdmin: false };
      const budget = getBudgetForUser(user);

      assert.equal(budget.tokenBudget, 20000);
      assert.equal(budget.callBudget, 50);
      assert.equal(budget.featureBudgets.fitbot_chat, 10000);
      assert.equal(budget.featureBudgets.food_snap, 5000);

      const admin = { _id: 'admin1', isAdmin: true };
      const adminBudget = getBudgetForUser(admin);
      assert.equal(adminBudget.tokenBudget, 100000); // 20000 * 5
      assert.equal(adminBudget.callBudget, 250); // 50 * 5
      assert.equal(adminBudget.featureBudgets.fitbot_chat, 50000); // 10000 * 5
    });

    it('falls back gracefully to defaults on invalid environment variables', () => {
      process.env.AI_DAILY_TOKEN_BUDGET = '-500';
      process.env.AI_DAILY_CALL_BUDGET = 'abc';
      process.env.AI_DAILY_BUDGET_ADMIN_MULTIPLIER = '0';
      process.env.AI_FEATURE_BUDGETS = 'invalid-json';

      const user = { _id: 'user1', isAdmin: false };
      const budget = getBudgetForUser(user);

      assert.equal(budget.tokenBudget, DEFAULT_TOKEN_BUDGET);
      assert.equal(budget.callBudget, DEFAULT_CALL_BUDGET);
      assert.deepEqual(budget.featureBudgets, {});
    });
  });

  describe('4. checkBudget: under / at / over limits & per-feature caps', () => {
    const userId = '507f1f77bcf86cd799439011';
    let store;

    beforeEach(() => {
      store = createInMemoryUsageStore();
      setUsageModel(store);
      process.env.AI_DAILY_TOKEN_BUDGET = '1000';
      process.env.AI_DAILY_CALL_BUDGET = '10';
      process.env.AI_FEATURE_BUDGETS = JSON.stringify({ fitbot_chat: 500 });
    });

    it('allows request when user is strictly under limit', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 5,
        tokens: 300,
        features: { fitbot_chat: { calls: 5, tokens: 200 } },
      });

      const res = await checkBudget({ userId, feature: 'fitbot_chat', usageStore: store });
      assert.equal(res.allowed, true);
      assert.equal(res.reason, null);
      assert.equal(res.remainingCalls, 5); // 10 - 5
      assert.equal(res.remainingTokens, 300); // min(1000-300=700, 500-200=300) = 300
      assert.ok(res.retryAfterSeconds > 0);
      assert.ok(res.resetAt);
    });

    it('rejects when calls count is at the limit', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 10, // at limit
        tokens: 200,
      });

      const res = await checkBudget({ userId, feature: 'fitbot_chat', usageStore: store });
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'CALL_BUDGET_EXCEEDED');
      assert.equal(res.remainingCalls, 0);
    });

    it('rejects when calls count is over the limit', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 11, // over limit
        tokens: 200,
      });

      const res = await checkBudget({ userId, feature: 'fitbot_chat', usageStore: store });
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'CALL_BUDGET_EXCEEDED');
      assert.equal(res.remainingCalls, 0);
    });

    it('rejects when tokens count is at the limit', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 4,
        tokens: 1000, // at limit
      });

      const res = await checkBudget({ userId, feature: 'planner_meal', usageStore: store });
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'TOKEN_BUDGET_EXCEEDED');
      assert.equal(res.remainingTokens, 0);
    });

    it('rejects when tokens count is over the limit', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 4,
        tokens: 1050, // over limit
      });

      const res = await checkBudget({ userId, feature: 'planner_meal', usageStore: store });
      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'TOKEN_BUDGET_EXCEEDED');
      assert.equal(res.remainingTokens, 0);
    });

    it('enforces per-feature token cap even when global budget has remaining tokens', async () => {
      const day = getUtcDay();
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 5,
        tokens: 550, // global is 1000, so global has 450 remaining
        features: {
          fitbot_chat: { calls: 5, tokens: 500 }, // feature cap is 500 (at limit!)
        },
      });

      // fitbot_chat should be rejected due to feature budget
      const chatRes = await checkBudget({ userId, feature: 'fitbot_chat', usageStore: store });
      assert.equal(chatRes.allowed, false);
      assert.equal(chatRes.reason, 'FEATURE_BUDGET_EXCEEDED');

      // food_snap (no per-feature cap) should still be allowed under global budget
      const foodRes = await checkBudget({ userId, feature: 'food_snap', usageStore: store });
      assert.equal(foodRes.allowed, true);
      assert.equal(foodRes.remainingTokens, 450);
    });

    it('admin user passes check with higher limits when normal user fails', async () => {
      const day = getUtcDay();
      // 12 calls used: standard user cap is 10, admin cap is 10 * 10 = 100
      store.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 12,
        tokens: 800,
      });

      const regularUser = { _id: userId, isAdmin: false };
      const regularCheck = await checkBudget({
        userId,
        feature: 'fitbot_chat',
        user: regularUser,
        usageStore: store,
      });
      assert.equal(regularCheck.allowed, false);
      assert.equal(regularCheck.reason, 'CALL_BUDGET_EXCEEDED');

      const adminUser = { _id: userId, isAdmin: true };
      const adminCheck = await checkBudget({
        userId,
        feature: 'fitbot_chat',
        user: adminUser,
        usageStore: store,
      });
      assert.equal(adminCheck.allowed, true);
      assert.equal(adminCheck.remainingCalls, 88); // 100 - 12
    });
  });

  describe('5. UTC Day Rollover & resetAt Calculation', () => {
    it('anchors resetAt to the next UTC midnight regardless of input time', () => {
      const fixedTime = new Date('2026-10-31T15:30:45.000Z');
      const day = getUtcDay(fixedTime);
      assert.equal(day, '2026-10-31');

      const nextMidnight = getNextUtcMidnight(fixedTime);
      assert.equal(nextMidnight.toISOString(), '2026-11-01T00:00:00.000Z');

      const retryAfter = getRetryAfterSeconds(fixedTime);
      // From 15:30:45 to 24:00:00 is 8 hours, 29 minutes, 15 seconds = 30555 seconds
      assert.equal(retryAfter, 8 * 3600 + 29 * 60 + 15);
    });

    it('resets budget when UTC calendar day rolls over', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const store = createInMemoryUsageStore();

      // Exhaust budget on 2026-10-31
      store.records.set(`${userId}:2026-10-31`, {
        user: userId,
        day: '2026-10-31',
        calls: 10000,
        tokens: 500000,
      });

      const day1Check = await checkBudget({
        userId,
        feature: 'fitbot_chat',
        usageStore: store,
        now: new Date('2026-10-31T23:59:50.000Z'),
      });
      assert.equal(day1Check.allowed, false);

      // 20 seconds later at 2026-11-01T00:00:10.000Z (new UTC day)
      const day2Check = await checkBudget({
        userId,
        feature: 'fitbot_chat',
        usageStore: store,
        now: new Date('2026-11-01T00:00:10.000Z'),
      });
      assert.equal(day2Check.allowed, true);
      assert.equal(day2Check.remainingCalls, DEFAULT_CALL_BUDGET);
      assert.equal(day2Check.remainingTokens, DEFAULT_TOKEN_BUDGET);
    });
  });

  describe('6. Store Unavailability & Fail Mode Policy', () => {
    it('fails CLOSED when store throws and AI_BUDGET_FAIL_MODE is closed', async () => {
      process.env.AI_BUDGET_FAIL_MODE = 'closed';
      const failingStore = {
        findOne: () => {
          throw new Error('Mongo connection timed out');
        },
      };

      const res = await checkBudget({
        userId: '507f1f77bcf86cd799439011',
        feature: 'fitbot_chat',
        usageStore: failingStore,
      });

      assert.equal(res.allowed, false);
      assert.equal(res.reason, 'STORE_UNAVAILABLE_FAIL_CLOSED');
    });

    it('fails OPEN when store throws and AI_BUDGET_FAIL_MODE is open', async () => {
      process.env.AI_BUDGET_FAIL_MODE = 'open';
      const failingStore = {
        findOne: () => {
          throw new Error('Mongo connection timed out');
        },
      };

      const res = await checkBudget({
        userId: '507f1f77bcf86cd799439011',
        feature: 'fitbot_chat',
        usageStore: failingStore,
      });

      assert.equal(res.allowed, true);
      assert.equal(res.reason, 'STORE_UNAVAILABLE_FAIL_OPEN');
      assert.equal(res.remainingTokens, DEFAULT_TOKEN_BUDGET);
    });
  });

  describe('7. recordUsage & Concurrency', () => {
    it('records valid usage atomically with per-feature breakdown', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const store = createInMemoryUsageStore();

      await recordUsage({
        userId,
        feature: 'food_snap',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        usage: { promptTokenCount: 150, candidatesTokenCount: 50, totalTokenCount: 200 },
        status: 'success',
        usageStore: store,
      });

      const day = getUtcDay();
      const saved = store.records.get(`${userId}:${day}`);

      assert.equal(saved.calls, 1);
      assert.equal(saved.tokens, 200);
      assert.equal(saved.promptTokens, 150);
      assert.equal(saved.completionTokens, 50);
      assert.equal(saved.estimatedCalls, 0);
      assert.equal(saved.features.food_snap.calls, 1);
      assert.equal(saved.features.food_snap.tokens, 200);
    });

    it('flags missing usage as estimated and increments unknownUsageCalls', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const store = createInMemoryUsageStore();

      await recordUsage({
        userId,
        feature: 'calorie_estimate',
        provider: 'openrouter',
        usage: null, // missing usage metadata
        inputChars: 200,
        usageStore: store,
      });

      const day = getUtcDay();
      const saved = store.records.get(`${userId}:${day}`);

      assert.equal(saved.calls, 1);
      assert.ok(saved.tokens > 0, 'tokens must be positive');
      assert.equal(saved.estimatedCalls, 1);
      assert.equal(saved.unknownUsageCalls, 1);
      assert.equal(saved.features.calorie_estimate.estimatedCalls, 1);
    });

    it('increments timeouts and failures correctly', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const store = createInMemoryUsageStore();

      await recordUsage({
        userId,
        feature: 'voice_set',
        usage: { tokens: 100 },
        status: 'timeout',
        usageStore: store,
      });

      await recordUsage({
        userId,
        feature: 'voice_set',
        usage: { tokens: 100 },
        status: 500, // HTTP 500 failure
        usageStore: store,
      });

      const day = getUtcDay();
      const saved = store.records.get(`${userId}:${day}`);

      assert.equal(saved.calls, 2);
      assert.equal(saved.timeouts, 1);
      assert.equal(saved.failures, 1);
      assert.equal(saved.features.voice_set.timeouts, 1);
      assert.equal(saved.features.voice_set.failures, 1);
    });

    it('recovers from duplicate key race (E11000) by retrying once', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const baseStore = createInMemoryUsageStore();
      let attempt = 0;

      const raceStore = {
        findOneAndUpdate: async (filter, update, options) => {
          attempt += 1;
          if (attempt === 1) {
            const err = new Error('E11000 duplicate key error collection: fittrack.aiusagedailies index: user_1_day_1');
            err.code = 11000;
            throw err;
          }
          return baseStore.findOneAndUpdate(filter, update, options);
        },
      };

      const result = await recordUsage({
        userId,
        feature: 'fitbot_chat',
        usage: { promptTokens: 50, completionTokens: 25, tokens: 75 },
        usageStore: raceStore,
      });

      assert.equal(attempt, 2, 'Should have retried after duplicate key error');
      assert.ok(result);
      assert.equal(result.calls, 1);
      assert.equal(result.tokens, 75);
    });

    it('concurrent recordUsage calls do not lose increments', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const store = createInMemoryUsageStore();

      // Launch 10 concurrent usage records
      const concurrentTasks = Array.from({ length: 10 }, (_, i) =>
        recordUsage({
          userId,
          feature: 'fitbot_chat',
          usage: { promptTokens: 10, completionTokens: 10, tokens: 20 },
          usageStore: store,
        })
      );

      await Promise.all(concurrentTasks);

      const day = getUtcDay();
      const saved = store.records.get(`${userId}:${day}`);

      assert.equal(saved.calls, 10);
      assert.equal(saved.tokens, 200); // 10 * 20
      assert.equal(saved.promptTokens, 100); // 10 * 10
      assert.equal(saved.completionTokens, 100); // 10 * 10
      assert.equal(saved.features.fitbot_chat.calls, 10);
      assert.equal(saved.features.fitbot_chat.tokens, 200);
    });
  });

  describe('8. Rejection Decision Helper & sendError Format', () => {
    it('builds standard HTTP 429 response payload adhering to sendError contract', () => {
      const checkResult = {
        allowed: false,
        remainingTokens: 0,
        remainingCalls: 0,
        resetAt: '2026-11-01T00:00:00.000Z',
        retryAfterSeconds: 3600,
        reason: 'TOKEN_BUDGET_EXCEEDED',
      };

      const { status, headers, body } = buildBudgetExceededResponse(checkResult);

      assert.equal(status, 429);
      assert.equal(headers['Retry-After'], '3600');
      assert.equal(headers['X-RateLimit-Reset'], '2026-11-01T00:00:00.000Z');

      assert.ok(body.message);
      assert.equal(body.retryAfterSeconds, 3600);
      assert.equal(body.error.code, BUDGET_EXCEEDED_CODE);
      assert.equal(body.error.retryAfterSeconds, 3600);
      assert.equal(body.error.reason, 'TOKEN_BUDGET_EXCEEDED');
      assert.equal(body.error.resetAt, '2026-11-01T00:00:00.000Z');
      assert.equal(body.error.message, body.message);
    });

    it('sendBudgetExceeded sets response status, headers and body', () => {
      const mockRes = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        set(k, v) {
          this.headers[k] = v;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };

      const checkResult = {
        allowed: false,
        retryAfterSeconds: 1200,
        resetAt: '2026-11-01T00:00:00.000Z',
        reason: 'CALL_BUDGET_EXCEEDED',
      };

      sendBudgetExceeded(mockRes, checkResult, 'Custom budget limit message');

      assert.equal(mockRes.statusCode, 429);
      assert.equal(mockRes.headers['Retry-After'], '1200');
      assert.equal(mockRes.body.message, 'Custom budget limit message');
      assert.equal(mockRes.body.error.code, BUDGET_EXCEEDED_CODE);
      assert.equal(mockRes.body.error.message, 'Custom budget limit message');
    });
  });

  describe('9. AiUsageDaily Mongoose Model & TTL Index', () => {
    it('validates schema definition and YYYY-MM-DD day regex', () => {
      const validDoc = new AiUsageDaily({
        user: new mongoose.Types.ObjectId(),
        day: '2026-10-31',
      });
      const validErr = validDoc.validateSync();
      assert.equal(validErr, undefined);

      const invalidDoc = new AiUsageDaily({
        user: new mongoose.Types.ObjectId(),
        day: 'invalid-date',
      });
      const invalidErr = invalidDoc.validateSync();
      assert.ok(invalidErr.errors.day);
    });

    it('calculates expiresAt ~35 days after the day ends', () => {
      const expiry = AiUsageDaily.calculateDayExpiry('2026-10-31');
      // 2026-10-31 ends at 2026-11-01T00:00:00.000Z + 35 days = 2026-12-06T00:00:00.000Z
      assert.equal(expiry.toISOString(), '2026-12-06T00:00:00.000Z');
    });

    it('defines unique index on { user: 1, day: 1 } and TTL index on expiresAt', () => {
      const indexes = AiUsageDaily.schema.indexes();

      const uniqueUserDayIndex = indexes.find(
        ([fields, opts]) => fields.user === 1 && fields.day === 1 && opts.unique === true
      );
      assert.ok(uniqueUserDayIndex, 'Should define unique index on { user: 1, day: 1 }');

      const ttlIndex = indexes.find(
        ([fields, opts]) => fields.expiresAt === 1 && opts.expireAfterSeconds === 0
      );
      assert.ok(ttlIndex, 'Should define TTL index on expiresAt with expireAfterSeconds: 0');
    });

    it('applies toJSONPlugin transforming _id to string id', () => {
      const doc = new AiUsageDaily({
        user: new mongoose.Types.ObjectId(),
        day: '2026-10-31',
        calls: 3,
        tokens: 150,
      });

      const json = doc.toJSON();
      assert.ok(json.id, 'Expected JSON to contain id string');
      assert.equal(json._id, undefined, '_id should be deleted');
      assert.equal(json.__v, undefined, 'version key should be omitted');
    });
  });

  describe('10. Environment Variable Validation (envValidator)', () => {
    const { validateEnvironment } = require('../src/config/envValidator');

    it('emits warnings without crashing or invalidating startup for malformed budget vars', () => {
      const testEnv = {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/test_db',
        JWT_SECRET: 'test_jwt_secret_with_sufficient_length_123',
        AI_DAILY_TOKEN_BUDGET: '-500',
        AI_DAILY_CALL_BUDGET: 'not-a-number',
        AI_DAILY_BUDGET_ADMIN_MULTIPLIER: '0',
        AI_FEATURE_BUDGETS: '{ malformed json',
        AI_BUDGET_FAIL_MODE: 'unsupported_mode',
      };

      const result = validateEnvironment(testEnv);

      // Must remain valid (warnings, not crashes/errors)
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);

      // Verify each warning is captured
      assert.ok(result.warnings.some((w) => w.includes('AI_DAILY_TOKEN_BUDGET should be a positive number')));
      assert.ok(result.warnings.some((w) => w.includes('AI_DAILY_CALL_BUDGET should be a positive number')));
      assert.ok(result.warnings.some((w) => w.includes('AI_DAILY_BUDGET_ADMIN_MULTIPLIER should be a positive number')));
      assert.ok(result.warnings.some((w) => w.includes('AI_FEATURE_BUDGETS is not valid JSON')));
      assert.ok(result.warnings.some((w) => w.includes('AI_BUDGET_FAIL_MODE should be "open" or "closed"')));
    });

    it('accepts valid budget environment variables cleanly without warnings', () => {
      const testEnv = {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://localhost:27017/test_db',
        JWT_SECRET: 'test_jwt_secret_with_sufficient_length_123',
        AI_DAILY_TOKEN_BUDGET: '60000',
        AI_DAILY_CALL_BUDGET: '150',
        AI_DAILY_BUDGET_ADMIN_MULTIPLIER: '5',
        AI_FEATURE_BUDGETS: JSON.stringify({ fitbot_chat: 25000, food_snap: 15000 }),
        AI_BUDGET_FAIL_MODE: 'closed',
      };

      const result = validateEnvironment(testEnv);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(!result.warnings.some((w) => w.includes('AI_')));
    });
  });
});
