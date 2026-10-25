const asyncHandler = require('express-async-handler');
const { getWorkoutRecommendations } = require('../services/progressionEngine');
const { parseVoiceGymSet } = require('../utils/gemini');
const sendError = require('../utils/sendError');

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

/**
 * POST /api/workouts/parse-voice-set
 * Parses natural gym speech (or audio blob) into structured set data:
 * { exerciseName, weightKg, reps, rpe, startRestTimer: true }
 */
const parseVoiceSet = asyncHandler(async (req, res) => {
  const speechText = req.body?.speechText || req.body?.text;
  const audioBuffer = req.file?.buffer;
  const mimeType = req.file?.mimetype || 'audio/webm';

  if (!speechText && !audioBuffer) {
    return sendError(res, 400, 'Please provide speechText or an audio file');
  }

  const parsed = await parseVoiceGymSet({
    speechText,
    audioBuffer,
    mimeType,
  });

  res.status(200).json({
    success: true,
    parsed,
  });
});

module.exports = {
  getRecommendations,
  parseVoiceSet,
};
