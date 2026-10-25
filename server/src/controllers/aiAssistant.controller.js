const asyncHandler = require('express-async-handler');
const { chatWithAssistant } = require('../services/aiAssistant.service');
const { buildEnvironmentContext } = require('../services/environment.service');
const { buildFitnessPromptContext } = require('../services/fitnessContext.service');
const { buildPlannerContext, PLANNER_KINDS } = require('../services/plannerContext.service');
const { extractProposedActions } = require('../utils/chatActions');

// Test seams: let tests replace the context loaders without a database. Production never changes them.
let fitnessPromptBuilder = buildFitnessPromptContext;
const setFitnessPromptBuilderForTests = (fn) => {
  fitnessPromptBuilder = fn || buildFitnessPromptContext;
};
let plannerContextBuilder = buildPlannerContext;
const setPlannerContextBuilderForTests = (fn) => {
  plannerContextBuilder = fn || buildPlannerContext;
};
const logger = require('../utils/logger');

const MAX_MESSAGES = 50;
const MAX_SINGLE_MESSAGE_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;
const MAX_USER_CONTEXT_CHARS = 4000;
const MAX_MEMORY_CONTEXT_CHARS = 1200;

// Concurrency limits to prevent upstream budget exhaustion and runaway thread saturation
const MAX_CONCURRENT_AI_REQUESTS = parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS, 10) || 25;
const MAX_USER_CONCURRENT_AI_REQUESTS = parseInt(process.env.MAX_USER_CONCURRENT_AI_REQUESTS, 10) || 2;

let activeRequestsTotal = 0;
const activeRequestsPerUser = new Map();

const getActiveConcurrencyStats = () => ({
  activeTotal: activeRequestsTotal,
  activeUsers: activeRequestsPerUser.size,
  maxTotal: MAX_CONCURRENT_AI_REQUESTS,
  maxPerUser: MAX_USER_CONCURRENT_AI_REQUESTS,
});

const resetConcurrencyStats = () => {
  activeRequestsTotal = 0;
  activeRequestsPerUser.clear();
};

/**
 * Normalizes and gracefully truncates messages array and text lengths (FitBot Plan §4 #8).
 * Drops oldest messages when history exceeds limits, ensuring active conversations never crash.
 */
const prepareMessages = (rawMessages) => {
  if (!rawMessages || !Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { valid: false, error: 'messages array is required and must not be empty' };
  }

  // Gracefully truncate to the most recent MAX_MESSAGES
  const boundedMessages = rawMessages.length > MAX_MESSAGES
    ? rawMessages.slice(-MAX_MESSAGES)
    : rawMessages;

  const sanitized = [];
  let totalChars = 0;

  for (let i = 0; i < boundedMessages.length; i++) {
    const m = boundedMessages[i];
    if (!m || typeof m !== 'object') {
      return { valid: false, error: `Message at index ${i} is invalid.` };
    }

    let text = '';
    if (Array.isArray(m.parts)) {
      text = m.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
    } else if (typeof m.content === 'string') {
      text = m.content;
    } else if (typeof m.text === 'string') {
      text = m.text;
    } else {
      return { valid: false, error: `Message at index ${i} missing valid text/content.` };
    }

    // Gracefully truncate any individual message that exceeds limit
    if (text.length > MAX_SINGLE_MESSAGE_CHARS) {
      text = text.slice(0, MAX_SINGLE_MESSAGE_CHARS);
    }

    sanitized.push({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      parts: [{ text }],
      content: text,
      textLength: text.length,
    });
    totalChars += text.length;
  }

  // Gracefully drop oldest messages from the beginning if total payload exceeds MAX_TOTAL_CHARS
  while (sanitized.length > 1 && totalChars > MAX_TOTAL_CHARS) {
    const dropped = sanitized.shift();
    totalChars -= dropped.textLength;
  }

  return { valid: true, messages: sanitized, totalChars };
};

