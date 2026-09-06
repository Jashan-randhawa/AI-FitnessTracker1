/**
 * Sends a JSON error response. Ships the message both flat (`message`)
 * and nested (`error.message`) because different pages in the existing
 * React client read one or the other from Strapi's original error
 * envelope — this keeps every toast.error(...) call in the frontend
 * working without touching client code.
 *
 * @param {import('express').Response} res
 * @param {number} status HTTP status code
 * @param {string} message Human-readable error message
 * @param {object} [extra] Extra keys merged into the `error` object (e.g. `{ type: 'rate_limited' }`)
 */
const sendError = (res, status, message, extra = {}) => {
  res.status(status).json({ message, error: { message, ...extra } });
};

module.exports = sendError;
