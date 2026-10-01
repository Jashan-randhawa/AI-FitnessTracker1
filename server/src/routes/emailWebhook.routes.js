const express = require('express');
const rateLimit = require('express-rate-limit');
const brevoWebhookAuth = require('../middleware/brevoWebhookAuth');
const { handleBrevoWebhook } = require('../controllers/emailWebhook.controller');

const router = express.Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many webhook requests from this IP.' } },
});

// Webhook endpoint for transactional email status updates
router.post(
  '/webhooks/email',
  webhookLimiter,
  express.json({ limit: '256kb' }),
  brevoWebhookAuth,
  handleBrevoWebhook
);

module.exports = router;
