const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const FoodLog = require('../models/FoodLog');
const ActivityLog = require('../models/ActivityLog');
const WorkoutPlan = require('../models/WorkoutPlan');
const { publishChange } = require('../services/eventBus');
const { dayKey } = require('./localDay');
const { recordProviderCall } = require('../middleware/aiBudget');
const logger = require('./logger');

const DEFAULT_GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 20000;

const createGeminiTimeoutError = (timeoutMs) => {
  const err = new Error(`Gemini request timed out after ${timeoutMs}ms`);
  err.name = 'TimeoutError';
  err.code = 'ETIMEDOUT';
  err.status = 504;
  err.isTimeout = true;
  return err;
};

const withGeminiTimeout = async (promiseFn, { timeoutMs = DEFAULT_GEMINI_TIMEOUT_MS, signal } = {}) => {
  if (signal?.aborted) {
    const err = new Error('Request aborted by client');
    err.name = 'AbortError';
    err.status = 499;
    throw err;
  }

  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(createGeminiTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  const abortPromise = signal
    ? new Promise((_, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            const err = new Error('Request aborted by client');
            err.name = 'AbortError';
            err.status = 499;
            reject(err);
          },
          { once: true }
        );
      })
    : null;

  try {
    const promises = [promiseFn(), timeoutPromise];
    if (abortPromise) promises.push(abortPromise);
    const result = await Promise.race(promises);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

/**
 * Native Gemini responseSchema for deterministic JSON food analysis output.
 * Output shape:
 * {
 *   dishTitle: string,
 *   totalCalories: number,
 *   totalProtein: number,
 *   totalCarbs: number,
 *   totalFats: number,
 *   overallConfidence: number (0.0 to 1.0),
 *   items: [{ name, weightGrams, calories, protein, carbs, fats, confidenceScore }]
 * }
 */
const FoodSnapSchema = {
  type: SchemaType.OBJECT,
  properties: {
    dishTitle: {
      type: SchemaType.STRING,
      description: 'Concise title or overall name of the meal/dish',
    },
    totalCalories: {
      type: SchemaType.NUMBER,
      description: 'Total estimated calories in kcal',
    },
    totalProtein: {
      type: SchemaType.NUMBER,
      description: 'Total protein in grams',
    },
    totalCarbs: {
      type: SchemaType.NUMBER,
      description: 'Total carbohydrates in grams',
    },
    totalFats: {
      type: SchemaType.NUMBER,
      description: 'Total fats in grams',
    },
    overallConfidence: {
      type: SchemaType.NUMBER,
      description: 'Overall detection confidence score between 0.0 and 1.0',
    },
    items: {
      type: SchemaType.ARRAY,
      description: 'Breakdown of individual food items and ingredients in the dish',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: 'Name of the ingredient or component',
          },
          weightGrams: {
            type: SchemaType.NUMBER,
            description: 'Estimated weight in grams',
          },
          calories: {
            type: SchemaType.NUMBER,
            description: 'Calories in kcal',
          },
          protein: {
            type: SchemaType.NUMBER,
            description: 'Protein in grams',
          },
          carbs: {
            type: SchemaType.NUMBER,
            description: 'Carbohydrates in grams',
          },
          fats: {
            type: SchemaType.NUMBER,
            description: 'Fats in grams',
          },
          confidenceScore: {
            type: SchemaType.NUMBER,
            description: 'Confidence score for this item between 0.0 and 1.0',
          },
        },
        required: [
          'name',
          'weightGrams',
          'calories',
          'protein',
          'carbs',
          'fats',
          'confidenceScore',
        ],
      },
    },
  },
  required: [
    'dishTitle',
    'totalCalories',
    'totalProtein',
    'totalCarbs',
    'totalFats',
    'overallConfidence',
    'items',
  ],
};

