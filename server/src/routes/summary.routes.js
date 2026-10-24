const express = require('express');
const { protect } = require('../middleware/auth');
const { getDaySummary, getRangeSummary } = require('../controllers/summary.controller');

const router = express.Router();

// Mounted under '/summary' in routes/index.js; protect applied per route, as elsewhere.
router.get('/day', protect, getDaySummary);
router.get('/range', protect, getRangeSummary);

module.exports = router;
