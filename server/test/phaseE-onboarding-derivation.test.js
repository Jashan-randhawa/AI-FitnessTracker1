process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { deriveGoals } = require('../src/utils/goals');
const { PROMPT_VERSION, FITBOT_SYSTEM_PROMPT } = require('../src/prompts/fitbot.prompt');

describe('Phase E: Onboarding Goal Derivation Parity (G8)', () => {
  it('derives default macro and water targets matching deriveGoals specification', () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      age: 28,
      weight: 75,
      height: 178,
      goal: 'maintain',
    };

    const derived = deriveGoals(user);
    assert.equal(derived.calorieLimit, 2000);
    assert.equal(derived.calorieBurnGoal, 400);
    assert.equal(derived.proteinGoal, 150); // (2000 * 0.3) / 4
    assert.equal(derived.carbsGoal, 200);   // (2000 * 0.4) / 4
    assert.equal(derived.fatGoal, 67);      // round((2000 * 0.3) / 9)
    assert.equal(derived.waterGoal, 2500);
  });

  it('respects explicit macro targets without overriding them', () => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      age: 30,
      dailycaloriesintake: 2400,
      dailyproteingoal: 180,
      dailycarbsgoal: 220,
      dailyfatgoal: 80,
      dailywatergoal: 3000,
    };

    const derived = deriveGoals(user);
    assert.equal(derived.calorieLimit, 2400);
    assert.equal(derived.proteinGoal, 180);
    assert.equal(derived.carbsGoal, 220);
    assert.equal(derived.fatGoal, 80);
    assert.equal(derived.waterGoal, 3000);
  });
});

describe('Phase E: Estimator Fit with Remaining Targets Prompt Contract (G4)', () => {
  it('exposes PROMPT_VERSION 1.9.0', () => {
    assert.equal(PROMPT_VERSION, '1.9.0');
  });

  it('instructs model to evaluate meal suggestions against remaining daily targets', () => {
    assert.ok(
      FITBOT_SYSTEM_PROMPT.includes(
        'When suggesting meals, snacks, recipes, or workout burns in conversational coaching, estimate calories and evaluate them directly against the remaining targets in <fitness_context>'
      )
    );
  });

  it('instructs model to suggest light nutrient-dense options when near or at calorie limit', () => {
    assert.ok(
      FITBOT_SYSTEM_PROMPT.includes(
        'If remaining calories are under 300 kcal or already at/over target, recommend light, nutrient-dense options'
      )
    );
  });
});
