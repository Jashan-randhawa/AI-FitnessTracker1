const express = require('express');
const { protect, requireAdmin } = require('../middleware/auth');
const { aiLimiter, aiUserLimiter } = require('../middleware/rateLimiter');
const { fitbotRateLimiter } = require('../middleware/aiRateLimiter');
const { validateChatPayload } = require('../middleware/aiValidation');
const { enforceAiBudget, resolveChatFeature } = require('../middleware/aiBudget');
const { chat } = require('../controllers/aiAssistant.controller');
const { getAiUsage, getTopAiConsumers } = require('../controllers/aiBudget.controller');

const router = express.Router();

// User daily AI budget status (read-only)
router.get('/ai/usage', protect, aiLimiter, getAiUsage);
router.get('/ai-assistant/usage', protect, aiLimiter, getAiUsage);

// Admin-only top AI token consumers for a given day (keyset pagination)
router.get('/ai/admin/top-consumers', protect, requireAdmin, aiLimiter, getTopAiConsumers);
router.get('/admin/ai-usage/top-consumers', protect, requireAdmin, aiLimiter, getTopAiConsumers);

// Protected with JWT auth, token-bucket rate limiter (30 req/hr), validation, legacy limiters, and daily budget.
router.post(
  '/ai-assistant/chat',
  protect,
  fitbotRateLimiter,
  aiLimiter,
  aiUserLimiter,
  validateChatPayload,
  enforceAiBudget(resolveChatFeature),
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
  enforceAiBudget(resolveChatFeature),
  chat
);

module.exports = router;
