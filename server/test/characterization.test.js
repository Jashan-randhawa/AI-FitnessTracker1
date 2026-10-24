const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

describe('Phase 0 Characterization Tests — Pure Function Calculations', () => {
  let buildDailyTotals;
  let calcStreakFromMap;
  let dateKey;
  let buildNormalizedContext;
  let sanitizeContextString;
  let validateNumericMetric;

  before(async () => {
    const dailyTotalsPath = pathToFileURL(
      path.resolve(__dirname, '../../client/src/utils/dailyTotals.ts')
    ).href;
    const fitbotHistoryPath = pathToFileURL(
      path.resolve(__dirname, '../../client/src/utils/fitbotHistory.ts')
    ).href;

    const dailyTotalsModule = await import(dailyTotalsPath);
    const fitbotHistoryModule = await import(fitbotHistoryPath);

    buildDailyTotals = dailyTotalsModule.buildDailyTotals;
    calcStreakFromMap = dailyTotalsModule.calcStreakFromMap;
    dateKey = dailyTotalsModule.dateKey;

    buildNormalizedContext = fitbotHistoryModule.buildNormalizedContext;
    sanitizeContextString = fitbotHistoryModule.sanitizeContextString;
    validateNumericMetric = fitbotHistoryModule.validateNumericMetric;
  });

  describe('buildDailyTotals & dateKey Characterization', () => {
    it('generates consistent dateKey with date, createdAt fallback, or current time', () => {
      const fixedDate = '2026-10-24T10:00:00.000Z';
      const expectedKey = new Date(fixedDate).toDateString();

      assert.equal(dateKey({ date: fixedDate }), expectedKey);
      assert.equal(dateKey({ createdAt: fixedDate }), expectedKey);
      assert.equal(dateKey({}, new Date(fixedDate)), expectedKey);
    });

    it('returns an empty map when all log lists are empty or undefined', () => {
      const map = buildDailyTotals([], [], []);
      assert.equal(map.size, 0);

      const defaultMap = buildDailyTotals();
      assert.equal(defaultMap.size, 0);
    });

    it('aggregates multiple food, activity, and water logs for the same day', () => {
      const targetDate = '2026-10-24T12:00:00.000Z';
      const key = new Date(targetDate).toDateString();

      const foodLogs = [
        { date: targetDate, calories: 500, protein: 30, carbs: 50, fat: 15 },
        { date: targetDate, calories: 750, protein: 45, carbs: 80, fat: 20 },
      ];
      const activityLogs = [
        { date: targetDate, calories: 300, duration: 35 },
        { date: targetDate, caloriesBurned: 200, duration: 25 },
      ];
      const waterLogs = [
        { date: targetDate, amount: 500 },
        { date: targetDate, amount: 750 },
      ];

      const map = buildDailyTotals(foodLogs, activityLogs, waterLogs);
      assert.equal(map.size, 1);

      const day = map.get(key);
      assert.ok(day);
      assert.equal(day.calories, 1250);
      assert.equal(day.protein, 75);
      assert.equal(day.carbs, 130);
      assert.equal(day.fat, 35);
      assert.equal(day.meals, 2);
      assert.equal(day.burned, 500);
      assert.equal(day.minutes, 60);
      assert.equal(day.water, 1250);
      assert.equal(day.hasFood, true);
      assert.equal(day.hasActivity, true);
    });

    it('separates logs across multiple calendar days properly', () => {
      const day1 = '2026-10-23T12:00:00.000Z';
      const day2 = '2026-10-24T12:00:00.000Z';
      const key1 = new Date(day1).toDateString();
      const key2 = new Date(day2).toDateString();

      const foodLogs = [
        { date: day1, calories: 400, protein: 20, carbs: 40, fat: 10 },
        { date: day2, calories: 600, protein: 30, carbs: 60, fat: 15 },
      ];

      const map = buildDailyTotals(foodLogs, [], []);
      assert.equal(map.size, 2);
      assert.equal(map.get(key1).calories, 400);
      assert.equal(map.get(key2).calories, 600);
    });

    it('gracefully handles null or undefined items in log lists', () => {
      const day1 = '2026-10-24T12:00:00.000Z';
      const map = buildDailyTotals(
        [null, { date: day1, calories: 300 }, undefined],
        [undefined, { date: day1, duration: 20 }],
        [null, { date: day1, amount: 250 }]
      );

      const key = new Date(day1).toDateString();
      const day = map.get(key);
      assert.ok(day);
      assert.equal(day.calories, 300);
      assert.equal(day.minutes, 20);
      assert.equal(day.water, 250);
    });
  });

  describe('calcStreakFromMap Characterization', () => {
    it('returns 0 for empty map', () => {
      const map = new Map();
      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 0);
    });

    it('calculates streak starting today when today has activity or food', () => {
      const map = new Map();
      map.set('Sat Oct 24 2026', { hasFood: true, hasActivity: false });
      map.set('Fri Oct 23 2026', { hasFood: false, hasActivity: true });
      map.set('Thu Oct 22 2026', { hasFood: true, hasActivity: true });

      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 3);
    });

    it('maintains streak from yesterday when today has not logged yet', () => {
      const map = new Map();
      // No entry or hasFood/hasActivity false for Oct 24
      map.set('Fri Oct 23 2026', { hasFood: true, hasActivity: false });
      map.set('Thu Oct 22 2026', { hasFood: false, hasActivity: true });
      map.set('Wed Oct 21 2026', { hasFood: true, hasActivity: false });

      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 3);
    });

    it('breaks streak when yesterday had no activity or food even if older days did', () => {
      const map = new Map();
      map.set('Sat Oct 24 2026', { hasFood: true, hasActivity: false });
      // Oct 23 missing
      map.set('Thu Oct 22 2026', { hasFood: true, hasActivity: true });

      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 1);
    });

    it('returns 0 when neither today nor yesterday has activity or food', () => {
      const map = new Map();
      // Only older days exist
      map.set('Thu Oct 22 2026', { hasFood: true, hasActivity: true });

      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 0);
    });

    it('does not count water alone as maintaining a streak', () => {
      const map = new Map();
      // Oct 24 only has water (hasFood: false, hasActivity: false)
      map.set('Sat Oct 24 2026', { hasFood: false, hasActivity: false, water: 2000 });
      // Oct 23 only has water
      map.set('Fri Oct 23 2026', { hasFood: false, hasActivity: false, water: 2500 });
      map.set('Thu Oct 22 2026', { hasFood: true, hasActivity: true });

      assert.equal(calcStreakFromMap(map, 'Sat Oct 24 2026'), 0);
    });
  });

  describe('buildNormalizedContext Characterization', () => {
    it('normalizes valid user profile fields into context string and object', () => {
      const result = buildNormalizedContext({
        user: {
          goal: 'lose',
          weight: 75.4,
          height: 178,
          age: 28,
          dailycaloriesintake: 2000,
          dailycaloriesburned: 450,
        },
      });

      assert.equal(
        result.contextString,
        '[User Profile] Goal: lose weight | Weight: 75.4kg | Height: 178cm | Age: 28 | Daily calorie target: 2000 kcal | Daily burn target: 450 kcal'
      );
      assert.deepEqual(result.contextObject.profile, {
        goal: 'lose',
        weightKg: 75.4,
        heightCm: 178,
        age: 28,
        dailyCalorieTarget: 2000,
        dailyBurnTarget: 450,
      });
    });

    it('rejects invalid profile goals and out-of-boundary metrics', () => {
      const result = buildNormalizedContext({
        user: {
          goal: 'invalid_goal',
          weight: 15, // Below 20
          height: 300, // Above 260
          age: 150, // Above 120
          dailycaloriesintake: 100, // Below 500
          dailycaloriesburned: -50, // Below 0
        },
      });

      assert.equal(result.contextString, '');
      assert.deepEqual(result.contextObject.profile, {});
    });

    it('normalizes today nutrition logs and aggregates totals with item names capped at 5', () => {
      const foodLogs = [
        { name: 'Oatmeal', calories: 350, protein: 12, carbs: 60, fat: 6 },
        { name: 'Protein Shake', calories: 250, protein: 30, carbs: 10, fat: 3 },
        { name: 'Chicken Breast & Rice', calories: 600, protein: 50, carbs: 70, fat: 10 },
        { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
        { name: 'Almonds', calories: 160, protein: 6, carbs: 6, fat: 14 },
        { name: 'Greek Yogurt (extra)', calories: 120, protein: 15, carbs: 8, fat: 0 },
      ];

      const result = buildNormalizedContext({ foodLogs });
      assert.ok(result.contextString.includes("[Recorded in App] Today's Nutrition: 1575 kcal total consumed across 6 items"));
      assert.ok(result.contextString.includes('[Oatmeal, Protein Shake, Chicken Breast & Rice, Apple, Almonds]'));
      assert.ok(result.contextString.includes('114g protein, 179g carbs, 33g fat'));

      assert.equal(result.contextObject.todayNutrition.loggedCount, 6);
      assert.equal(result.contextObject.todayNutrition.totalCalories, 1575);
      assert.equal(result.contextObject.todayNutrition.items.length, 5);
      assert.equal(result.contextObject.todayNutrition.provenance, 'Recorded in App');
    });

    it('normalizes today activity logs and aggregates duration and burn', () => {
      const activityLogs = [
        { name: 'Morning Run', duration: 30, caloriesBurned: 320 },
        { type: 'Weight Training', duration: 45, calories: 280 },
      ];

      const result = buildNormalizedContext({ activityLogs });
      assert.equal(
        result.contextString,
        "[Recorded in App] Today's Activity: 600 kcal burned across 75 active minutes [Morning Run (30m), Weight Training (45m)]"
      );
      assert.equal(result.contextObject.todayActivity.loggedCount, 2);
      assert.equal(result.contextObject.todayActivity.totalDurationMinutes, 75);
      assert.equal(result.contextObject.todayActivity.totalCaloriesBurned, 600);
    });

    it('strips angle brackets and sanitizes control characters from names (injection defense)', () => {
      const foodLogs = [
        { name: '<script>alert("xss")</script>Salad\n\twith dressing', calories: 200 },
      ];
      const activityLogs = [
        { name: 'Workout<tag>', duration: 25, calories: 150 },
      ];

      const result = buildNormalizedContext({ foodLogs, activityLogs });
      assert.ok(!result.contextString.includes('<'));
      assert.ok(!result.contextString.includes('>'));
      // Note: food item names are capped at 40 chars by sanitizeContextString(log.name, 40)
      assert.ok(result.contextString.includes('scriptalert("xss")/scriptSalad with dres'));
      assert.ok(result.contextString.includes('Workouttag (25m)'));
    });
  });
});
