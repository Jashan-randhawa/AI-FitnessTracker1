const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');
const logger = require('../utils/logger');

const hashToken = (plainToken) =>
  crypto.createHash('sha256').update(String(plainToken).trim()).digest('hex');

const generatePlainToken = () => crypto.randomBytes(40).toString('hex');

const getRefreshTokenCookieOptions = () => {
  const sameSite = (process.env.REFRESH_TOKEN_SAMESITE || 'lax').toLowerCase();
  const isProd = process.env.NODE_ENV === 'production';
  const secure =
    process.env.REFRESH_TOKEN_SECURE !== undefined
      ? process.env.REFRESH_TOKEN_SECURE === 'true'
      : isProd;
  const cookiePath = process.env.REFRESH_TOKEN_COOKIE_PATH || '/api/auth';
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: cookiePath,
    maxAge: days * 24 * 60 * 60 * 1000,
  };
};

const setRefreshTokenCookie = (res, plainToken) => {
  const options = getRefreshTokenCookieOptions();
  res.cookie('refreshToken', plainToken, options);
};

const clearRefreshTokenCookie = (res) => {
  const options = getRefreshTokenCookieOptions();
  res.clearCookie('refreshToken', {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
};

/**
 * Creates and persists a new refresh token record.
 */
const createRefreshTokenRecord = async ({
  userId,
  userAgent = '',
  ipAddress = '',
  familyId = null,
}) => {
  const plainToken = generatePlainToken();
  const hashedToken = hashToken(plainToken);
  const activeFamilyId = familyId || crypto.randomUUID();
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const record = await RefreshToken.create({
    hashedToken,
    userId,
    familyId: activeFamilyId,
    expiresAt,
    userAgent: String(userAgent || '').slice(0, 500),
    ipAddress: String(ipAddress || '').slice(0, 100),
  });

  return { plainToken, hashedToken, record };
};

/**
 * Rotates a refresh token.
 * If a revoked token is reused, invalidates that user's whole token family.
 */
const rotateRefreshToken = async ({ plainToken, userAgent = '', ipAddress = '' }) => {
  if (!plainToken || typeof plainToken !== 'string') {
    return { error: 'invalid_token', status: 401, message: 'Invalid refresh token' };
  }

  const hashedToken = hashToken(plainToken);
  const tokenRecord = await RefreshToken.findOne({ hashedToken });

  if (!tokenRecord) {
    return { error: 'invalid_token', status: 401, message: 'Invalid refresh token' };
  }

  // Reuse Detection: If an already-revoked token is used, compromise is suspected.
  if (tokenRecord.revokedAt) {
    logger.warn('[refresh-token] Reused revoked token detected — revoking family lineage', {
      familyId: tokenRecord.familyId,
      userId: tokenRecord.userId,
    });
    await RefreshToken.updateMany(
      { familyId: tokenRecord.familyId },
      { $set: { revokedAt: new Date() } }
    );
    return {
      error: 'token_reuse',
      status: 401,
      message: 'Invalid or reused refresh token. Session terminated.',
    };
  }

  // Expiration check
  if (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() < Date.now()) {
    return { error: 'token_expired', status: 401, message: 'Refresh token has expired' };
  }

  // Verify associated user exists and is active
  const user = await User.findById(tokenRecord.userId);
  if (!user || user.blocked) {
    return { error: 'user_inactive', status: 403, message: 'Account is inactive or blocked' };
  }

  // Issue new token in the same lineage
  const newPlainToken = generatePlainToken();
  const newHashedToken = hashToken(newPlainToken);
  const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;
  const newExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Mark old token revoked and record replacement
  tokenRecord.revokedAt = new Date();
  tokenRecord.replacedBy = newHashedToken;
  await tokenRecord.save();

  await RefreshToken.create({
    hashedToken: newHashedToken,
    userId: user._id,
    familyId: tokenRecord.familyId,
    expiresAt: newExpiresAt,
    userAgent: String(userAgent || '').slice(0, 500),
    ipAddress: String(ipAddress || '').slice(0, 100),
  });

  return {
    success: true,
    user,
    newPlainToken,
  };
};

/**
 * Revokes a single refresh token by its plain value.
 */
const revokeRefreshToken = async (plainToken) => {
  if (!plainToken || typeof plainToken !== 'string') return;
  const hashedToken = hashToken(plainToken);
  await RefreshToken.updateOne(
    { hashedToken, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * Revokes all refresh tokens for a user (e.g., on password reset/change).
 */
const revokeAllUserRefreshTokens = async (userId) => {
  if (!userId) return;
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = {
  hashToken,
  generatePlainToken,
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  createRefreshTokenRecord,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};
