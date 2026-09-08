const express = require('express');
const { protect } = require('../middleware/auth');
const { estimate } = require('../controllers/calorieEstimate.controller');

const router = express.Router();

// Original route was `auth: false`; the client (ActivityLog.tsx) already
// sends a Bearer token on every call, so this is gated for the same
// API-cost-protection reason as ai-assistant/chat above.
router.post('/calorie-estimate', protect, estimate);

module.exports = router;
