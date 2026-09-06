const express = require('express');
const { protect } = require('../middleware/auth');
const { create, find, findOne, update, remove } = require('../controllers/activitylog.controller');

const router = express.Router();

// See foodlog.routes.js for why protect is applied per-route here rather
// than as a blanket router.use(). Mounted under '/activitylogs' in routes/index.js.
router.route('/').get(protect, find).post(protect, create);
router.route('/:id').get(protect, findOne).put(protect, update).delete(protect, remove);

module.exports = router;
