const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const {
  request: requestResetController,
  validate: validateResetController,
  reset: resetPasswordController,
} = require('../src/controllers/passwordReset.controller');

const {
  checkRateLimit,
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  resetPassword,
} = require('../src/services/passwordReset.service');

const { verifyCsrfAndOrigin } = require('../src/middleware/csrfProtection');
const { maskEmail, recordSecurityEvent } = require('../src/utils/auditLogger');
const User = require('../src/models/User');

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

describe('Password Reset Controller Tests', () => {
  it('returns 400 if email is missing or non-string', async () => {
    const req = { body: {}, headers: {} };
    const res = createMockRes();

    await requestResetController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Email is required'));
  });

  it('returns 400 if email format is invalid', async () => {
    const req = { body: { email: 'not-an-email' }, headers: {} };
    const res = createMockRes();

    await requestResetController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Invalid email format'));
  });

  it('returns 400 if reset code is missing in validate', async () => {
    const req = { query: {}, headers: {} };
    const res = createMockRes();

    await validateResetController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.valid, false);
    assert.ok(res.body.message.includes('Reset code is required'));
  });

  it('returns 400 if code or newPassword is missing in reset', async () => {
    const req = { body: { code: 'some-code' }, headers: {} };
    const res = createMockRes();

    await resetPasswordController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Reset code and new password are required'));
  });
});

