const asyncHandler = require('express-async-handler');
const { getWorkoutRecommendations } = require('../services/progressionEngine');

/**
 * GET /api/workouts/recommendations
 * Computes progressive overload and cross-domain recovery recommendations
 * for the authenticated user's active exercises.
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const result = await getWorkoutRecommendations(req.user._id, {
    exercise: req.query.exercise,
  });

  res.status(200).json(result);
});

module.exports = {
  getRecommendations,
};
