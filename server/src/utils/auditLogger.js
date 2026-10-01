/**
 * Security Audit Logger for AI-FitnessTracker1
 * Persists high-priority security events (auth, password reset, account lockout)
 * to MongoDB and emits structured security log entries.
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const AuditLog = require('../models/AuditLog');

/**
 * Mask an email address for privacy in public log streams (e.g. j***n@domain.com)
 * @param {string} email
 * @returns {string}
 */
const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return 'anonymous';
  const parts = email.split('@');
  if (parts.length !== 2) return '[REDACTED_EMAIL]';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
};

/**
 * Record a security event.
 * @param {object} params
 * @param {string} params.event - e.g. 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_SUCCESS'
 * @param {string} [params.userId]
 * @param {string} [params.email]
 * @param {string} [params.ip]
 * @param {string} [params.userAgent]
 * @param {'success'|'failure'|'blocked'|'warning'} [params.status='success']
 * @param {object} [params.details={}]
 */
const recordSecurityEvent = async ({
  event,
  userId,
  email,
  ip,
  userAgent,
  requestId,
  status = 'success',
  details = {},
}) => {
  const safeEmail = email ? email.toLowerCase().trim() : undefined;
  const masked = safeEmail ? maskEmail(safeEmail) : undefined;

  // 1. Emit structured log
  const logMessage = `[SECURITY_AUDIT] ${event} [${status.toUpperCase()}]`;
  const meta = {
    type: 'security_audit',
    event,
    status,
    userId: userId ? String(userId) : undefined,
    email: masked,
    ip: ip || 'unknown',
    userAgent: userAgent ? userAgent.substring(0, 150) : undefined,
    requestId: requestId || undefined,
    details,
  };

  if (status === 'failure' || status === 'blocked') {
    logger.warn(logMessage, meta);
  } else {
    logger.info(logMessage, meta);
  }

  // 2. Persist to MongoDB if connected
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await AuditLog.create({
        event,
        userId: userId || undefined,
        email: safeEmail,
        ip: ip || 'unknown',
        userAgent: userAgent ? userAgent.substring(0, 255) : undefined,
        status,
        details,
      });
    }
  } catch (err) {
    // Audit logging should never break user requests
    logger.warn('[audit] Could not persist audit entry to database:', { error: err.message });
  }
};

module.exports = {
  recordSecurityEvent,
  maskEmail,
};
