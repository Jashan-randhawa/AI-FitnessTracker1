const express = require('express');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { foodSnapRateLimiter } = require('../middleware/aiRateLimiter');
const { validateFoodSnapUpload } = require('../middleware/aiValidation');
const { enforceAiBudget } = require('../middleware/aiBudget');
const upload = require('../middleware/upload');
const { analyze } = require('../controllers/imageAnalysis.controller');

const router = express.Router();

// Protected with JWT auth. Upload & validation execute BEFORE AI rate limiters
// and daily budget so malformed, spoofed, or oversized payloads never consume user AI quota.
router.post(
  '/image-analysis',
  protect,
  express.json({ limit: '7mb' }),
  upload.single('image'),
  validateFoodSnapUpload,
  foodSnapRateLimiter,
  aiLimiter,
  enforceAiBudget('food_snap'),
  analyze
);

module.exports = router;
