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

describe('User Profile & Username Update Tests', () => {
  const { updateUser } = require('../src/controllers/user.controller');
  const User = require('../src/models/User');

  it('rejects update if params.id does not match user id (403)', async () => {
    const req = {
      params: { id: 'other_user_id' },
      user: { _id: 'my_user_id', username: 'currentuser' },
      body: { username: 'newname' },
    };
    const res = createMockRes();

    await updateUser(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.ok(res.body?.error?.message?.includes('only update your own profile'));
  });

  it('rejects username shorter than 3 characters (400)', async () => {
    const req = {
      params: { id: 'my_user_id' },
      user: { _id: 'my_user_id', username: 'currentuser' },
      body: { username: 'ab' },
    };
    const res = createMockRes();

    await updateUser(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body?.error?.message?.includes('at least 3 characters'));
  });

  it('rejects username longer than 30 characters (400)', async () => {
    const req = {
      params: { id: 'my_user_id' },
      user: { _id: 'my_user_id', username: 'currentuser' },
      body: { username: 'a'.repeat(31) },
    };
    const res = createMockRes();

    await updateUser(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body?.error?.message?.includes('at most 30 characters'));
  });

  it('rejects username if already taken by another user (409)', async () => {
    const originalFindOne = User.findOne;
    User.findOne = async () => ({ _id: 'someone_else_id', username: 'takenuser' });

    try {
      const req = {
        params: { id: 'my_user_id' },
        user: { _id: 'my_user_id', username: 'currentuser' },
        body: { username: 'takenuser' },
      };
      const res = createMockRes();

      await updateUser(req, res, () => {});

      assert.equal(res.statusCode, 409);
      assert.ok(res.body?.error?.message?.includes('already taken'));
    } finally {
      User.findOne = originalFindOne;
    }
  });

  it('successfully updates username and profile fields (200)', async () => {
    const originalFindOne = User.findOne;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;

    User.findOne = async () => null; // not taken
    User.findByIdAndUpdate = async (_id, updates) => ({
      ...updates,
      _id,
      toJSON: () => ({ id: String(_id), ...updates }),
    });

    try {
      const req = {
        params: { id: 'my_user_id' },
        user: { _id: 'my_user_id', username: 'olduser' },
        body: { username: 'brandNewUser', age: 28, weight: 75 },
      };
      const res = createMockRes();

      await updateUser(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.username, 'brandNewUser');
      assert.equal(res.body.age, 28);
      assert.equal(res.body.weight, 75);
    } finally {
      User.findOne = originalFindOne;
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  it('allows params.id as "me" and updates username correctly (200)', async () => {
    const originalFindOne = User.findOne;
    const originalFindByIdAndUpdate = User.findByIdAndUpdate;

    User.findOne = async () => null;
    User.findByIdAndUpdate = async (_id, updates) => ({
      ...updates,
      _id,
      toJSON: () => ({ id: String(_id), ...updates }),
    });

    try {
      const req = {
        params: { id: 'me' },
        user: { _id: 'my_user_id', username: 'olduser' },
        body: { username: 'updatedMeUser' },
      };
      const res = createMockRes();

      await updateUser(req, res, () => {});

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.username, 'updatedMeUser');
    } finally {
      User.findOne = originalFindOne;
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });
});

