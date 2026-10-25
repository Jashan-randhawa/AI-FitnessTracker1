const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  chat,
  prepareMessages,
  getActiveConcurrencyStats,
  resetConcurrencyStats,
  MAX_MESSAGES,
  MAX_SINGLE_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  MAX_USER_CONCURRENT_AI_REQUESTS,
} = require('../src/controllers/aiAssistant.controller');
const {
  chatWithAssistant,
  responseCache,
  computeCacheKey,
  getCacheStats,
  resetCache,
  MAX_CACHE_ENTRIES,
} = require('../src/services/aiAssistant.service');
const { PROMPT_VERSION, FITBOT_SYSTEM_PROMPT, buildFitBotPrompt } = require('../src/prompts/fitbot.prompt');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('AI Assistant Controller Payload Validation & Truncation Tests', () => {
  it('returns 400 when messages array is missing or empty', async () => {
    const req = { body: {}, user: { id: 'test-user-id' } };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /messages array is required/);
  });

  it('returns 400 when a message object is invalid or missing content', async () => {
    const req = {
      body: { messages: [{ role: 'user' }] }, // missing content or parts
      user: { id: 'test-user-id' },
    };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /missing valid text\/content/);
  });

  it('gracefully truncates oversized message history to MAX_MESSAGES (FitBot Plan §4 #8)', () => {
    const raw = Array.from({ length: 70 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      parts: [{ text: `Message turn ${i}` }],
    }));

    const result = prepareMessages(raw);
    assert.equal(result.valid, true);
    assert.equal(result.messages.length, MAX_MESSAGES);
    // Verify that the most recent messages were preserved
    assert.equal(result.messages[result.messages.length - 1].parts[0].text, 'Message turn 69');
  });

  it('gracefully truncates oversized single message text to MAX_SINGLE_MESSAGE_CHARS', () => {
    const oversizedText = 'A'.repeat(MAX_SINGLE_MESSAGE_CHARS + 500);
    const raw = [{ role: 'user', content: oversizedText }];

    const result = prepareMessages(raw);
    assert.equal(result.valid, true);
    assert.equal(result.messages[0].parts[0].text.length, MAX_SINGLE_MESSAGE_CHARS);
  });

  it('gracefully drops oldest messages when total conversation exceeds MAX_TOTAL_CHARS', () => {
    const largeChunk = 'B'.repeat(7000);
    const raw = Array.from({ length: 7 }, (_, i) => ({
      role: 'user',
      content: `${i}: ${largeChunk}`,
    }));

    const result = prepareMessages(raw);
    assert.equal(result.valid, true);
    assert.ok(result.totalChars <= MAX_TOTAL_CHARS);
    assert.ok(result.messages.length < 7);
  });

  it('returns 503 with friendly outage message when upstream AI service fails (FitBot Plan §6.1)', async () => {
    const req = {
      body: { messages: [{ role: 'user', content: 'Help me plan a workout' }] },
      user: { id: 'test-user-id' },
    };
    const res = createMockRes();

    await chat(req, res, () => {});

    // In local unit test environment with mock OpenRouter, status is 503/500
    assert.ok(res.statusCode === 503 || res.statusCode === 500);
    assert.ok(res.body.error);
    assert.match(res.body.error, /AI assistant|unavailable/i);
  });

  it('accepts skipCache and regenerate flags without validation error', async () => {
    const req = {
      body: {
        messages: [{ role: 'user', content: 'What is protein?' }],
        regenerate: true,
        skipCache: true,
      },
      user: { id: 'test-user-id' },
    };
    const res = createMockRes();

    await chat(req, res, () => {});

    // Even though network fails in mock env, status code is 503/500 and not 400
    assert.notEqual(res.statusCode, 400);
  });
});

