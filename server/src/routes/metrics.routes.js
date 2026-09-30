const express = require('express');
const { getMetrics } = require('../controllers/metrics.controller');

const router = express.Router();

router.get('/metrics', getMetrics);

module.exports = router;
