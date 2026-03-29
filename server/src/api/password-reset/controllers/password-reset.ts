import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} from '../services/password-reset';

// ─────────────────────────────────────────────────────────────────────────────
// Shared email validator
// ─────────────────────────────────────────────────────────────────────────────
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {

  // ── POST /api/password-reset/request ───────────────────────────────────────
  // Body: { email }
  // Accepts an email, generates a secure token, and emails a reset link.
  // Always returns the same generic message to prevent user enumeration.
  async request(ctx: any) {
    const { email } = ctx.request.body;

    if (!email || typeof email !== 'string') {
      return ctx.badRequest('Email is required.');
    }
    if (!emailRegex.test(email.trim())) {
      return ctx.badRequest('Invalid email format.');
    }

    try {
      const result = await requestPasswordReset(strapi, email.trim().toLowerCase());

      if (!result.success) {
        // Only rate-limit errors reach here
        ctx.status = 429;
        ctx.body   = { error: { message: result.message } };
        return;
      }

      // Return the same generic message whether the email exists or not.
      ctx.body = { message: result.message };
    } catch (err) {
      strapi.log.error('[password-reset] request error:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },

  // ── GET /api/password-reset/validate?code=TOKEN ────────────────────────────
  // Allows the frontend to pre-validate a token when the page loads,
  // so it can show a friendly error before the user types a new password.
  async validate(ctx: any) {
    const token = (ctx.query?.code as string) || '';

    if (!token) {
      ctx.status = 400;
      ctx.body   = { valid: false, message: 'Reset code is required.' };
      return;
    }

    const result = validateResetToken(token);
    ctx.status   = result.valid ? 200 : 400;
    ctx.body     = result;
  },

  // ── POST /api/password-reset/reset ─────────────────────────────────────────
  // Body: { code, newPassword }
  // The `code` is the plain token extracted from the ?code= query param.
  async reset(ctx: any) {
    const { code, newPassword } = ctx.request.body;

    if (!code || !newPassword) {
      return ctx.badRequest('Reset code and new password are required.');
    }

    try {
      const result = await resetPassword(strapi, code, newPassword);

      if (!result.success) {
        ctx.status = 400;
        ctx.body   = { error: { message: result.message } };
        return;
      }

      ctx.body = { message: result.message };
    } catch (err) {
      strapi.log.error('[password-reset] reset error:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },
};
