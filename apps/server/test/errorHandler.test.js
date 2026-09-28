const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { errorHandler } = require('../src/middleware/errorHandler');

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

describe('Error Handler Middleware Tests', () => {
  it('returns 400 with specific message for MulterError', () => {
    const err = { name: 'MulterError', message: 'File too large' };
    const req = {};
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.message, 'File too large');
  });

  it('returns 400 with formatted message for Mongoose ValidationError', () => {
    const err = {
      name: 'ValidationError',
      errors: {
        email: { message: 'Path `email` is invalid.' },
        username: { message: 'Path `username` is required.' },
      },
    };
    const req = {};
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Path `email` is invalid'));
  });

  it('returns 400 for CastError with invalid identifier message', () => {
    const err = { name: 'CastError' };
    const req = {};
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.message, 'Invalid resource identifier.');
  });

  it('returns 400 for duplicate key error (code 11000)', () => {
    const err = { code: 11000, keyPattern: { email: 1 } };
    const req = {};
    const res = createMockRes();

    errorHandler(err, req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error.message, 'email is already taken.');
  });

  it('masks internal server errors with generic message in production', () => {
    const origEnv = process.env.NODE_ENV;
    const origError = console.error;
    process.env.NODE_ENV = 'production';
    console.error = () => {};

    try {
      const err = new Error('Database password leak at connection pool: secret');
      const req = {};
      const res = createMockRes();

      errorHandler(err, req, res, () => {});

      assert.equal(res.statusCode, 500);
      assert.equal(res.body.error.message, 'Internal server error. Please try again later.');
    } finally {
      process.env.NODE_ENV = origEnv;
      console.error = origError;
    }
  });

  it('masks MongoServerError even if 4xx status was staged', () => {
    const origEnv = process.env.NODE_ENV;
    const origError = console.error;
    process.env.NODE_ENV = 'production';
    console.error = () => {};

    try {
      const err = { name: 'MongoServerError', message: 'Topology was destroyed' };
      const req = {};
      const res = createMockRes();
      res.statusCode = 400;

      errorHandler(err, req, res, () => {});

      assert.equal(res.body.error.message, 'Internal server error. Please try again later.');
    } finally {
      process.env.NODE_ENV = origEnv;
      console.error = origError;
    }
  });
});
