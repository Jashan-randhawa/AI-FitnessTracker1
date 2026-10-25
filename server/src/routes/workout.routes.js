const express = require('express');
const { protect } = require('../middleware/auth');
const { getRecommendations } = require('../controllers/workout.controller');

const router = express.Router();

// All workout routes require authentication
router.use(protect);

router.get('/recommendations', getRecommendations);

module.exports = router;
