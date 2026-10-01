const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendPasswordResetEmail, sendSecurityNoticeEmail } = require('./email.service');
const { checkDistributedRateLimit, clearDistributedRateLimit } = require('../utils/redisClient');
const { recordSecurityEvent } = require('../utils/auditLogger');
const metrics = require('../utils/metrics');
const logger = require('../utils/logger');

const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_BYTES = 32;

const FAILED_ATTEMPTS_LIMIT = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

// In-memory fallback stores
const rateLimitStore = new Map();
const failedAttemptsStore = new Map();

// Track last async dispatch promise for test inspection
let _lastDispatchPromise = null;

const generateSecureToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Check per-email rate limit using distributed Redis or in-memory fallback
 * @param {string} email
 */
const checkRateLimit = async (email) => {
  return checkDistributedRateLimit(
    'ratelimit:pwreset:email',
    email.toLowerCase(),
    RATE_LIMIT_MAX,
    RATE_LIMIT_MS,
    rateLimitStore
  );
};

/**
 * Check if IP or identifier is temporarily locked out due to repeated failures (read-only check, Gap 9)
 * @param {string} identifier
 */
const checkLockout = async (identifier) => {
  const result = await checkDistributedRateLimit(
    'lockout:pwreset',
    identifier,
    FAILED_ATTEMPTS_LIMIT,
    LOCKOUT_WINDOW_MS,
    failedAttemptsStore,
    { readOnly: true }
  );
  if (result.limited) {
    return {
      locked: true,
      retryAfter: result.retryAfter || Math.ceil(LOCKOUT_WINDOW_MS / 1000),
    };
  }
  return { locked: false };
};

/**
 * Record a failed token verification or reset attempt (increments failure count)
 * @param {string} identifier
 */
const recordFailedAttempt = async (identifier) => {
  await checkDistributedRateLimit(
    'lockout:pwreset',
    identifier,
    FAILED_ATTEMPTS_LIMIT,
    LOCKOUT_WINDOW_MS,
    failedAttemptsStore,
    { readOnly: false }
  );
};

/**
 * Clear failed attempt count upon successful verification / reset
 * @param {string} identifier
 */
const clearFailedAttempts = (identifier) => {
  clearDistributedRateLimit('lockout:pwreset', identifier, failedAttemptsStore);
};

/**
 * Request password reset
 * @param {string} email
 * @param {{ ip?: string, userAgent?: string }} context
 * @returns {Promise<{ success: boolean, type: 'sent'|'rate_limited'|'locked'|'email_failed', message: string }>}
 */
