const express = require('express');
const { handleBrevoWebhook } = require('../controllers/emailWebhook.controller');

const router = express.Router();

// Webhook endpoint for transactional email status updates
router.post('/webhooks/email', handleBrevoWebhook);

module.exports = router;
