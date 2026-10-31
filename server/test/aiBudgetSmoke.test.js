const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const {
  setUsageModel,
  getUtcDay,
  BUDGET_EXCEEDED_CODE,
} = require('../src/services/aiBudget.service');
const {
  enforceAiBudget,
} = require('../src/middleware/aiBudget');
const {
  analyzeFoodImage,
  parseVoiceGymSet,
  runFitBotAgentSession,
  setGeminiFitBotMock,
  clearGeminiFitBotMock,
  setGeminiVisionMock,
  clearGeminiVisionMock,
  setGeminiVoiceMock,
  clearGeminiVoiceMock,
} = require('../src/utils/gemini');

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
    once(event, handler) {
      emitter.once(event, handler);
      return this;
    },
  };
  return res;
};

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

describe('Smoke Check: Low Budget Quota Exhaustion & Mock Provider Resilience', () => {
  let envBackup;
  let mockStore;

  beforeEach(() => {
    envBackup = { ...process.env };
    // Set a very low token budget so 2 requests will exhaust it
    process.env.AI_DAILY_TOKEN_BUDGET = '2000';
    process.env.AI_DAILY_CALL_BUDGET = '10';
    mockStore = createMockUsageStore();
    setUsageModel(mockStore);
  });

  afterEach(() => {
    process.env = envBackup;
    setUsageModel(null);
    clearGeminiFitBotMock();
    clearGeminiVisionMock();
    clearGeminiVoiceMock();
  });

  it('runs end-to-end smoke sequence with setGeminiVisionMock, setGeminiVoiceMock, setGeminiFitBotMock', async () => {
    const userId = 'smoke-user-42';
    const day = getUtcDay();

    // ── Step 1: Missing usage response is recorded as estimated ───────
    let visionMockCalls = 0;
    setGeminiVisionMock(async () => {
      visionMockCalls++;
      // Return payload with missing usageMetadata
      return {
        dishTitle: 'Oatmeal with Berries',
        totalCalories: 350,
        totalProtein: 12,
        totalCarbs: 55,
        totalFats: 6,
        overallConfidence: 0.95,
        items: [],
        usageMetadata: null, // missing usage metadata
      };
    });

    const req1 = {
      user: { _id: userId },
      file: { buffer: Buffer.from('fake-image-bytes'), mimetype: 'image/jpeg' },
    };
    const res1 = createMockResponse();
    const mw1 = enforceAiBudget('food_snap');

    let mw1NextCalled = false;
    await mw1(req1, res1, async () => {
      mw1NextCalled = true;
      try {
        const parsed = await analyzeFoodImage(req1.file.buffer, req1.file.mimetype);
        res1.status(200).json({ success: true, parsed });
      } catch (err) {
        res1.status(500).json({ error: err.message });
      }
    });

    await res1.waitForFlush();

    assert.equal(mw1NextCalled, true);
    assert.equal(visionMockCalls, 1);
    assert.equal(res1.statusCode, 200);

    const docAfterReq1 = mockStore.records.get(`${userId}:${day}`);
    assert.ok(docAfterReq1, 'Usage doc must exist after req 1');
    assert.equal(docAfterReq1.calls, 1);
    assert.equal(docAfterReq1.estimatedCalls, 1, 'Must record as estimatedCall');
    assert.equal(docAfterReq1.unknownUsageCalls, 1, 'Must increment unknownUsageCalls');
    assert.ok(docAfterReq1.tokens >= 1500, 'Must charge conservative fallback floor (food_snap >= 1500 tokens)');

    // ── Step 2: Mocked timeout is charged and returns a clean error ────
    let voiceMockCalls = 0;
    setGeminiVoiceMock(async () => {
      voiceMockCalls++;
      const timeoutErr = new Error('Gemini request timed out after 20000ms');
      timeoutErr.name = 'TimeoutError';
      timeoutErr.isTimeout = true;
      timeoutErr.status = 504;
      throw timeoutErr;
    });

    const req2 = {
      user: { _id: userId },
      file: { buffer: Buffer.from('fake-audio-bytes'), mimetype: 'audio/webm' },
    };
    const res2 = createMockResponse();
    const mw2 = enforceAiBudget('voice_set');

    let mw2NextCalled = false;
    await mw2(req2, res2, async () => {
      mw2NextCalled = true;
      try {
        await parseVoiceGymSet({ audioBuffer: req2.file.buffer, mimeType: req2.file.mimetype });
        res2.status(200).json({ success: true });
      } catch (err) {
        res2.status(err.status || 504).json({ error: err.message, isTimeout: err.isTimeout });
      }
    });

    await res2.waitForFlush();

    assert.equal(mw2NextCalled, true);
    assert.equal(voiceMockCalls, 1);
    assert.equal(res2.statusCode, 504, 'Must return clean 504 on timeout');
    assert.equal(res2.body.isTimeout, true);

    const docAfterReq2 = mockStore.records.get(`${userId}:${day}`);
    assert.equal(docAfterReq2.calls, 2);
    assert.equal(docAfterReq2.timeouts, 1, 'Timeouts counter must be incremented');
    // 1500 tokens (req1 floor) + 400 tokens (voice_set floor) = 1900 tokens
    assert.ok(docAfterReq2.tokens >= 1900, 'Timed-out call must be charged the configured floor');

    // Add extra tokens to push past the 2000 token ceiling
    docAfterReq2.tokens = 2100;
    mockStore.records.set(`${userId}:${day}`, docAfterReq2);

    // ── Step 3: Nth request returns 429 AI_DAILY_BUDGET_EXCEEDED with provider NOT called ──
    let fitBotMockCalls = 0;
    setGeminiFitBotMock(async () => {
      fitBotMockCalls++;
      return { reply: 'Should never be called' };
    });

    const req3 = {
      user: { _id: userId },
      body: { messages: [{ role: 'user', content: 'Exhausted budget test' }] },
    };
    const res3 = createMockResponse();
    const mw3 = enforceAiBudget('fitbot_chat');

    let mw3NextCalled = false;
    await mw3(req3, res3, async () => {
      mw3NextCalled = true;
      await runFitBotAgentSession({ messages: req3.body.messages, user: req3.user });
      res3.status(200).json({ ok: true });
    });

    await res3.waitForFlush();

    assert.equal(mw3NextCalled, false, 'Route handler / next() must NOT be invoked');
    assert.equal(fitBotMockCalls, 0, 'Upstream Gemini provider mock must NOT be called');
    assert.equal(res3.statusCode, 429, 'Must return HTTP 429');
    assert.equal(res3.body.error.code, BUDGET_EXCEEDED_CODE, 'Code must be AI_DAILY_BUDGET_EXCEEDED');
    assert.equal(res3.headers['x-ai-budget-remaining-tokens'], '0');
    assert.ok(Number(res3.headers['retry-after']) > 0, 'Retry-After header must be present');
  });
});
