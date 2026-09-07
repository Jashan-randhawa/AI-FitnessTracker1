const express = require('express');
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  me,
  googleConnect,
  googleConnectCallback,
  googleAuthCallback,
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/auth/local/register', register);
router.post('/auth/local', login);
router.get('/users/me', protect, me);

// Google OAuth 3-hop flow
router.get('/connect/google', googleConnect);
router.get('/connect/google/callback', googleConnectCallback);
router.get('/auth/google/callback', googleAuthCallback);

module.exports = router;
