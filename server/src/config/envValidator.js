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
  GEMINI_TIMEOUT_MS: z.any().optional(),
  AI_DAILY_TOKEN_BUDGET: z.any().optional(),
  AI_DAILY_CALL_BUDGET: z.any().optional(),
  AI_FEATURE_BUDGETS: z.any().optional(),
  AI_DAILY_BUDGET_ADMIN_MULTIPLIER: z.any().optional(),
  AI_FALLBACK_COST_TOKENS: z.any().optional(),
  AI_BUDGET_FAIL_MODE: z.any().optional(),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().positive().default(336),
  OFFLINE_MAX_AGE_DAYS: z.coerce.number().positive().default(30),
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
  if (!rawEnv.MONGODB_URI && rawEnv.MONGO_URI) {
    if (rawEnv === process.env) {
      process.env.MONGODB_URI = rawEnv.MONGO_URI;
    }
    warnings.push('MONGO_URI is deprecated; please use MONGODB_URI.');
  }
  const hasDb = Boolean(rawEnv.MONGODB_URI || rawEnv.MONGO_URI);
  if (!hasDb) {
    if (isProd && !isCiOrTest) {
      errors.push('MONGODB_URI is required in production.');
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

  // AI Daily Budget configuration validation (warnings only, never crashes boot)
  if (rawEnv.GEMINI_TIMEOUT_MS !== undefined && rawEnv.GEMINI_TIMEOUT_MS !== '') {
    const parsed = Number(rawEnv.GEMINI_TIMEOUT_MS);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      warnings.push(`GEMINI_TIMEOUT_MS should be a positive number; received "${rawEnv.GEMINI_TIMEOUT_MS}" (will fall back to default).`);
    }
  }

  if (rawEnv.AI_DAILY_TOKEN_BUDGET !== undefined && rawEnv.AI_DAILY_TOKEN_BUDGET !== '') {
    const parsed = Number(rawEnv.AI_DAILY_TOKEN_BUDGET);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      warnings.push(`AI_DAILY_TOKEN_BUDGET should be a positive number; received "${rawEnv.AI_DAILY_TOKEN_BUDGET}" (will fall back to default).`);
    }
  }

  if (rawEnv.AI_DAILY_CALL_BUDGET !== undefined && rawEnv.AI_DAILY_CALL_BUDGET !== '') {
    const parsed = Number(rawEnv.AI_DAILY_CALL_BUDGET);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      warnings.push(`AI_DAILY_CALL_BUDGET should be a positive number; received "${rawEnv.AI_DAILY_CALL_BUDGET}" (will fall back to default).`);
    }
  }

  if (rawEnv.AI_DAILY_BUDGET_ADMIN_MULTIPLIER !== undefined && rawEnv.AI_DAILY_BUDGET_ADMIN_MULTIPLIER !== '') {
    const parsed = Number(rawEnv.AI_DAILY_BUDGET_ADMIN_MULTIPLIER);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      warnings.push(`AI_DAILY_BUDGET_ADMIN_MULTIPLIER should be a positive number; received "${rawEnv.AI_DAILY_BUDGET_ADMIN_MULTIPLIER}" (will fall back to default).`);
    }
  }

  if (rawEnv.AI_FEATURE_BUDGETS) {
    try {
      const parsed = typeof rawEnv.AI_FEATURE_BUDGETS === 'string'
        ? JSON.parse(rawEnv.AI_FEATURE_BUDGETS)
        : rawEnv.AI_FEATURE_BUDGETS;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        warnings.push('AI_FEATURE_BUDGETS should be a valid JSON object mapping feature keys to token limits.');
      }
    } catch (_err) {
      warnings.push('AI_FEATURE_BUDGETS is not valid JSON; per-feature caps will be ignored.');
    }
  }

  if (rawEnv.AI_BUDGET_FAIL_MODE !== undefined && rawEnv.AI_BUDGET_FAIL_MODE !== '') {
    const mode = String(rawEnv.AI_BUDGET_FAIL_MODE).toLowerCase();
    if (mode !== 'open' && mode !== 'closed') {
      warnings.push(`AI_BUDGET_FAIL_MODE should be "open" or "closed"; received "${rawEnv.AI_BUDGET_FAIL_MODE}".`);
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
