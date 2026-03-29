import { requestPasswordReset, resetPassword } from '../services/password-reset';

export default {

  // POST /api/password-reset/request
  // Body: { email }
  async request(ctx: any) {
    const { email } = ctx.request.body;

    if (!email || typeof email !== 'string') {
      return ctx.badRequest('Email is required.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return ctx.badRequest('Invalid email format.');
    }

    try {
      const result = await requestPasswordReset(strapi, email.trim());

      if (!result.success) {
        // Only rate-limit errors land here
        ctx.status = 429;
        ctx.body   = { error: { message: result.message } };
        return;
      }

      ctx.body = { message: result.message };
    } catch (err) {
      strapi.log.error('Password reset request error:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },

  // POST /api/password-reset/reset
  // Body: { email, otp, newPassword }
  async reset(ctx: any) {
    const { email, otp, newPassword } = ctx.request.body;

    if (!email || !otp || !newPassword) {
      return ctx.badRequest('Email, code, and new password are required.');
    }

    try {
      const result = await resetPassword(strapi, email.trim(), otp.trim(), newPassword);

      if (!result.success) {
        ctx.status = 400;
        ctx.body   = { error: { message: result.message } };
        return;
      }

      ctx.body = { message: result.message };
    } catch (err) {
      strapi.log.error('Password reset error:', err);
      ctx.internalServerError('Something went wrong. Please try again.');
    }
  },
};
