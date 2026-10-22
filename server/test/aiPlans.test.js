const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  safeParseMealPlan,
  safeParseActivityPlan,
  extractRawJson,
  unwrapPlanArray,
} = require('../src/schemas/aiPlans.schema');
const {
  chatWithAssistant,
  validateStructuredOutput,
  resetCache,
} = require('../src/services/aiAssistant.service');
const {
  buildFitBotPrompt,
  FITBOT_SYSTEM_PROMPT,
} = require('../src/prompts/fitbot.prompt');

describe('Phase 5: Structured Meal Plan Zod Schema & Extraction Tests', () => {
  test('successfully parses a clean meal plan array', () => {
    const raw = JSON.stringify([
      {
        day: 'Day 1',
        meals: [
          {
            name: 'Oatmeal with Almonds',
            calories: 350,
            protein: 12,
            carbs: 55,
            fat: 8,
            mealType: 'breakfast',
            description: 'Fiber-rich breakfast bowl',
          },
          {
            name: 'Grilled Salmon with Quinoa',
            calories: 550,
            protein: 45,
            carbs: 40,
            fat: 20,
            mealType: 'dinner',
            description: 'Omega-3 rich dinner',
          },
        ],
        totalCalories: 900,
      },
    ]);

    const result = safeParseMealPlan(raw);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].day, 'Day 1');
    assert.strictEqual(result.data[0].meals.length, 2);
    assert.strictEqual(result.data[0].totalCalories, 900);
  });

  test('unwraps nested { plan: [...] } wrapper and computes totalCalories if omitted', () => {
    const raw = JSON.stringify({
      plan: [
        {
          day: 'Monday',
          meals: [
            { name: 'Eggs & Toast', calories: 300, protein: 18, carbs: 24, fat: 12, mealType: 'breakfast' },
            { name: 'Turkey Wrap', calories: 450, protein: 35, carbs: 45, fat: 14, mealType: 'lunch' },
          ],
        },
      ],
    });

    const result = safeParseMealPlan(raw);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data[0].totalCalories, 750);
  });

  test('extracts from markdown fenced code block (```json ... ```)', () => {
    const markdown = "Here is your customized meal plan:\n```json\n[{\n  \"day\": \"Day 1\",\n  \"meals\": [{\n    \"name\": \"Greek Yogurt\",\n    \"calories\": 180,\n    \"protein\": 15,\n    \"carbs\": 10,\n    \"fat\": 3,\n    \"mealType\": \"snack\"\n  }]\n}]\n```\nEnjoy your healthy meals!";

    const result = safeParseMealPlan(markdown);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data[0].meals[0].name, 'Greek Yogurt');
    assert.strictEqual(result.data[0].totalCalories, 180);
  });

  test('rejects unparseable non-JSON text', () => {
    const invalid = 'Sorry, as an AI I cannot generate that today.';
    const result = safeParseMealPlan(invalid);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Failed to parse JSON string/);
  });

  test('rejects empty meal plan array or missing meals', () => {
    const empty = JSON.stringify([]);
    const resultEmpty = safeParseMealPlan(empty);
    assert.strictEqual(resultEmpty.success, false);

    const noMeals = JSON.stringify([{ day: 'Day 1', meals: [] }]);
    const resultNoMeals = safeParseMealPlan(noMeals);
    assert.strictEqual(resultNoMeals.success, false);
  });
});

describe('Phase 5: Structured Activity / Workout Plan Zod Schema & Extraction Tests', () => {
  test('successfully parses a clean activity plan array', () => {
    const raw = JSON.stringify([
      {
        day: 'Day 1 - Push Focus',
        activities: [
          {
            name: 'Barbell Bench Press',
            type: 'weight training',
            duration: 40,
            caloriesBurned: 220,
            intensity: 'high',
            targetMuscles: ['chest', 'triceps', 'shoulders'],
            notes: '4 sets of 8-10 reps',
            warmup: '5 min dynamic warm-up',
            cooldown: '5 min shoulder stretching',
          },
        ],
        totalDuration: 40,
        totalCaloriesBurned: 220,
        recoveryFocus: 'Upper body foam rolling',
      },
    ]);

    const result = safeParseActivityPlan(raw);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0].activities[0].name, 'Barbell Bench Press');
    assert.strictEqual(result.data[0].recoveryFocus, 'Upper body foam rolling');
  });

  test('unwraps { days: [...] } envelope and computes totals from exercise array', () => {
    const raw = JSON.stringify({
      days: [
        {
          day: 'Day 1',
          activities: [
            { name: 'Outdoor Jog', type: 'running', duration: 30, caloriesBurned: 250, intensity: 'medium' },
            { name: 'Core Planks', type: 'custom', duration: 15, caloriesBurned: 80, intensity: 'medium' },
          ],
        },
      ],
    });

    const result = safeParseActivityPlan(raw);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.data[0].totalDuration, 45);
    assert.strictEqual(result.data[0].totalCaloriesBurned, 330);
    assert.strictEqual(result.data[0].recoveryFocus, 'Hydration and rest');
  });

  test('rejects unparseable activity input', () => {
    const result = safeParseActivityPlan('Not JSON');
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Failed to parse JSON string/);
  });
});

