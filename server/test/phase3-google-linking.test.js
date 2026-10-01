const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolveGoogleUser } = require('../src/controllers/auth.controller');
const { createFakeUser, createQueryMock } = require('./helpers/authTestHelpers');
const User = require('../src/models/User');

describe('Phase P3 Specification: Google Sign-in Hardening and Linking Decision Matrix', () => {
  it('exports resolveGoogleUser function for matrix evaluation', () => {
    assert.equal(typeof resolveGoogleUser, 'function', 'resolveGoogleUser must be exported from auth.controller');
  });

  it('Case 1: User with matching googleId signs in directly', async () => {
    const existingUser = createFakeUser({
      email: 'matched@example.com',
      googleId: 'google-sub-123',
      provider: 'google',
    });

    const originalFindOne = User.findOne;
    User.findOne = ({ googleId }) => {
      if (googleId === 'google-sub-123') return createQueryMock(existingUser);
      return createQueryMock(null);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'google-sub-123',
        email: 'matched@example.com',
        email_verified: true,
      });

      assert.equal(result.action, 'signin');
      assert.equal(result.user._id, existingUser._id);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('Case 2: User with email E but different googleId is refused (google_account_mismatch)', async () => {
    const existingUser = createFakeUser({
      email: 'mismatch@example.com',
      googleId: 'original-google-sub-999',
    });

    const originalFindOne = User.findOne;
    User.findOne = ({ email, googleId }) => {
      if (googleId === 'new-sub-888') return createQueryMock(null);
      if (email === 'mismatch@example.com') return createQueryMock(existingUser);
      return createQueryMock(null);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'new-sub-888',
        email: 'mismatch@example.com',
        email_verified: true,
      });

      assert.equal(result.action, 'refuse');
      assert.equal(result.code, 'google_account_mismatch');
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('Case 3: No user with email E -> Creates account with provider google and emailVerified true', async () => {
    const originalFindOne = User.findOne;
    const originalCreate = User.create;
    User.findOne = () => createQueryMock(null);

    let createdData = null;
    User.create = async (data) => {
      createdData = data;
      return createFakeUser(data);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'new-user-sub',
        email: 'brandnew@example.com',
        name: 'Brand New',
        email_verified: true,
      });

      assert.equal(result.action, 'created');
      assert.equal(createdData.email, 'brandnew@example.com');
      assert.equal(createdData.googleId, 'new-user-sub');
      assert.equal(createdData.emailVerified, true);
      assert.equal(createdData.hasPassword, false);
      assert.equal(createdData.provider, 'google');
    } finally {
      User.findOne = originalFindOne;
      User.create = originalCreate;
    }
  });

  it('Case 4: User with email E, no googleId, hasPassword false (legacy) -> Binds sub', async () => {
    const legacyUser = createFakeUser({
      email: 'legacy@example.com',
      googleId: undefined,
      hasPassword: false,
      save: async function () { return this; },
    });

    const originalFindOne = User.findOne;
    User.findOne = ({ email, googleId }) => {
      if (googleId) return createQueryMock(null);
      if (email === 'legacy@example.com') return createQueryMock(legacyUser);
      return createQueryMock(null);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'legacy-sub-bind',
        email: 'legacy@example.com',
        email_verified: true,
      });

      assert.equal(result.action, 'bind');
      assert.equal(legacyUser.googleId, 'legacy-sub-bind');
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('Case 5: User with email E, no googleId, hasPassword true, emailVerified true -> Links and dispatches notice', async () => {
    const verifiedUser = createFakeUser({
      email: 'verified-pw@example.com',
      googleId: undefined,
      hasPassword: true,
      emailVerified: true,
      save: async function () { return this; },
    });

    const originalFindOne = User.findOne;
    User.findOne = ({ email, googleId }) => {
      if (googleId) return createQueryMock(null);
      if (email === 'verified-pw@example.com') return createQueryMock(verifiedUser);
      return createQueryMock(null);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'verified-sub-link',
        email: 'verified-pw@example.com',
        email_verified: true,
      });

      assert.equal(result.action, 'link');
      assert.equal(verifiedUser.googleId, 'verified-sub-link');
      assert.equal(result.sendNotice, true);
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('Case 6: User with email E, no googleId, hasPassword true, emailVerified false -> Clears password and squat sessions', async () => {
    const squattedUser = createFakeUser({
      email: 'squat@example.com',
      googleId: undefined,
      hasPassword: true,
      emailVerified: false,
      password: 'hashedpassword123',
      save: async function () { return this; },
    });

    const originalFindOne = User.findOne;
    User.findOne = ({ email, googleId }) => {
      if (googleId) return createQueryMock(null);
      if (email === 'squat@example.com') return createQueryMock(squattedUser);
      return createQueryMock(null);
    };

    try {
      const result = await resolveGoogleUser({
        sub: 'squat-cleared-sub',
        email: 'squat@example.com',
        email_verified: true,
      });

      assert.equal(result.action, 'reclaimed');
      assert.equal(squattedUser.googleId, 'squat-cleared-sub');
      assert.equal(squattedUser.password, undefined);
      assert.equal(squattedUser.hasPassword, false);
      assert.equal(squattedUser.emailVerified, true);
      assert.ok(squattedUser.passwordChangedAt);
    } finally {
      User.findOne = originalFindOne;
    }
  });
});
