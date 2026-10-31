const { describe, it, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../src/models/RefreshToken');
const User = require('../src/models/User');
const generateToken = require('../src/utils/generateToken');
const { protect } = require('../src/middleware/auth');
const {
  hashToken,
  generatePlainToken,
  createRefreshTokenRecord,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  getRefreshTokenCookieOptions,
} = require('../src/services/refreshToken.service');
const { refresh, logout } = require('../src/controllers/auth.controller');
const app = require('../src/app');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-refresh-token-suite';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    clearedCookies: [],
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    cookie(name, val, options) {
      this.cookies[name] = { val, options };
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      delete this.cookies[name];
      return this;
    },
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
  };
  return res;
};

describe('Refresh Token Service & Model Logic Tests', () => {
  let inMemoryTokens = [];
  const fakeUserId = '507f1f77bcf86cd799439011';
  const fakeUser = {
    _id: fakeUserId,
    username: 'testrunner',
    email: 'test@example.com',
    blocked: false,
    toJSON() {
      return { id: this._id, username: this.username, email: this.email };
    },
  };

  const origCreate = RefreshToken.create;
  const origFindOne = RefreshToken.findOne;
  const origUpdateOne = RefreshToken.updateOne;
  const origUpdateMany = RefreshToken.updateMany;
  const origFindById = User.findById;

  beforeEach(() => {
    inMemoryTokens = [];

    RefreshToken.create = async (doc) => {
      const record = {
        _id: `token_${Date.now()}_${Math.random()}`,
        ...doc,
        revokedAt: doc.revokedAt || null,
        replacedBy: doc.replacedBy || null,
        save: async function () {
          return this;
        },
      };
      inMemoryTokens.push(record);
      return record;
    };

    RefreshToken.findOne = async (filter) => {
      if (filter.hashedToken) {
        return inMemoryTokens.find((t) => t.hashedToken === filter.hashedToken) || null;
      }
      return null;
    };

    RefreshToken.updateOne = async (filter, update) => {
      const rec = inMemoryTokens.find((t) => {
        if (filter.hashedToken && t.hashedToken !== filter.hashedToken) return false;
        if (filter.revokedAt === null && t.revokedAt !== null) return false;
        return true;
      });
      if (rec && update.$set) {
        Object.assign(rec, update.$set);
      }
      return { modifiedCount: rec ? 1 : 0 };
    };

    RefreshToken.updateMany = async (filter, update) => {
      let count = 0;
      inMemoryTokens.forEach((t) => {
        let match = true;
        if (filter.familyId && t.familyId !== filter.familyId) match = false;
        if (filter.userId && String(t.userId) !== String(filter.userId)) match = false;
        if (filter.revokedAt === null && t.revokedAt !== null) match = false;
        if (match) {
          if (update.$set) Object.assign(t, update.$set);
          count++;
        }
      });
      return { modifiedCount: count };
    };

    User.findById = (id) => ({
      select: () => Promise.resolve(String(id) === fakeUserId ? fakeUser : null),
      then: (resolve) => resolve(String(id) === fakeUserId ? fakeUser : null),
    });
  });

  after(() => {
    RefreshToken.create = origCreate;
    RefreshToken.findOne = origFindOne;
    RefreshToken.updateOne = origUpdateOne;
    RefreshToken.updateMany = origUpdateMany;
    User.findById = origFindById;
  });

  it('1. Refresh rotates: issues new access token, updates old record, and preserves familyId', async () => {
    const { plainToken, record: initialRecord } = await createRefreshTokenRecord({
      userId: fakeUserId,
      userAgent: 'Mozilla/5.0 TestBrowser',
      ipAddress: '127.0.0.1',
    });

    assert.ok(plainToken);
    assert.equal(initialRecord.familyId.length > 0, true);
    assert.equal(initialRecord.revokedAt, null);

    // Rotate token
    const result = await rotateRefreshToken({
      plainToken,
      userAgent: 'Mozilla/5.0 RotatedBrowser',
      ipAddress: '127.0.0.1',
    });

    assert.equal(result.success, true);
    assert.ok(result.newPlainToken);
    assert.notEqual(result.newPlainToken, plainToken);

    // Initial record should now be revoked and have replacedBy set
    assert.ok(initialRecord.revokedAt instanceof Date || initialRecord.revokedAt);
    assert.equal(initialRecord.replacedBy, hashToken(result.newPlainToken));

    // New record exists in DB with the exact same familyId
    const newRecord = inMemoryTokens.find((t) => t.hashedToken === hashToken(result.newPlainToken));
    assert.ok(newRecord);
    assert.equal(newRecord.familyId, initialRecord.familyId);
    assert.equal(newRecord.revokedAt, null);
  });

  it('2. Reused token is rejected: revoking a used token terminates the entire token family', async () => {
    // Step A: Issue and rotate token once
    const { plainToken: t1 } = await createRefreshTokenRecord({ userId: fakeUserId });
    const rot1 = await rotateRefreshToken({ plainToken: t1 });
    const t2 = rot1.newPlainToken;

    // Step B: Present the ALREADY REVOKED token t1 again (replay attack)
    const reuseResult = await rotateRefreshToken({ plainToken: t1 });

    assert.equal(reuseResult.success, undefined);
    assert.equal(reuseResult.status, 401);
    assert.equal(reuseResult.error, 'token_reuse');
    assert.ok(reuseResult.message.includes('reused'));

    // Step C: Verify that t2 in the same family has now been revoked as a consequence!
    const t2Record = inMemoryTokens.find((t) => t.hashedToken === hashToken(t2));
    assert.ok(t2Record);
    assert.ok(t2Record.revokedAt !== null, 't2 should be revoked due to family compromise');

    // Step D: Attempting to use t2 is now also rejected
    const t2Attempt = await rotateRefreshToken({ plainToken: t2 });
    assert.equal(t2Attempt.status, 401);
    assert.equal(t2Attempt.error, 'token_reuse');
  });

  it('3. Logout clears the cookie and revokes token in DB', async () => {
    const { plainToken } = await createRefreshTokenRecord({ userId: fakeUserId });
    const tokenRec = inMemoryTokens.find((t) => t.hashedToken === hashToken(plainToken));
    assert.equal(tokenRec.revokedAt, null);

    const req = {
      cookies: { refreshToken: plainToken },
      headers: { 'content-type': 'application/json' },
    };
    const res = createMockRes();

    await logout(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Logged out successfully');
    assert.equal(tokenRec.revokedAt !== null, true);
    assert.equal(res.clearedCookies.some((c) => c.name === 'refreshToken'), true);
  });

  it('4. Password reset revokes all refresh tokens for that user', async () => {
    const session1 = await createRefreshTokenRecord({ userId: fakeUserId });
    const session2 = await createRefreshTokenRecord({ userId: fakeUserId });
    const otherUserSession = await createRefreshTokenRecord({ userId: 'other_user_id' });

    assert.equal(inMemoryTokens.filter((t) => t.revokedAt === null).length, 3);

    await revokeAllUserRefreshTokens(fakeUserId);

    const fakeTokens = inMemoryTokens.filter((t) => String(t.userId) === fakeUserId);
    assert.equal(fakeTokens.every((t) => t.revokedAt !== null), true);

    const otherTokens = inMemoryTokens.filter((t) => String(t.userId) === 'other_user_id');
    assert.equal(otherTokens.every((t) => t.revokedAt === null), true);
  });

  it('5. Old Bearer token still works: protect middleware authenticates valid JWTs', async () => {
    // Generate an access token (or legacy 30d token)
    const validJwt = generateToken(fakeUserId, '30d');
    const req = {
      headers: {
        authorization: `Bearer ${validJwt}`,
      },
    };
    const res = createMockRes();
    let nextCalled = false;

    await protect(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user._id, fakeUserId);
  });
});

describe('HTTP & CSRF Integration Tests for Refresh & Logout', () => {
  let server;
  let baseUrl;
  const fakeUserId = '507f1f77bcf86cd799439011';
  const fakeUser = {
    _id: fakeUserId,
    username: 'httpuser',
    email: 'httpuser@example.com',
    blocked: false,
    toJSON() {
      return { id: this._id, username: this.username, email: this.email };
    },
  };

  let inMemoryTokens = [];
  const origCreate = RefreshToken.create;
  const origFindOne = RefreshToken.findOne;
  const origUpdateOne = RefreshToken.updateOne;
  const origUpdateMany = RefreshToken.updateMany;
  const origFindById = User.findById;

  beforeEach(async () => {
    inMemoryTokens = [];

    RefreshToken.create = async (doc) => {
      const record = {
        _id: `token_${Date.now()}_${Math.random()}`,
        ...doc,
        revokedAt: doc.revokedAt || null,
        replacedBy: doc.replacedBy || null,
        save: async function () {
          return this;
        },
      };
      inMemoryTokens.push(record);
      return record;
    };

    RefreshToken.findOne = async (filter) => {
      if (filter.hashedToken) {
        return inMemoryTokens.find((t) => t.hashedToken === filter.hashedToken) || null;
      }
      return null;
    };

    RefreshToken.updateOne = async (filter, update) => {
      const rec = inMemoryTokens.find((t) => t.hashedToken === filter.hashedToken);
      if (rec && update.$set) Object.assign(rec, update.$set);
      return { modifiedCount: rec ? 1 : 0 };
    };

    RefreshToken.updateMany = async (filter, update) => {
      inMemoryTokens.forEach((t) => {
        if (!filter.familyId || t.familyId === filter.familyId) {
          if (update.$set) Object.assign(t, update.$set);
        }
      });
      return { modifiedCount: 1 };
    };

    User.findById = (id) => ({
      select: () => Promise.resolve(String(id) === fakeUserId ? fakeUser : null),
      then: (resolve) => resolve(String(id) === fakeUserId ? fakeUser : null),
    });

    if (!server) {
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const address = server.address();
          baseUrl = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      });
    }
  });

  after(() => {
    if (server) server.close();
    RefreshToken.create = origCreate;
    RefreshToken.findOne = origFindOne;
    RefreshToken.updateOne = origUpdateOne;
    RefreshToken.updateMany = origUpdateMany;
    User.findById = origFindById;
  });

  it('blocks cross-origin refresh with HTTP 403 when Origin is unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-cross-origin.com',
      },
      body: JSON.stringify({ refreshToken: 'some-dummy-token' }),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data?.error?.message?.includes('Cross-origin request blocked'));
  });

  it('accepts legitimate refresh, sets httpOnly cookie, and rotates token', async () => {
    const { plainToken } = await createRefreshTokenRecord({ userId: fakeUserId });

    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ai-fitness-tracker1.vercel.app',
        Cookie: `refreshToken=${plainToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.jwt, 'Should return jwt');
    assert.ok(data.accessToken, 'Should return accessToken');
    assert.equal(data.user.id, fakeUserId);

    // Verify Set-Cookie header is returned with new refresh token and HttpOnly
    const rawCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')];
    const cookieHeader = rawCookies.join('; ');
    assert.ok(cookieHeader.includes('refreshToken='), 'Should issue new refreshToken cookie');
    assert.ok(cookieHeader.toLowerCase().includes('httponly'), 'Cookie must be HttpOnly');
  });

  it('logout via HTTP clears refreshToken cookie', async () => {
    const { plainToken } = await createRefreshTokenRecord({ userId: fakeUserId });

    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ai-fitness-tracker1.vercel.app',
        Cookie: `refreshToken=${plainToken}`,
      },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, 'Logged out successfully');

    const rawCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [res.headers.get('set-cookie')];
    const cookieHeader = rawCookies.join('; ');
    assert.ok(
      cookieHeader.includes('refreshToken=;') ||
        cookieHeader.includes('Max-Age=0') ||
        cookieHeader.includes('1970'),
      'Should clear refreshToken cookie'
    );
  });
});
