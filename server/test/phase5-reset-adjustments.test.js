const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resetPassword } = require('../src/services/passwordReset.service');
const { getSenderFromEnv } = require('../src/services/email.service');
const { createFakeUser } = require('./helpers/authTestHelpers');
const User = require('../src/models/User');
const crypto = require('crypto');

describe('Phase P5 Specification: Reset Flow Adjustments & Provider Preservation', () => {
  it('resetPassword preserves provider: google and googleId while setting emailVerified and passwordChangedAt', async () => {
    const token = 'valid-p5-token-123';
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const googleUser = createFakeUser({
      _id: '507f1f77bcf86cd799439055',
      email: 'googlekeep@example.com',
      provider: 'google',
      googleId: 'preserved-google-sub-55',
      resetPasswordTokenHash: hashed,
      resetPasswordExpires: new Date(Date.now() + 60000),
      save: async function () { return this; },
    });

    const originalFindOne = User.findOne;
    User.findOne = () => ({
      select: () => Promise.resolve(googleUser),
    });

    try {
      const res = await resetPassword(token, 'BrandNewP@ssword123', { ip: '127.0.0.1' });
      assert.equal(res.success, true);
      assert.equal(googleUser.provider, 'google', 'Provider must NOT be overwritten to local');
      assert.equal(googleUser.googleId, 'preserved-google-sub-55', 'googleId must be preserved');
      assert.equal(googleUser.emailVerified, true, 'emailVerified must be set to true');
      assert.ok(googleUser.passwordChangedAt, 'passwordChangedAt must be set');
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('getSenderFromEnv throws or rejects when EMAIL_FROM is missing and not falling back to hardcoded personal Gmail', () => {
    const originalFrom = process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM;

    try {
      assert.throws(
        () => getSenderFromEnv(),
        /EMAIL_FROM is required/i,
        'Should fail when EMAIL_FROM is not set'
      );
    } finally {
      process.env.EMAIL_FROM = originalFrom;
    }
  });

  it('buildResetHtml adapts title and CTA for Google accounts vs standard password accounts', () => {
    const { buildResetHtml } = require('../src/services/email.service');
    const googleHtml = buildResetHtml('https://example.com/reset', true);
    const standardHtml = buildResetHtml('https://example.com/reset', false);

    assert.match(googleHtml, /Set your password/i);
    assert.match(googleHtml, /Set My Password/i);
    assert.match(standardHtml, /Reset your password/i);
    assert.match(standardHtml, /Reset My Password/i);
  });
});
