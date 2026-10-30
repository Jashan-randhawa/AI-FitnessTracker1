const { z } = require('zod');

/**
 * Zod Environment Schema for Server Startup (Phase 5).
 * Validates critical environment variables before opening network sockets.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(1337),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').optional(),
  MONGO_URI: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
});

/**
 * Validates process.env at boot time with CI & test bypass mode.
 *
 * @param {Object} [rawEnv=process.env]
 * @returns {{ valid: boolean, env: Object, warnings: string[], errors: string[] }}
 */
const validateEnvironment = (rawEnv = process.env) => {
  const isCiOrTest =
    rawEnv.CI === 'true' ||
    rawEnv.CI_DRY_RUN === 'true' ||
    rawEnv.NODE_ENV === 'test';

  const isProd = rawEnv.NODE_ENV === 'production';

  const warnings = [];
  const errors = [];

  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  const env = parsed.success ? parsed.data : rawEnv;

  // Database credentials check
  const hasDb = Boolean(rawEnv.MONGO_URI || rawEnv.MONGODB_URI);
  if (!hasDb) {
    if (isProd && !isCiOrTest) {
      errors.push('MONGO_URI or MONGODB_URI is required in production.');
    } else {
      warnings.push('Database URI not specified; using memory or localhost fallback.');
    }
  }

  // Gemini API key check
  const hasGemini = Boolean(rawEnv.GOOGLE_API_KEY || rawEnv.GEMINI_API_KEY);
  if (!hasGemini) {
    if (isProd && rawEnv.STRICT_AI_KEYS === 'true' && !isCiOrTest) {
      errors.push('GOOGLE_API_KEY or GEMINI_API_KEY is required in production when STRICT_AI_KEYS is enabled.');
    } else {
      warnings.push('GOOGLE_API_KEY / GEMINI_API_KEY not configured. Gemini AI features (Food Snap v2 vision, FitBot tools, voice logger) will run with fallback handlers until a key is added.');
    }
  }

  // JWT Secret check
  if (!rawEnv.JWT_SECRET) {
    if (isProd && !isCiOrTest) {
      errors.push('JWT_SECRET is strictly required in production.');
    } else {
      warnings.push('JWT_SECRET not set; using development fallback.');
      if (rawEnv === process.env && !process.env.JWT_SECRET) {
        process.env.JWT_SECRET = 'dev-insecure-secret-key-32chars!!';
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      env,
      warnings,
      errors,
    };
  }

  return {
    valid: true,
    env,
    warnings,
    errors: [],
  };
};

module.exports = {
  EnvSchema,
  validateEnvironment,
};
