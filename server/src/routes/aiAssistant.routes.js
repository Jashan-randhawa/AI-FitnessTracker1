const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter, aiUserLimiter } = require('../middleware/rateLimiter');
const { fitbotRateLimiter } = require('../middleware/aiRateLimiter');
const { validateChatPayload } = require('../middleware/aiValidation');
const { chat } = require('../controllers/aiAssistant.controller');

const router = express.Router();

// Protected with JWT auth, token-bucket rate limiter (30 req/hr), validation, and legacy limiters.
router.post(
  '/ai-assistant/chat',
  protect,
  fitbotRateLimiter,
  aiLimiter,
  aiUserLimiter,
  validateChatPayload,
  chat
);

// Alias /api/ai/chat for playbook compatibility
router.post(
  '/ai/chat',
  protect,
  fitbotRateLimiter,
  aiLimiter,
  aiUserLimiter,
  validateChatPayload,
  chat
);

module.exports = router;
