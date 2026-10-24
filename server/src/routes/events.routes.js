const express = require('express');
const { protect } = require('../middleware/auth');
const { createTicket, stream } = require('../controllers/events.controller');

const router = express.Router();

// Mounted under '/events'. The stream itself is authorised by its ticket, not a header.
router.post('/ticket', protect, createTicket);
router.get('/', stream);

module.exports = router;