// ── Phase 4: Voice Gym Set Response Schema ──────────────────────────
const VoiceSetSchema = {
  type: SchemaType.OBJECT,
  properties: {
    exerciseName: {
      type: SchemaType.STRING,
      description: 'Standardized exercise name in Title Case (e.g., Barbell Bench Press, Barbell Back Squat, Dumbbell Shoulder Press)',
    },
    weightKg: {
      type: SchemaType.NUMBER,
      description: 'Weight lifted in kilograms (converted from pounds if spoken as lbs)',
    },
    reps: {
      type: SchemaType.NUMBER,
      description: 'Number of repetitions completed in the set',
    },
    rpe: {
      type: SchemaType.NUMBER,
      description: 'Rate of Perceived Exertion on a 1-10 scale (or null if not mentioned)',
    },
    startRestTimer: {
      type: SchemaType.BOOLEAN,
      description: 'Always true to automatically trigger the rest interval timer',
    },
  },
  required: ['exerciseName', 'weightKg', 'reps', 'startRestTimer'],
};

// ── Phase 2: Agentic FitBot Declarative Tools Registry ──────────
const fitbotFunctionDeclarations = [
  {
    name: 'logMealItem',
    description: "Log a meal or food item with calories and macronutrients directly to the user's food log database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        foodName: {
          type: SchemaType.STRING,
          description: 'Name of the food, ingredient, or meal item (e.g. "200g Greek yogurt")',
        },
        calories: {
          type: SchemaType.NUMBER,
          description: 'Estimated energy content in kcal',
        },
        protein: {
          type: SchemaType.NUMBER,
          description: 'Protein content in grams',
        },
        carbs: {
          type: SchemaType.NUMBER,
          description: 'Carbohydrate content in grams',
        },
        fats: {
          type: SchemaType.NUMBER,
          description: 'Fat content in grams',
        },
        mealType: {
          type: SchemaType.STRING,
          description: 'Category of meal: "breakfast", "lunch", "dinner", or "snack"',
        },
      },
      required: ['foodName', 'calories'],
    },
  },
  {
    name: 'logWorkoutSession',
    description: "Log a workout exercise set or session with sets, reps, weight in kg, and RPE to the user's activity log.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        exerciseName: {
          type: SchemaType.STRING,
          description: 'Name of the exercise performed (e.g. "Barbell Bench Press")',
        },
        sets: {
          type: SchemaType.NUMBER,
          description: 'Number of sets completed',
        },
        reps: {
          type: SchemaType.NUMBER,
          description: 'Number of repetitions per set',
        },
        weightKg: {
          type: SchemaType.NUMBER,
          description: 'Load or weight used in kilograms (0 for bodyweight)',
        },
        rpe: {
          type: SchemaType.NUMBER,
          description: 'Rate of Perceived Exertion on a 1-10 scale (optional)',
        },
      },
      required: ['exerciseName', 'sets', 'reps'],
    },
  },
  {
    name: 'swapExerciseInPlan',
    description: "Swap or replace an exercise in the user's active workout routine with a suitable alternative.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetExercise: {
          type: SchemaType.STRING,
          description: 'The current exercise in the routine to replace (e.g. "Barbell Back Squat")',
        },
        replacementExercise: {
          type: SchemaType.STRING,
          description: 'The new substitute exercise (e.g. "Leg Press")',
        },
        equipmentAvailable: {
          type: SchemaType.STRING,
          description: 'Available gym equipment or reason for the substitution (optional)',
        },
      },
      required: ['targetExercise', 'replacementExercise'],
    },
  },
];

const fitbotTools = [{ functionDeclarations: fitbotFunctionDeclarations }];

// Mock handlers for testing without live network
let mockVisionHandler = null;
let mockFitBotHandler = null;

const setGeminiVisionMock = (handler) => {
  mockVisionHandler = handler;
};
const clearGeminiVisionMock = () => {
  mockVisionHandler = null;
};

const setGeminiFitBotMock = (handler) => {
  mockFitBotHandler = handler;
};
const clearGeminiFitBotMock = () => {
  mockFitBotHandler = null;
};
const isFitBotMockActive = () => Boolean(mockFitBotHandler);
const isFitBotConfigured = () => Boolean(mockFitBotHandler || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);

let mockVoiceSetHandler = null;
const setGeminiVoiceMock = (handler) => {
  mockVoiceSetHandler = handler;
};
const clearGeminiVoiceMock = () => {
  mockVoiceSetHandler = null;
};

/**
 * Validates and normalizes raw parsed JSON into the strict Phase 1 format.
 */
