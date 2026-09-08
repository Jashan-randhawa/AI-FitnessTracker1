const asyncHandler = require('express-async-handler');
const { estimateFood } = require('../services/foodEstimate.service');

// POST /api/food-estimate — body: { name } — authenticated
const estimate = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Food name is required.' } });
  }

  try {
    const result = await estimateFood(name.trim());
    res.json({ success: true, result });
  } catch (error) {
    const message = error?.message || 'Failed to estimate food nutrition.';
    const isProviderIssue = message.includes('OpenRouter API key not set') || message.includes('API key not set');
    res.status(isProviderIssue ? 503 : 500).json({ success: false, error: { message } });
  }
});

module.exports = { estimate };
