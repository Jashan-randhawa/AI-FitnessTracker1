const express = require('express');
const { youtubeLimiter } = require('../middleware/rateLimiter');
const { search } = require('../controllers/youtube.controller');

const router = express.Router();

// Rate-limited to prevent RapidAPI quota exhaustion.
router.get('/youtube/search', youtubeLimiter, search);

module.exports = router;
