process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { calculateGoalSuggestion } = require('../src/utils/goals');
const User = require('../src/models/User');

describe('G8 Deterministic Goal Suggestions Tests (Mifflin-St Jeor & Safe Bounds)', () => {
  it('returns null if age, weight, or height is missing or non-positive', () => {
    assert.equal(calculateGoalSuggestion({}), null);
    assert.equal(calculateGoalSuggestion({ age: 25 }), null);
    assert.equal(calculateGoalSuggestion({ age: 25, weight: 70 }), null);
    assert.equal(calculateGoalSuggestion({ age: 0, weight: 70, height: 175 }), null);
    assert.equal(calculateGoalSuggestion({ age: 25, weight: -5, height: 175 }), null);
  });

  it('calculates BMR and TDEE for male maintain accurately', () => {
    // Male, 25y, 70kg, 175cm, moderate (1.55)
    // BMR = 10*70 + 6.25*175 - 5*25 + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
    // TDEE = 1673.75 * 1.55 = 2594.3125
    // Maintain = 2594 kcal
    const res = calculateGoalSuggestion({
      age: 25,
      weight: 70,
      height: 175,
      gender: 'male',
      activityLevel: 'moderate',
      goal: 'maintain',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 2594);
    assert.equal(res.calorieBurn, 450);
    assert.ok(res.explanation.includes('BMR: 1674 kcal'));
    assert.ok(res.explanation.includes('TDEE: 2594 kcal'));
  });

  it('calculates 500 kcal deficit for weight loss goal', () => {
    // Same profile, goal = 'lose'
    // 2594.3125 - 500 = 2094 kcal
    const res = calculateGoalSuggestion({
      age: 25,
      weight: 70,
      height: 175,
      gender: 'male',
      activityLevel: 'moderate',
      goal: 'lose',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 2094);
    assert.ok(res.explanation.includes('500 kcal deficit for weight loss'));
  });

  it('calculates 350 kcal surplus for muscle gain goal', () => {
    // Same profile, goal = 'gain'
    // 2594.3125 + 350 = 2944 kcal
    const res = calculateGoalSuggestion({
      age: 25,
      weight: 70,
      height: 175,
      gender: 'male',
      activityLevel: 'moderate',
      goal: 'gain',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 2944);
    assert.ok(res.explanation.includes('350 kcal surplus for muscle gain'));
  });

  it('enforces clinical safe minimum of 1200 kcal for female / unspecified', () => {
    // Extreme deficit or small female: 40kg, 140cm, 60y, sedentary (1.2), lose
    // BMR = 10*40 + 6.25*140 - 5*60 - 161 = 400 + 875 - 300 - 161 = 814
    // TDEE = 814 * 1.2 = 976.8
    // Minus 500 = 476.8 -> Clamped to 1200 kcal
    const res = calculateGoalSuggestion({
      age: 60,
      weight: 40,
      height: 140,
      gender: 'female',
      activityLevel: 'sedentary',
      goal: 'lose',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 1200);
  });

  it('enforces clinical safe minimum of 1500 kcal for male', () => {
    // Small male with deficit
    const res = calculateGoalSuggestion({
      age: 65,
      weight: 48,
      height: 145,
      gender: 'male',
      activityLevel: 'sedentary',
      goal: 'lose',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 1500);
  });

  it('enforces maximum safe ceiling of 4000 kcal', () => {
    // Heavy athlete, very_active, gain
    const res = calculateGoalSuggestion({
      age: 22,
      weight: 125,
      height: 200,
      gender: 'male',
      activityLevel: 'very_active',
      goal: 'gain',
    });

    assert.ok(res);
    assert.equal(res.calorieIntake, 4000);
  });

  it('User schema validates optional gender and activityLevel fields', () => {
    const validUser = new User({
      username: 'test_g8_user',
      email: 'g8_user@example.com',
      gender: 'female',
      activityLevel: 'active',
    });
    const err = validUser.validateSync();
    assert.equal(err, undefined);

    const invalidGender = new User({
      username: 'test_g8_user2',
      email: 'g8_user2@example.com',
      gender: 'invalid_gender',
    });
    const genderErr = invalidGender.validateSync();
    assert.ok(genderErr?.errors?.gender);

    const invalidActivity = new User({
      username: 'test_g8_user3',
      email: 'g8_user3@example.com',
      activityLevel: 'couch_potato',
    });
    const actErr = invalidActivity.validateSync();
    assert.ok(actErr?.errors?.activityLevel);
  });
});
