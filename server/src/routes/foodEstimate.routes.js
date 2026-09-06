const express = require('express');
const { protect } = require('../middleware/auth');
const { estimate } = require('../controllers/foodEstimate.controller');

const router = express.Router();

// Already required auth in the original (`config: { auth: {} }`).
router.post('/food-estimate', protect, estimate);

module.exports = router;
