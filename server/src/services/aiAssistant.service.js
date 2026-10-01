const crypto = require('crypto');
const { chatCompletionDetailed } = require('./openrouter.service');
const { buildFitBotPrompt, PROMPT_VERSION } = require('../prompts/fitbot.prompt');
const logger = require('../utils/logger');

// In-memory 5-minute TTL cache for identical prompt queries (FitBot Plan §4 #5)
const CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map();

const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      responseCache.delete(key);
    }
  }
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
 * Communicates with FitBot AI via OpenRouter with caching, fallback,
 * and JSON parse validation retry for structured Activity Planner plans.
 *
 * @param {Array<{ role: 'user'|'model'|'assistant', parts?: { text: string }[], content?: string }>} messages
 * @param {string} [userContext]
 * @param {Object} [options]
 * @param {boolean} [options.expectJson]
 * @returns {Promise<{ reply: string, usage: object, model: string, cached: boolean }>}
 */
const chatWithAssistant = async (messages, userContext, options = {}) => {
  cleanExpiredCache();

  const systemInstruction = buildFitBotPrompt(userContext);

  const openRouterMessages = [
    { role: 'system', content: systemInstruction },
    ...messages.map((m) => {
      let text = '';
      if (Array.isArray(m.parts)) {
        text = m.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
      } else if (typeof m.content === 'string') {
        text = m.content;
      }
      return {
        role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
        content: text,
      };
    }),
  ];

  // Check if query requests structured JSON (e.g. Activity Planner)
  const lastUserMsg = openRouterMessages[openRouterMessages.length - 1]?.content || '';
  const isJsonRequest = options.expectJson || /return (only )?valid json/i.test(lastUserMsg);

  const skipCache = Boolean(options.skipCache || options.regenerate);

  // Compute cache key based on prompt messages and user context
  const cacheKey = crypto
    .createHash('sha256')
    .update(JSON.stringify({ messages: openRouterMessages, isJsonRequest, version: PROMPT_VERSION }))
    .digest('hex');

  if (!skipCache) {
    const cachedEntry = responseCache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL_MS) {
      logger.debug(`[AI Assistant] Cache hit for prompt hash ${cacheKey.slice(0, 8)}`);
      return { ...cachedEntry.data, cached: true };
    }
  } else {
    logger.debug(`[AI Assistant] Bypassing response cache for hash ${cacheKey.slice(0, 8)} due to regenerate/skipCache`);
  }

  logger.info('[AI Assistant] Dispatching request to OpenRouter', {
    messageCount: openRouterMessages.length,
    isJsonRequest,
    promptVersion: PROMPT_VERSION,
  });

  let result = await chatCompletionDetailed({
    messages: openRouterMessages,
    title: 'FitTrack AI Assistant',
    maxTokens: 4000,
    returnUsage: true,
  });

  // Gap 6: Structured JSON validation guard with 1 repair retry
  if (isJsonRequest && !extractCleanJson(result.content)) {
    logger.warn('[AI Assistant] Model returned unparseable JSON for structured request; attempting repair retry...');
    const repairMessages = [
      ...openRouterMessages,
      { role: 'assistant', content: result.content },
      {
        role: 'user',
        content: 'Your previous response could not be parsed as valid JSON. Return ONLY valid, well-formed JSON matching the requested structure. Do not include markdown formatting or explanation.',
      },
    ];

    try {
      const repairedResult = await chatCompletionDetailed({
        messages: repairMessages,
        title: 'FitTrack AI Assistant (JSON Repair)',
        maxTokens: 4000,
        returnUsage: true,
      });

      if (extractCleanJson(repairedResult.content)) {
        logger.info('[AI Assistant] JSON repair succeeded.');
        result = repairedResult;
      }
    } catch (repairErr) {
      logger.warn(`[AI Assistant] JSON repair attempt failed: ${repairErr.message}`);
    }
  }

  const responsePayload = {
    reply: result.content || 'Sorry, I could not generate a response.',
    usage: result.usage,
    model: result.model,
    cached: false,
  };

  // Cache successful responses
  responseCache.set(cacheKey, {
    data: responsePayload,
    timestamp: Date.now(),
  });

  return responsePayload;
};

module.exports = {
  chatWithAssistant,
  extractCleanJson,
  responseCache,
  CACHE_TTL_MS,
};
