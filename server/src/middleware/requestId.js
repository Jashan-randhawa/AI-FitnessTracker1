const crypto = require('crypto');

/**
 * Middleware that assigns a unique request ID to each incoming HTTP request,
 * attaches it to req.id, and sets the X-Request-Id header on the response.
 */
const requestId = (req, res, next) => {
  const existingId = req.headers['x-request-id'];
  const id = typeof existingId === 'string' && existingId.trim().length > 0
    ? existingId.trim()
    : crypto.randomUUID();

  req.id = id;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = requestId;
