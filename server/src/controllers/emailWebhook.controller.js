const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const EmailEvent = require('../models/EmailEvent');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Handles incoming transactional email webhook events from Brevo
 * POST /api/webhooks/email
 */
const handleBrevoWebhook = asyncHandler(async (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: { message: 'Invalid webhook payload.' } });
  }

  // Handle single event or batch of events
  const events = Array.isArray(payload) ? payload : [payload];

  for (const item of events) {
    const eventType = item.event || item.type || 'unknown';
    const email = (item.email || '').toLowerCase().trim();
    const messageId = item['message-id'] || item.messageId || String(item.id || '');
    const reason = item.reason || item.description || undefined;

    if (!email) continue;

    logger.info(`[email-webhook] Received event: ${eventType} for ${email}`, {
      eventType,
      email,
      messageId,
    });

    // 1. Record event log if DB is connected
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await EmailEvent.create({
          messageId,
          email,
          event: eventType,
          ip: req.ip,
          reason,
          rawPayload: item,
        });
      } catch (dbErr) {
        logger.warn('[email-webhook] Error saving email event:', { error: dbErr.message });
      }
    }

    // 2. If address hard bounced or marked as spam, flag user account
    if (eventType === 'hard_bounce' || eventType === 'spam' || eventType === 'blocked') {
      try {
        const updated = await User.findOneAndUpdate(
          { email },
          { emailBounced: true }
        );
        if (updated) {
          logger.warn(`[email-webhook] Flagged user account ${email} as emailBounced`, {
            email,
            eventType,
          });
        }
      } catch (userErr) {
        logger.warn('[email-webhook] Error updating user bounced state:', { error: userErr.message });
      }
    }
  }

  res.status(200).json({ status: 'received', count: events.length });
});

module.exports = { handleBrevoWebhook };
