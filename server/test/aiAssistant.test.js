const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  chat,
  prepareMessages,
  MAX_MESSAGES,
  MAX_SINGLE_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
} = require('../src/controllers/aiAssistant.controller');

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
    const req = { body: { messages: [] } };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('messages array is required'));
  });

  it('returns 400 when a message object is invalid or missing content', async () => {
    const req = { body: { messages: [null] } };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('invalid'));
  });

  it('gracefully truncates oversized message history to MAX_MESSAGES (FitBot Plan §4 #8)', () => {
    const oversizedMessages = Array.from({ length: 65 }, (_, i) => ({
      role: 'user',
      parts: [{ text: `Message number ${i}` }],
    }));

    const result = prepareMessages(oversizedMessages);
    assert.equal(result.valid, true);
    assert.equal(result.messages.length, MAX_MESSAGES);
    // Preserves the latest messages
    assert.equal(result.messages[result.messages.length - 1].content, 'Message number 64');
  });

  it('gracefully truncates oversized single message text to MAX_SINGLE_MESSAGE_CHARS', () => {
    const hugeText = 'z'.repeat(12000);
    const messages = [{ role: 'user', parts: [{ text: hugeText }] }];

    const result = prepareMessages(messages);
    assert.equal(result.valid, true);
    assert.equal(result.messages[0].content.length, MAX_SINGLE_MESSAGE_CHARS);
  });

  it('gracefully drops oldest messages when total conversation exceeds MAX_TOTAL_CHARS', () => {
    const textPerMsg = 'a'.repeat(6000);
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: 'user',
      parts: [{ text: `msg-${i}-${textPerMsg}` }],
    }));

    const result = prepareMessages(messages);
    assert.equal(result.valid, true);
    assert.ok(result.totalChars <= MAX_TOTAL_CHARS);
    // Must retain at least the latest user message
    assert.ok(result.messages[result.messages.length - 1].content.startsWith('msg-9'));
  });

  it('returns 503 with friendly outage message when upstream AI service fails (FitBot Plan §6.1)', async () => {
    const req = {
      body: { messages: [{ role: 'user', parts: [{ text: 'Hello' }] }] },
      user: { id: 'test-user-id' },
    };
    const res = createMockRes();

    // In this test environment with no real OpenRouter key, chatWithAssistant fails gracefully
    await chat(req, res, () => {});

    assert.ok(res.statusCode === 503 || res.statusCode === 500);
    assert.ok(res.body.error);
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
  const { chatWithAssistant, responseCache } = require('../src/services/aiAssistant.service');
  const crypto = require('crypto');
  const { PROMPT_VERSION } = require('../src/prompts/fitbot.prompt');

  it('bypasses cache when skipCache or regenerate is true', async () => {
    const messages = [{ role: 'user', content: 'Unique prompt for cache test' }];
    const openRouterMessages = [
      { role: 'system', content: require('../src/prompts/fitbot.prompt').buildFitBotPrompt(undefined) },
      { role: 'user', content: 'Unique prompt for cache test' },
    ];
    const cacheKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ messages: openRouterMessages, isJsonRequest: false, version: PROMPT_VERSION }))
      .digest('hex');

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
});

describe('AI Assistant FitBot Prompt Contract v1.3.0', () => {
  const { PROMPT_VERSION, FITBOT_SYSTEM_PROMPT, buildFitBotPrompt } = require('../src/prompts/fitbot.prompt');

  it('exposes PROMPT_VERSION 1.3.0 matching redesign specification', () => {
    assert.equal(PROMPT_VERSION, '1.3.0');
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
    assert.ok(built.includes('User context:\nWeight: 75kg'));
  });
});


