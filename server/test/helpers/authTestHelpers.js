const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Creates an in-memory fake user object suitable for unit testing
 */
const createFakeUser = (overrides = {}) => {
  const user = {
    _id: overrides._id || '507f1f77bcf86cd799439011',
    username: overrides.username || 'testuser',
    email: overrides.email || 'user@example.com',
    provider: overrides.provider || 'local',
    googleId: overrides.googleId !== undefined ? overrides.googleId : undefined,
    password: overrides.password !== undefined ? overrides.password : undefined,
    hasPassword: overrides.hasPassword !== undefined ? overrides.hasPassword : false,
    emailVerified: overrides.emailVerified !== undefined ? overrides.emailVerified : false,
    emailBounced: overrides.emailBounced !== undefined ? overrides.emailBounced : false,
    blocked: overrides.blocked !== undefined ? overrides.blocked : false,
    passwordChangedAt: overrides.passwordChangedAt !== undefined ? overrides.passwordChangedAt : undefined,
    passwordHistory: overrides.passwordHistory || [],
    save: async function () {
      if (this.password && this.hasPassword === undefined) {
        this.hasPassword = true;
      }
      return this;
    },
    ...overrides,
  };
  return user;
};

/**
 * Creates a mock query promise supporting chained Mongoose methods (.select, .lean)
 */
const createQueryMock = (result) => {
  const p = Promise.resolve(result);
  const chainMethods = ['select', 'lean', 'setOptions', 'exec', 'populate', 'sort', 'limit', 'skip', 'where'];
  for (const m of chainMethods) {
    p[m] = () => p;
  }
  return p;
};

/**
 * Generate a JWT token with a specific `iat` (issued at timestamp in seconds)
 */
const signTokenWithIat = (payload, iatSeconds) => {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      ...payload,
      iat: iatSeconds,
      exp: Math.max(iatSeconds, now) + 3600, // Valid for at least 1 hour from now
    },
    JWT_SECRET
  );
  return token;
};

/**
 * Standard fetch mock for Google API endpoints
 */
const mockGoogleFetch = ({ tokenInfo = {}, userInfo = {}, status = 200 } = {}) => {
  return async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('oauth2.googleapis.com/tokeninfo') || urlStr.includes('tokeninfo')) {
      return {
        ok: status === 200,
        status,
        text: async () => JSON.stringify(tokenInfo),
        json: async () => tokenInfo,
      };
    }
    if (urlStr.includes('googleapis.com/oauth2/v3/userinfo') || urlStr.includes('userinfo')) {
      return {
        ok: status === 200,
        status,
        text: async () => JSON.stringify(userInfo),
        json: async () => userInfo,
      };
    }
    return {
      ok: false,
      status: 404,
      text: async () => 'Not Found',
      json: async () => ({ error: 'Not Found' }),
    };
  };
};

module.exports = {
  JWT_SECRET,
  createFakeUser,
  createQueryMock,
  signTokenWithIat,
  mockGoogleFetch,
};
