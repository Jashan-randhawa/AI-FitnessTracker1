const crypto = require('crypto');
const { chatCompletionDetailed, DEFAULT_MODEL } = require('./openrouter.service');
const { buildFitBotPrompt, PROMPT_VERSION } = require('../prompts/fitbot.prompt');
const {
  safeParseMealPlan,
  safeParseActivityPlan,
  extractRawJson,
} = require('../schemas/aiPlans.schema');
const logger = require('../utils/logger');

// In-memory configurable TTL and capacity bounded LRU cache (FitBot Phase 4)
const CACHE_TTL_MS = parseInt(process.env.AI_CACHE_TTL_MS, 10) || 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = parseInt(process.env.AI_CACHE_MAX_ENTRIES, 10) || 200;
const DEFAULT_MAX_OUTPUT_TOKENS = parseInt(process.env.AI_MAX_OUTPUT_TOKENS, 10) || 2500;

const responseCache = new Map();

// Cache observability metrics
const cacheStats = {
  hits: 0,
  misses: 0,
  expirations: 0,
  evictions: 0,
};

const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      responseCache.delete(key);
      cacheStats.expirations++;
    }
  }
};

const getCacheStats = () => ({
  size: responseCache.size,
  maxCapacity: MAX_CACHE_ENTRIES,
  ttlMs: CACHE_TTL_MS,
  hits: cacheStats.hits,
  misses: cacheStats.misses,
  expirations: cacheStats.expirations,
  evictions: cacheStats.evictions,
});

const resetCache = () => {
  responseCache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.expirations = 0;
  cacheStats.evictions = 0;
};

const computeCacheKey = ({
  messages,
  isJsonRequest = false,
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
}) => {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        messages,
        isJsonRequest: Boolean(isJsonRequest),
        model,
        maxTokens,
        version: PROMPT_VERSION,
      })
    )
    .digest('hex');
};

const extractCleanJson = (text) => {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = match ? match[1].trim() : text.trim();
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};

/**
 * Validates candidate AI text against target structured plan schema or generic JSON syntax.
 * @param {string} content
 * @param {'mealPlan'|'activityPlan'|'workoutPlan'|string} [planType]
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
const validateStructuredOutput = (content, planType) => {
  if (planType === 'mealPlan') {
    return safeParseMealPlan(content);
  }
  if (planType === 'activityPlan' || planType === 'workoutPlan') {
    return safeParseActivityPlan(content);
  }
  const parsed = extractCleanJson(content);
  if (!parsed) {
    return { success: false, error: 'Output could not be parsed as valid JSON.' };
  }
  return { success: true, data: parsed };
};

/**
 * Communicates with FitBot AI via OpenRouter with bounded LRU caching, fallback,
 * cancellation propagation, distinct memoryContext, and JSON schema validation retry for structured plans.
 *
 * @param {Array<{ role: 'user'|'model'|'assistant', parts?: { text: string }[], content?: string, text?: string }>} messages
 * @param {string|object} [userContext]
 * @param {Object} [options]
 * @param {string} [options.memoryContext]
 * @param {boolean} [options.expectJson]
 * @param {string} [options.planType]
 * @param {boolean} [options.skipCache]
 * @param {boolean} [options.regenerate]
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.fetchFn]
 * @returns {Promise<{ reply: string, usage: object, model: string, cached: boolean, fallbackUsed?: boolean, attempts?: number }>}
 */
