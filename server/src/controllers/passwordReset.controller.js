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
  console.log('[password-reset] request called with email:', email);

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: { message: 'Email is required.' } });
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: { message: 'Invalid email format.' } });
  }

  const result = await requestPasswordReset(email.trim().toLowerCase());
  console.log('[password-reset] requestPasswordReset result:', result);

  if (!result.success) {
    const status =
      result.type === 'rate_limited' ? 429
      : result.type === 'not_found' ? 404
      : result.type === 'google' ? 422
      : result.type === 'email_failed' ? 502
      : 400;
    return res.status(status).json({ error: { type: result.type, message: result.message } });
  }

  res.json({ type: result.type, message: result.message });
});

// GET /api/password-reset/validate?code=TOKEN
const validate = asyncHandler(async (req, res) => {
  const token = req.query?.code || '';
  console.log('[password-reset] validate called, token length:', token.length);

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Reset code is required.' });
  }

  const result = await validateResetToken(token);
  console.log('[password-reset] validateResetToken result:', result);
  res.status(result.valid ? 200 : 400).json(result);
});

// POST /api/password-reset/reset
const reset = asyncHandler(async (req, res) => {
  const { code, newPassword } = req.body;
  console.log(
    '[password-reset] reset called, code length:',
    code?.length,
    'password length:',
    newPassword?.length
  );

  if (!code || !newPassword) {
    return res.status(400).json({ error: { message: 'Reset code and new password are required.' } });
  }

  const result = await resetPassword(code, newPassword);
  console.log('[password-reset] resetPassword result:', result);

  if (!result.success) {
    return res.status(400).json({ error: { message: result.message } });
  }

  res.json({ message: result.message });
});

module.exports = { request, validate, reset };
