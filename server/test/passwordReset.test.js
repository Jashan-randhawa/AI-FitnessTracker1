const { describe, it, beforeEach } = require('node:test');
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

