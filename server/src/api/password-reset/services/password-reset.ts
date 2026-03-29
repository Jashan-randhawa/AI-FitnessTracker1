import crypto from 'crypto';

// In-memory store for reset tokens
// In production, replace this with a DB table or Redis
// Structure: { [hashedToken]: { userId, expiresAt, attempts } }
const tokenStore = new Map<string, {
  userId:    number;
  expiresAt: number;
  attempts:  number;
}>();

// Rate limit store: { [email]: { count, resetAt } }
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const OTP_EXPIRY_MS    = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const RATE_LIMIT_MAX   = 3;              // max requests per window
const RATE_LIMIT_MS    = 15 * 60 * 1000; // 15-minute window

// ── Helpers ────────────────────────────────────────────────────────────────

const generateOTP = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// ── Rate limiting ───────────────────────────────────────────────────────────

export const checkRateLimit = (email: string): { limited: boolean; retryAfter?: number } => {
  const now  = Date.now();
  const key  = email.toLowerCase();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Fresh window
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_MS });
    return { limited: false };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { limited: false };
};

// ── Request reset ───────────────────────────────────────────────────────────

export const requestPasswordReset = async (
  strapi: any,
  email: string
): Promise<{ success: boolean; message: string; otp?: string }> => {

  // 1. Rate limit check
  const rl = checkRateLimit(email);
  if (rl.limited) {
    return {
      success: false,
      message: `Too many requests. Please try again in ${rl.retryAfter} seconds.`,
    };
  }

  // 2. Look up user — do NOT reveal non-existence in the response message
  //    (per security requirement #4). We return the same message either way.
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { email: email.toLowerCase() }, limit: 1 }
  );

  if (!users || users.length === 0) {
    // Security: same message as success so we don't leak email existence
    return {
      success: true,
      message: 'If that email is registered, a reset code has been sent.',
    };
  }

  const user = users[0];

  // 3. Generate OTP and store hashed version
  const otp        = generateOTP();
  const hashedOTP  = hashToken(otp);
  const expiresAt  = Date.now() + OTP_EXPIRY_MS;

  // Clear any existing token for this user
  for (const [key, val] of tokenStore.entries()) {
    if (val.userId === user.id) tokenStore.delete(key);
  }

  tokenStore.set(hashedOTP, { userId: user.id, expiresAt, attempts: 0 });

  // 4. Send email via Strapi's email plugin
  try {
    await strapi.plugins['email'].services.email.send({
      to:      user.email,
      subject: 'Your Password Reset Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0a0f;color:#f9fafb;border-radius:12px;">
          <h2 style="color:#818cf8;margin-bottom:8px;">Reset Your Password</h2>
          <p style="color:#9ca3af;margin-bottom:24px;">Use the code below to reset your password. It expires in <strong style="color:#f9fafb;">10 minutes</strong>.</p>
          <div style="background:#1e1b4b;border:1px solid #3730a3;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#a5b4fc;">${otp}</span>
          </div>
          <p style="color:#6b7280;font-size:13px;">If you didn't request a password reset, you can safely ignore this email.</p>
          <p style="color:#6b7280;font-size:13px;">This code can only be used once and expires in 10 minutes.</p>
        </div>
      `,
      text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
    });
  } catch (emailError) {
    strapi.log.error('Password reset email failed:', emailError);
    // Don't expose email errors to client
  }

  return {
    success: true,
    message: 'If that email is registered, a reset code has been sent.',
  };
};

// ── Verify OTP + reset password ─────────────────────────────────────────────

export const resetPassword = async (
  strapi: any,
  email:    string,
  otp:      string,
  newPassword: string
): Promise<{ success: boolean; message: string }> => {

  // 1. Validate input lengths up front
  if (!otp || otp.trim().length !== 6) {
    return { success: false, message: 'Invalid code format.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }

  // 2. Look up user
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { email: email.toLowerCase() }, limit: 1 }
  );

  if (!users || users.length === 0) {
    return { success: false, message: 'Invalid or expired code.' };
  }

  const user = users[0];

  // 3. Find the token for this user
  const hashedOTP = hashToken(otp.trim());
  const entry     = tokenStore.get(hashedOTP);

  if (!entry || entry.userId !== user.id) {
    return { success: false, message: 'Invalid or expired code.' };
  }

  // 4. Check expiry
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(hashedOTP);
    return { success: false, message: 'Invalid or expired code.' };
  }

  // 5. Brute-force guard — max 5 wrong attempts per token
  entry.attempts++;
  if (entry.attempts > MAX_OTP_ATTEMPTS) {
    tokenStore.delete(hashedOTP);
    return { success: false, message: 'Too many attempts. Please request a new code.' };
  }

  // 6. Hash new password via Strapi's bcrypt util and update user
  // Strapi's users-permissions plugin exposes a hashPassword helper
  const hashedPassword = await strapi.plugins['users-permissions']
    .services.user.hashPassword({ password: newPassword });

  await strapi.entityService.update(
    'plugin::users-permissions.user',
    user.id,
    { data: { password: hashedPassword, resetPasswordToken: null } }
  );

  // 7. Invalidate token — one-time use
  tokenStore.delete(hashedOTP);

  return { success: true, message: 'Password updated successfully.' };
};
