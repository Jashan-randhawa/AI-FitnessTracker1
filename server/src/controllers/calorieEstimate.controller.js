const asyncHandler = require('express-async-handler');
const { estimateCalories } = require('../services/calorieEstimate.service');

// POST /api/calorie-estimate — body: { activity, duration, weight? }
const estimate = asyncHandler(async (req, res) => {
  const { activity, duration, weight } = req.body;

  if (!activity || typeof activity !== 'string' || !activity.trim()) {
    return res.status(400).json({ success: false, error: 'activity is required.' });
  }
  if (!duration || Number.isNaN(Number(duration)) || Number(duration) <= 0) {
    return res.status(400).json({ success: false, error: 'duration must be a positive number (minutes).' });
  }

  const weightKg = Number(weight) > 0 ? Number(weight) : 70;
  const durationMin = Number(duration);

  try {
    const result = await estimateCalories(activity.trim(), durationMin, weightKg);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to estimate calories.' });
  }
});

module.exports = { estimate };
