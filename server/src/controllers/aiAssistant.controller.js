const asyncHandler = require('express-async-handler');
const { chatWithAssistant } = require('../services/aiAssistant.service');
const logger = require('../utils/logger');

const MAX_MESSAGES = 50;
const MAX_SINGLE_MESSAGE_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;
const MAX_USER_CONTEXT_CHARS = 4000;
const MAX_MEMORY_CONTEXT_CHARS = 1200;

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

// POST /api/ai-assistant/chat — body: { messages, userContext?, memoryContext?, systemInstruction?, expectJson? }
const chat = asyncHandler(async (req, res) => {
  const {
    messages: rawMessages,
    userContext: rawUserContext,
    memoryContext: rawMemoryContext,
    context: rawStructuredContext,
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

  // Gracefully accept userContext, structured context, or legacy systemInstruction
  let userContext = undefined;
  if (typeof rawUserContext === 'string' && rawUserContext.trim().length > 0) {
    userContext = rawUserContext.trim();
  } else if (rawStructuredContext && typeof rawStructuredContext === 'object') {
    try {
      userContext = JSON.stringify(rawStructuredContext);
    } catch {
      userContext = undefined;
    }
  } else if (typeof systemInstruction === 'string' && systemInstruction.trim().length > 0) {
    userContext = systemInstruction.trim();
  }

  if (userContext && typeof userContext === 'string' && userContext.length > MAX_USER_CONTEXT_CHARS) {
    userContext = userContext.slice(0, MAX_USER_CONTEXT_CHARS);
  }

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

  const chatOptions = {
    expectJson: Boolean(expectJson || options?.expectJson),
    skipCache: Boolean(skipCache || regenerate || options?.skipCache || options?.regenerate),
    signal: abortController.signal,
    memoryContext,
  };

  try {
    const result = await chatWithAssistant(messages, userContext, chatOptions);
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

    res.json({
      success: true,
      reply: result.reply,
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
  }
});

module.exports = {
  chat,
  prepareMessages,
  MAX_MESSAGES,
  MAX_SINGLE_MESSAGE_CHARS,
  MAX_TOTAL_CHARS,
  MAX_USER_CONTEXT_CHARS,
  MAX_MEMORY_CONTEXT_CHARS,
};
