const express = require('express');
const { protect } = require('../middleware/auth');
const { chat } = require('../controllers/aiAssistant.controller');

const router = express.Router();

// Original route was `auth: false` (fully public), but every caller in the
// client already sends a Bearer token — requiring it here just stops
// anyone else from spending your OpenRouter credits on a public endpoint.
router.post('/ai-assistant/chat', protect, chat);

module.exports = router;
