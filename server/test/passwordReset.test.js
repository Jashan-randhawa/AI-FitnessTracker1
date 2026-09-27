const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { request: requestResetController } = require('../src/controllers/passwordReset.controller');

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

describe('Password Reset Controller Tests', () => {
  it('returns 400 if email is missing or non-string', async () => {
    const req = { body: {} };
    const res = createMockRes();

    await requestResetController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Email is required'));
  });

  it('returns 400 if email format is invalid', async () => {
    const req = { body: { email: 'not-an-email' } };
    const res = createMockRes();

    await requestResetController(req, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.ok(res.body.error.message.includes('Invalid email format'));
  });
});
