const { chatCompletion } = require('./openrouter.service');
const { createEstimator } = require('@jashan-randhawa/ai-nutrition-estimator');

const estimator = createEstimator({ chat: chatCompletion });

const analyzeImage = async (buffer, mimeType) => {
  return estimator.foodFromImage({ buffer, mimeType });
};

module.exports = { analyzeImage, estimator };
