const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getRecommendations } = require('../src/controllers/workout.controller');
const {
  calculateEpley1RM,
  isLowerBody,
  calculateSetsVolume,
  calculateRecoveryMetrics,
  evaluateExerciseProgression,
  getWorkoutRecommendations,
} = require('../src/services/progressionEngine');

describe('Phase 3: Closed-Loop Progressive Overload & Recovery Engine', () => {
  describe('Deterministic Epley 1RM & Volume Calculations', () => {
    it('computes accurate 1RM using Epley formula: weight * (1 + reps / 30)', () => {
      // Single rep should equal the weight
      assert.equal(calculateEpley1RM(100, 1), 100);

      // 80kg x 8 reps = 80 * (1 + 8/30) = 80 * 1.26667 = 101.3kg
      assert.equal(calculateEpley1RM(80, 8), 101.3);

      // 100kg x 10 reps = 100 * (1 + 10/30) = 133.3kg
      assert.equal(calculateEpley1RM(100, 10), 133.3);

      // 60kg x 12 reps = 60 * (1 + 12/30) = 84kg
      assert.equal(calculateEpley1RM(60, 12), 84);
    });

    it('safely handles zero, negative, or invalid weight/reps without throwing', () => {
      assert.equal(calculateEpley1RM(0, 10), 0);
      assert.equal(calculateEpley1RM(-50, 10), 0);
      assert.equal(calculateEpley1RM(100, 0), 0);
      assert.equal(calculateEpley1RM(null, undefined), 0);
    });

    it('identifies compound lower body movements for +5kg overload vs +2.5kg upper body', () => {
      assert.equal(isLowerBody('Barbell Back Squat'), true);
      assert.equal(isLowerBody('Hack Squat Machine'), true);
      assert.equal(isLowerBody('Romanian Deadlift (RDL)'), true);
      assert.equal(isLowerBody('Leg Press 45-degree'), true);
      assert.equal(isLowerBody('Walking Lunges'), true);

      assert.equal(isLowerBody('Barbell Bench Press'), false);
      assert.equal(isLowerBody('Overhead Dumbbell Press'), false);
      assert.equal(isLowerBody('Barbell Bent-Over Row'), false);
      assert.equal(isLowerBody('Incline Dumbbell Press'), false);
    });

    it('computes total session tonnage: sum(sets * reps * weight)', () => {
      const sets = [
        { setNumber: 1, weight: 80, reps: 8, completed: true },
        { setNumber: 2, weight: 80, reps: 8, completed: true },
        { setNumber: 3, weight: 85, reps: 6, completed: true },
      ];
      // 80*8 + 80*8 + 85*6 = 640 + 640 + 510 = 1790
      assert.equal(calculateSetsVolume(sets), 1790);
    });
  });

  describe('Cross-Domain Recovery & Caloric Balance', () => {
    const mockUser = {
      dailycaloriesintake: 2200,
      dailyproteingoal: 160,
    };

    it('computes rolling caloric balance and protein adherence across 5-day window', () => {
      const now = Date.now();
      const foodLogs = [
        // Day 0: 2200 kcal, 160g protein (adherence 100%)
        { calories: 2200, protein: 160, date: new Date(now) },
        // Day 1: 2100 kcal, 150g protein
        { calories: 2100, protein: 150, date: new Date(now - 1 * 24 * 60 * 60 * 1000) },
        // Day 2: 2300 kcal, 170g protein
        { calories: 2300, protein: 170, date: new Date(now - 2 * 24 * 60 * 60 * 1000) },
        // Day 3: 2200 kcal, 160g protein
        { calories: 2200, protein: 160, date: new Date(now - 3 * 24 * 60 * 60 * 1000) },
        // Day 4: 2150 kcal, 155g protein
        { calories: 2150, protein: 155, date: new Date(now - 4 * 24 * 60 * 60 * 1000) },
      ];

      const metrics = calculateRecoveryMetrics(mockUser, foodLogs, 5);
      assert.equal(metrics.steepDeficitDays, 0);
      assert.equal(metrics.isSteepDeficit, false);
      assert.equal(metrics.recoveryStatus, 'optimal');
      assert.ok(metrics.proteinAdherence >= 0.95);
    });

    it('detects steep caloric deficit when deficit exceeds 500 kcal/day for 4+ days', () => {
      const now = Date.now();
      const foodLogs = [
        // 4 days with 1500 kcal (target 2200, deficit = 700 kcal/day > 500)
        { calories: 1500, protein: 90, date: new Date(now) },
        { calories: 1400, protein: 85, date: new Date(now - 1 * 24 * 60 * 60 * 1000) },
        { calories: 1550, protein: 95, date: new Date(now - 2 * 24 * 60 * 60 * 1000) },
        { calories: 1450, protein: 80, date: new Date(now - 3 * 24 * 60 * 60 * 1000) },
        // 1 day normal
        { calories: 2200, protein: 160, date: new Date(now - 4 * 24 * 60 * 60 * 1000) },
      ];

      const metrics = calculateRecoveryMetrics(mockUser, foodLogs, 5);
      assert.equal(metrics.steepDeficitDays, 4);
      assert.equal(metrics.isSteepDeficit, true);
      assert.equal(metrics.recoveryStatus, 'impaired');
      assert.ok(metrics.proteinAdherence < 0.85);
    });
  });

  describe('Deterministic Progressive Overload vs Deload Decision Rules', () => {
    it('prescribes +2.5kg overload for upper body when reps hit at RPE <= 8 and protein >= 85%', () => {
      const recoveryMetrics = {
        isSteepDeficit: false,
        proteinAdherence: 0.92,
        steepDeficitDays: 0,
      };

      const exerciseSessions = [
        {
          date: new Date(),
          sets: [
            { weight: 80, reps: 8, completed: true, rpe: 7.5 },
            { weight: 80, reps: 8, completed: true, rpe: 8.0 },
            { weight: 80, reps: 8, completed: true, rpe: 8.0 },
          ],
        },
      ];

      const rec = evaluateExerciseProgression({
        exerciseName: 'Barbell Bench Press',
        exerciseSessions,
        recoveryMetrics,
        targetReps: 8,
      });

      assert.equal(rec.recommendation.status, 'overload');
      assert.equal(rec.recommendation.targetWeight, 82.5); // 80 + 2.5kg
      assert.equal(rec.recommendation.targetReps, 8);
      assert.equal(rec.recommendation.increment, 2.5);
      assert.equal(rec.recommendation.chip, 'Target: 82.5kg x 8 | +2.5kg Overload');
      assert.equal(rec.isLowerBody, false);
      assert.equal(rec.estimated1RM, 101.3); // 80 * (1 + 8/30)
    });

    it('prescribes +5kg overload for lower body when reps hit at RPE <= 8 and protein >= 85%', () => {
      const recoveryMetrics = {
        isSteepDeficit: false,
        proteinAdherence: 0.90,
        steepDeficitDays: 1,
      };

      const exerciseSessions = [
        {
          date: new Date(),
          sets: [
            { weight: 120, reps: 8, completed: true, rpe: 7 },
            { weight: 120, reps: 8, completed: true, rpe: 7.5 },
            { weight: 120, reps: 8, completed: true, rpe: 8 },
          ],
        },
      ];

      const rec = evaluateExerciseProgression({
        exerciseName: 'Barbell Back Squat',
        exerciseSessions,
        recoveryMetrics,
        targetReps: 8,
      });

      assert.equal(rec.recommendation.status, 'overload');
      assert.equal(rec.recommendation.targetWeight, 125); // 120 + 5kg
      assert.equal(rec.recommendation.increment, 5);
      assert.equal(rec.recommendation.chip, 'Target: 125kg x 8 | +5kg Overload');
      assert.equal(rec.isLowerBody, true);
    });

    it('prescribes 10% deload when steep caloric deficit (>500 kcal/day for 4+ days) AND RPE >= 9.5', () => {
      const recoveryMetrics = {
        isSteepDeficit: true,
        steepDeficitDays: 4,
        proteinAdherence: 0.72,
      };

      const exerciseSessions = [
        {
          date: new Date(),
          sets: [
            { weight: 100, reps: 8, completed: true, rpe: 9.5 },
            { weight: 100, reps: 8, completed: true, rpe: 10 },
          ],
        },
      ];

      const rec = evaluateExerciseProgression({
        exerciseName: 'Barbell Bench Press',
        exerciseSessions,
        recoveryMetrics,
        targetReps: 8,
      });

      assert.equal(rec.recommendation.status, 'deload');
      assert.equal(rec.recommendation.targetWeight, 90); // 100 * 0.9 = 90kg (-10%)
      assert.equal(rec.recommendation.chip, 'Recovery Deload Suggested');
      assert.ok(rec.recommendation.reason.includes('Caloric deficit'));
      assert.ok(rec.recommendation.reason.includes('10% deload'));
    });

    it('prescribes 10% deload when steep caloric deficit AND missed reps on previous session', () => {
      const recoveryMetrics = {
        isSteepDeficit: true,
        steepDeficitDays: 5,
        proteinAdherence: 0.65,
      };

      const exerciseSessions = [
        {
          date: new Date(),
          sets: [
            { weight: 80, reps: 8, completed: true, rpe: 8 },
            { weight: 80, reps: 5, completed: false, rpe: 9 }, // Missed reps!
          ],
        },
      ];

      const rec = evaluateExerciseProgression({
        exerciseName: 'Barbell Bench Press',
        exerciseSessions,
        recoveryMetrics,
        targetReps: 8,
      });

      assert.equal(rec.recommendation.status, 'deload');
      assert.equal(rec.recommendation.targetWeight, 72); // 80 * 0.9 = 72kg
      assert.equal(rec.recommendation.chip, 'Recovery Deload Suggested');
    });

    it('prescribes maintenance when protein adherence is below 85% without steep deficit', () => {
      const recoveryMetrics = {
        isSteepDeficit: false,
        steepDeficitDays: 0,
        proteinAdherence: 0.78, // < 85%
      };

      const exerciseSessions = [
        {
          date: new Date(),
          sets: [{ weight: 80, reps: 8, completed: true, rpe: 7.5 }],
        },
      ];

      const rec = evaluateExerciseProgression({
        exerciseName: 'Barbell Bench Press',
        exerciseSessions,
        recoveryMetrics,
        targetReps: 8,
      });

      assert.equal(rec.recommendation.status, 'maintain');
      assert.equal(rec.recommendation.targetWeight, 80);
      assert.equal(rec.recommendation.chip, 'Target: 80kg x 8');
      assert.ok(rec.recommendation.reason.includes('Protein adherence'));
    });
  });

  describe('API Endpoint GET /api/workouts/recommendations', () => {
    it('handles controller dispatch returning HTTP 200 JSON', async () => {
      const req = {
        user: { _id: '507f191e810c19729de860ea' },
        query: { exercise: 'Barbell Bench Press' },
      };
      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          jsonPayload = data;
          return this;
        },
      };

      await getRecommendations(req, res);

      assert.equal(statusCode, 200);
      assert.equal(jsonPayload.success, true);
      assert.ok(jsonPayload.recovery);
      assert.ok(jsonPayload.recommendations.length > 0);
    });
  });
});
