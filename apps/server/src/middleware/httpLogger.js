const logger = require('../utils/logger');

/**
 * Structured HTTP access logger middleware.
 * Logs method, route, status code, response time, and request ID across all environments.
 */
const httpLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    // Avoid spamming health check logs unless in debug mode
    if (req.originalUrl === '/api/health' && process.env.LOG_LEVEL !== 'debug') {
      return;
    }

    const duration = Date.now() - startTime;
    const meta = {
      requestId: req.id || req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, meta);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`, meta);
    }
  });

  next();
};

module.exports = httpLogger;
