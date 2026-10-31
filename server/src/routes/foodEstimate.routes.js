const express = require('express');
const { protect } = require('../middleware/auth');
const { enforceAiBudget } = require('../middleware/aiBudget');
const { estimate } = require('../controllers/foodEstimate.controller');

const router = express.Router();

// Already required auth in the original (`config: { auth: {} }`).
router.post('/food-estimate', protect, enforceAiBudget('food_estimate'), estimate);

module.exports = router;
