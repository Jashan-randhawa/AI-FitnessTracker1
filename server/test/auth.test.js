const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_for_testing_purposes_only';

const generateToken = require('../src/utils/generateToken');
const { register, login } = require('../src/controllers/auth.controller');

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

describe('Auth & Token Unit Tests', () => {
  describe('generateToken', () => {
    it('generates a valid signed JWT containing the user id', () => {
      const userId = 'user_test_12345';
      const token = generateToken(userId);
      assert.ok(typeof token === 'string' && token.length > 0);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.id, userId);
    });
  });

  describe('register validation', () => {
    it('rejects registration when username is shorter than 3 characters', async () => {
      const req = { body: { username: 'ab', email: 'valid@example.com', password: 'password123' } };
      const res = createMockRes();

      await register(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error?.message?.includes('username must be at least 3 characters'));
    });

    it('rejects registration when email is invalid', async () => {
      const req = { body: { username: 'validuser', email: 'invalid-email', password: 'password123' } };
      const res = createMockRes();

      await register(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error?.message?.includes('a valid email is required'));
    });

    it('rejects registration when password is shorter than 6 characters', async () => {
      const req = { body: { username: 'validuser', email: 'user@example.com', password: '123' } };
      const res = createMockRes();

      await register(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error?.message?.includes('password must be at least 6 characters'));
    });
  });

  describe('login validation', () => {
    it('rejects login when identifier is missing', async () => {
      const req = { body: { identifier: '', password: 'password123' } };
      const res = createMockRes();

      await login(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error?.message?.includes('identifier and password are required'));
    });

    it('rejects login when password is missing', async () => {
      const req = { body: { identifier: 'myuser', password: '' } };
      const res = createMockRes();

      await login(req, res, () => {});

      assert.equal(res.statusCode, 400);
      assert.ok(res.body?.error?.message?.includes('identifier and password are required'));
    });
  });
});
