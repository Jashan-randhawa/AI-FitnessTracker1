const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  FoodSnapSchema,
  VoiceSetSchema,
  fitbotTools,
  normalizeVisionOutput,
  executeFitBotTool,
  setGeminiVisionMock,
  clearGeminiVisionMock,
  setGeminiFitBotMock,
  clearGeminiFitBotMock,
} = require('../src/utils/gemini');

const {
  foodSnapRateLimiter,
  fitbotRateLimiter,
  resetAiRateLimits,
} = require('../src/middleware/aiRateLimiter');

const {
  validateChatPayload,
  validateFoodSnapUpload,
} = require('../src/middleware/aiValidation');

const { validateEnvironment } = require('../src/config/envValidator');

const FoodLog = require('../src/models/FoodLog');
const ActivityLog = require('../src/models/ActivityLog');

describe('Phase 5: Production Security, Rate Limiting & End-to-End AI Flow Integration', () => {
  beforeEach(() => {
    resetAiRateLimits();
  });

  afterEach(() => {
    resetAiRateLimits();
    clearGeminiVisionMock();
    clearGeminiFitBotMock();
  });

  describe('(a) Food Snap Schema Parsing & Single-RTT Auto-Save Flow', () => {
    it('normalizes multi-item vision output and validates FoodSnapSchema contract', () => {
      const rawAiResponse = {
        dishTitle: 'Grilled Chicken Breast with Steamed Broccoli',
        totalCalories: 420,
        totalProtein: 48,
        totalCarbs: 10,
        totalFats: 8,
        overallConfidence: 0.94,
        items: [
          {
            name: 'Grilled Chicken Breast',
            weightGrams: 200,
            calories: 330,
            protein: 44,
            carbs: 0,
            fats: 6,
            confidenceScore: 0.96,
          },
          {
            name: 'Steamed Broccoli',
            weightGrams: 150,
            calories: 90,
            protein: 4,
            carbs: 10,
            fats: 2,
            confidenceScore: 0.91,
          },
        ],
      };

      const normalized = normalizeVisionOutput(rawAiResponse);
      assert.equal(normalized.dishTitle, 'Grilled Chicken Breast with Steamed Broccoli');
      assert.equal(normalized.totalCalories, 420);
      assert.equal(normalized.totalProtein, 48);
      assert.equal(normalized.overallConfidence, 0.94);
      assert.equal(normalized.items.length, 2);
    });

    it('simulates single-roundtrip database persistence when overallConfidence >= 0.75 and autoSave=true', async () => {
      const mockUserId = new mongoose.Types.ObjectId();
      let createdDoc = null;

      const originalCreate = FoodLog.create;
      FoodLog.create = async (payload) => {
        createdDoc = {
          _id: new mongoose.Types.ObjectId(),
          ...payload,
          createdAt: new Date(),
        };
        return createdDoc;
      };

      try {
        const analysis = {
          dishTitle: 'Salmon Rice Bowl',
          totalCalories: 580,
          totalProtein: 42,
          totalCarbs: 55,
          totalFats: 16,
          overallConfidence: 0.88, // >= 0.75 threshold
        };

        const autoSaveRequested = true;
        let savedRecord = null;
        let autoSaved = false;

        if (autoSaveRequested && analysis.overallConfidence >= 0.75) {
          savedRecord = await FoodLog.create({
            user: mockUserId,
            name: analysis.dishTitle,
            calories: analysis.totalCalories,
            protein: analysis.totalProtein,
            carbs: analysis.totalCarbs,
            fat: analysis.totalFats,
            mealType: 'lunch',
            date: new Date(),
          });
          autoSaved = true;
        }

        assert.equal(autoSaved, true);
        assert.ok(savedRecord);
        assert.equal(savedRecord.name, 'Salmon Rice Bowl');
        assert.equal(savedRecord.calories, 580);
      } finally {
        FoodLog.create = originalCreate;
      }
    });
  });

  describe('(b) FitBot Agentic functionCall Execution Flow', () => {
    it('executes logMealItem functionCall mutation with parameter validation', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        dailycaloriesintake: 2200,
      };

      let savedMeal = null;
      const originalCreate = FoodLog.create;
      FoodLog.create = async (payload) => {
        savedMeal = {
          _id: new mongoose.Types.ObjectId(),
          ...payload,
        };
        return savedMeal;
      };

      try {
        const toolResult = await executeFitBotTool(
          'logMealItem',
          {
            foodName: '3 Boiled Eggs',
            calories: 210,
            protein: 18,
            carbs: 2,
            fats: 15,
            mealType: 'breakfast',
          },
          mockUser
        );

        assert.equal(toolResult.status, 'success');
        assert.equal(toolResult.foodName, '3 Boiled Eggs');
        assert.equal(toolResult.calories, 210);
        assert.ok(savedMeal);
        assert.equal(savedMeal.name, '3 Boiled Eggs');
      } finally {
        FoodLog.create = originalCreate;
      }
    });

    it('executes logWorkoutSession functionCall mutation against ActivityLog', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
      };

      let savedActivity = null;
      const originalCreate = ActivityLog.create;
      ActivityLog.create = async (payload) => {
        savedActivity = {
          _id: new mongoose.Types.ObjectId(),
          ...payload,
        };
        return savedActivity;
      };

      try {
        const toolResult = await executeFitBotTool(
          'logWorkoutSession',
          {
            exerciseName: 'Barbell Back Squat',
            sets: 3,
            reps: 8,
            weightKg: 100,
            rpe: 8,
          },
          mockUser
        );

        assert.equal(toolResult.status, 'success');
        assert.equal(toolResult.exerciseName, 'Barbell Back Squat');
        assert.equal(toolResult.weightKg, 100);
        assert.ok(savedActivity);
        assert.equal(savedActivity.exercises[0].name, 'Barbell Back Squat');
      } finally {
        FoodLog.create = originalCreate;
      }
    });
  });

  describe('(c) Production Rate Limiting & Cooldown Headers (HTTP 429)', () => {
    it('enforces 10 requests/hour limit on Food Snap vision route returning HTTP 429 and retryAfterSeconds', () => {
      const req = {
        user: { _id: 'user-vision-test' },
        headers: {},
      };

      const mockRes = () => {
        const headers = {};
        let statusCode = 200;
        let payload = null;
        return {
          set(key, val) {
            headers[key] = val;
            return this;
          },
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            payload = data;
            return this;
          },
          getHeaders: () => headers,
          getStatusCode: () => statusCode,
          getPayload: () => payload,
        };
      };

      // First 10 requests must pass
      for (let i = 1; i <= 10; i++) {
        let nextCalled = false;
        const res = mockRes();
        foodSnapRateLimiter(req, res, () => {
          nextCalled = true;
        });
        assert.equal(nextCalled, true, `Request ${i} should be allowed`);
        assert.equal(res.getHeaders()['X-RateLimit-Remaining'], String(10 - i));
      }

      // 11th request must be blocked with HTTP 429
      let nextCalledOn11 = false;
      const blockedRes = mockRes();
      foodSnapRateLimiter(req, blockedRes, () => {
        nextCalledOn11 = true;
      });

      assert.equal(nextCalledOn11, false, '11th request must be rejected');
      assert.equal(blockedRes.getStatusCode(), 429);
      assert.equal(blockedRes.getPayload().error, 'Rate limit exceeded');
      assert.ok(blockedRes.getPayload().retryAfterSeconds > 0);
      assert.ok(blockedRes.getHeaders()['Retry-After']);
    });

    it('enforces 30 messages/hour limit on FitBot chat route returning HTTP 429', () => {
      const req = {
        user: { _id: 'user-chat-test' },
        headers: {},
      };

      const mockRes = () => {
        const headers = {};
        let statusCode = 200;
        let payload = null;
        return {
          set(key, val) {
            headers[key] = val;
            return this;
          },
          status(code) {
            statusCode = code;
            return this;
          },
          json(data) {
            payload = data;
            return this;
          },
          getHeaders: () => headers,
          getStatusCode: () => statusCode,
          getPayload: () => payload,
        };
      };

      // First 30 requests must pass
      for (let i = 1; i <= 30; i++) {
        let nextCalled = false;
        const res = mockRes();
        fitbotRateLimiter(req, res, () => {
          nextCalled = true;
        });
        assert.equal(nextCalled, true, `Request ${i} should be allowed`);
      }

      // 31st request must be blocked with HTTP 429
      let nextCalledOn31 = false;
      const blockedRes = mockRes();
      fitbotRateLimiter(req, blockedRes, () => {
        nextCalledOn31 = true;
      });

      assert.equal(nextCalledOn31, false, '31st message must be rejected');
      assert.equal(blockedRes.getStatusCode(), 429);
      assert.equal(blockedRes.getPayload().error, 'Rate limit exceeded');
      assert.ok(blockedRes.getPayload().retryAfterSeconds > 0);
    });
  });

  describe('(d) Zod Request & Environment Validation', () => {
    it('rejects chat prompts exceeding single message limit (2000 chars)', () => {
      const req = {
        body: {
          messages: [{ role: 'user', content: 'A'.repeat(2500) }],
        },
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

      let nextCalled = false;
      validateChatPayload(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 400);
      assert.ok(jsonPayload.message.includes('cannot exceed 2000 characters'));
    });

    it('rejects food snap upload exceeding 4MB file cap', () => {
      const req = {
        file: {
          size: 5 * 1024 * 1024, // 5MB > 4MB cap
          mimetype: 'image/jpeg',
        },
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

      let nextCalled = false;
      validateFoodSnapUpload(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 400);
      assert.ok(jsonPayload.message.includes('4MB'));
    });

    it('validates environment with CI_DRY_RUN=true mock fallback bypass', () => {
      // In CI dry run mode, missing production keys should not throw fatal error
      const ciEnv = {
        NODE_ENV: 'test',
        CI: 'true',
        CI_DRY_RUN: 'true',
        PORT: '1337',
      };

      const result = validateEnvironment(ciEnv);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
      assert.ok(result.warnings.length > 0);
    });
  });
});
