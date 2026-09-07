const express = require('express');
const { request, validate, reset } = require('../controllers/passwordReset.controller');

const router = express.Router();

// All public — no JWT required, matching the original.
router.post('/password-reset/request', request);
router.get('/password-reset/validate', validate);
router.post('/password-reset/reset', reset);

module.exports = router;
