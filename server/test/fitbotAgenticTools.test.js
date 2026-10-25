const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  fitbotTools,
  fitbotFunctionDeclarations,
  executeFitBotTool,
  buildUserTodayStatus,
  runFitBotAgentSession,
  setGeminiFitBotMock,
  clearGeminiFitBotMock,
} = require('../src/utils/gemini');

const FoodLog = require('../src/models/FoodLog');
const ActivityLog = require('../src/models/ActivityLog');
const WorkoutPlan = require('../src/models/WorkoutPlan');
const { chatWithAssistant } = require('../src/services/aiAssistant.service');

describe('Phase 2: Agentic FitBot via Gemini Function Calling', () => {
  const mockUserId = new mongoose.Types.ObjectId();
  const mockUser = {
    _id: mockUserId,
    id: String(mockUserId),
    dailycaloriesintake: 2200,
    dailyproteingoal: 160,
    dailycarbsgoal: 220,
    dailyfatgoal: 60,
  };

  afterEach(() => {
    clearGeminiFitBotMock();
  });

  describe('Declarative Tool Registry', () => {
    it('registers exactly three executable tools matching Phase 2 specifications', () => {
      assert.ok(Array.isArray(fitbotTools));
      assert.equal(fitbotTools.length, 1);
      const decls = fitbotTools[0].functionDeclarations;
      assert.equal(decls.length, 3);

      const names = decls.map((d) => d.name);
      assert.ok(names.includes('logMealItem'));
      assert.ok(names.includes('logWorkoutSession'));
      assert.ok(names.includes('swapExerciseInPlan'));
    });

    it('declares logMealItem parameters: foodName, calories, protein, carbs, fats, mealType', () => {
      const tool = fitbotFunctionDeclarations.find((d) => d.name === 'logMealItem');
      assert.ok(tool);
      const props = tool.parameters.properties;
      assert.ok(props.foodName);
      assert.ok(props.calories);
      assert.ok(props.protein);
      assert.ok(props.carbs);
      assert.ok(props.fats);
      assert.ok(props.mealType);
      assert.deepEqual(tool.parameters.required, ['foodName', 'calories']);
    });

    it('declares logWorkoutSession parameters: exerciseName, sets, reps, weightKg, rpe', () => {
      const tool = fitbotFunctionDeclarations.find((d) => d.name === 'logWorkoutSession');
      assert.ok(tool);
      const props = tool.parameters.properties;
      assert.ok(props.exerciseName);
      assert.ok(props.sets);
      assert.ok(props.reps);
      assert.ok(props.weightKg);
      assert.ok(props.rpe);
      assert.deepEqual(tool.parameters.required, ['exerciseName', 'sets', 'reps']);
    });

    it('declares swapExerciseInPlan parameters: targetExercise, replacementExercise, equipmentAvailable', () => {
      const tool = fitbotFunctionDeclarations.find((d) => d.name === 'swapExerciseInPlan');
      assert.ok(tool);
      const props = tool.parameters.properties;
      assert.ok(props.targetExercise);
      assert.ok(props.replacementExercise);
      assert.ok(props.equipmentAvailable);
      assert.deepEqual(tool.parameters.required, ['targetExercise', 'replacementExercise']);
    });
  });

  describe('Server-Side Tool Execution Against User Records', () => {
    it('executes logMealItem by inserting into FoodLog collection', async () => {
      let createdDoc = null;
      const originalCreate = FoodLog.create;
      FoodLog.create = async (payload) => {
        createdDoc = {
          ...payload,
          _id: new mongoose.Types.ObjectId(),
        };
        return createdDoc;
      };

      try {
        const result = await executeFitBotTool(
          'logMealItem',
          {
            foodName: '200g Greek yogurt',
            calories: 130,
            protein: 15,
            carbs: 6,
            fats: 0,
            mealType: 'breakfast',
          },
          mockUser
        );

        assert.equal(result.status, 'success');
        assert.equal(result.action, 'logMealItem');
        assert.equal(result.foodName, '200g Greek yogurt');
        assert.equal(result.calories, 130);
        assert.equal(result.mealType, 'breakfast');
        assert.ok(createdDoc);
        assert.equal(createdDoc.name, '200g Greek yogurt');
        assert.equal(createdDoc.protein, 15);
        assert.equal(String(createdDoc.user), String(mockUserId));
      } finally {
        FoodLog.create = originalCreate;
      }
    });

    it('executes logWorkoutSession by inserting into ActivityLog collection', async () => {
      let createdActivity = null;
      const originalCreate = ActivityLog.create;
      ActivityLog.create = async (payload) => {
        createdActivity = {
          ...payload,
          _id: new mongoose.Types.ObjectId(),
        };
        return createdActivity;
      };

      try {
        const result = await executeFitBotTool(
          'logWorkoutSession',
          {
            exerciseName: 'Barbell Bench Press',
            sets: 3,
            reps: 8,
            weightKg: 80,
            rpe: 8.5,
          },
          mockUser
        );

        assert.equal(result.status, 'success');
        assert.equal(result.action, 'logWorkoutSession');
        assert.equal(result.exerciseName, 'Barbell Bench Press');
        assert.equal(result.sets, 3);
        assert.equal(result.reps, 8);
        assert.equal(result.weightKg, 80);
        assert.equal(result.rpe, 8.5);
        assert.ok(createdActivity);
        assert.equal(createdActivity.exercises[0].name, 'Barbell Bench Press');
        assert.equal(createdActivity.exercises[0].sets.length, 3);
        assert.equal(createdActivity.exercises[0].sets[0].weight, 80);
      } finally {
        ActivityLog.create = originalCreate;
      }
    });

    it('executes swapExerciseInPlan by finding and updating active WorkoutPlan', async () => {
      let savedPlan = false;
      const mockPlanDoc = {
        title: 'Push Pull Legs',
        user: mockUserId,
        isActive: true,
        days: [
          {
            day: 'Leg Day',
            exercises: [
              { name: 'Barbell Back Squat', sets: '4', reps: '6' },
              { name: 'Romanian Deadlift', sets: '3', reps: '8' },
            ],
          },
        ],
        markModified: () => {},
        save: async () => {
          savedPlan = true;
        },
      };

      const originalFindOne = WorkoutPlan.findOne;
      WorkoutPlan.findOne = async () => mockPlanDoc;

      try {
        const result = await executeFitBotTool(
          'swapExerciseInPlan',
          {
            targetExercise: 'Barbell Back Squat',
            replacementExercise: 'Hack Squat Machine',
            equipmentAvailable: 'Gym Hack Squat',
          },
          mockUser
        );

        assert.equal(result.status, 'success');
        assert.equal(result.targetExercise, 'Barbell Back Squat');
        assert.equal(result.replacementExercise, 'Hack Squat Machine');
        assert.equal(result.day, 'Leg Day');
        assert.equal(savedPlan, true);
        assert.equal(mockPlanDoc.days[0].exercises[0].name, 'Hack Squat Machine');
      } finally {
        WorkoutPlan.findOne = originalFindOne;
      }
    });
  });

  describe('Bounded Context Window & System Instruction Pinning', () => {
    it('truncates conversation history array to the most recent 8 messages', async () => {
      let receivedHistoryLength = 0;
      setGeminiFitBotMock(async ({ messages }) => {
        receivedHistoryLength = messages.length;
        return {
          reply: 'I see your message.',
          executedActions: [],
        };
      });

      // Send 15 messages
      const longChat = [];
      for (let i = 1; i <= 15; i++) {
        longChat.push({
          role: i % 2 === 1 ? 'user' : 'assistant',
          content: `Message turn ${i}`,
        });
      }

      const res = await chatWithAssistant(longChat, null, {
        user: mockUser,
        forceGemini: true,
      });

      assert.equal(res.reply, 'I see your message.');
      assert.equal(receivedHistoryLength, 8); // Capped to history.slice(-8)
    });

    it('pins compact JSON snapshot of today macros and workout status into systemInstruction', async () => {
      let receivedSystemPrompt = '';
      setGeminiFitBotMock(async ({ systemInstruction, todayStatus }) => {
        receivedSystemPrompt = systemInstruction;
        return {
          reply: 'Status received.',
          executedActions: [],
        };
      });

      await chatWithAssistant([{ role: 'user', content: 'What should I eat?' }], null, {
        user: mockUser,
        forceGemini: true,
      });

      assert.ok(receivedSystemPrompt.includes('[Active User Today Snapshot - Do Not Recalculate]'));
      assert.ok(receivedSystemPrompt.includes('macroTotalsToday'));
      assert.ok(receivedSystemPrompt.includes('activeWorkoutRoutine'));
    });
  });

  describe('End-to-End Agentic Execution Loop', () => {
    it('executes tool call, feeds functionResponse back, and returns reply with executedActions', async () => {
      let toolExecuted = false;

      setGeminiFitBotMock(async ({ user }) => {
        // Simulate Gemini deciding to call logMealItem
        const toolAction = await executeFitBotTool(
          'logMealItem',
          {
            foodName: '200g Greek yogurt',
            calories: 130,
            protein: 15,
            carbs: 6,
            fats: 0,
            mealType: 'breakfast',
          },
          user
        );
        toolExecuted = true;

        return {
          reply: "I've logged 200g of Greek yogurt for breakfast (130 kcal, 15g protein).",
          executedActions: [toolAction],
          model: 'gemini-2.5-flash',
        };
      });

      const originalCreate = FoodLog.create;
      FoodLog.create = async (payload) => ({
        ...payload,
        _id: new mongoose.Types.ObjectId(),
      });

      try {
        const res = await chatWithAssistant(
          [{ role: 'user', content: 'Log 200g Greek yogurt for breakfast' }],
          null,
          { user: mockUser, forceGemini: true }
        );

        assert.equal(toolExecuted, true);
        assert.ok(res.reply.includes('Greek yogurt'));
        assert.equal(res.executedActions.length, 1);
        assert.equal(res.executedActions[0].action, 'logMealItem');
        assert.equal(res.executedActions[0].calories, 130);
        assert.equal(res.executedActions[0].status, 'success');
      } finally {
        FoodLog.create = originalCreate;
      }
    });
  });
});
