const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { analyze } = require('../controllers/imageAnalysis.controller');

const router = express.Router();

// Original manually checked for a Bearer header without verifying it; this
// verifies the JWT for real. Every call site already sends a valid token.
router.post('/image-analysis', protect, upload.single('image'), analyze);

module.exports = router;
