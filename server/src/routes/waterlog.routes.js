const express = require('express');
const { protect } = require('../middleware/auth');
const { create, find, remove } = require('../controllers/waterlog.controller');

const router = express.Router();

// See foodlog.routes.js for why protect is applied per-route here rather
// than as a blanket router.use(). Mounted under '/waterlogs' in routes/index.js.
router.route('/').get(protect, find).post(protect, create);
router.delete('/:id', protect, remove);

module.exports = router;
