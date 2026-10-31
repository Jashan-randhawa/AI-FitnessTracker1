const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const metrics = require('../src/utils/metrics');
const logger = require('../src/utils/logger');
const AuditLog = require('../src/models/AuditLog');
const {
  checkBudget,
  recordUsage,
  getUtcDay,
  setUsageModel,
  resetDailyBudgetMetricsTracker,
  setAuditLogger,
} = require('../src/services/aiBudget.service');
const {
  aiUsageStorage,
  recordProviderCall,
  enforceAiBudget,
} = require('../src/middleware/aiBudget');
const {
  getAiUsage,
  getTopAiConsumers,
} = require('../src/controllers/aiBudget.controller');
const { requireAdmin } = require('../src/middleware/auth');

// In-memory fake model store for testing without live MongoDB
const createMockStore = (initialDocs = []) => {
  const map = new Map();
  for (const doc of initialDocs) {
    const key = `${doc.user}:${doc.day}`;
    map.set(key, { ...doc, _id: doc._id || new mongoose.Types.ObjectId() });
  }

  const store = {
    _map: map,
    findOne(query) {
      const key = `${query.user}:${query.day}`;
      const found = map.get(key) ? JSON.parse(JSON.stringify(map.get(key))) : null;
      return {
        lean: async () => found,
        then(resolve) {
          resolve(found);
        },
      };
    },
    async findOneAndUpdate(filter, update, options = {}) {
      const key = `${filter.user}:${filter.day}`;
      let existing = map.get(key);

      if (!existing && options.upsert) {
        existing = {
          _id: new mongoose.Types.ObjectId(),
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
        };
        map.set(key, existing);
      }

      if (existing) {
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            if (k.startsWith('features.')) {
              const parts = k.split('.');
              const feat = parts[1];
              const field = parts[2];
              if (!existing.features) existing.features = {};
              if (!existing.features[feat]) existing.features[feat] = {};
              existing.features[feat][field] = (existing.features[feat][field] || 0) + v;
            } else {
              existing[k] = (existing[k] || 0) + v;
            }
          }
        }
        existing.updatedAt = new Date();
      }

      return JSON.parse(JSON.stringify(existing));
    },
    find(filter = {}) {
      let items = Array.from(map.values());
      if (filter.day) {
        items = items.filter((item) => item.day === filter.day);
      }
      if (filter.$or) {
        // Simple keyset emulation for test
        const compare = filter.$or[0];
        if (compare.tokens && compare.tokens.$lt !== undefined) {
          items = items.filter((item) => item.tokens < compare.tokens.$lt);
        }
      }

      const chain = {
        _sort: null,
        _limit: null,
        _populate: null,
        sort(s) {
          chain._sort = s;
          if (s && s.tokens === -1) {
            items.sort((a, b) => (b.tokens || 0) - (a.tokens || 0));
          }
          return chain;
        },
        limit(n) {
          chain._limit = n;
          return chain;
        },
        populate(p) {
          chain._populate = p;
          return chain;
        },
        then(resolve) {
          const slice = chain._limit ? items.slice(0, chain._limit) : items;
          return Promise.resolve(JSON.parse(JSON.stringify(slice))).then(resolve);
        },
      };
      return chain;
    },
  };

  return store;
};

const createMockRes = () => {
  const headers = {};
  let flushResolve;
  const flushPromise = new Promise((resolve) => {
    flushResolve = resolve;
  });

  const res = {
    statusCode: 200,
    headers,
    body: null,
    set(key, val) {
      headers[key] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.emitFinish();
      return this;
    },
    send(data) {
      this.body = data;
      this.emitFinish();
      return this;
    },
    _listeners: {},
    once(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
      return this;
    },
    emitFinish() {
      const listeners = this._listeners['finish'] || [];
      for (const fn of listeners) fn();
      setTimeout(async () => {
        if (this._flushPromise) {
          await this._flushPromise;
        }
        flushResolve();
      }, 5);
    },
    waitForFlush() {
      return flushPromise;
    },
  };
  return res;
};

