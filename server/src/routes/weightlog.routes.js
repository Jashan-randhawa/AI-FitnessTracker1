const express = require('express');
const { protect } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { logLimiter } = require('../middleware/rateLimiter');
const { create, find, remove } = require('../controllers/weightlog.controller');

const router = express.Router();

router.use(logLimiter);
router.route('/').get(protect, find).post(protect, idempotency, create);
router.delete('/:id', protect, remove);

module.exports = router;
