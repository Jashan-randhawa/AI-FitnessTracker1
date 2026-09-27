const asyncHandler = require('express-async-handler');
const { chatWithAssistant } = require('../services/aiAssistant.service');

const MAX_MESSAGES = 50;
const MAX_SINGLE_MESSAGE_CHARS = 8000;
const MAX_TOTAL_CHARS = 40000;
const MAX_USER_CONTEXT_CHARS = 4000;

// POST /api/ai-assistant/chat — body: { messages, userContext? }
const chat = asyncHandler(async (req, res) => {
  const { messages, userContext } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required and must not be empty' });
  }

  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({
      error: `Too many messages in history. Maximum allowed is ${MAX_MESSAGES}.`,
    });
  }

  if (userContext && typeof userContext === 'string' && userContext.length > MAX_USER_CONTEXT_CHARS) {
    return res.status(400).json({
      error: `userContext exceeds maximum allowed size of ${MAX_USER_CONTEXT_CHARS} characters.`,
    });
  }

  let totalChars = 0;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') {
      return res.status(400).json({ error: `Message at index ${i} is invalid.` });
    }

    // Extract text from parts array or direct content
    let text = '';
    if (Array.isArray(m.parts)) {
      text = m.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
    } else if (typeof m.content === 'string') {
      text = m.content;
    } else {
      return res.status(400).json({ error: `Message at index ${i} missing valid text/content.` });
    }

    if (text.length > MAX_SINGLE_MESSAGE_CHARS) {
      return res.status(400).json({
        error: `Message at index ${i} exceeds maximum limit of ${MAX_SINGLE_MESSAGE_CHARS} characters.`,
      });
    }

    totalChars += text.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return res.status(400).json({
        error: `Total conversation length exceeds maximum payload size of ${MAX_TOTAL_CHARS} characters.`,
      });
    }
  }

  try {
    const reply = await chatWithAssistant(messages, userContext);
    res.json({ success: true, reply });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error communicating with AI' });
  }
});

module.exports = { chat };
