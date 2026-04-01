import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} from '../services/password-reset';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {

  // POST /api/password-reset/request
  async request(ctx: any) {
    const { email } = ctx.request.body;
    console.log('[password-reset] request called with email:', email);

    if (!email || typeof email !== 'string') {
      return ctx.badRequest('Email is required.');
    }
    if (!emailRegex.test(email.trim())) {
      return ctx.badRequest('Invalid email format.');
    }

    try {
      const result = await requestPasswordReset(strapi, email.trim().toLowerCase());
      console.log('[password-reset] requestPasswordReset result:', result);

      if (!result.success) {
        const status =
          result.type === 'rate_limited' ? 429 :
          result.type === 'not_found'    ? 404 :
          result.type === 'google'       ? 422 : 400;

        ctx.status = status;
        ctx.body   = { error: { type: result.type, message: result.message } };
        return;
      }

      ctx.body = { type: result.type, message: result.message };
    } catch (err) {
      console.error('[password-reset] request CRASHED:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },

  // GET /api/password-reset/validate?code=TOKEN
  async validate(ctx: any) {
    const token = (ctx.query?.code as string) || '';
    console.log('[password-reset] validate called, token length:', token.length);

    if (!token) {
      ctx.status = 400;
      ctx.body   = { valid: false, message: 'Reset code is required.' };
      return;
    }

    try {
      const result = await validateResetToken(strapi, token);
      console.log('[password-reset] validateResetToken result:', result);
      ctx.status = result.valid ? 200 : 400;
      ctx.body   = result;
    } catch (err) {
      console.error('[password-reset] validate CRASHED:', err);
      ctx.internalServerError('Something went wrong.');
    }
  },

  // POST /api/password-reset/reset
  async reset(ctx: any) {
    const { code, newPassword } = ctx.request.body;
    console.log('[password-reset] reset called, code length:', code?.length, 'password length:', newPassword?.length);

    if (!code || !newPassword) {
      return ctx.badRequest('Reset code and new password are required.');
    }

    try {
      const result = await resetPassword(strapi, code, newPassword);
      console.log('[password-reset] resetPassword result:', result);

      if (!result.success) {
        ctx.status = 400;
        ctx.body   = { error: { message: result.message } };
        return;
      }

      ctx.body = { message: result.message };
    } catch (err) {
      console.error('[password-reset] reset CRASHED:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },
};
