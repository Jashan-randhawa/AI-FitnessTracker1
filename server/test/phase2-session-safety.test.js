const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { protect, requireRecentLogin } = require('../src/middleware/auth');
const { createFakeUser, signTokenWithIat } = require('./helpers/authTestHelpers');
const User = require('../src/models/User');

const runProtect = (req, res) => {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      originalJson(data);
      finish();
      return res;
    };

    protect(req, res, (err) => {
      res.nextCalled = true;
      res.nextErr = err;
      finish();
    });
  });
};

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
  };
  return res;
};

describe('Phase P2 Specification: Session Safety & Password Changed Invalidation', () => {
  it('protect rejects token with iat earlier than user.passwordChangedAt', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const changeTimestamp = nowSeconds - 100;
    const tokenIat = nowSeconds - 200; // issued 100s before password was changed

    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439011',
      passwordChangedAt: new Date(changeTimestamp * 1000),
    });

    const originalFindById = User.findById;
    User.findById = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    const token = signTokenWithIat({ id: fakeUser._id }, tokenIat);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();

    try {
      await runProtect(req, res);

      assert.equal(res.nextCalled, undefined, 'protect must not call next() for invalidated session');
      assert.equal(res.statusCode, 401);
      assert.ok(res.body.error.message.includes('Password recently changed') || res.body.error.message.includes('Session expired'));
    } finally {
      User.findById = originalFindById;
    }
  });

  it('protect accepts token with iat after or same-second as user.passwordChangedAt', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const changeTimestamp = nowSeconds - 100;
    const tokenIat = nowSeconds - 50; // issued 50s after password was changed

    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439011',
      passwordChangedAt: new Date(changeTimestamp * 1000),
    });

    const originalFindById = User.findById;
    User.findById = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    const token = signTokenWithIat({ id: fakeUser._id }, tokenIat);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();

    try {
      await runProtect(req, res);

      assert.equal(res.nextCalled, true, 'protect must accept valid active session');
      assert.equal(res.statusCode, 200);
      assert.ok(req.auth && req.auth.iat, 'req.auth.iat must be preserved');
    } finally {
      User.findById = originalFindById;
    }
  });

  it('protect accepts users without passwordChangedAt set', async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const fakeUser = createFakeUser({
      _id: '507f1f77bcf86cd799439011',
      passwordChangedAt: undefined,
    });

    const originalFindById = User.findById;
    User.findById = () => ({
      select: () => Promise.resolve(fakeUser),
    });

    const token = signTokenWithIat({ id: fakeUser._id }, nowSeconds - 50);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createMockRes();

    try {
      await runProtect(req, res);

      assert.equal(res.nextCalled, true);
    } finally {
      User.findById = originalFindById;
    }
  });

  it('requireRecentLogin helper rejects token older than maxAgeSeconds with reauth_required', () => {
    assert.equal(typeof requireRecentLogin, 'function', 'requireRecentLogin must be exported from auth middleware');
    const middleware = requireRecentLogin(900); // 15 mins

    const nowSeconds = Math.floor(Date.now() / 1000);
    const oldIat = nowSeconds - 1000; // >900s ago

    const req = { auth: { iat: oldIat } };
    const res = createMockRes();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'reauth_required');
  });
});