describe('CSRF & Origin Protection Middleware Tests', () => {
  it('allows safe HTTP methods (GET, OPTIONS) unconditionally', () => {
    const req = { method: 'GET', headers: {} };
    const res = createMockRes();
    let nextCalled = false;

    verifyCsrfAndOrigin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  it('blocks POST requests without application/json Content-Type', () => {
    const req = {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'http://localhost:5173',
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyCsrfAndOrigin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 415);
    assert.ok(res.body.error.message.includes('application/json'));
  });

  it('blocks POST requests from unauthorized Origin', () => {
    const req = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://malicious-site.com',
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyCsrfAndOrigin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.ok(res.body.error.message.includes('Cross-origin request blocked'));
  });

  it('allows POST requests with authorized Origin', () => {
    const req = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:5173',
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    verifyCsrfAndOrigin(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});

describe('Security Audit & Email Masking Tests', () => {
  it('properly masks email for security logs', () => {
    assert.equal(maskEmail('jashan@example.com'), 'j****n@example.com');
    assert.equal(maskEmail('ab@example.com'), 'a*@example.com');
    assert.equal(maskEmail(''), 'anonymous');
    assert.equal(maskEmail('invalid-email'), '[REDACTED_EMAIL]');
  });

  it('records security events without throwing', async () => {
    await recordSecurityEvent({
      event: 'TEST_EVENT',
      email: 'test@example.com',
      ip: '127.0.0.1',
      status: 'success',
    });
    assert.ok(true);
  });
});

describe('Password Reuse Prevention & History Tests', () => {
  it('rejects password when new password is identical to current password', async () => {
    const currentHash = await bcrypt.hash('CurrentP@ss1', 10);
    const token = 'valid-test-token-123';
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const fakeUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      password: currentHash,
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 60000),
      passwordHistory: [],
      save: async () => {},
    };

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    try {
      const result = await resetPassword(token, 'CurrentP@ss1');
      assert.equal(result.success, false);
      assert.ok(result.message.includes('cannot reuse your current password'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('rejects password when new password exists in passwordHistory', async () => {
    const oldHash = await bcrypt.hash('HistoricalP@ss1', 10);
    const currentHash = await bcrypt.hash('DifferentCurrentP@ss2', 10);
    const token = 'valid-test-token-456';
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const fakeUser = {
      _id: '507f1f77bcf86cd799439012',
      email: 'test@example.com',
      password: currentHash,
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 60000),
      passwordHistory: [{ hash: oldHash, changedAt: new Date() }],
      save: async () => {},
    };

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    try {
      const result = await resetPassword(token, 'HistoricalP@ss1');
      assert.equal(result.success, false);
      assert.ok(result.message.includes('cannot reuse a recent password'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('accepts brand new password and saves old password to history', async () => {
    const currentHash = await bcrypt.hash('OldCurrentP@ss1', 10);
    const token = 'valid-test-token-789';
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    let saved = false;
    const fakeUser = {
      _id: '507f1f77bcf86cd799439013',
      email: 'test@example.com',
      password: currentHash,
      resetPasswordTokenHash: hashedToken,
      resetPasswordExpires: new Date(Date.now() + 60000),
      passwordHistory: [],
      save: async () => {
        saved = true;
      },
    };

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    try {
      const result = await resetPassword(token, 'BrandNewSecureP@ss99');
      assert.equal(result.success, true);
      assert.equal(saved, true);
      assert.equal(fakeUser.passwordHistory.length, 1);
      assert.equal(fakeUser.passwordHistory[0].hash, currentHash);
      assert.equal(fakeUser.resetPasswordTokenHash, undefined);
    } finally {
      User.findOne = originalFindOne;
    }
  });
});

describe('Lockout & Brute-Force Protection Tests', () => {
  const testIp = '192.168.1.99';

  beforeEach(() => {
    clearFailedAttempts(testIp);
  });

  it('triggers lockout after reaching maximum failed attempts', async () => {
    let lockout = await checkLockout(testIp);
    assert.equal(lockout.locked, false);

    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(testIp);
    }

    lockout = await checkLockout(testIp);
    assert.equal(lockout.locked, true);
    assert.ok(lockout.retryAfter > 0);
  });

  it('clears lockout on clearFailedAttempts', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(testIp);
    }
    clearFailedAttempts(testIp);

    const lockout = await checkLockout(testIp);
    assert.equal(lockout.locked, false);
  });
});

describe('Email Delivery, Templates & Webhook Tests', () => {
  const { buildResetHtml, sendPasswordResetEmail } = require('../src/services/email.service');
  const { handleBrevoWebhook } = require('../src/controllers/emailWebhook.controller');

  it('buildResetHtml includes preheader, link, and security notice', () => {
    const link = 'https://ai-fitness-tracker1.vercel.app/reset-password?code=abc123token';
    const html = buildResetHtml(link);

    assert.ok(html.includes('Reset your AI Fitness Tracker password'));
    assert.ok(html.includes(link));
    assert.ok(html.includes('Security reminder:'));
    assert.ok(html.includes('Valid for 10 minutes only'));
  });

  it('sendPasswordResetEmail handles development mode without API key', async () => {
    const originalApiKey = process.env.BREVO_API_KEY;
    delete process.env.BREVO_API_KEY;

    try {
      const result = await sendPasswordResetEmail({
        to: 'devuser@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'testtoken',
      });
      assert.equal(result.sent, true);
    } finally {
      process.env.BREVO_API_KEY = originalApiKey;
    }
  });

  it('handleBrevoWebhook parses delivery events and updates bounced users', async () => {
    let updatedEmail = null;
    let bouncedFlag = false;

    const originalFindOneAndUpdate = User.findOneAndUpdate;
    User.findOneAndUpdate = (query, update) => {
      updatedEmail = query.email;
      bouncedFlag = update.emailBounced;
      return Promise.resolve({ email: query.email });
    };

    const req = {
      body: [
        {
          event: 'delivered',
          email: 'happy@example.com',
          messageId: 'msg-1',
        },
        {
          event: 'hard_bounce',
          email: 'bounced@example.com',
          messageId: 'msg-2',
          reason: 'Mailbox does not exist',
        },
      ],
      ip: '127.0.0.1',
    };

    const res = createMockRes();

    try {
      await handleBrevoWebhook(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.count, 2);
      assert.equal(updatedEmail, 'bounced@example.com');
      assert.equal(bouncedFlag, true);
    } finally {
      User.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });
});

describe('Password Reset Service Layer Logic Tests', () => {
  const {
    requestPasswordReset,
    validateResetToken,
    clearFailedAttempts,
  } = require('../src/services/passwordReset.service');

  beforeEach(() => {
    clearFailedAttempts('127.0.0.1');
  });

  it('requestPasswordReset returns uniform success when user is not found (anti-enumeration)', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(null);

    try {
      const result = await requestPasswordReset('unknown-user@example.com', { ip: '127.0.0.1' });
      assert.equal(result.success, true);
      assert.equal(result.type, 'sent');
      assert.ok(result.message.includes('If an account exists'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('requestPasswordReset returns google type for OAuth accounts without generating reset token', async () => {
    const originalFindOne = User.findOne;
    const fakeOAuthUser = {
      _id: '507f1f77bcf86cd799439099',
      email: 'oauthuser@example.com',
      provider: 'google',
    };
    User.findOne = () => Promise.resolve(fakeOAuthUser);

    try {
      const result = await requestPasswordReset('oauthuser@example.com', { ip: '127.0.0.1' });
      assert.equal(result.success, false);
      assert.equal(result.type, 'google');
      assert.ok(result.message.includes('registered with Google Sign-In'));
      assert.equal(fakeOAuthUser.resetPasswordTokenHash, undefined);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('requestPasswordReset generates secure token and dispatches email for local user', async () => {
    let saved = false;
    const fakeLocalUser = {
      _id: '507f1f77bcf86cd799439088',
      email: 'localuser@example.com',
      provider: 'local',
      save: async () => {
        saved = true;
      },
    };

    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(fakeLocalUser);

    try {
      const result = await requestPasswordReset('localuser@example.com', { ip: '127.0.0.1' });
      assert.equal(result.success, true);
      assert.equal(result.type, 'sent');
      assert.equal(saved, true);
      assert.ok(fakeLocalUser.resetPasswordTokenHash);
      assert.ok(fakeLocalUser.resetPasswordExpires);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('validateResetToken returns false when token does not exist', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(null),
    });

    try {
      const result = await validateResetToken('nonexistent-token', { ip: '127.0.0.1' });
      assert.equal(result.valid, false);
      assert.ok(result.message.includes('Invalid or expired'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('validateResetToken returns false when token is expired', async () => {
    const token = 'expired-test-token-123';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const fakeUser = {
      _id: '507f1f77bcf86cd799439077',
      email: 'expired@example.com',
      resetPasswordTokenHash: hashed,
      resetPasswordExpires: new Date(Date.now() - 60000), // 1 min in the past
    };

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    try {
      const result = await validateResetToken(token, { ip: '127.0.0.1' });
      assert.equal(result.valid, false);
      assert.ok(result.message.includes('expired'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('validateResetToken returns true for valid non-expired token', async () => {
    const token = 'valid-active-token-999';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const fakeUser = {
      _id: '507f1f77bcf86cd799439066',
      email: 'active@example.com',
      resetPasswordTokenHash: hashed,
      resetPasswordExpires: new Date(Date.now() + 300000), // 5 min in the future
    };

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    try {
      const result = await validateResetToken(token, { ip: '127.0.0.1' });
      assert.equal(result.valid, true);
      assert.equal(result.message, 'Token is valid.');
    } finally {
      User.findOne = originalFindOne;
    }
  });
});

describe('Email Service Retry Queue & Failure Resilience Tests', () => {
  const { sendPasswordResetEmail } = require('../src/services/email.service');

  it('retries when Brevo returns 500 and succeeds on subsequent attempt', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-brevo-key';

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      return {
        ok: true,
        status: 201,
        text: async () => '{"messageId":"msg-retry-success"}',
      };
    };

    try {
      const result = await sendPasswordResetEmail({
        to: 'retry-user@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'test-retry-token',
      });

      assert.equal(result.sent, true);
      assert.equal(result.attempts, 2);
      assert.equal(callCount, 2);
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalApiKey;
    }
  });

  it('aborts retries immediately on non-retryable 400 Bad Request error', async () => {
    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.BREVO_API_KEY;
    process.env.BREVO_API_KEY = 'test-brevo-key';

    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 400,
        text: async () => '{"message":"Invalid recipient email"}',
      };
    };

    try {
      const result = await sendPasswordResetEmail({
        to: 'bad-email@example.com',
        resetUrl: 'https://example.com/reset',
        plainToken: 'test-token',
      });

      assert.equal(result.sent, false);
      assert.equal(result.reason, 'brevo_400');
      assert.equal(callCount, 1); // Not retried
    } finally {
      globalThis.fetch = originalFetch;
      process.env.BREVO_API_KEY = originalApiKey;
    }
  });
});

describe('End-to-End Password Reset API Integration Tests', () => {
  const app = require('../src/app');
  let server;
  let baseUrl;

  beforeEach(async () => {
    if (!server) {
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const address = server.address();
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    }
    clearFailedAttempts('127.0.0.1');
    clearFailedAttempts('::1');
  });

  after(() => {
    if (server) {
      server.close();
    }
  });

  it('POST /api/password-reset/request rejects missing email with 400', async () => {
    const res = await fetch(`${baseUrl}/api/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ai-fitness-tracker1.vercel.app',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.ok(data.error.message.includes('Email is required'));
  });

  it('POST /api/password-reset/request rejects unauthorized origin with 403', async () => {
    const res = await fetch(`${baseUrl}/api/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-phishing.com',
      },
      body: JSON.stringify({ email: 'user@example.com' }),
    });

    assert.equal(res.status, 403);
  });

  it('POST /api/password-reset/request rejects form submission content-type with 415', async () => {
    const res = await fetch(`${baseUrl}/api/password-reset/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://ai-fitness-tracker1.vercel.app',
      },
      body: 'email=user%40example.com',
    });

    assert.equal(res.status, 415);
  });

  it('POST /api/password-reset/request returns 200 with valid email and origin', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(null);

    try {
      const res = await fetch(`${baseUrl}/api/password-reset/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://ai-fitness-tracker1.vercel.app',
        },
        body: JSON.stringify({ email: 'validuser@example.com' }),
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.ok(data.message.includes('If an account exists'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('GET /api/password-reset/validate returns 400 when code query parameter is missing', async () => {
    const res = await fetch(`${baseUrl}/api/password-reset/validate`);
    const data = await res.json();

    assert.equal(res.status, 400);
    assert.equal(data.valid, false);
    assert.ok(data.message.includes('Reset code is required'));
  });

  it('POST /api/password-reset/reset returns 400 when new password is too short', async () => {
    const res = await fetch(`${baseUrl}/api/password-reset/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ai-fitness-tracker1.vercel.app',
      },
      body: JSON.stringify({ code: 'some-token', newPassword: '123' }),
    });

    const data = await res.json();
    assert.equal(res.status, 400);
    assert.ok(data.error.message.includes('at least 8 characters'));
  });

  it('POST /api/webhooks/email receives webhook event array and returns 200', async () => {
    const originalFindOneAndUpdate = User.findOneAndUpdate;
    User.findOneAndUpdate = () => Promise.resolve(null);

    try {
      const res = await fetch(`${baseUrl}/api/webhooks/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            event: 'delivered',
            email: 'delivered@example.com',
            messageId: 'msg-e2e-1',
          },
        ]),
      });

      const data = await res.json();
      assert.equal(res.status, 200);
      assert.equal(data.status, 'received');
      assert.equal(data.count, 1);
    } finally {
      User.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });
});

describe('Password Reset Schema Validation Tests', () => {
  const {
    requestResetSchema,
    validateTokenSchema,
    resetPasswordSchema,
  } = require('../src/schemas/passwordReset.schema');

  it('requestResetSchema transforms valid email to lower case and trims', () => {
    const result = requestResetSchema.safeParse({ email: '  TestUser@Example.COM  ' });
    assert.equal(result.success, true);
    assert.equal(result.data.email, 'testuser@example.com');
  });

  it('requestResetSchema rejects invalid email formats', () => {
    const r1 = requestResetSchema.safeParse({ email: '' });
    assert.equal(r1.success, false);

    const r2 = requestResetSchema.safeParse({ email: 'plainaddress' });
    assert.equal(r2.success, false);

    const r3 = requestResetSchema.safeParse({ email: '@missingusername.com' });
    assert.equal(r3.success, false);
  });

  it('validateTokenSchema accepts valid token string and trims', () => {
    const result = validateTokenSchema.safeParse({ code: '  valid-token-code  ' });
    assert.equal(result.success, true);
    assert.equal(result.data.code, 'valid-token-code');
  });

  it('validateTokenSchema rejects empty or missing code', () => {
    const r1 = validateTokenSchema.safeParse({});
    assert.equal(r1.success, false);

    const r2 = validateTokenSchema.safeParse({ code: '   ' });
    assert.equal(r2.success, false);
  });

  it('resetPasswordSchema validates code and minimum 8-char password', () => {
    const valid = resetPasswordSchema.safeParse({
      code: 'valid-code-123',
      newPassword: 'MySecurePassword!123',
    });
    assert.equal(valid.success, true);

    const short = resetPasswordSchema.safeParse({
      code: 'valid-code-123',
      newPassword: 'short',
    });
    assert.equal(short.success, false);

    const missingCode = resetPasswordSchema.safeParse({
      newPassword: 'MySecurePassword!123',
    });
    assert.equal(missingCode.success, false);
  });
});



