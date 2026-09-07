const jwt = require('jsonwebtoken');

/**
 * Issues a signed JWT for a user id — the MERN equivalent of Strapi's
 * `getService('jwt').issue({ id: user.id })`.
 * @param {string} id Mongo ObjectId of the user
 */
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

module.exports = generateToken;
