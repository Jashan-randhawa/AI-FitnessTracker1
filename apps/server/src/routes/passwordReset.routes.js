const express = require('express');
const { passwordResetLimiter } = require('../middleware/rateLimiter');
const { request, validate, reset } = require('../controllers/passwordReset.controller');

const router = express.Router();

// All public — no JWT required, rate limited to prevent brute forcing and enumeration.
router.post('/password-reset/request', passwordResetLimiter, request);
router.get('/password-reset/validate', passwordResetLimiter, validate);
router.post('/password-reset/reset', passwordResetLimiter, reset);

module.exports = router;
