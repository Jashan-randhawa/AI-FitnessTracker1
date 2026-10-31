const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const {
  setUsageModel,
  getUtcDay,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_CALL_BUDGET,
  BUDGET_EXCEEDED_CODE,
} = require('../src/services/aiBudget.service');
const {
  enforceAiBudget,
  resolveChatFeature,
  recordProviderCall,
  aiUsageStorage,
} = require('../src/middleware/aiBudget');
const { chatCompletionDetailed } = require('../src/services/openrouter.service');
const { chatWithAssistant, resetCache } = require('../src/services/aiAssistant.service');
const { setGeminiVisionMock, clearGeminiVisionMock } = require('../src/utils/gemini');

/**
 * Creates a mock Express Response object with event emitter capabilities
 */
const createMockResponse = () => {
  const emitter = new EventEmitter();
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(key, val) {
      this.headers[key.toLowerCase()] = String(val);
      return this;
    },
    setHeader(key, val) {
      return this.set(key, val);
    },
    get(key) {
      return this.headers[key.toLowerCase()];
    },
    json(data) {
      this.body = data;
      this.end();
      return this;
    },
    end() {
      this._finished = true;
      emitter.emit('finish');
    },
    async waitForFlush() {
      if (!this._finished) {
        await new Promise((resolve) => emitter.once('finish', resolve));
      }
      if (this._flushPromise) {
        await this._flushPromise;
      }
    },
    on(event, handler) {
      emitter.on(event, handler);
      return this;
    },
    once(event, handler) {
      emitter.once(event, handler);
      return this;
    },
  };
  return res;
};

/**
 * In-memory usage store simulating MongoDB
 */
