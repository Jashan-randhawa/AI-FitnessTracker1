const jwt = require('jsonwebtoken');

/**
 * Issues a signed JWT for a user id.
 * @param {string} id Mongo ObjectId of the user
 */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-insecure-secret-key-32chars!!', {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

module.exports = generateToken;