const requestPasswordReset = async (email, context = {}) => {
  const normalizedEmail = email.toLowerCase().trim();
  const { ip, userAgent, requestId } = context;

  // Check lockout on IP
  if (ip) {
    const lockout = await checkLockout(ip);
    if (lockout.locked) {
      metrics.increment('password_reset_requests_total', { outcome: 'locked' });
      await recordSecurityEvent({
        event: 'PASSWORD_RESET_LOCKED',
        email: normalizedEmail,
        ip,
        userAgent,
        requestId,
        status: 'blocked',
        details: { retryAfter: lockout.retryAfter },
      });
      return {
        success: false,
        type: 'rate_limited',
        message: `Too many failed attempts. Reset functionality temporarily suspended. Try again in ${lockout.retryAfter} seconds.`,
      };
    }
  }

  // Check per-email rate limit
  const rl = await checkRateLimit(normalizedEmail);
  if (rl.limited) {
    metrics.increment('password_reset_requests_total', { outcome: 'rate_limited' });
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_RATE_LIMITED',
      email: normalizedEmail,
      ip,
      userAgent,
      requestId,
      status: 'blocked',
      details: { retryAfter: rl.retryAfter },
    });
    return {
      success: false,
      type: 'rate_limited',
      message: `Too many requests. Please try again in ${rl.retryAfter} seconds.`,
    };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    metrics.increment('password_reset_requests_total', { outcome: 'sent' });
    logger.info('[password-reset] Reset requested for non-existent email', { email: normalizedEmail, requestId });
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_REQUESTED_NONEXISTENT',
      email: normalizedEmail,
      ip,
      userAgent,
      requestId,
      status: 'success',
    });
    return {
      success: true,
      type: 'sent',
      message: 'If an account exists with this email address, a password reset link has been sent.',
    };
  }

  if (user.provider && user.provider !== 'local') {
    metrics.increment('password_reset_requests_total', { outcome: 'oauth_account' });
    logger.info('[password-reset] Reset requested for OAuth account — generating reset token to allow password setup', {
      provider: user.provider,
      requestId,
    });
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_REQUESTED_OAUTH',
      userId: user._id,
      email: normalizedEmail,
      ip,
      userAgent,
      requestId,
      status: 'success',
      details: { provider: user.provider },
    });
  }

  // Check if recipient has bounced previously (D2)
  if (user.emailBounced) {
    logger.warn('[password-reset] Skipping email dispatch for bounced recipient', {
      userId: user._id,
      email: normalizedEmail,
      requestId,
    });
    return {
      success: true,
      type: 'sent',
      message: 'If an account exists with this email address, a password reset link has been sent.',
    };
  }

  // F2: 60-Second Debounce Guard
  // If an active token was already issued within the last 60s, do not generate a new token
  // and do not send duplicate email. Preserve the active token so existing link remains valid.
  const COOLDOWN_MS = 60 * 1000;
  if (user.resetPasswordExpires && user.resetPasswordTokenHash) {
    const expiresTime = user.resetPasswordExpires instanceof Date
      ? user.resetPasswordExpires.getTime()
      : new Date(user.resetPasswordExpires).getTime();
    const issuedAt = expiresTime - TOKEN_EXPIRY_MS;
    const elapsed = Date.now() - issuedAt;

    if (elapsed >= 0 && elapsed < COOLDOWN_MS && expiresTime > Date.now()) {
      logger.info('[password-reset] Debouncing duplicate reset request within 60s cooldown', {
        userId: user._id,
        email: normalizedEmail,
        requestId,
        elapsedMs: elapsed,
      });
      return {
        success: true,
        type: 'sent',
        message: 'If an account exists with this email address, a password reset link has been sent.',
        debounced: true,
      };
    }
  }

  const plainToken = generateSecureToken();
  user.resetPasswordTokenHash = hashToken(plainToken);
  user.resetPasswordExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await user.save({ validateModifiedOnly: true });

  const clientBaseUrl = (process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app').replace(/\/$/, '');
  const resetUrl = `${clientBaseUrl}/reset-password`;
  const isGoogleAccount = Boolean(user.provider === 'google' || user.googleId);

  // Asynchronous background dispatch (D3 / Gap 1: eliminate timing oracle)
  const dispatchPromise = (async () => {
    try {
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        plainToken,
        isGoogleAccount,
        requestId,
      });

      if (!emailResult.sent) {
        metrics.increment('password_reset_requests_total', { outcome: 'email_failed' });
        logger.error('[password-reset] Email delivery failed', { reason: emailResult.reason, requestId });
        await recordSecurityEvent({
          event: 'PASSWORD_RESET_EMAIL_FAILED',
          userId: user._id,
          email: normalizedEmail,
          ip,
          userAgent,
          requestId,
          status: 'failure',
          details: { reason: emailResult.reason },
        });

        // Gap 8: Clear token on email delivery failure to avoid orphaned active tokens
        try {
          await User.updateOne(
            { _id: user._id },
            { $unset: { resetPasswordTokenHash: 1, resetPasswordExpires: 1 } }
          );
        } catch (cleanupErr) {
          logger.error('[password-reset] Failed to clear token after email delivery failure', {
            error: cleanupErr.message,
            requestId,
          });
        }
      } else {
        metrics.increment('password_reset_requests_total', { outcome: 'sent' });
        await recordSecurityEvent({
          event: 'PASSWORD_RESET_REQUESTED',
          userId: user._id,
          email: normalizedEmail,
          ip,
          userAgent,
          requestId,
          status: 'success',
        });
      }
    } catch (err) {
      logger.error('[password-reset] Unexpected error in background email dispatch', {
        error: err.message,
        requestId,
      });
      try {
        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordTokenHash: 1, resetPasswordExpires: 1 } }
        );
      } catch (_) {}
    }
  })();

  _lastDispatchPromise = dispatchPromise;

  return {
    success: true,
    type: 'sent',
    message: 'If an account exists with this email address, a password reset link has been sent.',
  };
};

