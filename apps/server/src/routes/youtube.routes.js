const express = require('express');
const { protect } = require('../middleware/auth');
const { youtubeLimiter } = require('../middleware/rateLimiter');
const { search } = require('../controllers/youtube.controller');

const router = express.Router();

// Authenticated & rate-limited to prevent RapidAPI quota exhaustion.
router.get('/youtube/search', protect, youtubeLimiter, search);

module.exports = router;
