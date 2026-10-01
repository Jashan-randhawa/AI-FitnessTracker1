const asyncHandler = require('express-async-handler');
const { chatWithAssistant } = require('../services/aiAssistant.service');
const logger = require('../utils/logger');

const MAX_MESSAGES = 50;
const MAX_SINGLE_MESSAGE_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;
const MAX_USER_CONTEXT_CHARS = 4000;

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

// POST /api/ai-assistant/chat — body: { messages, userContext?, systemInstruction?, expectJson? }
const chat = asyncHandler(async (req, res) => {
  const {
    messages: rawMessages,
    userContext: rawUserContext,
    systemInstruction,
    expectJson,
    options,
    skipCache,
    regenerate,
  } = req.body;
  const startTime = Date.now();
  const userId = req.user?.id || req.user?._id;
  const requestId = req.id || req.requestId;

  const prepared = prepareMessages(rawMessages);
  if (!prepared.valid) {
    return res.status(400).json({ error: prepared.error });
  }

  // Gracefully accept userContext or legacy systemInstruction from client
  let userContext = typeof rawUserContext === 'string' && rawUserContext.trim().length > 0
    ? rawUserContext
    : (typeof systemInstruction === 'string' ? systemInstruction : undefined);

  if (userContext && typeof userContext === 'string' && userContext.length > MAX_USER_CONTEXT_CHARS) {
    userContext = userContext.slice(0, MAX_USER_CONTEXT_CHARS);
  }

  const { messages, totalChars } = prepared;
  const chatOptions = {
    expectJson: Boolean(expectJson || options?.expectJson),
    skipCache: Boolean(skipCache || regenerate || options?.skipCache || options?.regenerate),
  };

  try {
    const result = await chatWithAssistant(messages, userContext, chatOptions);
    const latencyMs = Date.now() - startTime;

    // AI-Specific Structured Metric Logging (FitBot Plan §5.3)
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

    res.json({
      success: true,
      reply: result.reply,
      usage: result.usage,
      model: result.model,
      cached: result.cached || false,
    });
  } catch (error) {
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
  }
});

module.exports = {
  chat,
  prepareMessages,
  MAX_MESSAGES,
  MAX_SINGLE_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  MAX_USER_CONTEXT_CHARS,
};
