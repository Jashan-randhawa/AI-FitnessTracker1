const express = require('express');
const { protect } = require('../middleware/auth');
const { find, create, deleteAll } = require('../controllers/chathistory.controller');

const router = express.Router();

// See foodlog.routes.js for why protect is applied per-route here rather
// than as a blanket router.use(). Mounted under '/chathistories' in routes/index.js.
router.route('/').get(protect, find).post(protect, create);
router.delete('/all', protect, deleteAll);

module.exports = router;