describe('AI Budget Monitoring & Observability', () => {
  let originalEnv;
  let mockStore;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AI_DAILY_TOKEN_BUDGET = '50000';
    process.env.AI_DAILY_CALL_BUDGET = '100';
    mockStore = createMockStore();
    setUsageModel(mockStore);
    resetDailyBudgetMetricsTracker();
    metrics.reset();
  });

  afterEach(() => {
    process.env = originalEnv;
    setUsageModel(null);
    resetDailyBudgetMetricsTracker();
    metrics.reset();
  });

  it('records provider calls total with ok, timeout, error, fallback and latency histogram', () => {
    // 1. ok status
    recordProviderCall({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      status: 'success',
      latencyMs: 1200,
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    // 2. timeout status
    recordProviderCall({
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      status: 'timeout',
      timedOut: true,
      latencyMs: 20500,
    });

    // 3. error status
    recordProviderCall({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      status: 'failure',
      latencyMs: 500,
    });

    // 4. fallback status
    recordProviderCall({
      provider: 'openrouter',
      model: 'deepseek/deepseek-chat',
      status: 'success',
      isFallback: true,
      latencyMs: 2300,
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
    });

    const metricsText = metrics.getPrometheusFormat();

    // Verify counter labels
    assert.match(metricsText, /ai_provider_calls_total\{model="openai\/gpt-4o-mini",provider="openrouter",status="ok"\} 1/);
    assert.match(metricsText, /ai_provider_calls_total\{model="gemini-1.5-flash",provider="gemini",status="timeout"\} 1/);
    assert.match(metricsText, /ai_provider_calls_total\{model="openai\/gpt-4o-mini",provider="openrouter",status="error"\} 1/);
    assert.match(metricsText, /ai_provider_calls_total\{model="deepseek\/deepseek-chat",provider="openrouter",status="fallback"\} 1/);

    // Verify latency histogram
    assert.match(metricsText, /ai_provider_latency_seconds_bucket\{provider="openrouter",le="2\.5"\} 3/);
    assert.match(metricsText, /ai_provider_latency_seconds_bucket\{provider="gemini",le="30"\} 1/);
  });

  it('records ai_usage_missing_total when provider usage metadata is omitted', () => {
    aiUsageStorage.run({ collector: { feature: 'food_estimate', calls: [] } }, () => {
      recordProviderCall({
        provider: 'openrouter',
        model: 'test-model',
        usage: null,
      });
    });

    const metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_usage_missing_total\{feature="food_estimate",provider="openrouter"\} 1/);
  });

  it('records ai_requests_total and ai_budget_exhausted_total on budget rejection', async () => {
    const userId = new mongoose.Types.ObjectId();
    const day = getUtcDay();
    mockStore._map.set(`${userId}:${day}`, {
      user: userId,
      day,
      tokens: 50000,
      calls: 100,
    });

    const req = {
      user: { _id: userId },
      body: { messages: [{ role: 'user', content: 'hello' }] },
    };
    const res = createMockRes();

    const mw = enforceAiBudget('fitbot_chat');
    await mw(req, res, () => {});

    assert.equal(res.statusCode, 429);
    const metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_requests_total\{feature="fitbot_chat",outcome="budget_exceeded"\} 1/);
    assert.match(metricsText, /ai_budget_exhausted_total\{feature="fitbot_chat"\} 1/);
  });

  it('increments ai_tokens_total by type (prompt/completion) and estimated flag', async () => {
    const userId = new mongoose.Types.ObjectId();
    await recordUsage({
      userId,
      feature: 'fitbot_chat',
      provider: 'openrouter',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 300, completionTokens: 150, totalTokens: 450 },
      usageStore: mockStore,
    });

    const metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_tokens_total\{estimated="false",feature="fitbot_chat",provider="openrouter",type="prompt"\} 300/);
    assert.match(metricsText, /ai_tokens_total\{estimated="false",feature="fitbot_chat",provider="openrouter",type="completion"\} 150/);
  });

  it('emits ai_budget_store_errors_total when usage store queries or updates fail', async () => {
    const failingStore = {
      findOne() {
        throw new Error('Connection pool exhausted');
      },
      findOneAndUpdate() {
        throw new Error('Disk full');
      },
    };

    process.env.AI_BUDGET_FAIL_MODE = 'open';
    const checkRes = await checkBudget({
      userId: 'user-err',
      feature: 'fitbot_chat',
      usageStore: failingStore,
    });
    assert.equal(checkRes.allowed, true);

    const metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_budget_store_errors_total 1/);
  });

  it('tracks users near (80%) and over (100%) budget via gauge without per-user labels', async () => {
    const user1 = new mongoose.Types.ObjectId();
    const user2 = new mongoose.Types.ObjectId();

    // User 1 reaches 82% (41,000 / 50,000)
    await recordUsage({
      userId: user1,
      feature: 'planner_meal',
      usage: { promptTokens: 30000, completionTokens: 11000, totalTokens: 41000 },
      usageStore: mockStore,
    });

    let metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_budget_users_status\{state="near"\} 1/);
    assert.match(metricsText, /ai_budget_users_status\{state="exhausted"\} 0/);
    assert.match(metricsText, /ai_users_near_budget 1/);

    // User 2 reaches 100% (51,000 / 50,000)
    await recordUsage({
      userId: user2,
      feature: 'fitbot_chat',
      usage: { promptTokens: 35000, completionTokens: 16000, totalTokens: 51000 },
      usageStore: mockStore,
    });

    metricsText = metrics.getPrometheusFormat();
    assert.match(metricsText, /ai_budget_users_status\{state="near"\} 1/);
    assert.match(metricsText, /ai_budget_users_status\{state="exhausted"\} 1/);
    assert.match(metricsText, /ai_users_over_budget 1/);

    // Guaranteed zero user IDs or emails in metrics exposition
    assert.doesNotMatch(metricsText, new RegExp(String(user1)));
    assert.doesNotMatch(metricsText, new RegExp(String(user2)));
  });

  it('emits ai_budget_event structured log lines at 80% and 100% once per user per day', async () => {
    const loggedEvents = [];
    const origInfo = logger.info;
    const origWarn = logger.warn;

    logger.info = (msg, meta) => {
      if (meta?.type === 'ai_budget_event') loggedEvents.push({ level: 'info', msg, meta });
      origInfo(msg, meta);
    };
    logger.warn = (msg, meta) => {
      if (meta?.type === 'ai_budget_event') loggedEvents.push({ level: 'warn', msg, meta });
      origWarn(msg, meta);
    };

    try {
      const user = new mongoose.Types.ObjectId();

      // Turn 1: 42,000 tokens (84%) -> triggers 80% event
      await recordUsage({
        userId: user,
        feature: 'fitbot_chat',
        usage: { promptTokens: 30000, completionTokens: 12000, totalTokens: 42000 },
        usageStore: mockStore,
      });

      // Turn 2: another 2,000 tokens (88%) -> should NOT trigger duplicate 80% event
      await recordUsage({
        userId: user,
        feature: 'fitbot_chat',
        usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
        usageStore: mockStore,
      });

      const events80 = loggedEvents.filter((e) => e.meta.threshold === '80%');
      assert.equal(events80.length, 1);
      assert.equal(events80[0].meta.userId, String(user));

      // Turn 3: 8,000 tokens (total 52,000 / 104%) -> triggers 100% event
      await recordUsage({
        userId: user,
        feature: 'fitbot_chat',
        usage: { promptTokens: 5000, completionTokens: 3000, totalTokens: 8000 },
        usageStore: mockStore,
      });

      // Turn 4: checkBudget on exhausted user -> should NOT duplicate 100% event
      await checkBudget({
        userId: user,
        feature: 'fitbot_chat',
        usageStore: mockStore,
      });

      const events100 = loggedEvents.filter((e) => e.meta.threshold === '100%');
      assert.equal(events100.length, 1);
      assert.equal(events100[0].level, 'warn');
      assert.equal(events100[0].meta.userId, String(user));
    } finally {
      logger.info = origInfo;
      logger.warn = origWarn;
    }
  });

  it('persists an AuditLog entry when a user is first blocked by budget with counts and feature only', async () => {
    let auditEntry = null;
    setAuditLogger(async (payload) => {
      auditEntry = payload;
      return payload;
    });

    try {
      const user = new mongoose.Types.ObjectId();
      const day = getUtcDay();
      mockStore._map.set(`${user}:${day}`, {
        user,
        day,
        tokens: 52000,
        calls: 80,
      });

      // First check: blocked
      const result1 = await checkBudget({
        userId: user,
        feature: 'fitbot_chat',
        usageStore: mockStore,
      });
      assert.equal(result1.allowed, false);
      assert.ok(auditEntry);
      assert.equal(auditEntry.event, 'ai_budget_exceeded');
      assert.equal(auditEntry.status, 'blocked');
      assert.equal(auditEntry.details.feature, 'fitbot_chat');
      assert.equal(auditEntry.details.counts.tokensUsed, 52000);

      // Second check: already blocked today, should not spam AuditLog entry again
      auditEntry = null;
      const result2 = await checkBudget({
        userId: user,
        feature: 'fitbot_chat',
        usageStore: mockStore,
      });
      assert.equal(result2.allowed, false);
      assert.equal(auditEntry, null);
    } finally {
      setAuditLogger(null);
    }
  });

  it('GET /api/ai/usage returns user usage status without raw database internals', async () => {
    const user = new mongoose.Types.ObjectId();
    const day = getUtcDay();
    mockStore._map.set(`${user}:${day}`, {
      user,
      day,
      tokens: 20000,
      calls: 15,
      features: {
        fitbot_chat: { tokens: 12000, calls: 8 },
        food_snap: { tokens: 8000, calls: 7 },
      },
      _id: new mongoose.Types.ObjectId(),
      __v: 0,
      expiresAt: new Date(),
    });

    const req = { user: { _id: user } };
    const res = createMockRes();

    await getAiUsage(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.day, day);
    assert.equal(res.body.tokensUsed, 20000);
    assert.equal(res.body.remainingTokens, 30000);
    assert.equal(res.body.callsUsed, 15);
    assert.equal(res.body.remainingCalls, 85);
    assert.equal(res.body.percentUsed, 40);
    assert.equal(res.body.isExhausted, false);
    assert.ok(res.body.resetAt);
    assert.equal(res.body.features.fitbot_chat.tokensUsed, 12000);

    // Verify raw internal properties are absent
    assert.equal(res.body._id, undefined);
    assert.equal(res.body.__v, undefined);
    assert.equal(res.body.expiresAt, undefined);
  });

  it('admin top-consumers endpoint rejects non-admins with 403 and accepts admins', async () => {
    // 1. Non-admin user
    const nonAdminReq = { user: { _id: new mongoose.Types.ObjectId(), isAdmin: false } };
    const nonAdminRes = createMockRes();
    let called = false;
    requireAdmin(nonAdminReq, nonAdminRes, () => {
      called = true;
    });
    assert.equal(called, false);
    assert.equal(nonAdminRes.statusCode, 403);

    // 2. Admin user
    const adminReq = {
      user: { _id: new mongoose.Types.ObjectId(), isAdmin: true },
      query: { limit: '5' },
    };
    const adminRes = createMockRes();

    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();
    const day = getUtcDay();
    mockStore._map.set(`${u1}:${day}`, { user: u1, day, tokens: 45000, calls: 40 });
    mockStore._map.set(`${u2}:${day}`, { user: u2, day, tokens: 10000, calls: 10 });

    await getTopAiConsumers(adminReq, adminRes);
    assert.equal(adminRes.statusCode, 200);
    assert.equal(Array.isArray(adminRes.body), true);
    assert.equal(adminRes.body.length, 2);
    // Highest consumer first
    assert.equal(adminRes.body[0].tokens, 45000);
  });
});