/**
 * Locate user by token using constant-time comparison
 * @param {string} token
 */
const findUserByToken = async (token) => {
  if (!token || typeof token !== 'string') return null;
  const hashedToken = hashToken(token.trim());

  // Indexed field lookup
  const user = await User.findOne({ resetPasswordTokenHash: hashedToken }).select(
    '+password +resetPasswordTokenHash +resetPasswordExpires +passwordHistory'
  );
  if (!user || !user.resetPasswordTokenHash) return null;

  // Constant-time comparison to prevent timing side channels
  const userHashBuf = Buffer.from(user.resetPasswordTokenHash, 'hex');
  const inputHashBuf = Buffer.from(hashedToken, 'hex');
  if (
    userHashBuf.length === 0 ||
    userHashBuf.length !== inputHashBuf.length ||
    !crypto.timingSafeEqual(userHashBuf, inputHashBuf)
  ) {
    return null;
  }

  return { user, expiresAt: user.resetPasswordExpires?.getTime() ?? 0 };
};

/**
 * Validate reset token
 * @param {string} token
 * @param {{ ip?: string, userAgent?: string }} context
 */
const validateResetToken = async (token, context = {}) => {
  const { ip, userAgent, requestId } = context;

  if (ip) {
    const lockout = await checkLockout(ip);
    if (lockout.locked) {
      metrics.increment('password_reset_validations_total', { outcome: 'locked' });
      await recordSecurityEvent({
        event: 'PASSWORD_RESET_VALIDATE_LOCKED',
        ip,
        userAgent,
        requestId,
        status: 'blocked',
      });
      return { valid: false, message: 'Too many attempts. Please try again later.' };
    }
  }

  const result = await findUserByToken(token);
  if (!result) {
    metrics.increment('password_reset_validations_total', { outcome: 'invalid' });
    if (ip) await recordFailedAttempt(ip);
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_INVALID_TOKEN',
      ip,
      userAgent,
      requestId,
      status: 'failure',
    });
    return { valid: false, message: 'Invalid or expired link.' };
  }

  if (Date.now() > result.expiresAt) {
    metrics.increment('password_reset_validations_total', { outcome: 'expired' });
    if (ip) await recordFailedAttempt(ip);
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_EXPIRED_TOKEN',
      userId: result.user._id,
      email: result.user.email,
      ip,
      userAgent,
      requestId,
      status: 'warning',
    });
    return { valid: false, message: 'This link has expired. Please request a new one.' };
  }

  metrics.increment('password_reset_validations_total', { outcome: 'valid' });
  await recordSecurityEvent({
    event: 'PASSWORD_RESET_TOKEN_VALIDATED',
    userId: result.user._id,
    email: result.user.email,
    ip,
    userAgent,
    requestId,
    status: 'success',
  });

  return { valid: true, message: 'Token is valid.' };
};

/**
 * Reset password with history and lockout protection
 * @param {string} token
 * @param {string} newPassword
 * @param {{ ip?: string, userAgent?: string, requestId?: string }} context
 */
