const express = require('express');
const { protect } = require('../middleware/auth');
const idempotency = require('../middleware/idempotency');
const { create, find, update, remove } = require('../controllers/waterlog.controller');

const router = express.Router();

// See foodlog.routes.js for why protect is applied per-route here rather
// than as a blanket router.use(). Mounted under '/waterlogs' in routes/index.js.
router.route('/').get(protect, find).post(protect, idempotency, create);
router.put('/:id', protect, update);
router.delete('/:id', protect, remove);

module.exports = router;
