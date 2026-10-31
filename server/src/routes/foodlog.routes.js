const express = require('express');
const { protect } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { logLimiter } = require('../middleware/rateLimiter');
const { create, find, findOne, update, remove } = require('../controllers/foodlog.controller');

const router = express.Router();

// protect is applied per-route (not as a blanket router.use()) — a bare
// `.use(protect)` here would run for every request that reaches this
// router, not just the ones matching /foodlogs, because this router is
// mounted under an explicit '/foodlogs' prefix in routes/index.js and paths
// below are relative to it.
router.use(logLimiter);
router.route('/').get(protect, find).post(protect, idempotency, create);
router.route('/:id').get(protect, findOne).put(protect, update).delete(protect, remove);

module.exports = router;