// POST /api/ai-assistant/chat — body: { messages, userContext?, memoryContext?, systemInstruction?, expectJson?, options? }
const chat = asyncHandler(async (req, res) => {
  const {
    messages: rawMessages,
    memoryContext: rawMemoryContext,
    expectJson,
    options,
    skipCache,
    regenerate,
    planType,
    schema,
    environment: rawEnvironment,
  } = req.body;
  const startTime = Date.now();
  const userId = req.user?.id || req.user?._id;
  const requestId = req.id || req.requestId || `req-${Date.now()}`;
  const userKey = String(userId || req.ip || 'anonymous');

  // Check in-flight concurrency caps
  if (activeRequestsTotal >= MAX_CONCURRENT_AI_REQUESTS) {
    if (typeof res.setHeader === 'function') res.setHeader('Retry-After', '2');
    return res.status(429).json({
      error: 'FitBot is currently processing many requests. Please wait a moment and try again.',
      retryAfter: 2,
    });
  }

  const userInFlight = activeRequestsPerUser.get(userKey) || 0;
  if (userInFlight >= MAX_USER_CONCURRENT_AI_REQUESTS) {
    if (typeof res.setHeader === 'function') res.setHeader('Retry-After', '2');
    return res.status(429).json({
      error: 'You already have an AI request in progress. Please wait for it to finish.',
      retryAfter: 2,
    });
  }

  const prepared = prepareMessages(rawMessages);
  if (!prepared.valid) {
    return res.status(400).json({ error: prepared.error });
  }

  // Client-supplied userContext, context, and systemInstruction are not trusted and are
  // not forwarded. The fitness context below is built on the server from the
  // authenticated user's records. These fields are still accepted so old clients keep working.

  let memoryContext = undefined;
  if (typeof rawMemoryContext === 'string' && rawMemoryContext.trim().length > 0) {
    memoryContext = rawMemoryContext.trim().slice(0, MAX_MEMORY_CONTEXT_CHARS);
  }

  const { messages, totalChars } = prepared;

  // Propagate client cancellation through to OpenRouter via AbortController
  const abortController = new AbortController();
  const onClientClose = () => {
    if (!res.writableEnded) {
      const abortErr = new Error('Client connection closed');
      abortErr.name = 'AbortError';
      abortErr.isClientAbort = true;
      abortController.abort(abortErr);
    }
  };
  if (typeof req.on === 'function') {
    req.on('close', onClientClose);
  }

  // Weather and local time are added only when the request includes `environment`.
  // Requests without it keep their existing prompt. The time comes from the validated
  // X-Timezone header, never from client text.
  const tzHeader = typeof req.get === 'function' ? req.get('X-Timezone') : undefined;
  let environmentContext;
  if (rawEnvironment !== undefined && rawEnvironment !== null) {
    environmentContext = buildEnvironmentContext({ raw: rawEnvironment, timeZone: tzHeader }).text;
  }

  const chatOptions = {
    expectJson: Boolean(expectJson || options?.expectJson),
    planType: options?.planType || planType || options?.schema || schema,
    skipCache: Boolean(skipCache || regenerate || options?.skipCache || options?.regenerate),
    signal: abortController.signal,
    memoryContext,
    model: options?.model,
    maxTokens: options?.maxTokens,
    fetchFn: options?.fetchFn,
    environmentContext,
    user: req.user,
    timeZone: tzHeader,
  };

  // Track concurrency in flight
  activeRequestsTotal++;
  activeRequestsPerUser.set(userKey, userInFlight + 1);

  try {
    const tzHeader = typeof req.get === 'function' ? req.get('X-Timezone') : undefined;
    const isPlannerRequest = Boolean(chatOptions.expectJson) && Object.prototype.hasOwnProperty.call(PLANNER_KINDS, chatOptions.planType);

    if (isPlannerRequest) {
      // Planners get server-built planning context: remaining calories, today's food names,
      // the active plan, and the streak rule. It is required. If it cannot be loaded, the
      // request is refused rather than planned without the user's data.
      const planner = await plannerContextBuilder({
        user: req.user,
        timeZone: tzHeader,
        planType: chatOptions.planType,
        requestedCalories: options?.targetCalories,
      });
      if (!planner.ok) {
        if (typeof req.removeListener === 'function') {
          req.removeListener('close', onClientClose);
        }
        return res.status(503).json({
          error: 'Your fitness data could not be loaded, so the plan was not generated. Please try again.',
        });
      }
      chatOptions.fitnessContext = planner.text;
      chatOptions.plannerLimits = planner.limits;
    } else if (!chatOptions.expectJson) {
      // Conversational requests get the coaching context. Other JSON requests keep their
      // existing shape and get no fitness context.
      chatOptions.fitnessContext = await fitnessPromptBuilder({ user: req.user, timeZone: tzHeader });
    }
    chatOptions.cacheScope = userId ? `user:${String(userId)}` : `anon:${userKey}`;

    const result = await chatWithAssistant(messages, undefined, chatOptions);
    if (typeof req.removeListener === 'function') {
      req.removeListener('close', onClientClose);
    }

    if (res.writableEnded || res.headersSent) {
      return;
    }

    const latencyMs = Date.now() - startTime;

    // AI-Specific Structured Metric Logging (FitBot Plan §5.3) - preserves user privacy (no raw prompts/tokens)
    logger.aiMetric({
      requestId,
      userId,
      messageCount: messages.length,
      inputChars: totalChars,
      model: result.model,
      latencyMs,
      usage: result.usage,
      status: 200,
      success: true,
    });

    const { cleanedReply, proposedActions } = extractProposedActions(result.reply);

    res.json({
      success: true,
      reply: cleanedReply,
      executedActions: result.executedActions || [],
      executedTools: result.executedActions || [],
      proposedActions,
      usage: result.usage,
      model: result.model,
      cached: result.cached || false,
    });
  } catch (error) {
    if (typeof req.removeListener === 'function') {
      req.removeListener('close', onClientClose);
    }

    if (res.writableEnded || res.headersSent) {
      return;
    }

    // Do not attempt to respond if the client explicitly aborted connection
    if (error.isClientAbort || error.name === 'AbortError') {
      logger.debug(`[AI Assistant] Request ${requestId} aborted by client`);
      return;
    }

    const latencyMs = Date.now() - startTime;
    const status = error.status || (error.isOperational ? 503 : 500);
    const friendlyMessage = error.status === 503 || error.isOperational
      ? 'AI assistant is temporarily unavailable. Please try again in a moment.'
      : (error.message || 'Error communicating with AI assistant.');

    logger.aiMetric({
      requestId,
      userId,
      messageCount: messages.length,
      inputChars: totalChars,
      model: 'unknown',
      latencyMs,
      status,
      success: false,
      error,
    });

    res.status(status).json({ error: friendlyMessage });
  } finally {
    // Release in-flight concurrency slots
    activeRequestsTotal = Math.max(0, activeRequestsTotal - 1);
    const remaining = (activeRequestsPerUser.get(userKey) || 1) - 1;
    if (remaining <= 0) {
      activeRequestsPerUser.delete(userKey);
    } else {
      activeRequestsPerUser.set(userKey, remaining);
    }
  }
});

module.exports = {
  chat,
  setFitnessPromptBuilderForTests,
  setPlannerContextBuilderForTests,
  prepareMessages,
  getActiveConcurrencyStats,
  resetConcurrencyStats,
  MAX_MESSAGES,
  MAX_SINGLE_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  MAX_USER_CONTEXT_CHARS,
  MAX_MEMORY_CONTEXT_CHARS,
  MAX_CONCURRENT_AI_REQUESTS,
  MAX_USER_CONCURRENT_AI_REQUESTS,
};