const normalizeVisionOutput = (raw) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }

  const items = Array.isArray(raw.items)
    ? raw.items.map((item) => {
        const weight = Number(item.weightGrams ?? item.estimatedGrams) || 0;
        const cal = Number(item.calories) || 0;
        const prot = Number(item.protein) || 0;
        const carb = Number(item.carbs) || 0;
        const fat = Number(item.fats ?? item.fat) || 0;
        const conf =
          typeof item.confidenceScore === 'number'
            ? Math.max(0, Math.min(1, item.confidenceScore))
            : 0.8;

        return {
          name: String(item.name || 'Food item').trim(),
          weightGrams: Math.round(weight),
          estimatedGrams: Math.round(weight),
          calories: Math.round(cal),
          protein: Math.round(prot * 10) / 10,
          carbs: Math.round(carb * 10) / 10,
          fats: Math.round(fat * 10) / 10,
          fat: Math.round(fat * 10) / 10,
          confidenceScore: conf,
        };
      })
    : [];

  const calculatedCalories =
    items.length > 0 ? items.reduce((s, i) => s + i.calories, 0) : 0;
  const calculatedProtein =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10
      : 0;
  const calculatedCarbs =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10
      : 0;
  const calculatedFats =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.fats, 0) * 10) / 10
      : 0;

  const totalCalories =
    typeof raw.totalCalories === 'number' && raw.totalCalories > 0
      ? Math.round(raw.totalCalories)
      : (typeof raw.calories === 'number' && raw.calories > 0
          ? Math.round(raw.calories)
          : calculatedCalories);

  const totalProtein =
    typeof raw.totalProtein === 'number'
      ? Math.round(raw.totalProtein * 10) / 10
      : (typeof raw.protein === 'number'
          ? Math.round(raw.protein * 10) / 10
          : calculatedProtein);

  const totalCarbs =
    typeof raw.totalCarbs === 'number'
      ? Math.round(raw.totalCarbs * 10) / 10
      : (typeof raw.carbs === 'number'
          ? Math.round(raw.carbs * 10) / 10
          : calculatedCarbs);

  const totalFats =
    typeof raw.totalFats === 'number'
      ? Math.round(raw.totalFats * 10) / 10
      : (typeof raw.fat === 'number'
          ? Math.round(raw.fat * 10) / 10
          : calculatedFats);

  const dishTitle = String(
    raw.dishTitle || raw.name || items[0]?.name || 'Analyzed Meal'
  ).trim();

  let overallConfidence =
    typeof raw.overallConfidence === 'number'
      ? Math.max(0, Math.min(1, raw.overallConfidence))
      : (items.length > 0
          ? items.reduce((s, i) => s + i.confidenceScore, 0) / items.length
          : 0.8);
  overallConfidence = Math.round(overallConfidence * 100) / 100;

  if (totalCalories <= 0 && items.length === 0) {
    throw new Error('Could not identify food in the image. Please try a clearer photo.');
  }

  return {
    dishTitle,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFats,
    overallConfidence,
    items,
    // Backward compatibility aliases
    name: dishTitle,
    calories: totalCalories,
    protein: totalProtein,
    carbs: totalCarbs,
    fat: totalFats,
    totalMacros: {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fats: totalFats,
    },
  };
};

/**
 * Analyzes a food image buffer using Gemini Vision with deterministic responseSchema.
 */
const analyzeFoodImage = async (buffer, mimeType = 'image/jpeg', options = {}) => {
  const modelName = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  if (mockVisionHandler) {
    try {
      const mockRaw = await mockVisionHandler(buffer, mimeType);
      recordProviderCall({
        provider: 'gemini',
        model: modelName,
        usage: mockRaw?.usageMetadata || null,
        status: 'success',
      });
      return normalizeVisionOutput(mockRaw);
    } catch (err) {
      recordProviderCall({
        provider: 'gemini',
        model: modelName,
        status: err.isTimeout ? 'timeout' : 'failure',
        timedOut: Boolean(err.isTimeout),
      });
      throw err;
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please set GOOGLE_API_KEY.');
  }

  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || DEFAULT_GEMINI_TIMEOUT_MS;
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: FoodSnapSchema,
    },
  });

  const prompt =
    'Analyze this meal image. Identify the dish, estimate the total macros (calories, protein, carbs, fats), ' +
    'break down each detected food item with estimated portion weight in grams and confidence score (0.0 to 1.0), ' +
    'and provide an overall confidence score.';

  let response;
  try {
    const callStart = Date.now();
    response = await withGeminiTimeout(
      () =>
        model.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType,
            },
          },
          prompt,
        ]),
      { timeoutMs, signal: options?.signal }
    );
    const latencyMs = Date.now() - callStart;

    const usageMetadata = response?.response?.usageMetadata || null;
    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      usage: usageMetadata,
      status: 'success',
      latencyMs,
    });
  } catch (err) {
    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      status: err.isTimeout ? 'timeout' : 'failure',
      timedOut: Boolean(err.isTimeout),
    });
    throw err;
  }

  const text = response.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('AI returned unreadable output. Please try again with a clearer photo.');
  }

  return normalizeVisionOutput(parsed);
};

