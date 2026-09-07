const sendError = require('../utils/sendError');

const notFound = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    return sendError(res, 400, err.message);
  }
  if (err && err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return sendError(res, 400, message);
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    return sendError(res, 400, `${field} is already taken`);
  }

  console.error(err);
  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  sendError(res, status, err?.message || 'Something went wrong. Please try again.');
};

module.exports = { notFound, errorHandler };
