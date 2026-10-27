const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { requireAdmin } = require('../src/middleware/auth');

const createMockRes = () => ({
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
});

describe('requireAdmin', () => {
  it('rejects a logged-in user who is not an admin with 403', () => {
    const req = { user: { _id: 'u1', isAdmin: false } };
    const res = createMockRes();
    let called = false;
    requireAdmin(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
  });

  it('rejects a user with no isAdmin flag set', () => {
    const req = { user: { _id: 'u2' } };
    const res = createMockRes();
    let called = false;
    requireAdmin(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
  });

  it('rejects a truthy but non-boolean isAdmin value', () => {
    const req = { user: { _id: 'u3', isAdmin: 'true' } };
    const res = createMockRes();
    let called = false;
    requireAdmin(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
  });

  it('allows an admin through', () => {
    const req = { user: { _id: 'admin', isAdmin: true } };
    const res = createMockRes();
    let called = false;
    requireAdmin(req, res, () => { called = true; });
    assert.equal(called, true);
    assert.equal(res.statusCode, 200);
  });

  it('rejects when there is no authenticated user', () => {
    const res = createMockRes();
    let called = false;
    requireAdmin({}, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
  });
});
