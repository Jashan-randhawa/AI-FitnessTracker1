const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const foodEstimateService = require('../services/foodEstimate.service');
const { buildFitnessContext } = require('../services/fitnessContext.service');
const { computeEstimateFit } = require('../utils/estimateFit');

// POST /api/food-estimate — body: { name } — authenticated
const estimate = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: { message: 'Food name is required.' } });
  }

  try {
    const result = await foodEstimateService.estimateFood(name.trim());

    let fit = null;
    if (req.user && mongoose.connection.readyState === 1) {
      try {
        const timeZone = req.headers['x-timezone'];
        const context = await buildFitnessContext({ user: req.user, timeZone });
        fit = computeEstimateFit(result, context);
      } catch {
        fit = null;
      }
    }

    res.json({ success: true, result, fit });
  } catch (error) {
    const message = error?.message || 'Failed to estimate food nutrition.';
    const isProviderIssue = message.includes('OpenRouter API key not set') || message.includes('API key not set');
    res.status(isProviderIssue ? 503 : 500).json({ success: false, error: { message } });
  }
});

module.exports = { estimate };
