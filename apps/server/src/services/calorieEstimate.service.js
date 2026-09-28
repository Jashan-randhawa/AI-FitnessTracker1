const { chatCompletion } = require('./openrouter.service');
const { createEstimator } = require('@jashan-randhawa/ai-nutrition-estimator');

const estimator = createEstimator({ chat: chatCompletion });

const estimateCalories = async (activity, durationMinutes, weightKg) => {
  return estimator.activity({
    name: activity,
    minutes: durationMinutes,
    weightKg,
  });
};

module.exports = { estimateCalories, estimator };
