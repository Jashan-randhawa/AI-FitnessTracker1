const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Validates incoming Brevo webhook requests using timing-safe comparison.
 * Supports:
 * - Header: X-Sib-Webhook-Key or X-Webhook-Key
 * - Header: Authorization: Bearer <token>
 * - Query param: ?key=<token> or ?token=<token>
 */
const brevoWebhookAuth = (req, res, next) => {
  const configuredKey = process.env.BREVO_WEBHOOK_KEY?.trim();

  // Fail-closed in production if webhook key is not configured
  if (!configuredKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('[email-webhook] BREVO_WEBHOOK_KEY is not configured in production. Rejecting request.');
      return res.status(503).json({
        error: { message: 'Webhook endpoint is disabled because BREVO_WEBHOOK_KEY is not configured.' },
      });
    }
    // In development or test mode without a configured key, allow request with notice
    return next();
  }

  // Extract client key from multiple common locations
  let clientKey =
    req.headers['x-sib-webhook-key'] ||
    req.headers['x-webhook-key'] ||
    req.query.key ||
    req.query.token;

  if (!clientKey && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    clientKey = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
  }

  if (!clientKey || typeof clientKey !== 'string') {
    logger.warn('[email-webhook] Webhook request rejected: missing authentication key', { ip: req.ip });
    return res.status(401).json({
      error: { message: 'Unauthorized: missing webhook authentication key.' },
    });
  }

  const expectedBuf = Buffer.from(configuredKey);
  const clientBuf = Buffer.from(clientKey.trim());

  if (expectedBuf.length !== clientBuf.length || !crypto.timingSafeEqual(expectedBuf, clientBuf)) {
    logger.warn('[email-webhook] Webhook request rejected: invalid authentication key', { ip: req.ip });
    return res.status(401).json({
      error: { message: 'Unauthorized: invalid webhook authentication key.' },
    });
  }

  next();
};

module.exports = brevoWebhookAuth;