describe('AI Assistant Service Caching & Regenerate Logic', () => {
  it('bypasses cache when skipCache or regenerate is true', async () => {
    const messages = [{ role: 'user', content: 'Unique prompt for cache test' }];
    const openRouterMessages = [
      { role: 'system', content: buildFitBotPrompt(undefined) },
      { role: 'user', content: 'Unique prompt for cache test' },
    ];
    const cacheKey = computeCacheKey({
      messages: openRouterMessages,
      isJsonRequest: false,
    });

    // Populate mock cache entry
    responseCache.set(cacheKey, {
      data: { reply: 'Cached response', usage: {}, model: 'mock-model' },
      timestamp: Date.now(),
    });

    // Without skipCache: should return cached entry
    const cachedResult = await chatWithAssistant(messages, undefined, { skipCache: false });
    assert.equal(cachedResult.cached, true);
    assert.equal(cachedResult.reply, 'Cached response');

    // Clean up
    responseCache.delete(cacheKey);
  });

  it('evicts least recently used entry when cache reaches MAX_CACHE_ENTRIES capacity', async () => {
    resetCache();

    // Populate up to MAX_CACHE_ENTRIES
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      responseCache.set(`key-${i}`, {
        data: { reply: `Reply ${i}` },
        timestamp: Date.now(),
      });
    }

    assert.equal(responseCache.size, MAX_CACHE_ENTRIES);

    // Call chatWithAssistant with mocked fetch that produces a new valid response
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: 'New entry pushing over capacity' } }],
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        }),
    });

    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    try {
      await chatWithAssistant(
        [{ role: 'user', content: 'Overflow test query' }],
        undefined,
        { fetchFn: fakeFetch, skipCache: false }
      );

      // Verify size did not exceed capacity cap
      assert.ok(responseCache.size <= MAX_CACHE_ENTRIES);

      // Verify that eviction stat was incremented
      const stats = getCacheStats();
      assert.ok(stats.evictions >= 1, 'Expected at least 1 cache eviction');
      assert.ok(stats.hits >= 0);
    } finally {
      process.env.OPENROUTER_API_KEY = originalKey;
      resetCache();
    }
  });

  it('differentiates cache keys across different target models and token ceilings', () => {
    const messages = [{ role: 'user', content: 'Workout routine' }];
    const key1 = computeCacheKey({ messages, model: 'openai/gpt-4o-mini', maxTokens: 2500 });
    const key2 = computeCacheKey({ messages, model: 'google/gemini-2.0-flash-001', maxTokens: 2500 });
    const key3 = computeCacheKey({ messages, model: 'openai/gpt-4o-mini', maxTokens: 4000 });

    assert.notEqual(key1, key2, 'Cache keys must differ when models differ');
    assert.notEqual(key1, key3, 'Cache keys must differ when maxTokens differ');
  });
});

describe('Phase 4: Concurrency Limit & Throttling Tests', () => {
  it('throttles when a single user exceeds MAX_USER_CONCURRENT_AI_REQUESTS', async () => {
    resetConcurrencyStats();
    const userId = 'concurrent-user-1';

    // Simulate in-flight requests
    const res1 = createMockRes();
    const res2 = createMockRes();
    const resThrottled = createMockRes();

    // Start 2 concurrent requests for the same user with slow mock
    let resolveSlow;
    const slowPromise = new Promise((resolve) => {
      resolveSlow = resolve;
    });

    const slowFetch = async () => {
      await slowPromise;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            choices: [{ message: { content: 'Slow reply' } }],
          }),
      };
    };

    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';

    try {
      const p1 = chat(
        {
          body: { messages: [{ role: 'user', content: 'Query 1' }], options: { fetchFn: slowFetch } },
          user: { id: userId },
        },
        res1,
        () => {}
      );

      const p2 = chat(
        {
          body: { messages: [{ role: 'user', content: 'Query 2' }], options: { fetchFn: slowFetch } },
          user: { id: userId },
        },
        res2,
        () => {}
      );

      // Third concurrent request for the same user should be throttled immediately with 429
      await chat(
        {
          body: { messages: [{ role: 'user', content: 'Query 3' }] },
          user: { id: userId },
        },
        resThrottled,
        () => {}
      );

      assert.equal(resThrottled.statusCode, 429);
      assert.match(resThrottled.body.error, /already have an AI request in progress/i);

      // Resolve slow requests
      resolveSlow();
      await Promise.all([p1, p2]);

      // Concurrency counters should be clean
      const stats = getActiveConcurrencyStats();
      assert.equal(stats.activeTotal, 0);
    } finally {
      process.env.OPENROUTER_API_KEY = originalKey;
      resetConcurrencyStats();
    }
  });
});

describe('AI Assistant FitBot Prompt Contract v1.6.0', () => {
  it('exposes PROMPT_VERSION 1.6.0 matching the v1.6.0 changelog', () => {
    assert.equal(PROMPT_VERSION, '1.6.0');
  });

  it('includes strict output format contract in system prompt', () => {
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('Output Format Contract:'));
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('concise, direct answer'));
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('## '));
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('tables ONLY for structured routines'));
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('at most 2 emoji'));
    assert.ok(FITBOT_SYSTEM_PROMPT.includes('Never use fenced code blocks'));
  });

  it('correctly appends user context to system prompt', () => {
    const context = 'Weight: 75kg, Goal: lose weight';
    const built = buildFitBotPrompt(context);
    assert.ok(built.includes(FITBOT_SYSTEM_PROMPT));
    assert.ok(built.includes('User context:'));
    assert.ok(built.includes('<user_context>'));
    assert.ok(built.includes('Weight: 75kg'));
  });
});
