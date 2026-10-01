const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendError = require('../utils/sendError');
const { sendSecurityNoticeEmail, sendVerificationEmail } = require('../services/email.service');
const { generateVerificationToken } = require('../services/emailVerification.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    if (name) cookies[name] = decodeURIComponent(val);
  });
  return cookies;
};

// POST /api/auth/local/register
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || username.trim().length < 3) {
    return sendError(res, 400, 'username must be at least 3 characters');
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return sendError(res, 400, 'a valid email is required');
  }
  if (!password || password.length < 6) {
    return sendError(res, 400, 'password must be at least 6 characters');
  }

  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase().trim() }, { username: username.trim() }],
  });
  if (existing) {
    return sendError(res, 400, 'Email or Username are already taken');
  }

  const { plainToken, tokenHash, expires } = generateVerificationToken();

  const user = await User.create({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password,
    provider: 'local',
    hasPassword: true,
    emailVerified: false,
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: expires,
  });

  const baseUrl = (process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app').replace(/\/$/, '');
  sendVerificationEmail({
    to: user.email,
    plainToken,
    verifyUrl: `${baseUrl}/verify-email`,
  }).catch(() => {});

  res.json({ jwt: generateToken(user._id), user: user.toJSON() });
});

// POST /api/auth/local
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return sendError(res, 400, 'identifier and password are required');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }],
  }).select('+password');

  // Gate on hasPassword + password match rather than provider string
  if (!user || !user.hasPassword || !user.password || !(await user.comparePassword(password))) {
    return sendError(res, 400, 'Invalid identifier or password');
  }
  if (user.blocked) {
    return sendError(res, 403, 'Your account has been blocked by an administrator');
  }

  res.json({ jwt: generateToken(user._id), user: user.toJSON() });
});

// GET /api/users/me
const me = asyncHandler(async (req, res) => {
  res.json(req.user.toJSON());
});

// ── Google OAuth Decision Matrix ──────────────────────────────
/**
 * Evaluates Google profile against Cases 1-6 of Section 3.3
 * @param {{ sub: string, email: string, email_verified?: boolean, name?: string }} profile
 */
const resolveGoogleUser = async (profile) => {
  const email = profile.email?.toLowerCase().trim();
  const sub = profile.sub;

  if (!email) {
    return { action: 'refuse', code: 'google_no_email', message: 'Google account has no email address' };
  }
  if (!profile.email_verified) {
    return { action: 'refuse', code: 'google_email_unverified', message: 'Google email address is not verified' };
  }

  // Case 1: Matching googleId
  const googleQuery = User.findOne({ googleId: sub });
  let user = await (googleQuery && typeof googleQuery.select === 'function'
    ? googleQuery.select('+googleId')
    : googleQuery);

  if (user) {
    if (user.blocked) {
      return { action: 'refuse', code: 'account_blocked', message: 'Your account has been blocked by an administrator' };
    }
    return { action: 'signin', user };
  }

  // Search by email
  const emailQuery = User.findOne({ email });
  user = await (emailQuery && typeof emailQuery.select === 'function'
    ? emailQuery.select('+password +passwordHistory +googleId')
    : emailQuery);

  if (user) {
    if (user.blocked) {
      return { action: 'refuse', code: 'account_blocked', message: 'Your account has been blocked by an administrator' };
    }

    // Case 2: Different googleId already bound -> refuse mismatch
    if (user.googleId && user.googleId !== sub) {
      return {
        action: 'refuse',
        code: 'google_account_mismatch',
        message: 'This email is already associated with a different Google account.',
      };
    }

    // Case 4: Legacy Google account (no googleId, hasPassword: false) -> bind sub
    if (!user.googleId && !user.hasPassword) {
      user.googleId = sub;
      user.emailVerified = true;
      await user.save();
      return { action: 'bind', user };
    }

    // Case 5: Verified password user -> link sub and notify
    if (!user.googleId && user.hasPassword && user.emailVerified) {
      user.googleId = sub;
      await user.save();
      return { action: 'link', user, sendNotice: true };
    }

    // Case 6: Unverified squatted user -> clear password and reclaim
    if (!user.googleId && user.hasPassword && !user.emailVerified) {
      user.googleId = sub;
      user.password = undefined;
      user.passwordHistory = [];
      user.hasPassword = false;
      user.emailVerified = true;
      user.passwordChangedAt = new Date();
      await user.save();
      return { action: 'reclaimed', user, sendNotice: true };
    }
  }

  // Case 3: Brand new user -> create account
  const username = await generateUniqueUsername(profile.name || email.split('@')[0]);
  const newUser = await User.create({
    username,
    email,
    provider: 'google',
    googleId: sub,
    hasPassword: false,
    emailVerified: true,
    confirmed: true,
  });

  return { action: 'created', user: newUser };
};

