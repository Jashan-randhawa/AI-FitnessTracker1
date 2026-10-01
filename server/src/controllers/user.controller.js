const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const sendError = require('../utils/sendError');
const generateToken = require('../utils/generateToken');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');
const { checkPasswordReuse } = require('../utils/passwordReuse');
const { sendSecurityNoticeEmail } = require('../services/email.service');
const { recordSecurityEvent } = require('../utils/auditLogger');
const logger = require('../utils/logger');

// Fields the client actually sends via Onboarding/Profile — anything else
// in the body (email, username, password, role, etc.) is ignored.
const ALLOWED_FIELDS = [
  'age',
  'weight',
  'height',
  'goal',
  'dailycaloriesintake',
  'dailycaloriesburned',
  'onboardedAt',
];

// PUT /api/users/:id
// Strapi's default users-permissions `user.update` action does NOT restrict
// this to the caller's own record by default. Scoping it to req.user here
// is a deliberate hardening — the client only ever calls this with its own
// id, so behavior for the app is unchanged.
const updateUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id === 'me' ? String(req.user._id) : req.params.id;
  if (targetId !== String(req.user._id)) {
    return sendError(res, 403, 'You can only update your own profile');
  }

  const updates = {};
  ALLOWED_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  // Support editing username
  if (req.body.username !== undefined) {
    const rawUsername = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    if (!rawUsername || rawUsername.length < 3) {
      return sendError(res, 400, 'Username must be at least 3 characters');
    }
    if (rawUsername.length > 30) {
      return sendError(res, 400, 'Username must be at most 30 characters');
    }

    // Check if new username is different from current username
    if (rawUsername.toLowerCase() !== (req.user.username || '').toLowerCase()) {
      const escaped = rawUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existing = await User.findOne({
        username: { $regex: new RegExp(`^${escaped}$`, 'i') },
        _id: { $ne: req.user._id },
      });
      if (existing) {
        return sendError(res, 409, 'Username is already taken');
      }
    }
    updates.username = rawUsername;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  res.json(user.toJSON());
});

// POST /api/users/me/password
const setUserPassword = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const userQuery = User.findById(userId);
  const user = await (userQuery && typeof userQuery.select === 'function'
    ? userQuery.select('+password +passwordHistory +passwordChangedAt')
    : userQuery);

  if (!user) {
    return sendError(res, 404, 'User not found');
  }

  const { currentPassword, newPassword } = req.body || {};

  // Case A: User has no password (first-time password add on OAuth account)
  if (!user.hasPassword) {
    const now = Math.floor(Date.now() / 1000);
    const iat = req.auth?.iat || Math.floor(Date.now() / 1000);
    const tokenAge = now - iat;
    const MAX_STEP_UP_AGE = 900; // 15 minutes

    if (tokenAge > MAX_STEP_UP_AGE) {
      return res.status(403).json({
        status: 'fail',
        code: 'reauth_required',
        message: 'Recent authentication required to set a password',
        error: {
          code: 'reauth_required',
          message: 'Recent authentication required to set a password',
        },
      });
    }
  } else {
    // Case B: User already has a password -> require currentPassword
    if (!currentPassword) {
      return sendError(res, 400, 'Current password is required');
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 400, 'Current password is incorrect');
    }
  }

  if (!newPassword) {
    return sendError(res, 400, 'New password is required');
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return sendError(res, 400, policy.message);
  }

  const reuse = await checkPasswordReuse(newPassword, user.password, user.passwordHistory);
  if (reuse.isReused) {
    return sendError(res, 400, 'You cannot reuse a recent password');
  }

  const wasSet = user.hasPassword;

  if (user.password) {
    if (!Array.isArray(user.passwordHistory)) {
      user.passwordHistory = [];
    }
    user.passwordHistory.push({
      hash: user.password,
      changedAt: new Date(),
    });
    if (user.passwordHistory.length > 5) {
      user.passwordHistory = user.passwordHistory.slice(-5);
    }
  }

  user.password = newPassword;
  user.hasPassword = true;
  user.passwordChangedAt = new Date();
  await user.save();

  // Async security notice
  sendSecurityNoticeEmail({
    to: user.email,
    kind: wasSet ? 'password_changed' : 'password_added',
  }).catch((err) => {
    logger.error('[security-notice] Failed to dispatch password change notice', {
      error: err.message,
    });
  });

  await recordSecurityEvent({
    event: wasSet ? 'PASSWORD_CHANGED' : 'PASSWORD_ADDED',
    userId: user._id,
    email: user.email,
    ip: req.ip,
    userAgent: req.headers ? req.headers['user-agent'] : undefined,
    status: 'success',
  });

  const freshJwt = generateToken(user._id);

  res.json({
    status: 'success',
    message: wasSet ? 'Password changed successfully' : 'Password added successfully',
    jwt: freshJwt,
    user: user.toJSON(),
  });
});

module.exports = { updateUser, setUserPassword };