// ── Server-Side Tool Execution Engine ───────────────────────────
/**
 * Executes a tool called by Gemini against authenticated user records.
 * @param {string} name - tool name
 * @param {object} args - function arguments
 * @param {object} user - authenticated mongoose user object
 */
const executeFitBotTool = async (name, args = {}, user) => {
  if (!user || !user._id) {
    return {
      action: name,
      status: 'error',
      message: 'User authentication required to execute database mutations.',
    };
  }

  const userId = user._id;

  try {
    if (name === 'logMealItem') {
      const hour = new Date().getHours();
      let defaultMealType = 'snack';
      if (hour >= 0 && hour < 12) defaultMealType = 'breakfast';
      else if (hour >= 12 && hour < 16) defaultMealType = 'lunch';
      else if (hour >= 16 && hour < 21) defaultMealType = 'dinner';

      const mealType = String(args.mealType || defaultMealType).toLowerCase().trim();
      const calories = Number(args.calories) || 0;
      const protein = Number(args.protein) || 0;
      const carbs = Number(args.carbs) || 0;
      const fat = Number(args.fats ?? args.fat) || 0;

      const foodLog = await FoodLog.create({
        name: String(args.foodName).trim(),
        calories,
        protein,
        carbs,
        fat,
        mealtype: mealType,
        mealType: mealType,
        date: new Date(),
        user: userId,
        aiGenerated: true,
      });

      publishChange(String(userId), 'food', foodLog.date);

      return {
        action: 'logMealItem',
        status: 'success',
        foodName: foodLog.name,
        calories: foodLog.calories,
        protein,
        carbs,
        fat,
        mealType: foodLog.mealType,
        recordId: String(foodLog._id),
        message: `Logged ${foodLog.name} (${foodLog.calories} kcal, ${protein}g P, ${carbs}g C, ${fat}g F) for ${foodLog.mealType}.`,
      };
    }

    if (name === 'logWorkoutSession') {
      const setsCount = Math.max(1, Math.round(Number(args.sets) || 1));
      const repsCount = Math.max(1, Math.round(Number(args.reps) || 10));
      const weightKg = Number(args.weightKg) || 0;
      const rpe = Number(args.rpe) || null;

      const setsArray = [];
      for (let i = 1; i <= setsCount; i++) {
        setsArray.push({
          setNumber: i,
          weight: weightKg,
          reps: repsCount,
          completed: true,
          rpe: rpe || undefined,
        });
      }

      const estimatedDuration = Math.round(setsCount * 3);
      const estimatedCalories = Math.round(setsCount * repsCount * (weightKg > 0 ? 0.35 : 0.2) + 20);

      const activityLog = await ActivityLog.create({
        name: `Workout: ${args.exerciseName}`,
        duration: estimatedDuration,
        calories: estimatedCalories,
        date: new Date(),
        user: userId,
        type: 'weight training',
        intensity: rpe && rpe >= 8.5 ? 'high' : 'medium',
        source: 'fitbot',
        exercises: [
          {
            name: String(args.exerciseName).trim(),
            sets: setsArray,
          },
        ],
      });

      publishChange(String(userId), 'activity', activityLog.date);

      return {
        action: 'logWorkoutSession',
        status: 'success',
        exerciseName: args.exerciseName,
        sets: setsCount,
        reps: repsCount,
        weightKg,
        rpe,
        recordId: String(activityLog._id),
        message: `Logged ${args.exerciseName} (${setsCount} sets × ${repsCount} reps @ ${weightKg}kg, RPE ${rpe ?? 'N/A'}).`,
      };
    }

    if (name === 'swapExerciseInPlan') {
      const plan = await WorkoutPlan.findOne({ user: userId, isActive: true });
      let swapped = false;
      let foundDay = null;

      if (plan && Array.isArray(plan.days)) {
        const targetLower = String(args.targetExercise).toLowerCase().trim();
        for (const day of plan.days) {
          if (Array.isArray(day.exercises)) {
            for (let i = 0; i < day.exercises.length; i++) {
              const ex = day.exercises[i];
              const exName = typeof ex === 'string' ? ex : (ex?.name || '');
              if (
                exName.toLowerCase().includes(targetLower) ||
                targetLower.includes(exName.toLowerCase())
              ) {
                if (typeof ex === 'string') {
                  day.exercises[i] = args.replacementExercise;
                } else {
                  day.exercises[i] = {
                    ...ex,
                    name: args.replacementExercise,
                  };
                }
                swapped = true;
                foundDay = day.day;
                break;
              }
            }
          }
          if (swapped) break;
        }

        if (swapped) {
          plan.markModified('days');
          await plan.save();
          publishChange(String(userId), 'plan');
        }
      }

      return {
        action: 'swapExerciseInPlan',
        status: swapped ? 'success' : 'not_found',
        targetExercise: args.targetExercise,
        replacementExercise: args.replacementExercise,
        day: foundDay,
        message: swapped
          ? `Swapped "${args.targetExercise}" with "${args.replacementExercise}" on ${foundDay}.`
          : `Exercise "${args.targetExercise}" not found in current active routine, but recommended "${args.replacementExercise}".`,
      };
    }

    return {
      action: name,
      status: 'error',
      message: `Unknown tool function "${name}".`,
    };
  } catch (err) {
    return {
      action: name,
      status: 'error',
      message: `Failed to execute ${name}: ${err.message}`,
    };
  }
};