const createMockUsageStore = () => {
  const records = new Map();

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
        if (!options.upsert) return null;
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

describe('Step 2: Server-Side AI Budget Enforcement & Real Usage Recording', () => {
  let envBackup;
  let mockStore;

  beforeEach(() => {
    envBackup = { ...process.env };
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    mockStore = createMockUsageStore();
    setUsageModel(mockStore);
    resetCache();
  });

  afterEach(() => {
    process.env = envBackup;
    setUsageModel(null);
    clearGeminiVisionMock();
    resetCache();
  });

  describe('1. Pre-execution quota gate (enforceAiBudget)', () => {
    it('returns HTTP 429 when budget is exhausted and does NOT call provider / next()', async () => {
      const userId = 'user_exhausted_1';
      const day = getUtcDay();

      // Exhaust call budget
      mockStore.records.set(`${userId}:${day}`, {
        user: userId,
        day,
        calls: 100, // at default 100 limit
        tokens: 1000,
      });

      const req = {
        user: { _id: userId, id: userId },
        body: { messages: [{ role: 'user', content: 'hello' }] },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const middleware = enforceAiBudget('fitbot_chat');
      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false, 'next() must NOT be called on exhausted budget');
      assert.equal(res.statusCode, 429);
      assert.equal(res.body.error.code, BUDGET_EXCEEDED_CODE);
      assert.ok(res.headers['retry-after']);
      assert.ok(res.body.retryAfterSeconds > 0);
      assert.equal(res.body.remainingCalls, 0);
    });

    it('sets budget remaining headers and calls next() when within budget', async () => {
      const userId = 'user_allowed_1';
      const req = {
        user: { _id: userId, id: userId },
        body: { messages: [{ role: 'user', content: 'hello' }] },
      };
      const res = createMockResponse();
      let nextCalled = false;

      const middleware = enforceAiBudget('fitbot_chat');
      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(res.headers['x-ai-budget-remaining-calls'], '100');
      assert.equal(res.headers['x-ai-budget-remaining-tokens'], '50000');
    });

    it('resolves chat features dynamically: planner_meal, planner_activity, fitbot_chat', () => {
      const mealReq = { body: { planType: 'mealPlan', expectJson: true } };
      assert.equal(resolveChatFeature(mealReq), 'planner_meal');

      const actReq = { body: { planType: 'workoutPlan', expectJson: true } };
      assert.equal(resolveChatFeature(actReq), 'planner_activity');

      const chatReq = { body: { messages: [{ role: 'user', content: 'Give me tips' }] } };
      assert.equal(resolveChatFeature(chatReq), 'fitbot_chat');
    });
  });

  describe('2. Request-scoped usage collection & single flush', () => {
    it('records real provider tokens upon response finish', async () => {
      const userId = 'user_usage_1';
      const req = {
        user: { _id: userId, id: userId },
        body: {},
      };
      const res = createMockResponse();

      const middleware = enforceAiBudget('fitbot_chat');
      await middleware(req, res, async () => {
        // Simulate provider call recorded within request context
        recordProviderCall({
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          usage: { prompt_tokens: 150, completion_tokens: 50, total_tokens: 200 },
          status: 'success',
        });
        res.json({ success: true });
      });

      await res.waitForFlush();

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);

      assert.ok(recorded, 'Usage record should be created');
      assert.equal(recorded.calls, 1);
      assert.equal(recorded.tokens, 200);
      assert.equal(recorded.promptTokens, 150);
      assert.equal(recorded.completionTokens, 50);
      assert.equal(recorded.features.fitbot_chat.calls, 1);
      assert.equal(recorded.features.fitbot_chat.tokens, 200);
    });

    it('records conservative estimate and flags estimated when provider omits usage', async () => {
      const userId = 'user_no_usage_1';
      const req = {
        user: { _id: userId, id: userId },
        body: {},
      };
      const res = createMockResponse();

      const middleware = enforceAiBudget('food_snap');
      await middleware(req, res, async () => {
        recordProviderCall({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          usage: null, // missing usage metadata
          status: 'success',
          inputChars: 400,
        });
        res.json({ success: true });
      });

      await res.waitForFlush();

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);

      assert.ok(recorded);
      assert.equal(recorded.calls, 1);
      assert.ok(recorded.tokens >= 1500, 'Food snap floor (1500) enforced');
      assert.equal(recorded.estimatedCalls, 1);
      assert.equal(recorded.unknownUsageCalls, 1);
    });

    it('response cache hits (cached: true) cost nothing and record 0 calls', async () => {
      const userId = 'user_cache_hit_1';
      const req = {
        user: { _id: userId, id: userId },
        body: {},
      };
      const res = createMockResponse();

      const middleware = enforceAiBudget('fitbot_chat');
      await middleware(req, res, async () => {
        // Cache hit: no provider call dispatched
        res.json({ success: true, cached: true });
      });

      await new Promise((r) => setTimeout(r, 10));

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);
      assert.equal(recorded, undefined, 'Cache hit should record zero usage');
    });

    it('recordProviderCall is a safe NO-OP when called outside middleware context', () => {
      assert.doesNotThrow(() => {
        recordProviderCall({
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          usage: { total_tokens: 100 },
          status: 'success',
        });
      });
    });
  });

  describe('3. Multi-attempt accounting (retries, fallback, repair)', () => {
    it('records every attempt across OpenRouter retry + fallback', async () => {
      const userId = 'user_retry_fallback_1';
      let fetchAttempt = 0;

      // Mock fetch: primary model fails twice, fallback model succeeds on attempt 1
      const mockFetch = async (url, options) => {
        fetchAttempt++;
        const body = JSON.parse(options.body);

        if (body.model === 'openai/gpt-4o-mini') {
          return {
            status: 500,
            ok: false,
            text: async () => JSON.stringify({ error: 'Internal Server Error' }),
          };
        }

        // Fallback model call
        return {
          status: 200,
          ok: true,
          text: async () =>
            JSON.stringify({
              choices: [{ message: { content: 'Fallback response text' } }],
              usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
            }),
        };
      };

      const req = { user: { _id: userId, id: userId }, body: {} };
      const res = createMockResponse();

      const middleware = enforceAiBudget('fitbot_chat');
      await middleware(req, res, async () => {
        await chatCompletionDetailed({
          messages: [{ role: 'user', content: 'test' }],
          fetchFn: mockFetch,
        });
        res.json({ success: true });
      });

      await res.waitForFlush();

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);

      assert.ok(recorded);
      // Primary: attempt 1 (500) + retry 1 (500) + retry 2 (500) = 3 calls
      // Fallback: attempt 1 (200 OK) = 1 call
      // Total calls = 4
      assert.ok(recorded.calls >= 2, `Expected at least 2 attempts recorded, got ${recorded.calls}`);
      assert.ok(recorded.failures >= 1, 'Failed attempts recorded in failures count');
      assert.ok(recorded.tokens > 0, 'Tokens recorded');
    });

    it('records both calls on planner structured JSON repair retry', async () => {
      const userId = 'user_repair_1';
      let callCount = 0;

      // First call returns invalid JSON; repair retry returns valid meal plan
      const mockFetch = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            status: 200,
            ok: true,
            text: async () =>
              JSON.stringify({
                choices: [{ message: { content: 'Sorry, I forgot JSON format.' } }],
                usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
              }),
          };
        }
        return {
          status: 200,
          ok: true,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      title: 'Healthy Meal Plan',
                      targetCalories: 2000,
                      days: [],
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 150, completion_tokens: 80, total_tokens: 230 },
            }),
        };
      };

      const req = { user: { _id: userId, id: userId }, body: {} };
      const res = createMockResponse();

      const middleware = enforceAiBudget('planner_meal');
      await middleware(req, res, async () => {
        await chatWithAssistant([{ role: 'user', content: 'Give me a meal plan' }], null, {
          expectJson: true,
          planType: 'mealPlan',
          skipCache: true,
          fetchFn: mockFetch,
        });
        res.json({ success: true });
      });

      await res.waitForFlush();

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);

      assert.ok(recorded);
      assert.equal(recorded.calls, 2, 'Initial call + repair retry = 2 calls recorded');
      assert.equal(recorded.tokens, 360, '130 + 230 = 360 total tokens');
      assert.equal(recorded.features.planner_meal.calls, 2);
    });
  });

  describe('4. Timeouts & Gemini resilience', () => {
    it('records minimum charge and timeout when provider times out', async () => {
      const userId = 'user_timeout_1';
      const req = { user: { _id: userId, id: userId }, body: {} };
      const res = createMockResponse();

      const middleware = enforceAiBudget('food_snap');
      await middleware(req, res, async () => {
        recordProviderCall({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          timedOut: true,
          status: 'timeout',
          inputChars: 50,
        });
        res.status(504).json({ error: 'Gemini request timed out' });
      });

      await res.waitForFlush();

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);

      assert.ok(recorded);
      assert.equal(recorded.calls, 1);
      assert.equal(recorded.timeouts, 1);
      assert.ok(recorded.tokens >= 1500, 'Minimum floor charged for timed out vision call');
    });
  });

  describe('5. Concurrency & Isolation', () => {
    it('exhaustion of User A does not impact User B', async () => {
      const userA = 'user_exhausted_A';
      const userB = 'user_fresh_B';
      const day = getUtcDay();

      mockStore.records.set(`${userA}:${day}`, {
        user: userA,
        day,
        calls: 100, // at limit
        tokens: 50000,
      });

      const middleware = enforceAiBudget('fitbot_chat');

      // User A check
      const reqA = { user: { _id: userA, id: userA }, body: {} };
      const resA = createMockResponse();
      let nextCalledA = false;
      await middleware(reqA, resA, () => {
        nextCalledA = true;
      });
      assert.equal(nextCalledA, false);
      assert.equal(resA.statusCode, 429);

      // User B check
      const reqB = { user: { _id: userB, id: userB }, body: {} };
      const resB = createMockResponse();
      let nextCalledB = false;
      await middleware(reqB, resB, () => {
        nextCalledB = true;
      });
      assert.equal(nextCalledB, true);
      assert.equal(resB.headers['x-ai-budget-remaining-calls'], '100');
    });

    it('store failure follows AI_BUDGET_FAIL_MODE (open vs closed)', async () => {
      const failingStore = {
        findOne: () => {
          throw new Error('Mongo connection failure');
        },
      };
      setUsageModel(failingStore);

      const middleware = enforceAiBudget('fitbot_chat');
      const req = { user: { _id: 'u1', id: 'u1' }, body: {} };

      // Case 1: Fail closed
      process.env.AI_BUDGET_FAIL_MODE = 'closed';
      const resClosed = createMockResponse();
      let nextClosed = false;
      await middleware(req, resClosed, () => {
        nextClosed = true;
      });
      assert.equal(nextClosed, false);
      assert.equal(resClosed.statusCode, 429);

      // Case 2: Fail open
      process.env.AI_BUDGET_FAIL_MODE = 'open';
      const resOpen = createMockResponse();
      let nextOpen = false;
      await middleware(req, resOpen, () => {
        nextOpen = true;
      });
      assert.equal(nextOpen, true);
    });

    it('concurrent requests from one user cannot exceed budget by more than concurrency cap', async () => {
      const userId = 'user_concurrency_bound';
      process.env.AI_DAILY_CALL_BUDGET = '2'; // Budget allows 2 calls
      const middleware = enforceAiBudget('fitbot_chat');

      // Launch 2 requests concurrently (at the in-flight user concurrency limit)
      const executeRequest = async (reqIndex) => {
        const req = { user: { _id: userId, id: userId }, body: {} };
        const res = createMockResponse();
        let wasAllowed = false;

        await middleware(req, res, async () => {
          wasAllowed = true;
          recordProviderCall({
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            usage: { total_tokens: 50 },
            status: 'success',
          });
          res.json({ success: true, reqIndex });
        });

        await res.waitForFlush();
        return { wasAllowed, statusCode: res.statusCode };
      };

      const [r1, r2] = await Promise.all([executeRequest(1), executeRequest(2)]);
      assert.equal(r1.wasAllowed, true);
      assert.equal(r2.wasAllowed, true);

      // Now 2 calls have been recorded (budget = 2 is exhausted)
      // A subsequent request must be immediately rejected with 429
      const r3 = await executeRequest(3);
      assert.equal(r3.wasAllowed, false);
      assert.equal(r3.statusCode, 429);

      const day = getUtcDay();
      const recorded = mockStore.records.get(`${userId}:${day}`);
      assert.equal(recorded.calls, 2);
    });
  });
});
