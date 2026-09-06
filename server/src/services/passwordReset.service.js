const crypto = require('crypto');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('./email.service');

const TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_BYTES = 32;

// In-memory, matching the original — resets on server restart. Fine for a
// single-instance deployment; move to Redis if this ever runs multi-instance.
const rateLimitStore = new Map();

const generateSecureToken = () => crypto.randomBytes(TOKEN_BYTES).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const checkRateLimit = (email) => {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_MS });
    return { limited: false };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { limited: false };
};

/**
 * @param {string} email
 * @returns {Promise<{ success: boolean, type: 'sent'|'not_found'|'google'|'rate_limited'|'email_failed', message: string }>}
 */
const requestPasswordReset = async (email) => {
  const rl = checkRateLimit(email);
  if (rl.limited) {
    return {
      success: false,
      type: 'rate_limited',
      message: `Too many requests. Please try again in ${rl.retryAfter} seconds.`,
    };
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return { success: false, type: 'not_found', message: 'No account found with this email address.' };
  }
  if (user.provider && user.provider !== 'local') {
    return {
      success: false,
      type: 'google',
      message: 'This account uses Google sign-in. Please use the "Sign in with Google" button instead.',
    };
  }

  const plainToken = generateSecureToken();
  user.resetPasswordTokenHash = hashToken(plainToken);
  user.resetPasswordExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);
  await user.save({ validateModifiedOnly: true });

  const clientBaseUrl = (process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app').replace(/\/$/, '');
  const resetUrl = `${clientBaseUrl}/reset-password`;

  const emailResult = await sendPasswordResetEmail({ to: user.email, resetUrl, plainToken });

  if (!emailResult.sent) {
    // Token is already saved, but the user was never actually notified — don't
    // tell the frontend "sent" when it wasn't. Let them know delivery failed
    // so they can retry instead of waiting on an email that's never coming.
    console.error('[password-reset] email not delivered, reason:', emailResult.reason);
    return {
      success: false,
      type: 'email_failed',
      message: "We couldn't send the reset email right now. Please try again in a moment.",
    };
  }

  return { success: true, type: 'sent', message: 'Password reset email sent successfully.' };
};

/**
 * @param {string} token
 */
const findUserByToken = async (token) => {
  const hashedToken = hashToken(token.trim());
  // Indexed field lookup — the original scanned every user with a non-null
  // token and parsed a JSON blob per row because Strapi couldn't filter on
  // JSON fields. Mongo can query the hash directly.
  const user = await User.findOne({ resetPasswordTokenHash: hashedToken }).select(
    '+resetPasswordTokenHash +resetPasswordExpires'
  );
  if (!user) return null;
  return { user, expiresAt: user.resetPasswordExpires?.getTime() ?? 0 };
};

/**
 * @param {string} token
 */
const validateResetToken = async (token) => {
  const result = await findUserByToken(token);
  if (!result) return { valid: false, message: 'Invalid or expired link.' };
  if (Date.now() > result.expiresAt) return { valid: false, message: 'This link has expired. Please request a new one.' };
  return { valid: true, message: 'Token is valid.' };
};

/**
 * @param {string} token
 * @param {string} newPassword
 */
const resetPassword = async (token, newPassword) => {
  if (!token?.trim()) return { success: false, message: 'Reset token is required.' };
  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }

  const result = await findUserByToken(token);
  if (!result) return { success: false, message: 'Invalid or expired link.' };
  if (Date.now() > result.expiresAt) {
    return { success: false, message: 'This link has expired. Please request a new one.' };
  }

  result.user.password = newPassword; // pre-save hook hashes it
  result.user.resetPasswordTokenHash = undefined;
  result.user.resetPasswordExpires = undefined;
  await result.user.save();

  return { success: true, message: 'Password updated successfully.' };
};

module.exports = { checkRateLimit, requestPasswordReset, validateResetToken, resetPassword };
