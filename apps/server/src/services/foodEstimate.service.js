const { chatCompletion } = require('./openrouter.service');
const { createEstimator } = require('@jashan-randhawa/ai-nutrition-estimator');

const estimator = createEstimator({ chat: chatCompletion });

const estimateFood = async (foodText) => {
  return estimator.foodFromText(foodText);
};

module.exports = { estimateFood, estimator };
