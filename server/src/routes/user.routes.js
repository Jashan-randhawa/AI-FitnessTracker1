const express = require('express');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { updateUser, setUserPassword } = require('../controllers/user.controller');

const router = express.Router();

router.put('/users/:id', protect, updateUser);
router.post('/users/me/password', authLimiter, protect, setUserPassword);

module.exports = router;