describe('Phase 5: Structured Output Validation Guard & Schema Repair Retry', () => {
  test('validateStructuredOutput verifies schema for mealPlan and activityPlan', () => {
    const validMeal = JSON.stringify([
      { day: 'Day 1', meals: [{ name: 'Salad', calories: 200, protein: 5, carbs: 10, fat: 5, mealType: 'lunch' }] },
    ]);
    const resMeal = validateStructuredOutput(validMeal, 'mealPlan');
    assert.strictEqual(resMeal.success, true);

    const invalidMeal = JSON.stringify([{ day: 'Day 1' }]); // missing meals
    const resInvalidMeal = validateStructuredOutput(invalidMeal, 'mealPlan');
    assert.strictEqual(resInvalidMeal.success, false);
  });

  test('chatWithAssistant triggers repair retry when initial response violates structured schema', async () => {
    resetCache();
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-key';
    let callCount = 0;

    const mockFetchFn = async () => {
      callCount++;
      if (callCount === 1) {
        // Initial call returns malformed JSON for a meal plan
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          text: async () =>
            JSON.stringify({
              id: 'mock-initial',
              model: 'openai/gpt-4o-mini',
              choices: [
                {
                  message: {
                    content: '{ "unrelated": "Here is some text not matching schema" }',
                  },
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
            }),
        };
      } else {
        // Repaired call returns valid conforming schema
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          text: async () =>
            JSON.stringify({
              id: 'mock-repaired',
              model: 'openai/gpt-4o-mini',
              choices: [
                {
                  message: {
                    content: JSON.stringify([
                      {
                        day: 'Day 1',
                        meals: [
                          { name: 'Oatmeal', calories: 300, protein: 10, carbs: 50, fat: 5, mealType: 'breakfast' },
                        ],
                      },
                    ]),
                  },
                },
              ],
              usage: { prompt_tokens: 15, completion_tokens: 15, total_tokens: 30 },
            }),
        };
      }
    };

    try {
      const result = await chatWithAssistant(
        [{ role: 'user', content: 'Generate a 1-day meal plan for weight loss.' }],
        'Goal: weight loss',
        {
          expectJson: true,
          planType: 'mealPlan',
          skipCache: true,
          fetchFn: mockFetchFn,
        }
      );

      // Call count should be 2 because repair retry was executed
      assert.strictEqual(callCount, 2);
      assert.strictEqual(result.cached, false);

      const parsed = safeParseMealPlan(result.reply);
      assert.strictEqual(parsed.success, true);
      assert.strictEqual(parsed.data[0].meals[0].name, 'Oatmeal');
    } finally {
      process.env.OPENROUTER_API_KEY = originalKey;
    }
  });
});

describe('Phase 5: Fitness & Clinical Safety Boundaries System Prompt Contract', () => {
  test('system prompt includes strict minimum calorie safe harbors', () => {
    assert.match(FITBOT_SYSTEM_PROMPT, /Minimum Calorie Safe Harbor/);
    assert.match(FITBOT_SYSTEM_PROMPT, /1,200 kcal for adult females/);
    assert.match(FITBOT_SYSTEM_PROMPT, /1,500 kcal for adult males/);
    assert.match(FITBOT_SYSTEM_PROMPT, /<1,000 kcal/);
  });

  test('system prompt mandates immediate exercise cessation for acute chest pain or red flags', () => {
    assert.match(FITBOT_SYSTEM_PROMPT, /Acute Pain & Red-Flag Symptoms/);
    assert.match(FITBOT_SYSTEM_PROMPT, /chest pain/);
    assert.match(FITBOT_SYSTEM_PROMPT, /stop exercising immediately and seek urgent medical evaluation/);
  });

  test('system prompt enforces eating disorder and obsessive restriction safeguards', () => {
    assert.match(FITBOT_SYSTEM_PROMPT, /Eating Disorder Red Flags/);
    assert.match(FITBOT_SYSTEM_PROMPT, /purging behaviors/);
    assert.match(FITBOT_SYSTEM_PROMPT, /helpline resources/);
  });

  test('system prompt proscribes specific injury diagnosis and dangerous unregulated substances', () => {
    assert.match(FITBOT_SYSTEM_PROMPT, /Injuries & Rehabilitation/);
    assert.match(FITBOT_SYSTEM_PROMPT, /physical therapist or physician/);
    assert.match(FITBOT_SYSTEM_PROMPT, /Supplements & Medications/);
    assert.match(FITBOT_SYSTEM_PROMPT, /anabolic steroids/);
  });

  test('buildFitBotPrompt correctly includes clinical safety boundaries in rendered prompt', () => {
    const rendered = buildFitBotPrompt('weight: 75kg', 'user likes running');
    assert.match(rendered, /Fitness & Clinical Safety Boundaries:/);
    assert.match(rendered, /<user_context>\nweight: 75kg\n<\/user_context>/);
  });
});
