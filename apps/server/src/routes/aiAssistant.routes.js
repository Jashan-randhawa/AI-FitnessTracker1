const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter, aiUserLimiter } = require('../middleware/rateLimiter');
const { chat } = require('../controllers/aiAssistant.controller');

const router = express.Router();

// Protected with JWT auth, IP rate limit (30/min), and per-user rate limit (20/min).
router.post('/ai-assistant/chat', protect, aiLimiter, aiUserLimiter, chat);

module.exports = router;
