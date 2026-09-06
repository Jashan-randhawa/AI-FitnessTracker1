const express = require('express');
const { search } = require('../controllers/youtube.controller');

const router = express.Router();

// Public in the original (`auth: false`) — left as-is.
router.get('/youtube/search', search);

module.exports = router;
