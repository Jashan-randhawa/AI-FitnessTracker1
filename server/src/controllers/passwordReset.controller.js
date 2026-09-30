const asyncHandler = require('express-async-handler');
const {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} = require('../services/passwordReset.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/password-reset/request
const request = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: { message: 'Email is required.' } });
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: { message: 'Invalid email format.' } });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await requestPasswordReset(email.trim().toLowerCase(), context);

  if (!result.success) {
    const status =
      result.type === 'rate_limited' ? 429
      : result.type === 'email_failed' ? 502
      : 400;
    return res.status(status).json({ error: { type: result.type, message: result.message } });
  }

  res.json({ type: result.type, message: result.message });
});

// GET /api/password-reset/validate?code=TOKEN
const validate = asyncHandler(async (req, res) => {
  const token = req.query?.code || '';

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Reset code is required.' });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await validateResetToken(token, context);
  res.status(result.valid ? 200 : 400).json(result);
});

// POST /api/password-reset/reset
const reset = asyncHandler(async (req, res) => {
  const { code, newPassword } = req.body;

  if (!code || !newPassword) {
    return res.status(400).json({ error: { message: 'Reset code and new password are required.' } });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await resetPassword(code, newPassword, context);

  if (!result.success) {
    return res.status(400).json({ error: { message: result.message } });
  }

  res.json({ message: result.message });
});

module.exports = { request, validate, reset };
