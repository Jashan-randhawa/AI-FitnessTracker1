const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  VoiceSetSchema,
  parseVoiceSetRegex,
  parseVoiceGymSet,
  setGeminiVoiceMock,
  clearGeminiVoiceMock,
} = require('../src/utils/gemini');
const { parseVoiceSet } = require('../src/controllers/workout.controller');

describe('Phase 4: Hands-Free Voice Gym Logging & Offline Resilience', () => {
  afterEach(() => {
    clearGeminiVoiceMock();
  });

  describe('VoiceSetSchema Definition', () => {
    it('defines strict VoiceSetSchema matching Phase 4 specifications', () => {
      assert.ok(VoiceSetSchema);
      const props = VoiceSetSchema.properties;
      assert.ok(props.exerciseName);
      assert.ok(props.weightKg);
      assert.ok(props.reps);
      assert.ok(props.rpe);
      assert.ok(props.startRestTimer);
      assert.deepEqual(VoiceSetSchema.required, [
        'exerciseName',
        'weightKg',
        'reps',
        'startRestTimer',
      ]);
    });
  });

  describe('Deterministic Speech Parser (Fallback & Unit Tests)', () => {
    it('parses "Bench press 80 kilos for 8 reps, felt like RPE 8.5"', () => {
      const parsed = parseVoiceSetRegex('Bench press 80 kilos for 8 reps, felt like RPE 8.5');
      assert.equal(parsed.exerciseName, 'Bench Press');
      assert.equal(parsed.weightKg, 80);
      assert.equal(parsed.reps, 8);
      assert.equal(parsed.rpe, 8.5);
      assert.equal(parsed.startRestTimer, true);
    });

    it('parses "Squats 100 kg 5 reps rpe 9"', () => {
      const parsed = parseVoiceSetRegex('Squats 100 kg 5 reps rpe 9');
      assert.equal(parsed.exerciseName, 'Squats');
      assert.equal(parsed.weightKg, 100);
      assert.equal(parsed.reps, 5);
      assert.equal(parsed.rpe, 9);
      assert.equal(parsed.startRestTimer, true);
    });

    it('converts spoken imperial lbs to metric kilograms', () => {
      const parsed = parseVoiceSetRegex('Deadlift 225 lbs for 5 reps');
      assert.equal(parsed.exerciseName, 'Deadlift');
      assert.equal(parsed.reps, 5);
      // 225 * 0.453592 = 102.1 kg
      assert.equal(parsed.weightKg, 102.1);
      assert.equal(parsed.startRestTimer, true);
    });

    it('throws error when speech text is empty or missing', () => {
      assert.throws(() => parseVoiceSetRegex(''), /Speech text is required/);
      assert.throws(() => parseVoiceSetRegex(null), /Speech text is required/);
    });
  });

  describe('Gemini Voice Parser & Controller Endpoint', () => {
    it('calls Gemini parser and returns structured payload', async () => {
      setGeminiVoiceMock(async ({ speechText }) => {
        return {
          exerciseName: 'Incline Dumbbell Press',
          weightKg: 32,
          reps: 10,
          rpe: 8,
          startRestTimer: true,
        };
      });

      const parsed = await parseVoiceGymSet({
        speechText: 'Incline dumbbell press 32kg for 10 reps rpe 8',
      });

      assert.equal(parsed.exerciseName, 'Incline Dumbbell Press');
      assert.equal(parsed.weightKg, 32);
      assert.equal(parsed.reps, 10);
      assert.equal(parsed.rpe, 8);
      assert.equal(parsed.startRestTimer, true);
    });

    it('controller returns 400 when both speechText and audio file are missing', async () => {
      const req = { body: {}, user: { _id: 'mock-user-id' } };
      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status(c) {
          statusCode = c;
          return this;
        },
        json(d) {
          jsonPayload = d;
          return this;
        },
      };

      await parseVoiceSet(req, res);

      assert.equal(statusCode, 400);
      assert.ok(jsonPayload.message.includes('speechText or an audio file'));
    });

    it('controller successfully handles valid speechText and returns HTTP 200', async () => {
      setGeminiVoiceMock(async () => ({
        exerciseName: 'Barbell Bench Press',
        weightKg: 80,
        reps: 8,
        rpe: 8.5,
        startRestTimer: true,
      }));

      const req = {
        body: { speechText: 'Bench press 80 kilos for 8 reps, felt like RPE 8.5' },
        user: { _id: 'mock-user-id' },
      };
      let statusCode = 0;
      let jsonPayload = null;
      const res = {
        status(c) {
          statusCode = c;
          return this;
        },
        json(d) {
          jsonPayload = d;
          return this;
        },
      };

      await parseVoiceSet(req, res);

      assert.equal(statusCode, 200);
      assert.equal(jsonPayload.success, true);
      assert.equal(jsonPayload.parsed.exerciseName, 'Barbell Bench Press');
      assert.equal(jsonPayload.parsed.weightKg, 80);
      assert.equal(jsonPayload.parsed.reps, 8);
      assert.equal(jsonPayload.parsed.rpe, 8.5);
      assert.equal(jsonPayload.parsed.startRestTimer, true);
    });
  });
});
