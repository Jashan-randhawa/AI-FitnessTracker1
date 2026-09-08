const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const sendError = require('../utils/sendError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const user = await User.create({
    username: username.trim(),
    email: email.toLowerCase().trim(),
    password,
    provider: 'local',
  });

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

  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 400, 'Invalid identifier or password');
  }
  if (user.blocked) {
    return sendError(res, 403, 'Your account has been blocked by an administrator');
  }
  if (user.provider !== 'local') {
    return sendError(res, 400, `This account uses ${user.provider} sign-in. Please use that instead.`);
  }

  res.json({ jwt: generateToken(user._id), user: user.toJSON() });
});

// GET /api/users/me
const me = asyncHandler(async (req, res) => {
  res.json(req.user.toJSON());
});

// ── Google OAuth ──────────────────────────────────────────────
// Step 1: GET /api/connect/google — kick off the OAuth dance
const googleConnect = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CALLBACK_URL) {
    return sendError(res, 503, 'Google sign-in is not configured on this server.');
  }
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: GET /api/connect/google/callback — Google redirects here with ?code=
// Exchanges the code for a Google access_token, then hands off to the
// client's own callback page (matches the original app's 3-hop flow).
const googleConnectCallback = asyncHandler(async (req, res) => {
  const { code, error } = req.query;
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

  if (error || !code) {
    return res.redirect(`${clientUrl}/google-callback?error=access_denied`);
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

    res.redirect(`${clientUrl}/google-callback?access_token=${tokenData.access_token}`);
  } catch (err) {
    console.error('[auth] Google connect callback failed:', err);
    res.redirect(`${clientUrl}/google-callback?error=oauth_failed`);
  }
});

// Step 3: GET /api/auth/google/callback?access_token=<google_access_token>
// Called by the client with the Google access_token — exchanges it for our
// own JWT, exactly like Strapi's `/api/auth/:provider/callback`.
const googleAuthCallback = asyncHandler(async (req, res) => {
  const googleAccessToken = req.query.access_token;
  if (!googleAccessToken) {
    return sendError(res, 400, 'access_token query parameter is required');
  }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${googleAccessToken}` },
  });
  if (!profileRes.ok) {
    return sendError(res, 400, 'Invalid or expired Google access token');
  }
  const profile = await profileRes.json();
  if (!profile.email) {
    return sendError(res, 400, 'Google account has no email address');
  }

  let user = await User.findOne({ email: profile.email.toLowerCase() });

  if (!user) {
    const username = await generateUniqueUsername(profile.name || profile.email.split('@')[0]);
    user = await User.create({
      username,
      email: profile.email.toLowerCase(),
      provider: 'google',
      confirmed: true,
    });
  }

  if (user.blocked) {
    return sendError(res, 403, 'Your account has been blocked by an administrator');
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

module.exports = { register, login, me, googleConnect, googleConnectCallback, googleAuthCallback };