const chatWithAssistant = async (messages, userContext, options = {}) => {
  cleanExpiredCache();

  const memoryContext = options.memoryContext;
  const systemInstruction = buildFitBotPrompt(userContext, memoryContext);

  const openRouterMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((m) => {
      let text = '';
      if (Array.isArray(m.parts)) {
        text = m.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
      } else if (typeof m.content === 'string') {
        text = m.content;
      } else if (typeof m.text === 'string') {
        text = m.text;
      }
      return {
        role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
        content: text,
      };
    }),
  ];

  // Check if query requests structured JSON (e.g. Activity Planner / Meal Planner)
  const lastUserMsg = openRouterMessages[openRouterMessages.length - 1]?.content || '';
  const isJsonRequest = Boolean(options.expectJson || /return (only )?valid json/i.test(lastUserMsg));

  // Auto-detect structured plan type if not explicitly supplied
  let effectivePlanType = options.planType;
  if (!effectivePlanType && isJsonRequest) {
    if (/meal plan|breakfast|lunch|dinner|calorie target|preferred cuisine/i.test(lastUserMsg)) {
      effectivePlanType = 'mealPlan';
    } else if (/workout|activity plan|exercises|duration.*calorie|recovery focus/i.test(lastUserMsg)) {
      effectivePlanType = 'activityPlan';
    }
  }

  // Determine token ceiling based on request type
  const maxTokens = isJsonRequest ? 4000 : (options.maxTokens || DEFAULT_MAX_OUTPUT_TOKENS);
  const targetModel = options.model || DEFAULT_MODEL;

  const skipCache = Boolean(options.skipCache || options.regenerate);

  // Compute comprehensive cache key including all settings that affect completion
  const cacheKey = computeCacheKey({
    messages: openRouterMessages,
    isJsonRequest,
    model: targetModel,
    maxTokens,
  });

  // Check LRU cache if not bypassing
  if (!skipCache) {
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry) {
      if (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
        // Move to most recently used position (LRU policy)
        responseCache.delete(cacheKey);
        responseCache.set(cacheKey, { ...cachedEntry, timestamp: Date.now() });
        cacheStats.hits++;
        logger.debug(`[AI Assistant] Cache hit for prompt hash ${cacheKey.slice(0, 8)}`);
        return { ...cachedEntry.data, cached: true };
      } else {
        responseCache.delete(cacheKey);
        cacheStats.expirations++;
      }
    }
    cacheStats.misses++;
  } else {
    logger.debug(`[AI Assistant] Bypassing response cache for hash ${cacheKey.slice(0, 8)} due to regenerate/skipCache`);
  }

  logger.info('[AI Assistant] Dispatching request to OpenRouter', {
    messageCount: openRouterMessages.length,
    isJsonRequest,
    planType: effectivePlanType || 'none',
    model: targetModel,
    maxTokens,
    promptVersion: PROMPT_VERSION,
  });

  let result = await chatCompletionDetailed({
    messages: openRouterMessages,
    title: 'FitTrack AI Assistant',
    model: targetModel,
    maxTokens,
    returnUsage: true,
    signal: options.signal,
    fetchFn: options.fetchFn,
  });

  // Structured JSON & Zod schema validation guard with 1 repair retry if invalid
  if (isJsonRequest) {
    const initialValidation = validateStructuredOutput(result.content, effectivePlanType);
    if (!initialValidation.success) {
      logger.warn(`[AI Assistant] Model returned invalid structured output (${effectivePlanType || 'json'}): ${initialValidation.error}; attempting repair retry...`);

      const repairFeedback = effectivePlanType
        ? `Your previous response did not match the required ${effectivePlanType} JSON schema: ${initialValidation.error}. Return ONLY valid, well-formed JSON matching the requested structure without markdown formatting or commentary.`
        : 'Your previous response could not be parsed as valid JSON. Return ONLY valid, well-formed JSON matching the requested structure. Do not include markdown formatting or explanation.';

      const repairMessages = [
        ...openRouterMessages,
        { role: 'assistant', content: result.content },
        {
          role: 'user',
          content: repairFeedback,
        },
      ];

      try {
        const repairedResult = await chatCompletionDetailed({
          messages: repairMessages,
          title: 'FitTrack AI Assistant (JSON Repair)',
          model: targetModel,
          maxTokens,
          returnUsage: true,
          signal: options.signal,
          fetchFn: options.fetchFn,
        });

        const repairedValidation = validateStructuredOutput(repairedResult.content, effectivePlanType);
        if (repairedValidation.success) {
          logger.info('[AI Assistant] Structured plan repair succeeded against schema.');
          result = repairedResult;
        } else {
          logger.warn(`[AI Assistant] Repaired output still violated schema: ${repairedValidation.error}`);
          if (extractCleanJson(repairedResult.content)) {
            result = repairedResult;
          }
        }
      } catch (repairErr) {
        logger.warn(`[AI Assistant] JSON repair attempt failed: ${repairErr.message}`);
      }
    }
  }

  const responsePayload = {
    reply: result.content || 'Sorry, I could not generate a response.',
    usage: result.usage,
    model: result.model,
    cached: false,
    fallbackUsed: result.fallbackUsed || false,
    attempts: result.attempts || 1,
  };

  // Only cache non-empty, successful responses
  if (!skipCache && responsePayload.reply && responsePayload.reply.trim().length > 0) {
    if (responseCache.size >= MAX_CACHE_ENTRIES) {
      // Evict least recently used (first inserted/accessed) entry
      const oldestKey = responseCache.keys().next().value;
      responseCache.delete(oldestKey);
      cacheStats.evictions++;
    }

    responseCache.set(cacheKey, {
      data: responsePayload,
      timestamp: Date.now(),
    });
  }

  return responsePayload;
};

module.exports = {
  chatWithAssistant,
  extractCleanJson,
  validateStructuredOutput,
  safeParseMealPlan,
  safeParseActivityPlan,
  computeCacheKey,
  responseCache,
  getCacheStats,
  resetCache,
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  DEFAULT_MAX_OUTPUT_TOKENS,
};
