import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
} from '../services/password-reset';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {

  // POST /api/password-reset/request
  // Body: { email }
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
        // Map each failure type to the right HTTP status
        const status =
          result.type === 'rate_limited' ? 429 :
          result.type === 'not_found'    ? 404 :
          result.type === 'google'       ? 422 : 400;

        ctx.status = status;
        ctx.body   = {
          error: {
            type:    result.type,
            message: result.message,
          },
        };
        return;
      }

      // success — email sent
      ctx.body = {
        type:    result.type,   // 'sent'
        message: result.message,
      };
    } catch (err) {
      strapi.log.error('[password-reset] request error:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },

  // GET /api/password-reset/validate?code=TOKEN
  async validate(ctx: any) {
    const token = (ctx.query?.code as string) || '';

    if (!token) {
      ctx.status = 400;
      ctx.body   = { valid: false, message: 'Reset code is required.' };
      return;
    }

    const result = await validateResetToken(strapi, token);
    ctx.status   = result.valid ? 200 : 400;
    ctx.body     = result;
  },

  // POST /api/password-reset/reset
  // Body: { code, newPassword }
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
