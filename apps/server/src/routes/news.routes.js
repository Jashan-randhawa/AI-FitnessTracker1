const express = require('express');
const { protect } = require('../middleware/auth');
const { getHeadlines } = require('../controllers/news.controller');

const router = express.Router();

// Original required auth (route config had a permission scope, and only
// the "authenticated" role was granted it — "public" was not). The client
// relies on axios's global default Authorization header here rather than
// passing one explicitly, so a logged-in user still sends it.
router.get('/news/headlines', protect, getHeadlines);

module.exports = router;
