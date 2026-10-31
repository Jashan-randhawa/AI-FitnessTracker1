const jwt = require('jsonwebtoken');

/**
 * Issues a signed JWT access token for a user id.
 * Defaults to 15 minutes for short-lived client access.
 *
 * @param {string} id Mongo ObjectId of the user
 * @param {string} [expiresIn] Token expiration string (e.g. '15m')
 */
const generateToken = (id, expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m') =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-insecure-secret-key-32chars!!', {
    expiresIn,
  });

module.exports = generateToken;
