const asyncHandler = require('express-async-handler');
const {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} = require('../services/passwordReset.service');
const {
  requestResetSchema,
  validateTokenSchema,
  resetPasswordSchema,
} = require('../schemas/passwordReset.schema');

// POST /api/password-reset/request
const request = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: { message: 'Email is required.' } });
  }

  const parsed = requestResetSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid email format.';
    return res.status(400).json({ error: { message } });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.id || req.requestId || req.headers['x-request-id'],
  };

  const result = await requestPasswordReset(parsed.data.email, context);

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
  const token = req.query?.code;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ valid: false, message: 'Reset code is required.' });
  }

  const parsed = validateTokenSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ valid: false, message: 'Reset code is required.' });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.id || req.requestId || req.headers['x-request-id'],
  };

  const result = await validateResetToken(parsed.data.code, context);
  res.status(result.valid ? 200 : 400).json(result);
});

// POST /api/password-reset/reset
const reset = asyncHandler(async (req, res) => {
  const { code, newPassword } = req.body || {};
  if (!code || !newPassword) {
    return res.status(400).json({ error: { message: 'Reset code and new password are required.' } });
  }

  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Reset code and new password are required.';
    return res.status(400).json({ error: { message } });
  }

  const context = {
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
    requestId: req.id || req.requestId || req.headers['x-request-id'],
  };

  const result = await resetPassword(parsed.data.code, parsed.data.newPassword, context);

  if (!result.success) {
    return res.status(400).json({ error: { message: result.message } });
  }

  res.json({ message: result.message });
});

module.exports = { request, validate, reset };
