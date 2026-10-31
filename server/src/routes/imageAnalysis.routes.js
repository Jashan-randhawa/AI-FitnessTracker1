const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { foodSnapRateLimiter } = require('../middleware/aiRateLimiter');
const { validateFoodSnapUpload } = require('../middleware/aiValidation');
const upload = require('../middleware/upload');
const { analyze } = require('../controllers/imageAnalysis.controller');

const router = express.Router();

// Protected with JWT auth. Upload & validation execute BEFORE AI rate limiters
// so malformed, spoofed, or oversized payloads never consume user AI quota.
router.post(
  '/image-analysis',
  protect,
  express.json({ limit: '7mb' }),
  upload.single('image'),
  validateFoodSnapUpload,
  foodSnapRateLimiter,
  aiLimiter,
  analyze
);

module.exports = router;
