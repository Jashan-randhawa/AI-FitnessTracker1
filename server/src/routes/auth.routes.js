const express = require('express');
const cookieParser = require('cookie-parser');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyCsrfAndOrigin } = require('../middleware/csrfProtection');
const {
  register,
  login,
  me,
  refresh,
  logout,
  googleConnect,
  googleConnectCallback,
  googleAuthCallback,
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/auth/local/register', authLimiter, register);
router.post('/auth/local', authLimiter, login);
router.post('/auth/refresh', cookieParser(), authLimiter, verifyCsrfAndOrigin, refresh);
router.post('/auth/logout', cookieParser(), verifyCsrfAndOrigin, logout);
router.get('/users/me', protect, me);

// Google OAuth flow
router.get('/connect/google', googleConnect);
router.get('/connect/google/callback', googleConnectCallback);
router.post('/auth/google/callback', cookieParser(), googleAuthCallback);

module.exports = router;
