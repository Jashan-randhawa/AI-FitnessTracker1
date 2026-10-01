const crypto = require('crypto');
const User = require('../models/User');
const { sendVerificationEmail } = require('./email.service');
const { recordSecurityEvent } = require('../utils/auditLogger');
const logger = require('../utils/logger');

const TOKEN_BYTES = 32;
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const hashToken = (token) => crypto.createHash('sha256').update(String(token).trim()).digest('hex');

/**
 * Generate a cryptographically secure random token and its sha256 hash
 */
const generateVerificationToken = () => {
  const plainToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(plainToken);
  const expires = new Date(Date.now() + EXPIRY_MS);
  return { plainToken, tokenHash, expires };
};

/**
 * Sends a verification email for the given user record
 */
const sendVerificationForUser = async (user, clientBaseUrl) => {
  if (!user || user.emailVerified) return null;
  const { plainToken, tokenHash, expires } = generateVerificationToken();
  user.emailVerificationTokenHash = tokenHash;
  user.emailVerificationExpires = expires;
  await user.save();

  const baseUrl = (clientBaseUrl || process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app').replace(/\/$/, '');
  const verifyUrl = `${baseUrl}/verify-email`;

  sendVerificationEmail({
    to: user.email,
    plainToken,
    verifyUrl,
  }).catch((err) => {
    logger.error('[email-verification] Failed to send verification email', { error: err.message });
  });

  return { plainToken };
};

/**
 * Verifies email verification token and marks user as emailVerified
 */
const verifyEmailToken = async (plainToken, context = {}) => {
  if (!plainToken || typeof plainToken !== 'string') {
    return { success: false, message: 'Verification code is required' };
  }

  const hashed = hashToken(plainToken);
  const userQuery = User.findOne({ emailVerificationTokenHash: hashed });
  const user = await (userQuery && typeof userQuery.select === 'function'
    ? userQuery.select('+emailVerificationTokenHash +emailVerificationExpires')
    : userQuery);

  if (!user || !user.emailVerificationTokenHash) {
    return { success: false, message: 'Invalid or expired verification link' };
  }

  // Constant-time check
  const storedBuf = Buffer.from(user.emailVerificationTokenHash, 'hex');
  const inputBuf = Buffer.from(hashed, 'hex');
  if (storedBuf.length === 0 || storedBuf.length !== inputBuf.length || !crypto.timingSafeEqual(storedBuf, inputBuf)) {
    return { success: false, message: 'Invalid or expired verification link' };
  }

  if (user.emailVerificationExpires && Date.now() > user.emailVerificationExpires.getTime()) {
    return { success: false, message: 'Verification link has expired. Please request a new one.' };
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  await recordSecurityEvent({
    event: 'EMAIL_VERIFIED',
    userId: user._id,
    email: user.email,
    ip: context.ip,
    userAgent: context.userAgent,
    status: 'success',
  });

  return { success: true, message: 'Email verified successfully', user };
};

/**
 * Request a new verification email for an unverified address
 */
const requestEmailVerification = async (email, context = {}) => {
  if (!email || typeof email !== 'string') {
    return { success: false, message: 'Email is required' };
  }

  const normalized = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalized });

  // Uniform response to prevent enumeration
  if (!user) {
    return { success: true, message: 'If an account exists, a verification link has been sent.' };
  }

  if (user.emailVerified) {
    return { success: true, message: 'If an account exists, a verification link has been sent.', alreadyVerified: true };
  }

  await sendVerificationForUser(user, context.clientBaseUrl);

  return { success: true, message: 'If an account exists, a verification link has been sent.' };
};

module.exports = {
  generateVerificationToken,
  sendVerificationForUser,
  verifyEmailToken,
  requestEmailVerification,
};
