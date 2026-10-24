const asyncHandler = require('express-async-handler');
const sendError = require('../utils/sendError');
const logger = require('../utils/logger');
const {
  issueTicket,
  consumeTicket,
  subscribe,
  tryAcquire,
  release,
  TICKET_TTL_SECONDS,
} = require('../services/eventBus');

const HEARTBEAT_MS = 25000; // under common proxy idle timeouts (about 60-100s)

// POST /api/events/ticket — exchanges the login token for a 60-second, single-use stream ticket
const createTicket = asyncHandler(async (req, res) => {
  res.json({
    ticket: issueTicket(String(req.user._id)),
    expiresIn: TICKET_TTL_SECONDS,
  });
});

// GET /api/events?ticket=... — Server-Sent Events stream of change notifications
const stream = (req, res) => {
  let userId;
  try {
    userId = consumeTicket(req.query.ticket);
  } catch {
    return sendError(res, 401, 'Invalid or expired stream ticket');
  }

  if (!tryAcquire(userId)) {
    res.setHeader('Retry-After', '5');
    return sendError(res, 429, 'Too many live connections. Try again shortly.');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop reverse proxies buffering the stream
  });
  res.write('retry: 3000\n');
  res.write('event: ready\ndata: {"connected":true}\n\n');

  const unsubscribe = subscribe(userId, (evt) => {
    res.write(`event: change\ndata: ${JSON.stringify(evt)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, HEARTBEAT_MS);

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    release(userId);
    logger.debug(`[events] stream closed for user ${userId}`);
  };

  req.on('close', cleanup);
  res.on('error', cleanup);
};

module.exports = { createTicket, stream };