/**
 * Builds compact JSON snapshot of today's macro totals and active workout status
 * to pin into systemInstruction (Phase 2 token optimization).
 */
const buildUserTodayStatus = async (user, timeZone = 'UTC') => {
  if (!user || !user._id) return null;

  try {
    const today = new Date();
    const todayStr = dayKey(today, timeZone);
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState !== 1) {
      return {
        date: todayStr,
        macroTotalsToday: {
          consumed: 0,
          calorieGoal: user.dailycaloriesintake || 2000,
          protein: 0,
          proteinGoal: user.dailyproteingoal || 150,
          carbs: 0,
          carbsGoal: user.dailycarbsgoal || 200,
          fats: 0,
          fatGoal: user.dailyfatgoal || 65,
        },
        activeWorkoutRoutine: {
          planTitle: null,
          days: [],
          completedToday: false,
        },
      };
    }

    const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

    const [foodLogs, activePlan, todayActivity] = await Promise.all([
      FoodLog.find({ user: user._id, date: { $gte: startOfDay, $lte: endOfDay } }).lean().catch(() => []),
      WorkoutPlan.findOne({ user: user._id, isActive: true }).lean().catch(() => null),
      ActivityLog.findOne({ user: user._id, date: { $gte: startOfDay, $lte: endOfDay } }).lean().catch(() => null),
    ]);

    const macros = (foodLogs || []).reduce(
      (acc, f) => ({
        calories: acc.calories + (f.calories || 0),
        protein: acc.protein + (f.protein || 0),
        carbs: acc.carbs + (f.carbs || 0),
        fat: acc.fat + (f.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      date: todayStr,
      macroTotalsToday: {
        consumed: Math.round(macros.calories),
        calorieGoal: user.dailycaloriesintake || 2000,
        protein: Math.round(macros.protein * 10) / 10,
        proteinGoal: user.dailyproteingoal || 150,
        carbs: Math.round(macros.carbs * 10) / 10,
        carbsGoal: user.dailycarbsgoal || 200,
        fats: Math.round(macros.fat * 10) / 10,
        fatGoal: user.dailyfatgoal || 65,
      },
      activeWorkoutRoutine: {
        planTitle: activePlan ? activePlan.title : null,
        days: activePlan?.days ? activePlan.days.map((d) => d.day) : [],
        completedToday: Boolean(todayActivity),
      },
    };
  } catch {
    return null;
  }
};

/**
 * Runs an agentic Gemini FitBot chat session with function calling and bounded context window.
 * - Caps history array sent to Gemini to last 8 turns (history.slice(-8)).
 * - Pins compact JSON snapshot of today's macros and workout status into systemInstruction.
 * - Implements server-side tool execution loop when functionCalls is non-empty.
 */
const runFitBotAgentSession = async ({
  messages,
  user,
  systemPrompt,
  timeZone = 'UTC',
}) => {
  // Bounded Context Window: cap conversation history array sent to Gemini to last 8 turns
  const boundedMessages = Array.isArray(messages) ? messages.slice(-8) : [];
  if (boundedMessages.length === 0) {
    throw new Error('No messages provided to FitBot');
  }

  // Build compact JSON snapshot of today's macros and workout status
  const todayStatus = await buildUserTodayStatus(user, timeZone);
  const statusBlock = todayStatus
    ? `\n\n[Active User Today Snapshot - Do Not Recalculate]\n${JSON.stringify(todayStatus)}`
    : '';
  const fullSystemInstruction = `${systemPrompt || 'You are FitBot, an encouraging and expert AI fitness and nutrition coach.'}${statusBlock}`;

  if (mockFitBotHandler) {
    try {
      const mockRes = await mockFitBotHandler({
        messages: boundedMessages,
        user,
        systemInstruction: fullSystemInstruction,
        todayStatus,
      });
      recordProviderCall({
        provider: 'gemini',
        model: mockRes?.model || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
        usage: mockRes?.usage || mockRes?.usageMetadata || null,
        status: 'success',
      });
      return mockRes;
    } catch (err) {
      recordProviderCall({
        provider: 'gemini',
        model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
        status: err.isTimeout ? 'timeout' : 'failure',
        timedOut: Boolean(err.isTimeout),
      });
      throw err;
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please set GOOGLE_API_KEY.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: fullSystemInstruction,
    tools: fitbotTools,
  });

  // Extract the latest user message
  const lastMsg = boundedMessages[boundedMessages.length - 1];
  const lastMsgText =
    typeof lastMsg.content === 'string'
      ? lastMsg.content
      : (Array.isArray(lastMsg.parts)
          ? lastMsg.parts.map((p) => p.text).join('')
          : (lastMsg.text || ''));

  // Prior turns form the chat history (up to 7 prior turns)
  const priorTurns = boundedMessages.slice(0, boundedMessages.length - 1);
  const geminiHistory = [];

  for (const m of priorTurns) {
    const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
    const text =
      typeof m.content === 'string'
        ? m.content
        : (Array.isArray(m.parts)
            ? m.parts.map((p) => p.text).join('')
            : (m.text || ''));
    geminiHistory.push({
      role,
      parts: [{ text }],
    });
  }

  // Gemini history must start with user turn
  while (geminiHistory.length > 0 && geminiHistory[0].role !== 'user') {
    geminiHistory.shift();
  }

  const chat = model.startChat({
    history: geminiHistory,
  });

  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || DEFAULT_GEMINI_TIMEOUT_MS;
  let response;
  const turn1Start = Date.now();
  try {
    response = await withGeminiTimeout(
      () => chat.sendMessage(lastMsgText),
      { timeoutMs, signal: options?.signal }
    );
  } catch (err) {
    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      status: err.isTimeout ? 'timeout' : 'failure',
      timedOut: Boolean(err.isTimeout),
      attempt: 1,
      latencyMs: Date.now() - turn1Start,
    });
    throw err;
  }

  const candidate = response.response;
  recordProviderCall({
    provider: 'gemini',
    model: modelName,
    usage: candidate.usageMetadata || null,
    status: 'success',
    attempt: 1,
    latencyMs: Date.now() - turn1Start,
  });

  // Check if Gemini invoked any function calls
  const functionCalls = candidate.functionCalls ? candidate.functionCalls() : [];

  if (functionCalls && functionCalls.length > 0) {
    const executedActions = [];
    const functionResponses = [];

    for (const call of functionCalls) {
      const toolResult = await executeFitBotTool(call.name, call.args, user);
      executedActions.push(toolResult);
      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: toolResult,
        },
      });
    }

    // Feed function responses back to Gemini to generate natural confirmation message
    let followUp;
    const turn2Start = Date.now();
    try {
      followUp = await withGeminiTimeout(
        () => chat.sendMessage(functionResponses),
        { timeoutMs, signal: options?.signal }
      );
    } catch (err) {
      recordProviderCall({
        provider: 'gemini',
        model: modelName,
        status: err.isTimeout ? 'timeout' : 'failure',
        timedOut: Boolean(err.isTimeout),
        attempt: 2,
        latencyMs: Date.now() - turn2Start,
      });
      throw err;
    }

    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      usage: followUp.response?.usageMetadata || null,
      status: 'success',
      attempt: 2,
      latencyMs: Date.now() - turn2Start,
    });

    const reply = followUp.response.text();

    const pTokens = (candidate.usageMetadata?.promptTokenCount || 0) + (followUp.response?.usageMetadata?.promptTokenCount || 0);
    const cTokens = (candidate.usageMetadata?.candidatesTokenCount || 0) + (followUp.response?.usageMetadata?.candidatesTokenCount || 0);
    const tTokens = (candidate.usageMetadata?.totalTokenCount || 0) + (followUp.response?.usageMetadata?.totalTokenCount || 0);

    const usage = tTokens > 0 ? {
      promptTokens: pTokens,
      completionTokens: cTokens,
      totalTokens: tTokens,
      tokens: tTokens,
    } : null;

    return {
      reply,
      executedActions,
      model: modelName,
      usage,
    };
  }

  const pTokens = candidate.usageMetadata?.promptTokenCount || 0;
  const cTokens = candidate.usageMetadata?.candidatesTokenCount || 0;
  const tTokens = candidate.usageMetadata?.totalTokenCount || 0;

  const usage = tTokens > 0 ? {
    promptTokens: pTokens,
    completionTokens: cTokens,
    totalTokens: tTokens,
    tokens: tTokens,
  } : null;

  return {
    reply: candidate.text(),
    executedActions: [],
    model: modelName,
    usage,
  };
};

