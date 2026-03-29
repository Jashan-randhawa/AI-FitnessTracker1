import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RequestResult = {
  success: boolean;
  type:    'sent' | 'not_found' | 'google' | 'rate_limited';
  message: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores
// ─────────────────────────────────────────────────────────────────────────────

const tokenStore = new Map<string, {
  userId:    number;
  expiresAt: number;
  used:      boolean;
}>();

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX  = 3;
const RATE_LIMIT_MS   = 15 * 60 * 1000;
const TOKEN_BYTES     = 32;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const generateSecureToken = (): string =>
  crypto.randomBytes(TOKEN_BYTES).toString('hex');

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const invalidatePreviousTokens = (userId: number): void => {
  for (const [key, val] of tokenStore.entries()) {
    if (val.userId === userId) tokenStore.delete(key);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

export const checkRateLimit = (
  email: string,
): { limited: boolean; retryAfter?: number } => {
  const now   = Date.now();
  const key   = email.toLowerCase();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_MS });
    return { limited: false };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { limited: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// Request password reset
// ─────────────────────────────────────────────────────────────────────────────

export const requestPasswordReset = async (
  strapi: any,
  email:  string,
): Promise<RequestResult> => {

  // 1. Rate-limit check
  const rl = checkRateLimit(email);
  if (rl.limited) {
    return {
      success: false,
      type:    'rate_limited',
      message: `Too many requests. Please try again in ${rl.retryAfter} seconds.`,
    };
  }

  // 2. Look up user
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { email: email.toLowerCase() }, limit: 1 },
  );

  // 3a. Email not found
  if (!users || users.length === 0) {
    return {
      success: false,
      type:    'not_found',
      message: 'No account found with this email address.',
    };
  }

  // 3b. Google (or other OAuth) account
  const user = users[0];
  if (user.provider && user.provider !== 'local') {
    return {
      success: false,
      type:    'google',
      message: 'This account uses Google sign-in. Please use the "Sign in with Google" button instead.',
    };
  }

  // 4. Generate secure token and store its hash
  const plainToken  = generateSecureToken();
  const hashedToken = hashToken(plainToken);
  const expiresAt   = Date.now() + TOKEN_EXPIRY_MS;

  invalidatePreviousTokens(user.id);
  tokenStore.set(hashedToken, { userId: user.id, expiresAt, used: false });

  // 5. Build reset URL  (<%= URL %>?code=<%= TOKEN %>)
  const clientBaseUrl = process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app';
  const resetUrl      = `${clientBaseUrl}/reset-password`;
  const token         = plainToken;

  // 6. Send email
  try {
    await strapi.plugins['email'].services.email.send({
      to:      user.email,
      subject: 'Reset your password',
      text: `We heard that you lost your password. Sorry about that!

But don't worry! You can use the following link to reset your password:

${resetUrl}?code=${token}

This link expires in 10 minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email.

Thanks.`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    body{margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0a0f;}
    .wrapper{max-width:520px;margin:40px auto;padding:0 16px;}
    .card{background:#111118;border:1px solid rgba(99,102,241,0.18);border-radius:16px;padding:40px 36px;}
    .logo{font-size:13px;font-weight:700;letter-spacing:0.12em;color:#6366f1;text-transform:uppercase;margin-bottom:32px;}
    h1{font-size:22px;font-weight:700;color:#f9fafb;margin:0 0 8px;}
    p{font-size:14px;color:#9ca3af;line-height:1.7;margin:0 0 24px;}
    .expiry{display:inline-block;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);border-radius:6px;padding:2px 10px;font-size:12px;color:#fbbf24;font-weight:600;}
    .btn-wrap{text-align:center;margin:28px 0;}
    .btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;box-shadow:0 4px 20px rgba(99,102,241,0.4);}
    .link-box{background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:8px;padding:12px 16px;word-break:break-all;font-size:12px;color:#818cf8;margin-bottom:24px;}
    .notice{font-size:13px;color:#4b5563;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;margin-top:4px;}
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="logo">🏋️ AI Fitness Tracker</div>
    <h1>Reset your password</h1>
    <p>We heard that you lost your password. Sorry about that!<br/>
    But don't worry — click the button below to reset it.<br/><br/>
    <span class="expiry">⏱ Expires in 10 minutes</span></p>
    <div class="btn-wrap"><a class="btn" href="${resetUrl}?code=${token}">Reset My Password</a></div>
    <p style="font-size:12px;color:#4b5563;text-align:center;margin-bottom:16px;">Or copy and paste this link into your browser:</p>
    <div class="link-box">${resetUrl}?code=${token}</div>
    <div class="notice">
      This link can only be used <strong style="color:#f9fafb;">once</strong> and expires in
      <strong style="color:#f9fafb;">10 minutes</strong>.<br/>
      If you did not request this, you can safely ignore this email.
    </div>
  </div></div>
</body>
</html>`,
    });
  } catch (emailError) {
    strapi.log.error('[password-reset] Email delivery failed:', emailError);
  }

  return {
    success: true,
    type:    'sent',
    message: 'Password reset email sent successfully.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Validate token (pre-check on page load)
// ─────────────────────────────────────────────────────────────────────────────

export const validateResetToken = (
  token: string,
): { valid: boolean; message: string } => {
  const hashedToken = hashToken(token.trim());
  const entry       = tokenStore.get(hashedToken);

  if (!entry)                       return { valid: false, message: 'Invalid or expired link.' };
  if (entry.used)                   return { valid: false, message: 'This link has already been used.' };
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(hashedToken);
    return { valid: false, message: 'This link has expired. Please request a new one.' };
  }
  return { valid: true, message: 'Token is valid.' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password
// ─────────────────────────────────────────────────────────────────────────────

export const resetPassword = async (
  strapi:      any,
  token:       string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {

  if (!token || token.trim().length === 0) {
    return { success: false, message: 'Reset token is required.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }

  const hashedToken = hashToken(token.trim());
  const entry       = tokenStore.get(hashedToken);

  if (!entry)     return { success: false, message: 'Invalid or expired link.' };
  if (entry.used) return { success: false, message: 'This link has already been used. Please request a new one.' };
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(hashedToken);
    return { success: false, message: 'This link has expired. Please request a new one.' };
  }

  const hashedPassword = await strapi
    .plugins['users-permissions']
    .services.user.hashPassword({ password: newPassword });

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    entry.userId,
    { data: { password: hashedPassword, resetPasswordToken: null } },
  );

  entry.used = true;
  tokenStore.delete(hashedToken);

  return { success: true, message: 'Password updated successfully.' };
};
