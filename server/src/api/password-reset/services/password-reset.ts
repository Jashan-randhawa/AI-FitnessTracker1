import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores (replace with DB / Redis in production for multi-instance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token store — keyed by hashed reset token.
 * Storing the *hash* means a stolen DB dump cannot be replayed directly.
 */
const tokenStore = new Map<string, {
  userId:    number;
  expiresAt: number;
  used:      boolean;
}>();

/** Rate-limit store — keyed by normalised email. */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS  = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX   = 3;              // max requests per window
const RATE_LIMIT_MS    = 15 * 60 * 1000; // 15-minute window
const TOKEN_BYTES      = 32;             // 256-bit token → 64 hex chars

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a cryptographically-secure, URL-safe token. */
const generateSecureToken = (): string =>
  crypto.randomBytes(TOKEN_BYTES).toString('hex');

/** One-way hash used for storage (SHA-256 is fine for short-lived tokens). */
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Remove stale tokens for a given userId (one active token per user). */
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
    return {
      limited:    true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { limited: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// Request password reset  (Step 1)
// ─────────────────────────────────────────────────────────────────────────────

export const requestPasswordReset = async (
  strapi: any,
  email:  string,
): Promise<{ success: boolean; message: string }> => {

  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const rl = checkRateLimit(email);
  if (rl.limited) {
    return {
      success: false,
      message: `Too many requests. Please try again in ${rl.retryAfter} seconds.`,
    };
  }

  // ── 2. Look up the user in the DB ──────────────────────────────────────────
  const users = await strapi.entityService.findMany(
    'plugin::users-permissions.user',
    { filters: { email: email.toLowerCase() }, limit: 1 },
  );

  // ── 3a. Email does NOT exist — return generic message (no enumeration) ──────
  //    We still return success:true so the controller returns 200.
  if (!users || users.length === 0) {
    return {
      success: true,
      message: 'If this email is registered, you will receive a password reset link.',
    };
  }

  // ── 3b. Email EXISTS — generate token, save hash, send email ───────────────
  const user = users[0];

  const plainToken  = generateSecureToken();  // sent to the user via email
  const hashedToken = hashToken(plainToken);  // stored server-side
  const expiresAt   = Date.now() + TOKEN_EXPIRY_MS;

  // Invalidate any previous reset token for this user
  invalidatePreviousTokens(user.id);

  // Persist the hashed token
  tokenStore.set(hashedToken, { userId: user.id, expiresAt, used: false });

  // Build the reset URL injected into the Strapi email template
  //   <%= URL %>?code=<%= TOKEN %>
  const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetUrl      = `${clientBaseUrl}/reset-password`;  // URL part
  const token         = plainToken;                          // TOKEN part

  try {
    await strapi.plugins['email'].services.email.send({
      to:      user.email,
      subject: 'Reset your password',

      // ── Strapi-style plain-text template ──────────────────────────────────
      //    Mirrors:  We heard that you lost your password. Sorry about that!
      //              But don't worry! You can use the following link:
      //              <%= URL %>?code=<%= TOKEN %>
      text: `We heard that you lost your password. Sorry about that!

But don't worry! You can use the following link to reset your password:

${resetUrl}?code=${token}

This link expires in 10 minutes and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

Thanks.`,

      // ── HTML version ──────────────────────────────────────────────────────
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background: #0a0a0f; }
    .wrapper { max-width: 520px; margin: 40px auto; padding: 0 16px; }
    .card {
      background: #111118;
      border: 1px solid rgba(99,102,241,0.18);
      border-radius: 16px;
      padding: 40px 36px;
    }
    .logo { font-size: 13px; font-weight: 700; letter-spacing: 0.12em;
            color: #6366f1; text-transform: uppercase; margin-bottom: 32px; }
    h1 { font-size: 22px; font-weight: 700; color: #f9fafb; margin: 0 0 8px; }
    p  { font-size: 14px; color: #9ca3af; line-height: 1.7; margin: 0 0 24px; }
    .notice { font-size: 13px; color: #4b5563; border-top: 1px solid rgba(255,255,255,0.06);
              padding-top: 20px; margin-top: 4px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff !important;
      text-decoration: none;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.01em;
      box-shadow: 0 4px 20px rgba(99,102,241,0.4);
    }
    .link-box {
      background: rgba(99,102,241,0.07);
      border: 1px solid rgba(99,102,241,0.18);
      border-radius: 8px;
      padding: 12px 16px;
      word-break: break-all;
      font-size: 12px;
      color: #818cf8;
      margin-bottom: 24px;
    }
    .expiry {
      display: inline-block;
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.25);
      border-radius: 6px;
      padding: 2px 10px;
      font-size: 12px;
      color: #fbbf24;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">🏋️ AI Fitness Tracker</div>

      <h1>Reset your password</h1>
      <p>
        We heard that you lost your password. Sorry about that!<br />
        But don't worry — click the button below to reset it.
        <br /><br />
        <span class="expiry">⏱ Expires in 10 minutes</span>
      </p>

      <div class="btn-wrap">
        <a class="btn" href="${resetUrl}?code=${token}">Reset My Password</a>
      </div>

      <p style="font-size:12px;color:#4b5563;text-align:center;margin-bottom:16px;">
        Or copy and paste this link into your browser:
      </p>
      <div class="link-box">${resetUrl}?code=${token}</div>

      <div class="notice">
        This link can only be used <strong style="color:#f9fafb;">once</strong> and expires in <strong style="color:#f9fafb;">10 minutes</strong>.<br />
        If you didn't request a password reset, you can safely ignore this email — your account remains secure.
      </div>
    </div>
  </div>
</body>
</html>`,
    });
  } catch (emailError) {
    strapi.log.error('[password-reset] Email delivery failed:', emailError);
    // Do not surface email errors to the client
  }

  return {
    success: true,
    message: 'If this email is registered, you will receive a password reset link.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Validate token  (optional Step 1.5 — lets the frontend pre-check the link)
// ─────────────────────────────────────────────────────────────────────────────

export const validateResetToken = (
  token: string,
): { valid: boolean; message: string } => {
  const hashedToken = hashToken(token.trim());
  const entry       = tokenStore.get(hashedToken);

  if (!entry)               return { valid: false, message: 'Invalid or expired link.' };
  if (entry.used)           return { valid: false, message: 'This link has already been used.' };
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(hashedToken);
    return { valid: false, message: 'This link has expired. Please request a new one.' };
  }

  return { valid: true, message: 'Token is valid.' };
};

// ─────────────────────────────────────────────────────────────────────────────
// Reset password  (Step 2 — after user clicks the link)
// ─────────────────────────────────────────────────────────────────────────────

export const resetPassword = async (
  strapi:      any,
  token:       string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> => {

  // ── 1. Basic validation ────────────────────────────────────────────────────
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { success: false, message: 'Reset token is required.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' };
  }

  // ── 2. Look up the hashed token ────────────────────────────────────────────
  const hashedToken = hashToken(token.trim());
  const entry       = tokenStore.get(hashedToken);

  if (!entry) {
    return { success: false, message: 'Invalid or expired link.' };
  }

  // ── 3. Check already used ──────────────────────────────────────────────────
  if (entry.used) {
    return { success: false, message: 'This link has already been used. Please request a new one.' };
  }

  // ── 4. Check expiry ────────────────────────────────────────────────────────
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(hashedToken);
    return { success: false, message: 'This link has expired. Please request a new one.' };
  }

  // ── 5. Hash new password via Strapi's bcrypt helper ───────────────────────
  const hashedPassword = await strapi
    .plugins['users-permissions']
    .services.user.hashPassword({ password: newPassword });

  // ── 6. Update user record ─────────────────────────────────────────────────
  await strapi.entityService.update(
    'plugin::users-permissions.user',
    entry.userId,
    { data: { password: hashedPassword, resetPasswordToken: null } },
  );

  // ── 7. Invalidate token (one-time use) ────────────────────────────────────
  entry.used = true;
  tokenStore.delete(hashedToken);

  return { success: true, message: 'Password updated successfully.' };
};
