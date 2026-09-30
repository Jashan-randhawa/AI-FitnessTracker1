const sendError = require('../utils/sendError');
const logger = require('../utils/logger');

const notFound = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Whitelisted, safe client-facing error types
  if (err && err.name === 'MulterError') {
    return sendError(res, 400, err.message);
  }
  if (err && err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return sendError(res, 400, message);
  }
  if (err && err.name === 'CastError') {
    return sendError(res, 400, 'Invalid resource identifier.');
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    return sendError(res, 400, `${field} is already taken.`);
  }
  if (err && err.message && err.message.startsWith('Not allowed by CORS')) {
    return sendError(res, 403, 'Cross-origin request blocked.');
  }

  if (process.env.NODE_ENV !== 'test') {
    logger.error('Unhandled application error', {
      requestId: req?.id || req?.requestId,
      method: req?.method,
      url: req?.originalUrl,
      errorName: err?.name,
      errorMessage: err?.message,
      stack: err?.stack,
    });
  }

  const status =
    err.status ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  const isProd = process.env.NODE_ENV === 'production';

  // In production, mask all 5xx server errors and unhandled internal database errors
  const isInternalDbError =
    err &&
    (err.name === 'MongoError' ||
      err.name === 'MongoServerError' ||
      err.name === 'MongooseError');

  let message;
  if (isProd) {
    if (status >= 500 || isInternalDbError) {
      message = 'Internal server error. Please try again later.';
    } else {
      // 4xx error paths in production: use sanitized message or generic fallback
      message =
        err.isOperational || (status >= 400 && status < 500 && !isInternalDbError)
          ? err?.message || 'Invalid request.'
          : 'An error occurred processing your request.';
    }
  } else {
    message = err?.message || 'Something went wrong. Please try again.';
  }

  sendError(res, status, message);
};

module.exports = { notFound, errorHandler };
