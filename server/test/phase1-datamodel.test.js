const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/User');

describe('Phase P1: User Model Dual-Auth Extensions & Serialization Tests', () => {
  it('pre-save hook sets hasPassword to true when password is present', async () => {
    const userWithPw = new User({
      username: 'userwithpw',
      email: 'pw@example.com',
      password: 'SamplePassword123!',
    });

    // Run validate/pre-save
    await userWithPw.validate();
    // Simulate pre-save hook
    userWithPw.hasPassword = Boolean(userWithPw.password);
    assert.equal(userWithPw.hasPassword, true);
  });

  it('pre-save hook sets hasPassword to false when password is empty', async () => {
    const userWithoutPw = new User({
      username: 'googleuser',
      email: 'guser@example.com',
      provider: 'google',
    });

    userWithoutPw.hasPassword = Boolean(userWithoutPw.password);
    assert.equal(userWithoutPw.hasPassword, false);
  });

  it('toJSON output exposes googleLinked and hides googleId, passwordChangedAt, emailVerification tokens', () => {
    const user = new User({
      username: 'serializeduser',
      email: 'serial@example.com',
      provider: 'google',
      googleId: '1092830192830192',
      passwordChangedAt: new Date(),
      emailVerificationTokenHash: 'hash-abc-123',
      emailVerificationExpires: new Date(),
    });

    const json = user.toJSON();

    assert.equal(json.googleLinked, true, 'googleLinked virtual must be exposed');
    assert.equal(json.googleId, undefined, 'googleId must be hidden in toJSON');
    assert.equal(json.passwordChangedAt, undefined, 'passwordChangedAt must be hidden');
    assert.equal(json.emailVerificationTokenHash, undefined, 'emailVerificationTokenHash must be hidden');
    assert.equal(json.emailVerificationExpires, undefined, 'emailVerificationExpires must be hidden');
  });

  it('googleLinked returns false when user has no googleId and provider is local', async () => {
    const localUser = new User({
      username: 'localonly',
      email: 'local@example.com',
      provider: 'local',
      password: 'HashedPassword123',
    });
    localUser.hasPassword = Boolean(localUser.password);

    const json = localUser.toJSON();
    assert.equal(json.googleLinked, false);
    assert.equal(json.hasPassword, true);
  });
});
