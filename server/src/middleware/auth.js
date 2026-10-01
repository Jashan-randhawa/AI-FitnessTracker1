const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const sendError = require('../utils/sendError');

/**
 * Requires a valid `Authorization: Bearer <token>` header, matching every
 * page in the client that already sends one. Populates req.user with the
 * full Mongo user document (equivalent of Strapi's ctx.state.user).
 */
const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return sendError(res, 401, 'You must be logged in');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+passwordChangedAt');

    if (!user) {
      return sendError(res, 401, 'You must be logged in');
    }
    if (user.blocked) {
      return sendError(res, 403, 'Your account has been blocked by an administrator');
    }

    // Phase P2: Session safety — invalidate tokens issued before passwordChangedAt
    if (user.passwordChangedAt && decoded.iat) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        return sendError(res, 401, 'Password recently changed. Session expired. Please log in again.');
      }
    }

    req.user = user;
    req.auth = decoded;
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired token');
  }
});

/**
 * Enforces step-up authentication within a maximum time window (default 15 mins / 900s)
 */
const requireRecentLogin = (maxAgeSeconds = 900) => (req, res, next) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenIat = req.auth?.iat;

  if (!tokenIat || (nowSeconds - tokenIat) > maxAgeSeconds) {
    return res.status(403).json({
      code: 'reauth_required',
      error: {
        message: 'Recent authentication required to perform this action. Please re-authenticate.',
      },
    });
  }

  next();
};

module.exports = { protect, requireRecentLogin };
