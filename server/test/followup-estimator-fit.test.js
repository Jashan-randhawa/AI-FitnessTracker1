process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { computeEstimateFit } = require('../src/utils/estimateFit');
const foodEstimateController = require('../src/controllers/foodEstimate.controller');
const foodEstimateService = require('../src/services/foodEstimate.service');

describe('G4 Deterministic Estimator Fit Tests', () => {
  const mockContext = (goalsOverride = {}, foodOverride = {}) => ({
    profile: {
      goals: {
        calorieLimit: 2000,
        proteinGoal: 150,
        carbsGoal: 200,
        fatGoal: 65,
        waterGoal: 2500,
        calorieBurnGoal: 400,
        ...goalsOverride,
      },
    },
    today: {
      food: {
        calories: 1200,
        protein: 80,
        carbs: 130,
        fat: 40,
        meals: 2,
        ...foodOverride,
      },
    },
  });

  it('returns null if estimate or estimate.calories is missing or invalid', () => {
    assert.equal(computeEstimateFit(null, mockContext()), null);
    assert.equal(computeEstimateFit({}, mockContext()), null);
    assert.equal(computeEstimateFit({ calories: 'not-a-number' }, mockContext()), null);
  });

  it('returns null if fitnessContext or goals is missing', () => {
    assert.equal(computeEstimateFit({ calories: 400 }, null), null);
    assert.equal(computeEstimateFit({ calories: 400 }, {}), null);
    assert.equal(computeEstimateFit({ calories: 400 }, { profile: {} }), null);
  });

  it('calculates fit percentage and protein proportion within remaining targets', () => {
    // Remaining: 2000 - 1200 = 800 kcal; Protein remaining: 150 - 80 = 70 g
    const estimate = { calories: 400, protein: 35, carbs: 40, fat: 10 };
    const fit = computeEstimateFit(estimate, mockContext());

    assert.ok(fit);
    assert.equal(fit.remainingCalories, 800);
    assert.equal(fit.remainingProtein, 70);
    // 400 / 800 = 50%
    assert.equal(fit.caloriePercentageOfRemaining, 50);
    // 35 / 70 = 50%
    assert.equal(fit.proteinPercentageOfRemaining, 50);
    assert.ok(fit.message.includes('Uses 50% of your remaining calories (800 kcal left)'));
    assert.ok(fit.message.includes('Provides 50% of remaining protein'));
  });

  it('handles estimates that exceed remaining daily calories', () => {
    // Remaining: 800 kcal. Estimate: 950 kcal.
    const estimate = { calories: 950, protein: 40 };
    const fit = computeEstimateFit(estimate, mockContext());

    assert.ok(fit);
    assert.ok(fit.message.includes('Exceeds remaining daily calories by 150 kcal.'));
  });

  it('handles users who have already met or exceeded calorie limit', () => {
    // Already at 2100 / 2000 kcal
    const ctx = mockContext({}, { calories: 2100 });
    const estimate = { calories: 300, protein: 20 };
    const fit = computeEstimateFit(estimate, ctx);

    assert.ok(fit);
    assert.equal(fit.remainingCalories, 0);
    assert.ok(fit.message.includes('You have reached your 2000 kcal calorie target for today.'));
  });

  it('foodEstimate controller safely completes and adds fit field for authenticated user', async () => {
    const originalEstimateFood = foodEstimateService.estimateFood;
    foodEstimateService.estimateFood = async () => ({
      name: 'Oatmeal with berries',
      calories: 320,
      protein: 12,
      carbs: 55,
      fat: 6,
    });

    try {
      const user = {
        _id: new mongoose.Types.ObjectId(),
        dailycaloriesintake: 2200,
        dailyproteingoal: 160,
      };

      const req = {
        user,
        body: { name: 'Oatmeal with berries' },
        headers: { 'x-timezone': 'UTC' },
      };

      let responseJson = null;
      const res = {
        status: () => res,
        json: (data) => {
          responseJson = data;
          return res;
        },
      };

      await foodEstimateController.estimate(req, res);

      assert.ok(responseJson);
      assert.equal(responseJson.success, true);
      assert.equal(responseJson.result.calories, 320);
      assert.ok('fit' in responseJson);
    } finally {
      foodEstimateService.estimateFood = originalEstimateFood;
    }
  });
});
