/**
 * Anti-CSRF and Strict Origin Protection Middleware
 * Protects state-changing endpoints (like password reset) from cross-site request forgery.
 */

const sendError = require('../utils/sendError');
const logger = require('../utils/logger');

const allowedOrigins = [
  'https://ai-fitness-tracker1.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, '').toLowerCase());

/**
 * Validates that requests originate from legitimate client applications.
 * Enforces JSON Content-Type and verifies Origin/Referer against allowed origins.
 */
const verifyCsrfAndOrigin = (req, res, next) => {
  // Allow safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Bypass origin verification in automated test environment if flag is set
  if (process.env.NODE_ENV === 'test' && !req.headers.origin && !req.headers.referer) {
    return next();
  }

  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';

  // 1. Verify Content-Type for state-modifying POST/PUT requests
  // Standard HTML form CSRF uses multipart/form-data or application/x-www-form-urlencoded.
  // Requiring application/json forces browsers to execute a CORS preflight check.
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    logger.warn('[csrf] Blocked request with non-JSON content-type:', {
      ip: req.ip,
      contentType,
      path: req.originalUrl,
    });
    return sendError(res, 415, 'Unsupported Media Type. Requests must use application/json.');
  }

  // 2. Validate Origin if provided
  if (origin) {
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();
    const isAllowed = allowedOrigins.some((allowed) => allowed === normalizedOrigin);
    if (!isAllowed) {
      logger.warn('[csrf] Blocked request from unauthorized Origin:', {
        ip: req.ip,
        origin,
        path: req.originalUrl,
      });
      return sendError(res, 403, 'Cross-origin request blocked.');
    }
  } else if (referer) {
    // 3. Fallback to Referer check
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`.toLowerCase();
      const isAllowed = allowedOrigins.some((allowed) => allowed === refererOrigin);
      if (!isAllowed) {
        logger.warn('[csrf] Blocked request from unauthorized Referer:', {
          ip: req.ip,
          referer,
          path: req.originalUrl,
        });
        return sendError(res, 403, 'Cross-origin request blocked.');
      }
    } catch {
      return sendError(res, 403, 'Invalid request origin header.');
    }
  }

  next();
};

module.exports = {
  verifyCsrfAndOrigin,
  allowedOrigins,
};
