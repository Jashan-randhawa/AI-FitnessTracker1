const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { foodSnapRateLimiter } = require('../middleware/aiRateLimiter');
const { validateFoodSnapUpload } = require('../middleware/aiValidation');
const upload = require('../middleware/upload');
const { analyze } = require('../controllers/imageAnalysis.controller');

const router = express.Router();

// Protected with JWT auth, token-bucket rate limiter (10 req/hr), upload validation, and handler
router.post(
  '/image-analysis',
  protect,
  foodSnapRateLimiter,
  aiLimiter,
  upload.single('image'),
  validateFoodSnapUpload,
  analyze
);

module.exports = router;
