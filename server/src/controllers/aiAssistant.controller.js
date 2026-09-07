const asyncHandler = require('express-async-handler');
const { chatWithAssistant } = require('../services/aiAssistant.service');

// POST /api/ai-assistant/chat — body: { messages, userContext? }
const chat = asyncHandler(async (req, res) => {
  const { messages, userContext } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  try {
    const reply = await chatWithAssistant(messages, userContext);
    res.json({ success: true, reply });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error communicating with AI' });
  }
});

module.exports = { chat };
