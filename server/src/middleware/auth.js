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
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 401, 'You must be logged in');
    }
    if (user.blocked) {
      return sendError(res, 403, 'Your account has been blocked by an administrator');
    }

    req.user = user;
    next();
  } catch (err) {
    return sendError(res, 401, 'Invalid or expired token');
  }
});

module.exports = { protect };
