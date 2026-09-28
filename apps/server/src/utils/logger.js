/**
 * Structured Logger for AI-FitnessTracker1
 * Provides JSON logging in production, readable output in development,
 * secret scrubbing (passwords, tokens, API keys), and structured AI metrics.
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_LEVEL = process.env.NODE_ENV === 'production' ? 'info' : (process.env.LOG_LEVEL || 'debug');
const CURRENT_LEVEL_NUM = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS[DEFAULT_LEVEL] ?? LOG_LEVELS.info;

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'apikey',
  'api_key',
  'openrouter_api_key',
  'jwt_secret',
  'cookie',
  'secret',
]);

const TOKEN_METRICS_KEYS = new Set([
  'prompttokens',
  'completiontokens',
  'totaltokens',
  'tokencount',
  'tokens',
]);

/**
 * Recursively redacts sensitive keys from an object or array.
 * @param {any} obj
 * @returns {any}
 */
const scrubSecrets = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Mask Bearer tokens
    if (/Bearer\s+[A-Za-z0-9-_.]+/i.test(obj)) {
      return obj.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]');
    }
    // Mask JWT-like strings (three base64 chunks separated by dots, each >= 8 chars)
    if (/^[A-Za-z0-9-_=]{8,}\.[A-Za-z0-9-_=]{8,}\.[A-Za-z0-9-_.+/=]{8,}$/.test(obj)) {
      return '[REDACTED_JWT]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(scrubSecrets);
  }

  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      const isSecret =
        !TOKEN_METRICS_KEYS.has(lowerKey) &&
        (SENSITIVE_KEYS.has(lowerKey) ||
          lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('token') ||
          lowerKey.includes('apikey'));

      if (isSecret) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = scrubSecrets(value);
      }
    }
    return cleaned;
  }

  return obj;
};

/**
 * Formats and outputs a log entry.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, any>} [meta]
 */
const log = (level, message, meta = {}) => {
  if (LOG_LEVELS[level] < CURRENT_LEVEL_NUM) return;

  const timestamp = new Date().toISOString();
  const safeMeta = scrubSecrets(meta);

  if (process.env.NODE_ENV === 'production') {
    const logObject = {
      timestamp,
      level,
      message,
      ...(safeMeta && Object.keys(safeMeta).length > 0 ? { meta: safeMeta } : {}),
    };
    const serialized = JSON.stringify(logObject);
    if (level === 'error') {
      process.stderr.write(serialized + '\n');
    } else {
      process.stdout.write(serialized + '\n');
    }
  } else {
    // Development / test readable format
    const metaStr = safeMeta && Object.keys(safeMeta).length > 0 ? ` ${JSON.stringify(safeMeta)}` : '';
    const output = `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
};

const logger = {
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),

  /**
   * Structured AI request logging helper (FitBot Logging Plan §5.3)
   */
  aiMetric: ({
    requestId,
    userId,
    messageCount,
    inputChars,
    model,
    latencyMs,
    usage = {},
    status = 200,
    success = true,
    error,
  }) => {
    logger.info('ai_assistant_request_completed', {
      type: 'ai_metrics',
      requestId,
      userId: userId ? String(userId) : 'anonymous',
      messageCount,
      inputChars,
      model,
      latencyMs,
      promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
      totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
      httpStatus: status,
      success,
      ...(error ? { error: error.message || String(error) } : {}),
    });
  },

  scrubSecrets,
};

module.exports = logger;