const resetPassword = async (token, newPassword, context = {}) => {
  const { ip, userAgent, requestId } = context;

  if (ip) {
    const lockout = await checkLockout(ip);
    if (lockout.locked) {
      metrics.increment('password_reset_completions_total', { outcome: 'locked' });
      return {
        success: false,
        message: `Too many failed attempts. Please try again after ${lockout.retryAfter} seconds.`,
      };
    }
  }

  if (!token?.trim()) return { success: false, message: 'Reset token is required.' };
  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }

  const result = await findUserByToken(token);
  if (!result) {
    metrics.increment('password_reset_completions_total', { outcome: 'invalid' });
    if (ip) await recordFailedAttempt(ip);
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_INVALID_TOKEN',
      ip,
      userAgent,
      requestId,
      status: 'failure',
    });
    return { success: false, message: 'Invalid or expired link.' };
  }

  if (Date.now() > result.expiresAt) {
    metrics.increment('password_reset_completions_total', { outcome: 'expired' });
    if (ip) await recordFailedAttempt(ip);
    await recordSecurityEvent({
      event: 'PASSWORD_RESET_EXPIRED_TOKEN',
      userId: result.user._id,
      email: result.user.email,
      ip,
      userAgent,
      requestId,
      status: 'warning',
    });
    return { success: false, message: 'This link has expired. Please request a new one.' };
  }

  const user = result.user;

  // Prevent reuse of current password
  if (user.password) {
    const isCurrentPassword = await bcrypt.compare(newPassword, user.password);
    if (isCurrentPassword) {
      metrics.increment('password_reset_completions_total', { outcome: 'reuse_blocked' });
      await recordSecurityEvent({
        event: 'PASSWORD_RESET_CURRENT_REUSE_BLOCKED',
        userId: user._id,
        email: user.email,
        ip,
        userAgent,
        requestId,
        status: 'blocked',
      });
      return {
        success: false,
        message: 'You cannot reuse your current password. Please choose a new one.',
      };
    }
  }

  // Prevent reuse of any recent password from passwordHistory (last 5)
  if (Array.isArray(user.passwordHistory) && user.passwordHistory.length > 0) {
    for (const item of user.passwordHistory) {
      if (item?.hash) {
        const isHistorical = await bcrypt.compare(newPassword, item.hash);
        if (isHistorical) {
          metrics.increment('password_reset_completions_total', { outcome: 'reuse_blocked' });
          await recordSecurityEvent({
            event: 'PASSWORD_RESET_HISTORY_REUSE_BLOCKED',
            userId: user._id,
            email: user.email,
            ip,
            userAgent,
            requestId,
            status: 'blocked',
          });
          return {
            success: false,
            message: 'You cannot reuse a recent password. Please choose a different one.',
          };
        }
      }
    }
  }

  // Save previous password hash into history (keep max 5 entries)
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

  user.password = newPassword; // pre-save hook hashes it with bcrypt
  user.hasPassword = true;
  user.emailVerified = true;
  user.passwordChangedAt = new Date();
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  // Async security notice
  sendSecurityNoticeEmail({
    to: user.email,
    kind: 'password_changed',
  }).catch((err) => {
    logger.error('[security-notice] Failed to dispatch password change notice after reset', {
      error: err.message,
      requestId,
    });
  });

  if (ip) clearFailedAttempts(ip);

  metrics.increment('password_reset_completions_total', { outcome: 'success' });
  await recordSecurityEvent({
    event: 'PASSWORD_RESET_SUCCESS',
    userId: user._id,
    email: user.email,
    ip,
    userAgent,
    requestId,
    status: 'success',
  });

  return { success: true, message: 'Password updated successfully.' };
};

module.exports = {
  checkRateLimit,
  checkLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  requestPasswordReset,
  findUserByToken,
  validateResetToken,
  resetPassword,
  getLastDispatchPromise: () => _lastDispatchPromise,
  _resetLastDispatchPromise: () => {
    _lastDispatchPromise = null;
  },
};
