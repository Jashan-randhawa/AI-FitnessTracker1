process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const {
  issueTicket,
  consumeTicket,
  publishChange,
  subscribe,
  tryAcquire,
  release,
  MAX_CONNECTIONS_PER_USER,
} = require('../src/services/eventBus');

const USER = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439012';

describe('stream tickets', () => {
  it('a fresh ticket resolves to its user exactly once', () => {
    const ticket = issueTicket(USER);
    assert.equal(consumeTicket(ticket), USER);
    assert.throws(() => consumeTicket(ticket), /already used/);
  });

  it('rejects a normal login token (no purpose claim)', () => {
    const login = jwt.sign({ id: USER }, process.env.JWT_SECRET, { expiresIn: '5m' });
    assert.throws(() => consumeTicket(login), /wrong ticket purpose/);
  });

  it('rejects an expired ticket', () => {
    const expired = jwt.sign(
      { id: USER, purpose: 'sse', jti: 'expired-1', exp: Math.floor(Date.now() / 1000) - 10 },
      process.env.JWT_SECRET
    );
    assert.throws(() => consumeTicket(expired), /expired/);
  });

  it('rejects a ticket signed with a different secret', () => {
    const forged = jwt.sign({ id: USER, purpose: 'sse', jti: 'forged-1' }, 'not-the-secret', { expiresIn: '60s' });
    assert.throws(() => consumeTicket(forged));
  });

  it('rejects a missing or non-string ticket', () => {
    assert.throws(() => consumeTicket(undefined), /missing ticket/);
    assert.throws(() => consumeTicket(['a', 'b']), /missing ticket/);
  });
});

describe('connection caps', () => {
  beforeEach(() => {
    // Drain any connections left over from earlier tests in this file.
    for (let i = 0; i < 20; i++) release(USER);
    for (let i = 0; i < 20; i++) release(OTHER);
  });

  it('allows up to the per-user cap, then refuses', () => {
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      assert.equal(tryAcquire(USER), true);
    }
    assert.equal(tryAcquire(USER), false);
  });

  it('does not let one user exhaust another user\'s slots', () => {
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) tryAcquire(USER);
    assert.equal(tryAcquire(OTHER), true);
  });

  it('frees a slot when a connection is released', () => {
    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) tryAcquire(USER);
    release(USER);
    assert.equal(tryAcquire(USER), true);
  });
});

describe('change notifications', () => {
  it('delivers only to the affected user', () => {
    const got = [];
    const offUser = subscribe(USER, (e) => got.push(['user', e]));
    const offOther = subscribe(OTHER, (e) => got.push(['other', e]));

    publishChange(USER, 'food', '2026-10-24T10:00:00Z');

    offUser();
    offOther();
    assert.equal(got.length, 1);
    assert.equal(got[0][0], 'user');
    assert.equal(got[0][1].type, 'summary.changed');
    assert.equal(got[0][1].kind, 'food');
    assert.equal(got[0][1].date, '2026-10-24T10:00:00.000Z');
  });

  it('sends a null date when the record date is missing or invalid', () => {
    const got = [];
    const off = subscribe(USER, (e) => got.push(e));
    publishChange(USER, 'water');
    publishChange(USER, 'water', 'not-a-date');
    off();
    assert.equal(got[0].date, null);
    assert.equal(got[1].date, null);
  });

  it('stops delivering after unsubscribe', () => {
    let count = 0;
    const off = subscribe(USER, () => count++);
    publishChange(USER, 'plan');
    off();
    publishChange(USER, 'plan');
    assert.equal(count, 1);
  });
});
