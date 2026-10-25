/**
 * Per-user change notifications for live views.
 *
 * In-process only: this works while the API runs as one instance (the current
 * Render setup). Two instances would need Redis pub/sub on the same channel
 * names; that is a scaling step, not part of this change.
 *
 * Browsers' EventSource cannot send an Authorization header, so the client
 * first exchanges its login token for a short-lived, single-use stream ticket.
 * Tickets carry purpose:'sse', which the auth middleware refuses, so a ticket
 * cannot be used as a login token.
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TICKET_TTL_SECONDS = 60;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_CONNECTIONS_TOTAL = 500;

const bus = new EventEmitter();
bus.setMaxListeners(0);

const connectionCounts = new Map();
let connectionTotal = 0;

// jti -> expiry (ms). Holds only unexpired, already-used tickets.
const usedTickets = new Map();

const channel = (userId) => `user:${userId}`;

/** Reserves a connection slot. Returns false when a cap is reached. */
const tryAcquire = (userId) => {
  if (connectionTotal >= MAX_CONNECTIONS_TOTAL) return false;
  const current = connectionCounts.get(userId) || 0;
  if (current >= MAX_CONNECTIONS_PER_USER) return false;
  connectionCounts.set(userId, current + 1);
  connectionTotal += 1;
  return true;
};

const release = (userId) => {
  const current = connectionCounts.get(userId) || 0;
  if (current <= 1) connectionCounts.delete(userId);
  else connectionCounts.set(userId, current - 1);
  connectionTotal = Math.max(0, connectionTotal - 1);
};

const subscribe = (userId, listener) => {
  const ch = channel(userId);
  bus.on(ch, listener);
  return () => bus.off(ch, listener);
};

/**
 * Tells a user's open views that something changed.
 * @param {string} userId
 * @param {'food'|'activity'|'water'|'plan'|'goals'|'weight'} kind
 * @param {Date|string|null} [date] the affected record's date, if known
 */
const publishChange = (userId, kind, date = null) => {
  if (!userId) return;
  const parsed = date ? new Date(date) : null;
  bus.emit(channel(userId), {
    type: 'summary.changed',
    kind,
    date: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
    at: new Date().toISOString(),
  });
};

const issueTicket = (userId) =>
  jwt.sign(
    { id: String(userId), purpose: 'sse', jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: TICKET_TTL_SECONDS }
  );

const sweepUsedTickets = (now) => {
  for (const [jti, exp] of usedTickets) {
    if (exp <= now) usedTickets.delete(jti);
  }
};

/**
 * Verifies and consumes a stream ticket. Throws if it is invalid, expired,
 * not an SSE ticket, or already used.
 * @returns {string} the user id
 */
const consumeTicket = (ticket) => {
  if (typeof ticket !== 'string' || ticket.length === 0) {
    throw new Error('missing ticket');
  }
  const decoded = jwt.verify(ticket, process.env.JWT_SECRET);
  if (decoded.purpose !== 'sse' || !decoded.jti || !decoded.id) {
    throw new Error('wrong ticket purpose');
  }
  const now = Date.now();
  sweepUsedTickets(now);
  if (usedTickets.has(decoded.jti)) {
    throw new Error('ticket already used');
  }
  usedTickets.set(decoded.jti, decoded.exp * 1000);
  return decoded.id;
};

module.exports = {
  publishChange,
  subscribe,
  tryAcquire,
  release,
  issueTicket,
  consumeTicket,
  TICKET_TTL_SECONDS,
  MAX_CONNECTIONS_PER_USER,
  MAX_CONNECTIONS_TOTAL,
};
