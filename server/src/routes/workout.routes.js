const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const { enforceAiBudget } = require('../middleware/aiBudget');
const {
  getRecommendations,
  parseVoiceSet,
} = require('../controllers/workout.controller');

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB audio cap
});

const router = express.Router();

// All workout routes require authentication
router.use(protect);

router.get('/recommendations', getRecommendations);
router.post('/parse-voice-set', audioUpload.single('audio'), enforceAiBudget('voice_set'), parseVoiceSet);

module.exports = router;
