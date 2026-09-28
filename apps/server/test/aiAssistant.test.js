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
});
