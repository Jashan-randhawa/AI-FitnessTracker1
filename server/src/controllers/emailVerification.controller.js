const asyncHandler = require('express-async-handler');
const sendError = require('../utils/sendError');
const {
  verifyEmailToken,
  requestEmailVerification,
} = require('../services/emailVerification.service');

// POST /api/email-verification/request
const requestVerification = asyncHandler(async (req, res) => {
  const email = req.body?.email || req.user?.email;
  if (!email) {
    return sendError(res, 400, 'Email is required');
  }

  const result = await requestEmailVerification(email, {
    clientBaseUrl: req.headers ? req.headers.origin : undefined,
    ip: req.ip,
    userAgent: req.headers ? req.headers['user-agent'] : undefined,
  });

  res.json({
    status: 'success',
    message: result.message,
    alreadyVerified: Boolean(result.alreadyVerified),
  });
});

// POST /api/email-verification/confirm
const confirmVerification = asyncHandler(async (req, res) => {
  const token = req.body?.token || req.body?.code;
  if (!token) {
    return sendError(res, 400, 'Verification code is required');
  }

  const result = await verifyEmailToken(token, {
    ip: req.ip,
    userAgent: req.headers ? req.headers['user-agent'] : undefined,
  });

  if (!result.success) {
    return sendError(res, 400, result.message);
  }

  res.json({
    status: 'success',
    message: result.message,
    user: result.user ? (typeof result.user.toJSON === 'function' ? result.user.toJSON() : result.user) : undefined,
  });
});

module.exports = {
  requestVerification,
  confirmVerification,
};
