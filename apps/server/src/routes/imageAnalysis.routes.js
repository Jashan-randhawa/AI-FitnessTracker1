const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const { analyze } = require('../controllers/imageAnalysis.controller');

const router = express.Router();

// Protected with JWT auth and rate limited to protect vision model API quotas.
router.post('/image-analysis', protect, aiLimiter, upload.single('image'), analyze);

module.exports = router;
