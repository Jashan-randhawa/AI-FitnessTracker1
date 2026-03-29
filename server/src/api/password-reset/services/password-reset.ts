import crypto from 'crypto';

export type RequestResult = {
  success: boolean;
  type:    'sent' | 'not_found' | 'google' | 'rate_limited';
  message: string;
};

const TOKEN_EXPIRY_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX  = 3;
const RATE_LIMIT_MS   = 15 * 60 * 1000;
const TOKEN_BYTES     = 32;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const generateSecureToken = (): string =>
  crypto.randomBytes(TOKEN_BYTES).toString('hex');

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

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

export const requestPasswordReset = async (
  strapi: any,
  email:  string,
): Promise<RequestResult> => {

  const rl = checkRateLimit(email);
  if (rl.limited) {
    return { success: false, type: 'rate_limited', message: `Too many requests. Please try again in ${rl.retryAfter} seconds.` };
  }

  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { email: email.toLowerCase() }, limit: 1 },
  );

  if (!users || users.length === 0) {
    return { success: false, type: 'not_found', message: 'No account found with this email address.' };
  }

  const user = users[0];
  if (user.provider && user.provider !== 'local') {
    return { success: false, type: 'google', message: 'This account uses Google sign-in. Please use the "Sign in with Google" button instead.' };
  }

  const plainToken  = generateSecureToken();
  const hashedToken = hashToken(plainToken);
  const expiresAt   = Date.now() + TOKEN_EXPIRY_MS;

  // Store as JSON string in resetPasswordToken field
  const tokenData = JSON.stringify({ hash: hashedToken, expiresAt });

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    { data: { resetPasswordToken: tokenData } },
  );

  const clientBaseUrl = process.env.CLIENT_URL || 'https://ai-fitness-tracker1.vercel.app';
  const resetUrl      = `${clientBaseUrl}/reset-password`;

  try {
    await strapi.plugins['email'].services.email.send({
      to:      user.email,
      subject: 'Reset your password',
      text: `Reset your password:\n\n${resetUrl}?code=${plainToken}\n\nExpires in 10 minutes. Can only be used once.`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
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
    .btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;}
    .link-box{background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.18);border-radius:8px;padding:12px 16px;word-break:break-all;font-size:12px;color:#818cf8;margin-bottom:24px;}
    .notice{font-size:13px;color:#4b5563;border-top:1px solid rgba(255,255,255,0.06);padding-top:20px;}
  </style>
</head>
<body>
  <div class="wrapper"><div class="card">
    <div class="logo">🏋️ AI Fitness Tracker</div>
    <h1>Reset your password</h1>
    <p>Click the button below to reset your password.<br/><br/>
    <span class="expiry">⏱ Expires in 10 minutes</span></p>
    <div class="btn-wrap"><a class="btn" href="${resetUrl}?code=${plainToken}">Reset My Password</a></div>
    <p style="font-size:12px;color:#4b5563;text-align:center;margin-bottom:16px;">Or copy and paste this link:</p>
    <div class="link-box">${resetUrl}?code=${plainToken}</div>
    <div class="notice">This link can only be used <strong style="color:#f9fafb;">once</strong> and expires in <strong style="color:#f9fafb;">10 minutes</strong>.</div>
  </div></div>
</body>
</html>`,
    });
  } catch (emailError) {
    strapi.log.error('[password-reset] Email delivery failed:', emailError);
  }

  return { success: true, type: 'sent', message: 'Password reset email sent successfully.' };
};

const findUserByToken = async (strapi: any, plainToken: string) => {
  const hashedToken = hashToken(plainToken.trim());

  // Get all users and find the one whose stored token matches
  // We scan because Strapi doesn't support JSON field filtering
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { resetPasswordToken: { $notNull: true } }, limit: 100 },
  );

  for (const user of users) {
    try {
      const data = JSON.parse(user.resetPasswordToken);
      if (data.hash === hashedToken) {
        return { user, expiresAt: data.expiresAt };
      }
    } catch {
      continue;
    }
  }
  return null;
};

export const validateResetToken = async (
  strapi: any,
  token: string,
): Promise<{ valid: boolean; message: string }> => {
  const result = await findUserByToken(strapi, token);
  if (!result) return { valid: false, message: 'Invalid or expired link.' };
  if (Date.now() > result.expiresAt) return { valid: false, message: 'This link has expired. Please request a new one.' };
  return { valid: true, message: 'Token is valid.' };
};

export const resetPassword = async (
  strapi:      any,
  token:       string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {

  if (!token?.trim()) return { success: false, message: 'Reset token is required.' };
  if (!newPassword || newPassword.length < 8) return { success: false, message: 'Password must be at least 8 characters.' };

  const result = await findUserByToken(strapi, token);
  if (!result) return { success: false, message: 'Invalid or expired link.' };
  if (Date.now() > result.expiresAt) return { success: false, message: 'This link has expired. Please request a new one.' };

  // Try Strapi v5 API first, fall back to v4
  let hashedPassword: string;
  try {
    hashedPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .hashPassword(newPassword);
    console.log('[password-reset] hashed password using v5 API');
  } catch (e1) {
    try {
      hashedPassword = await strapi
        .plugins['users-permissions']
        .services.user.hashPassword({ password: newPassword });
      console.log('[password-reset] hashed password using v4 API');
    } catch (e2) {
      console.error('[password-reset] hashPassword failed v5:', e1);
      console.error('[password-reset] hashPassword failed v4:', e2);
      throw e2;
    }
  }

  console.log('[password-reset] updating user password, userId:', result.user.id);
  await strapi.entityService.update(
    'plugin::users-permissions.user',
    result.user.id,
    { data: { password: hashedPassword, resetPasswordToken: null } },
  );

  return { success: true, message: 'Password updated successfully.' };
};
