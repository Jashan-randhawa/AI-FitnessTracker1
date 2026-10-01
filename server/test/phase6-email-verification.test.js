const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  generateVerificationToken,
  verifyEmailToken,
  requestEmailVerification,
} = require('../src/services/emailVerification.service');
const {
  requestVerification,
  confirmVerification,
} = require('../src/controllers/emailVerification.controller');
const { createFakeUser, createQueryMock } = require('./helpers/authTestHelpers');
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

describe('Phase P6 Specification: Signup Email Verification', () => {
  it('generateVerificationToken creates 64-char hex token, sha256 hash, and 24h expiration', () => {
    const { plainToken, tokenHash, expires } = generateVerificationToken();
    assert.equal(plainToken.length, 64);
    assert.equal(tokenHash.length, 64);
    assert.ok(expires instanceof Date);
    const expectedHash = crypto.createHash('sha256').update(plainToken).digest('hex');
    assert.equal(tokenHash, expectedHash);
    const msUntilExpiry = expires.getTime() - Date.now();
    assert.ok(msUntilExpiry > 23 * 3600 * 1000 && msUntilExpiry <= 24 * 3600 * 1000);
  });

  it('verifyEmailToken rejects invalid or expired token', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => createQueryMock(null);

    try {
      const resMissing = await verifyEmailToken('');
      assert.equal(resMissing.success, false);

      const resNotFound = await verifyEmailToken('unknown-token-12345');
      assert.equal(resNotFound.success, false);
      assert.match(resNotFound.message, /invalid or expired/i);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('verifyEmailToken rejects expired token when expiration is in past', async () => {
    const token = 'expired-token-12345';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const expiredUser = createFakeUser({
      email: 'expired@example.com',
      emailVerificationTokenHash: hashed,
      emailVerificationExpires: new Date(Date.now() - 5000), // 5 seconds ago
    });

    const originalFindOne = User.findOne;
    User.findOne = () => createQueryMock(expiredUser);

    try {
      const res = await verifyEmailToken(token);
      assert.equal(res.success, false);
      assert.match(res.message, /expired/i);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('verifyEmailToken verifies valid token and marks user as emailVerified', async () => {
    let saved = false;
    const token = 'valid-active-token-999';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const validUser = createFakeUser({
      email: 'verified-test@example.com',
      emailVerified: false,
      emailVerificationTokenHash: hashed,
      emailVerificationExpires: new Date(Date.now() + 3600000),
      save: async function () {
        saved = true;
        return this;
      },
    });

    const originalFindOne = User.findOne;
    User.findOne = () => createQueryMock(validUser);

    try {
      const res = await verifyEmailToken(token, { ip: '127.0.0.1' });
      assert.equal(res.success, true);
      assert.equal(saved, true);
      assert.equal(validUser.emailVerified, true);
      assert.equal(validUser.emailVerificationTokenHash, undefined);
      assert.equal(validUser.emailVerificationExpires, undefined);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('requestEmailVerification returns uniform message for non-existent users (anti-enumeration)', async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => createQueryMock(null);

    try {
      const res = await requestEmailVerification('ghost@example.com');
      assert.equal(res.success, true);
      assert.match(res.message, /verification link has been sent/i);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('confirmVerification controller endpoint returns 200 on success and 400 on error', async () => {
    const token = 'controller-valid-token-777';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const validUser = createFakeUser({
      email: 'ctrl@example.com',
      emailVerified: false,
      emailVerificationTokenHash: hashed,
      emailVerificationExpires: new Date(Date.now() + 3600000),
      save: async function () { return this; },
      toJSON: () => ({ email: 'ctrl@example.com', emailVerified: true }),
    });

    const originalFindOne = User.findOne;
    User.findOne = () => createQueryMock(validUser);

    try {
      const req = { body: { token }, ip: '127.0.0.1', headers: {} };
      const res = createMockRes();
      await confirmVerification(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');

      // Invalid token
      User.findOne = () => createQueryMock(null);
      const reqFail = { body: { token: 'invalid' }, ip: '127.0.0.1', headers: {} };
      const resFail = createMockRes();
      await confirmVerification(reqFail, resFail);
      assert.equal(resFail.statusCode, 400);
    } finally {
      User.findOne = originalFindOne;
    }
  });
});
