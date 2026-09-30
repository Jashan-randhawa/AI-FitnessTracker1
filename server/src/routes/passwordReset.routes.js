const express = require('express');
const { passwordResetLimiter } = require('../middleware/rateLimiter');
const { verifyCsrfAndOrigin } = require('../middleware/csrfProtection');
const { request, validate, reset } = require('../controllers/passwordReset.controller');

const router = express.Router();

// All public — no JWT required, rate limited and protected against CSRF & enumeration.
router.post('/password-reset/request', passwordResetLimiter, verifyCsrfAndOrigin, request);
router.get('/password-reset/validate', passwordResetLimiter, validate);
router.post('/password-reset/reset', passwordResetLimiter, verifyCsrfAndOrigin, reset);

module.exports = router;