/**
 * Deterministic fallback regex parser for natural gym speech set logs.
 * Extracts: exerciseName, weightKg, reps, rpe, startRestTimer.
 */
const parseVoiceSetRegex = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Speech text is required');
  }
  const clean = text.trim();

  // Weight extraction (e.g. "80 kg", "80 kilos", "80 kilograms", "80kgs", "175 lbs")
  let weightKg = 0;
  const weightMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|kgs?)/i) ||
                      clean.match(/(?:at|with|using)\s*(\d+(?:\.\d+)?)/i);
  if (weightMatch) {
    weightKg = parseFloat(weightMatch[1]);
  } else {
    const lbsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
    if (lbsMatch) {
      weightKg = Math.round(parseFloat(lbsMatch[1]) * 0.453592 * 10) / 10;
    }
  }

  // Reps extraction (e.g. "8 reps", "8 repetitions", "for 8")
  let reps = 0;
  const repsMatch = clean.match(/(\d+)\s*(?:reps?|repetitions?)/i) ||
                    clean.match(/(?:for|did)\s*(\d+)(?:\s*reps?)?/i);
  if (repsMatch) {
    reps = parseInt(repsMatch[1], 10);
  }

  // RPE extraction (e.g. "RPE 8.5", "felt like RPE 8.5", "felt like 8.5")
  let rpe = undefined;
  const rpeMatch = clean.match(/rpe\s*(\d+(?:\.\d+)?)/i) ||
                   clean.match(/(?:felt like|rate of perceived exertion)\s*(?:rpe\s*)?(\d+(?:\.\d+)?)/i);
  if (rpeMatch) {
    rpe = parseFloat(rpeMatch[1]);
  }

  // Clean exercise name from tokens
  let exerciseName = clean
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?|kgs?|lbs?|pounds?)\b/gi, '')
    .replace(/\b(\d+)\s*(?:reps?|repetitions?)\b/gi, '')
    .replace(/\brpe\s*(\d+(?:\.\d+)?)\b/gi, '')
    .replace(/\b(?:felt like|rate of perceived exertion|for|with|at|i did|just did|completed)\b/gi, ' ')
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!exerciseName || exerciseName.length < 3) {
    exerciseName = 'Barbell Bench Press';
  } else {
    // Title Case
    exerciseName = exerciseName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  if (!weightKg) weightKg = 60;
  if (!reps) reps = 8;

  return {
    exerciseName,
    weightKg,
    reps,
    rpe: rpe !== undefined ? rpe : 8.0,
    startRestTimer: true,
  };
};

