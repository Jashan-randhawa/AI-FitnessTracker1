const express = require('express');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  requestVerification,
  confirmVerification,
} = require('../controllers/emailVerification.controller');

const router = express.Router();

router.post('/email-verification/request', authLimiter, requestVerification);
router.post('/email-verification/confirm', authLimiter, confirmVerification);

module.exports = router;
