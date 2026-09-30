const { z } = require('zod');

const requestResetSchema = z.object({
  email: z
    .string({
      required_error: 'Email is required.',
      invalid_type_error: 'Email is required.',
    })
    .trim()
    .min(1, 'Email is required.')
    .email('Invalid email format.')
    .max(254, 'Email is too long.')
    .transform((val) => val.toLowerCase()),
});

const validateTokenSchema = z.object({
  code: z
    .string({
      required_error: 'Reset code is required.',
      invalid_type_error: 'Reset code is required.',
    })
    .trim()
    .min(1, 'Reset code is required.'),
});

const resetPasswordSchema = z.object({
  code: z
    .string({
      required_error: 'Reset code and new password are required.',
      invalid_type_error: 'Reset code and new password are required.',
    })
    .trim()
    .min(1, 'Reset code and new password are required.'),
  newPassword: z
    .string({
      required_error: 'Reset code and new password are required.',
      invalid_type_error: 'Reset code and new password are required.',
    })
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
});

module.exports = {
  requestResetSchema,
  validateTokenSchema,
  resetPasswordSchema,
};
