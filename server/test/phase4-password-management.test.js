const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { validatePasswordPolicy } = require('../src/utils/passwordPolicy');
const { checkPasswordReuse } = require('../src/utils/passwordReuse');
const { setUserPassword } = require('../src/controllers/user.controller');
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

describe('Phase P4 Specification: Password Management & Unified Password Policy', () => {
  it('validatePasswordPolicy enforces 8+ chars, uppercase, digit, and special character', () => {
    assert.equal(typeof validatePasswordPolicy, 'function');

    const invalidShort = validatePasswordPolicy('Ab1!');
    assert.equal(invalidShort.valid, false);

    const invalidNoUpper = validatePasswordPolicy('password123!');
    assert.equal(invalidNoUpper.valid, false);

    const invalidNoLower = validatePasswordPolicy('PASSWORD123!');
    assert.equal(invalidNoLower.valid, false);

    const invalidNoNumber = validatePasswordPolicy('Password!@#');
    assert.equal(invalidNoNumber.valid, false);

    const invalidNoSpecial = validatePasswordPolicy('Password123');
    assert.equal(invalidNoSpecial.valid, false);

    const valid = validatePasswordPolicy('StrongP@ss123');
    assert.equal(valid.valid, true);
  });

  it('checkPasswordReuse identifies current password and historical password reuse', async () => {
    const currentHash = await bcrypt.hash('CurrentP@ss1', 10);
    const oldHash1 = await bcrypt.hash('OldP@ssword1', 10);
    const oldHash2 = await bcrypt.hash('OldP@ssword2', 10);

    const history = [{ hash: oldHash1 }, { hash: oldHash2 }];

    const matchCurrent = await checkPasswordReuse('CurrentP@ss1', currentHash, history);
    assert.equal(matchCurrent.isReused, true);
    assert.equal(matchCurrent.type, 'current');

    const matchHistory = await checkPasswordReuse('OldP@ssword2', currentHash, history);
    assert.equal(matchHistory.isReused, true);
    assert.equal(matchHistory.type, 'history');

    const fresh = await checkPasswordReuse('BrandNewP@ss99', currentHash, history);
    assert.equal(fresh.isReused, false);
  });

  it('POST /users/me/password requires recent login (reauth_required) when setting password for first time with stale session', async () => {
    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439011',
      hasPassword: false,
      password: null,
      toJSON: () => ({ id: '507f1f77bcf86cd799439011' }),
    });

    const originalFindById = User.findById;
    User.findById = () => createQueryMock(fakeUser);

    const req = {
      user: fakeUser,
      auth: { iat: Math.floor(Date.now() / 1000) - 1200 }, // 20 minutes ago (> 15 min / 900s)
      body: { newPassword: 'BrandNewP@ss123' },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = createMockRes();

    try {
      await setUserPassword(req, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'reauth_required');
    } finally {
      User.findById = originalFindById;
    }
  });

  it('POST /users/me/password sets password for OAuth user within step-up window', async () => {
    let saved = false;
    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439012',
      hasPassword: false,
      password: null,
      save: async function () {
        saved = true;
        return this;
      },
      toJSON: () => ({ id: '507f1f77bcf86cd799439012', hasPassword: true }),
    });

    const originalFindById = User.findById;
    User.findById = () => createQueryMock(fakeUser);

    const req = {
      user: fakeUser,
      auth: { iat: Math.floor(Date.now() / 1000) - 60 }, // 1 minute ago (fresh)
      body: { newPassword: 'BrandNewP@ss123' },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = createMockRes();

    try {
      await setUserPassword(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.jwt);
      assert.equal(saved, true);
      assert.equal(fakeUser.hasPassword, true);
      assert.equal(fakeUser.password, 'BrandNewP@ss123');
      assert.ok(fakeUser.passwordChangedAt);
    } finally {
      User.findById = originalFindById;
    }
  });

  it('POST /users/me/password requires currentPassword when user already has a password', async () => {
    const currentHash = await bcrypt.hash('OldSecret123!', 10);
    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439013',
      hasPassword: true,
      password: currentHash,
      comparePassword: async (candidate) => candidate === 'OldSecret123!',
      toJSON: () => ({ id: '507f1f77bcf86cd799439013' }),
    });

    const originalFindById = User.findById;
    User.findById = () => createQueryMock(fakeUser);

    // Missing currentPassword
    const reqMissing = {
      user: fakeUser,
      body: { newPassword: 'BrandNewP@ss123' },
      ip: '127.0.0.1',
      headers: {},
    };
    const resMissing = createMockRes();

    try {
      await setUserPassword(reqMissing, resMissing);
      assert.equal(resMissing.statusCode, 400);

      // Wrong currentPassword
      const reqWrong = {
        user: fakeUser,
        body: { currentPassword: 'WrongPassword!', newPassword: 'BrandNewP@ss123' },
        ip: '127.0.0.1',
        headers: {},
      };
      const resWrong = createMockRes();
      await setUserPassword(reqWrong, resWrong);
      assert.equal(resWrong.statusCode, 400);

      // Correct currentPassword but re-using existing password
      const reqReuse = {
        user: fakeUser,
        body: { currentPassword: 'OldSecret123!', newPassword: 'OldSecret123!' },
        ip: '127.0.0.1',
        headers: {},
      };
      const resReuse = createMockRes();
      await setUserPassword(reqReuse, resReuse);
      assert.equal(resReuse.statusCode, 400);
      assert.match(resReuse.body.message, /reuse/i);
    } finally {
      User.findById = originalFindById;
    }
  });

  it('POST /users/me/password successfully changes password with valid currentPassword', async () => {
    let saved = false;
    const currentHash = await bcrypt.hash('OldSecret123!', 10);
    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439014',
      hasPassword: true,
      password: currentHash,
      passwordHistory: [],
      comparePassword: async (candidate) => candidate === 'OldSecret123!',
      save: async function () {
        saved = true;
        return this;
      },
      toJSON: () => ({ id: '507f1f77bcf86cd799439014' }),
    });

    const originalFindById = User.findById;
    User.findById = () => createQueryMock(fakeUser);

    const req = {
      user: fakeUser,
      body: { currentPassword: 'OldSecret123!', newPassword: 'FreshStrongP@ss999' },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = createMockRes();

    try {
      await setUserPassword(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'success');
      assert.ok(res.body.jwt);
      assert.equal(saved, true);
      assert.equal(fakeUser.password, 'FreshStrongP@ss999');
      assert.equal(fakeUser.passwordHistory.length, 1);
      assert.equal(fakeUser.passwordHistory[0].hash, currentHash);
      assert.ok(fakeUser.passwordChangedAt);
    } finally {
      User.findById = originalFindById;
    }
  });
});