// ── Google OAuth Endpoints ────────────────────────────────────
// Step 1: GET /api/connect/google — kick off the OAuth dance with state nonce
const googleConnect = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CALLBACK_URL) {
    return sendError(res, 503, 'Google sign-in is not configured on this server.');
  }

  const stateNonce = crypto.randomBytes(16).toString('hex');
  res.cookie('g_state', stateNonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: stateNonce,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: GET /api/connect/google/callback — Google redirects here with ?code= & ?state=
const googleConnectCallback = asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

  const cookies = parseCookies(req.headers.cookie);
  const cookieState = req.cookies?.g_state || cookies.g_state;
  res.clearCookie('g_state');

  if (error || !code) {
    return res.redirect(`${clientUrl}/google-callback?error=access_denied`);
  }

  // Verify OAuth state to prevent CSRF / injection
  if (!state || !cookieState || state !== cookieState) {
    console.warn('[auth] Google OAuth state parameter mismatch or missing');
    return res.redirect(`${clientUrl}/google-callback?error=google_state_invalid`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Google token exchange failed');
    }

    res.redirect(`${clientUrl}/google-callback#access_token=${tokenData.access_token}`);
  } catch (err) {
    console.error('[auth] Google connect callback failed:', err);
    res.redirect(`${clientUrl}/google-callback?error=oauth_failed`);
  }
});

// Step 3: POST /api/auth/google/callback — body: { access_token }
const googleAuthCallback = asyncHandler(async (req, res) => {
  const googleAccessToken = req.body?.access_token;
  if (!googleAccessToken) {
    return sendError(res, 400, 'access_token parameter is required');
  }

  // 1. Audience verification via Google tokeninfo
  const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${googleAccessToken}`);
  if (!tokenInfoRes.ok) {
    return sendError(res, 400, 'Invalid or expired Google access token');
  }
  const tokenInfo = await tokenInfoRes.json();
  const validAudience = process.env.GOOGLE_CLIENT_ID;
  if (validAudience && tokenInfo.aud !== validAudience && tokenInfo.issued_to !== validAudience) {
    return sendError(res, 400, 'Token audience mismatch', { code: 'google_audience_mismatch' });
  }

  // 2. Fetch profile from userinfo
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${googleAccessToken}` },
  });
  if (!profileRes.ok) {
    return sendError(res, 400, 'Could not retrieve Google profile');
  }
  const profile = await profileRes.json();

  // 3. Resolve through decision matrix
  const resolved = await resolveGoogleUser(profile);
  if (resolved.action === 'refuse') {
    return sendError(res, 400, resolved.message, { code: resolved.code });
  }

  const user = resolved.user;

  // 4. Background security notice dispatch if linking/reclaiming
  if (resolved.sendNotice) {
    sendSecurityNoticeEmail({
      to: user.email,
      kind: 'google_linked',
    }).catch((err) => console.error('[auth] Notice email failed:', err.message));
  }

  res.json({ jwt: generateToken(user._id), user: user.toJSON() });
});

const generateUniqueUsername = async (base) => {
  const cleaned = base.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'user';
  let candidate = cleaned.length >= 3 ? cleaned : `${cleaned}user`;
  let suffix = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ username: candidate })) {
    suffix += 1;
    candidate = `${cleaned}${suffix}`;
  }
  return candidate;
};

module.exports = {
  register,
  login,
  me,
  googleConnect,
  googleConnectCallback,
  googleAuthCallback,
  resolveGoogleUser,
};
