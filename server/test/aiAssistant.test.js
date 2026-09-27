const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { chat } = require('../src/controllers/aiAssistant.controller');

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

describe('AI Assistant Controller Payload Validation Tests', () => {
  it('returns 400 when messages array is missing or empty', async () => {
    const req = { body: { messages: [] } };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('messages array is required'));
  });

  it('returns 400 when messages array exceeds MAX_MESSAGES limit', async () => {
    const oversizedMessages = Array.from({ length: 55 }, (_, i) => ({
      role: 'user',
      parts: [{ text: `Hello ${i}` }],
    }));
    const req = { body: { messages: oversizedMessages } };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('Too many messages in history'));
  });

  it('returns 400 when a single message exceeds MAX_SINGLE_MESSAGE_CHARS', async () => {
    const hugeText = 'a'.repeat(9000);
    const req = {
      body: {
        messages: [{ role: 'user', parts: [{ text: hugeText }] }],
      },
    };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('exceeds maximum limit'));
  });

  it('returns 400 when userContext exceeds MAX_USER_CONTEXT_CHARS', async () => {
    const req = {
      body: {
        messages: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        userContext: 'c'.repeat(5000),
      },
    };
    const res = createMockRes();

    await chat(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.includes('userContext exceeds maximum allowed size'));
  });
});