/**
 * Parses natural gym speech (or audio buffer) into a structured workout set log
 * using Gemini Flash responseSchema or deterministic regex fallback.
 */
const parseVoiceGymSet = async ({ speechText, audioBuffer, mimeType = 'audio/webm', signal }) => {
  const modelName = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
  if (mockVoiceSetHandler) {
    try {
      const mockRes = await mockVoiceSetHandler({ speechText, audioBuffer, mimeType });
      recordProviderCall({
        provider: 'gemini',
        model: modelName,
        usage: mockRes?.usageMetadata || null,
        status: 'success',
      });
      return mockRes;
    } catch (err) {
      recordProviderCall({
        provider: 'gemini',
        model: modelName,
        status: err.isTimeout ? 'timeout' : 'failure',
        timedOut: Boolean(err.isTimeout),
      });
      if (speechText) {
        return parseVoiceSetRegex(speechText);
      }
      throw err;
    }
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    if (speechText) {
      return parseVoiceSetRegex(speechText);
    }
    throw new Error('Google Gemini API key not configured for audio transcription');
  }

  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || DEFAULT_GEMINI_TIMEOUT_MS;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: VoiceSetSchema,
      },
      systemInstruction:
        'You are a high-speed gym voice logger assistant. Parse the spoken workout set log into structured JSON: exerciseName (in clean Title Case), weightKg (number), reps (integer), rpe (number 1-10 or null), and startRestTimer (always true). If spoken in pounds/lbs, convert to kg.',
    });

    const promptParts = [];
    if (audioBuffer) {
      promptParts.push({
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType,
        },
      });
      promptParts.push('Parse the spoken workout set from this audio.');
    } else if (speechText) {
      promptParts.push(`Parse this spoken gym set: "${speechText}"`);
    } else {
      throw new Error('Either speechText or audioBuffer must be provided');
    }

    const callStart = Date.now();
    const result = await withGeminiTimeout(
      () => model.generateContent(promptParts),
      { timeoutMs, signal }
    );
    const latencyMs = Date.now() - callStart;

    const usageMetadata = result.response?.usageMetadata || null;
    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      usage: usageMetadata,
      status: 'success',
      latencyMs,
    });

    const text = result.response.text();
    const parsed = JSON.parse(text);

    return {
      exerciseName: parsed.exerciseName || 'Exercise',
      weightKg: Number(parsed.weightKg) || 0,
      reps: Number(parsed.reps) || 0,
      rpe: parsed.rpe !== undefined && parsed.rpe !== null ? Number(parsed.rpe) : undefined,
      startRestTimer: true,
    };
  } catch (err) {
    recordProviderCall({
      provider: 'gemini',
      model: modelName,
      status: err.isTimeout ? 'timeout' : 'failure',
      timedOut: Boolean(err.isTimeout),
    });
    logger.warn(`[Gemini Voice] Model error: ${err.message}; falling back to regex parser...`);
    if (speechText) {
      return parseVoiceSetRegex(speechText);
    }
    throw err;
  }
};

module.exports = {
  FoodSnapSchema,
  VoiceSetSchema,
  fitbotTools,
  fitbotFunctionDeclarations,
  analyzeFoodImage,
  normalizeVisionOutput,
  executeFitBotTool,
  buildUserTodayStatus,
  runFitBotAgentSession,
  parseVoiceSetRegex,
  parseVoiceGymSet,
  setGeminiVisionMock,
  clearGeminiVisionMock,
  setGeminiFitBotMock,
  clearGeminiFitBotMock,
  setGeminiVoiceMock,
  clearGeminiVoiceMock,
  isFitBotMockActive,
  isFitBotConfigured,
};
