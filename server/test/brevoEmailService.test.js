const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sendPasswordResetEmail, getSenderFromEnv } = require('../src/services/email.service');
const FailedEmail = require('../src/models/FailedEmail');

/**
 * Standardized mock response helper for fetch tests
 */
const createMockFetchResponse = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers(headers),
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
});

describe('Phase 1: Brevo-Only Email Adapter Specification Tests', () => {
  it('sends correct payload shape: sender, to, htmlContent, textContent, tags, and api-key header', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    const originalFrom = process.env.EMAIL_FROM;

    process.env.BREVO_API_KEY = 'test-brevo-key-123';
    process.env.EMAIL_FROM = '"AI Fitness Tracker" <jashanpreetsinghrandhawa65@gmail.com>';

    let capturedUrl = null;
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return createMockFetchResponse(201, { messageId: 'msg-test-payload-123' });
    };

    try {
      const res = await sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(capturedOptions.method, 'POST');
      assert.equal(capturedOptions.headers['api-key'], 'test-brevo-key-123');
      assert.equal(capturedOptions.headers['Content-Type'], 'application/json');

      const body = JSON.parse(capturedOptions.body);
      assert.deepEqual(body.sender, {
        name: 'AI Fitness Tracker',
        email: 'jashanpreetsinghrandhawa65@gmail.com',
      });
      assert.deepEqual(body.to, [{ email: 'user@example.com' }]);
      assert.ok(body.htmlContent && body.htmlContent.includes('token123'));
      assert.ok(body.textContent && body.textContent.includes('token123'));
      assert.deepEqual(body.tags, ['password-reset']);

      assert.equal(res.sent, true);
      assert.equal(res.provider, 'brevo');
      assert.equal(res.messageId, 'msg-test-payload-123');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
      process.env.EMAIL_FROM = originalFrom;
    }
  });

  it('aborts immediately without retrying on 401 Unauthorized or 403 Forbidden', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    const originalFailedEmailCreate = FailedEmail.create;
    process.env.BREVO_API_KEY = 'invalid-key';
    FailedEmail.create = async () => ({});

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return createMockFetchResponse(401, { message: 'Key not found' });
    };

    try {
      const res = await sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, false);
      assert.equal(res.reason, 'brevo_401');
      assert.equal(callCount, 1); // No retries for 401
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
      FailedEmail.create = originalFailedEmailCreate;
    }
  });

  it('retries on 429 Rate Limit and respects Retry-After header', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-key';

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return createMockFetchResponse(429, { message: 'Too many requests' }, { 'retry-after': '1' });
      }
      return createMockFetchResponse(201, { messageId: 'msg-recovered-429' });
    };

    try {
      const res = await sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, true);
      assert.equal(res.attempts, 2);
      assert.equal(res.messageId, 'msg-recovered-429');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
    }
  });

  it('retries on 500 server error and records FailedEmail when exhausted', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-key';

    let recordedFailed = null;
    const originalCreate = FailedEmail.create;
    FailedEmail.create = async (doc) => {
      recordedFailed = doc;
      return doc;
    };

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return createMockFetchResponse(500, 'Internal Server Error');
    };

    try {
      const res = await sendPasswordResetEmail({
        to: 'exhausted@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, false);
      assert.equal(res.reason, 'brevo_500');
      assert.equal(callCount, 3); // Max retries
      assert.ok(recordedFailed);
      assert.equal(recordedFailed.to, 'exhausted@example.com');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
      FailedEmail.create = originalCreate;
    }
  });

  it('aborts on timeout and marks failure as brevo_timeout', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-key';

    globalThis.fetch = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };

    try {
      const res = await sendPasswordResetEmail({
        to: 'timeout@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, false);
      assert.equal(res.reason, 'brevo_timeout');
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
    }
  });

  it('fails with not_configured in production when BREVO_API_KEY is missing', async () => {
    const originalKey = process.env.BREVO_API_KEY;
    const originalEnv = process.env.NODE_ENV;
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = 'production';

    try {
      const res = await sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, false);
      assert.equal(res.reason, 'not_configured');
    } finally {
      process.env.BREVO_API_KEY = originalKey;
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('fails with not_configured when NODE_ENV is unset and BREVO_API_KEY is missing (preventing silent dev fallback)', async () => {
    const originalKey = process.env.BREVO_API_KEY;
    const originalEnv = process.env.NODE_ENV;
    delete process.env.BREVO_API_KEY;
    delete process.env.NODE_ENV;

    try {
      const res = await sendPasswordResetEmail({
        to: 'user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, false);
      assert.equal(res.reason, 'not_configured');
    } finally {
      process.env.BREVO_API_KEY = originalKey;
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('returns provider dev-log only in explicit development mode without key', async () => {
    const originalKey = process.env.BREVO_API_KEY;
    const originalEnv = process.env.NODE_ENV;
    delete process.env.BREVO_API_KEY;
    process.env.NODE_ENV = 'development';

    try {
      const res = await sendPasswordResetEmail({
        to: 'dev@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'token123',
      });

      assert.equal(res.sent, true);
      assert.equal(res.provider, 'dev-log');
    } finally {
      process.env.BREVO_API_KEY = originalKey;
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('lockout check does not prematurely lock out an IP during normal request flow (gap 9)', async () => {
    const { checkLockout, clearFailedAttempts } = require('../src/services/passwordReset.service');
    clearFailedAttempts('192.168.1.100');

    // Perform 3 sequential read checks (e.g. request, validate, reset in a normal flow)
    const check1 = await checkLockout('192.168.1.100');
    const check2 = await checkLockout('192.168.1.100');
    const check3 = await checkLockout('192.168.1.100');

    assert.equal(check1.locked, false);
    assert.equal(check2.locked, false);
    assert.equal(check3.locked, false);
    clearFailedAttempts('192.168.1.100');
  });
});

describe('Phase 3: Password Reset Service Integration Tests', () => {
  const {
    requestPasswordReset,
    getLastDispatchPromise,
  } = require('../src/services/passwordReset.service');
  const User = require('../src/models/User');

  it('D2: skips email dispatch and token saving for previously bounced recipients', async () => {
    let saved = false;
    const bouncedUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'bounced@example.com',
      emailBounced: true,
      save: async () => {
        saved = true;
      },
    };

    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(bouncedUser);

    try {
      const result = await requestPasswordReset('bounced@example.com', { ip: '127.0.0.1' });
      assert.equal(result.success, true);
      assert.equal(result.type, 'sent');
      assert.equal(saved, false, 'Should not save token for bounced user');
      assert.equal(bouncedUser.resetPasswordTokenHash, undefined);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('D3 & Gap 1: requestPasswordReset returns immediately without waiting for Brevo dispatch (timing oracle elimination)', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-brevo-key';

    // Mock fetch that simulates a 300ms network delay
    globalThis.fetch = async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return createMockFetchResponse(201, { messageId: 'msg-async-timing' });
    };

    let saved = false;
    const testUser = {
      _id: '507f1f77bcf86cd799439022',
      email: 'fast-response@example.com',
      emailBounced: false,
      save: async () => {
        saved = true;
      },
    };

    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(testUser);

    try {
      const startTime = Date.now();
      const result = await requestPasswordReset('fast-response@example.com', { ip: '127.0.0.1' });
      const elapsed = Date.now() - startTime;

      assert.equal(result.success, true);
      assert.equal(result.type, 'sent');
      assert.equal(saved, true);
      // Response returned immediately (<100ms), far faster than the 300ms fetch delay
      assert.ok(elapsed < 150, `Expected elapsed < 150ms, got ${elapsed}ms`);

      // Await background dispatch to complete cleanly
      const backgroundPromise = getLastDispatchPromise();
      assert.ok(backgroundPromise, 'Background dispatch promise should be tracked');
      await backgroundPromise;
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
      User.findOne = originalFindOne;
    }
  });

  it('Gap 8: clears resetPasswordTokenHash and resetPasswordExpires if email delivery permanently fails', async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.BREVO_API_KEY;
    const originalFailedEmailCreate = FailedEmail.create;
    process.env.BREVO_API_KEY = 'test-brevo-key';
    FailedEmail.create = async () => ({});

    // Permanent 400 error
    globalThis.fetch = async () => createMockFetchResponse(400, { message: 'Invalid recipient' });

    let updatedFilter = null;
    let updatedUpdate = null;
    const originalUpdateOne = User.updateOne;
    User.updateOne = async (filter, update) => {
      updatedFilter = filter;
      updatedUpdate = update;
      return { acknowledged: true, modifiedCount: 1 };
    };

    const testUser = {
      _id: '507f1f77bcf86cd799439033',
      email: 'fail-recipient@example.com',
      emailBounced: false,
      save: async () => {},
    };

    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(testUser);

    try {
      const result = await requestPasswordReset('fail-recipient@example.com', { ip: '127.0.0.1' });
      assert.equal(result.success, true);

      // Wait for background dispatch to finish
      const backgroundPromise = getLastDispatchPromise();
      await backgroundPromise;

      assert.deepEqual(updatedFilter, { _id: '507f1f77bcf86cd799439033' });
      assert.deepEqual(updatedUpdate, {
        $unset: { resetPasswordTokenHash: 1, resetPasswordExpires: 1 },
      });
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalKey;
      User.findOne = originalFindOne;
      User.updateOne = originalUpdateOne;
      FailedEmail.create = originalFailedEmailCreate;
    }
  });
});

describe('Phase 5: Webhook Hardening & Security Tests', () => {
  const brevoWebhookAuth = require('../src/middleware/brevoWebhookAuth');
  const { handleBrevoWebhook } = require('../src/controllers/emailWebhook.controller');
  const EmailEvent = require('../src/models/EmailEvent');
  const mongoose = require('mongoose');

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

  it('rejects webhook requests when BREVO_WEBHOOK_KEY is set and auth is missing or invalid', () => {
    const originalKey = process.env.BREVO_WEBHOOK_KEY;
    process.env.BREVO_WEBHOOK_KEY = 'secret-webhook-key-123';

    try {
      // 1. Missing header
      const req1 = { headers: {}, query: {} };
      const res1 = createMockRes();
      let nextCalled1 = false;
      brevoWebhookAuth(req1, res1, () => { nextCalled1 = true; });

      assert.equal(res1.statusCode, 401);
      assert.equal(nextCalled1, false);

      // 2. Wrong key in header
      const req2 = { headers: { 'x-sib-webhook-key': 'wrong-key' }, query: {} };
      const res2 = createMockRes();
      let nextCalled2 = false;
      brevoWebhookAuth(req2, res2, () => { nextCalled2 = true; });

      assert.equal(res2.statusCode, 401);
      assert.equal(nextCalled2, false);
    } finally {
      process.env.BREVO_WEBHOOK_KEY = originalKey;
    }
  });

  it('accepts webhook requests with valid X-Sib-Webhook-Key or Bearer token', () => {
    const originalKey = process.env.BREVO_WEBHOOK_KEY;
    process.env.BREVO_WEBHOOK_KEY = 'secret-webhook-key-123';

    try {
      // 1. Valid custom header
      const req1 = { headers: { 'x-sib-webhook-key': 'secret-webhook-key-123' }, query: {} };
      const res1 = createMockRes();
      let nextCalled1 = false;
      brevoWebhookAuth(req1, res1, () => { nextCalled1 = true; });

      assert.equal(res1.statusCode, 200);
      assert.equal(nextCalled1, true);

      // 2. Valid Authorization: Bearer token
      const req2 = { headers: { authorization: 'Bearer secret-webhook-key-123' }, query: {} };
      const res2 = createMockRes();
      let nextCalled2 = false;
      brevoWebhookAuth(req2, res2, () => { nextCalled2 = true; });

      assert.equal(res2.statusCode, 200);
      assert.equal(nextCalled2, true);
    } finally {
      process.env.BREVO_WEBHOOK_KEY = originalKey;
    }
  });

  it('fails-closed with 503 in production if BREVO_WEBHOOK_KEY is not configured', () => {
    const originalKey = process.env.BREVO_WEBHOOK_KEY;
    const originalEnv = process.env.NODE_ENV;
    delete process.env.BREVO_WEBHOOK_KEY;
    process.env.NODE_ENV = 'production';

    try {
      const req = { headers: {}, query: {} };
      const res = createMockRes();
      let nextCalled = false;
      brevoWebhookAuth(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 503);
      assert.equal(nextCalled, false);
      assert.ok(res.body.error.message.includes('BREVO_WEBHOOK_KEY'));
    } finally {
      process.env.BREVO_WEBHOOK_KEY = originalKey;
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('handles deduplication by ignoring duplicate webhook events (MongoDB code 11000)', async () => {
    const originalCreate = EmailEvent.create;
    const originalReadyState = mongoose.connection.readyState;
    mongoose.connection.readyState = 1;

    let createCallCount = 0;
    EmailEvent.create = async () => {
      createCallCount++;
      if (createCallCount === 2) {
        const err = new Error('E11000 duplicate key error');
        err.code = 11000;
        throw err;
      }
      return { _id: 'event-1' };
    };

    const req = {
      body: [
        {
          event: 'delivered',
          email: 'dup@example.com',
          messageId: 'msg-dup-1',
          date: '2026-10-01T12:00:00Z',
        },
        {
          event: 'delivered',
          email: 'dup@example.com',
          messageId: 'msg-dup-1',
          date: '2026-10-01T12:00:00Z',
        },
      ],
      ip: '127.0.0.1',
    };
    const res = createMockRes();

    try {
      await handleBrevoWebhook(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'received');
      // First one processed, second one ignored due to code 11000 duplicate key
      assert.equal(res.body.count, 1);
      assert.equal(createCallCount, 2);
    } finally {
      EmailEvent.create = originalCreate;
      mongoose.connection.readyState = originalReadyState;
    }
  });
});


