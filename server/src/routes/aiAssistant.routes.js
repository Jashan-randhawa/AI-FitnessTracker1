const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { chat } = require('../controllers/aiAssistant.controller');

const router = express.Router();

// Protected with JWT auth and rate limited to protect OpenRouter API credits.
router.post('/ai-assistant/chat', protect, aiLimiter, chat);

module.exports = router;
