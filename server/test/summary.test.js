process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidTimeZone,
  isValidDateKey,
  dayKey,
  addDays,
  rangeKeys,
  utcWindowFor,
} = require('../src/utils/localDay');
const { deriveGoals } = require('../src/utils/goals');
const {
  computeStreak,
  mergeRows,
  buildFoodPipeline,
  buildActivityPipeline,
  buildWaterPipeline,
  MAX_STREAK_DAYS,
} = require('../src/services/summary.service');

describe('timezone-aware day keys', () => {
  it('buckets an instant into the local calendar day of the given timezone', () => {
    // 18:40 UTC is 00:10 the next day in Asia/Calcutta (UTC+05:30).
    const instant = new Date('2026-10-24T18:40:00Z');
    assert.equal(dayKey(instant, 'Asia/Calcutta'), '2026-10-25');
    assert.equal(dayKey(instant, 'UTC'), '2026-10-24');
  });

  it('places 23:59 local on the same day and 00:01 local on the next', () => {
    assert.equal(dayKey(new Date('2026-10-24T18:29:00Z'), 'Asia/Calcutta'), '2026-10-24');
    assert.equal(dayKey(new Date('2026-10-24T18:31:00Z'), 'Asia/Calcutta'), '2026-10-25');
  });

  it('handles the far-east offset (UTC+14) at the same instant', () => {
    assert.equal(dayKey(new Date('2026-10-24T12:00:00Z'), 'Pacific/Kiritimati'), '2026-10-25');
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });

  it('builds inclusive ranges', () => {
    assert.deepEqual(rangeKeys('2026-10-30', '2026-11-01'), ['2026-10-30', '2026-10-31', '2026-11-01']);
    assert.deepEqual(rangeKeys('2026-10-05', '2026-10-04'), []);
  });

  it('UTC window covers every local day in every timezone', () => {
    const { start, end } = utcWindowFor('2026-10-24', '2026-10-24');
    // Local midnight in the most-western (UTC-12) and most-eastern (UTC+14) zones.
    const westMidnight = new Date('2026-10-24T12:00:00Z');
    const eastMidnight = new Date('2026-10-23T10:00:00Z');
    assert.ok(start <= eastMidnight && eastMidnight < end);
    assert.ok(start <= westMidnight && westMidnight < end);
  });
});

describe('input validation', () => {
  it('accepts real IANA zones and rejects garbage', () => {
    assert.equal(isValidTimeZone('Asia/Calcutta'), true);
    assert.equal(isValidTimeZone('Mars/Olympus'), false);
    assert.equal(isValidTimeZone(''), false);
    assert.equal(isValidTimeZone(undefined), false);
  });

  it('accepts only real calendar dates in YYYY-MM-DD form', () => {
    assert.equal(isValidDateKey('2026-10-24'), true);
    assert.equal(isValidDateKey('2026-02-30'), false);
    assert.equal(isValidDateKey('24-10-2026'), false);
    assert.equal(isValidDateKey('2026-10-24T00:00:00Z'), false);
  });
});

describe('goal derivation (parity with client deriveGoals.ts)', () => {
  it('applies the same defaults as the client when nothing is set', () => {
    assert.deepEqual(deriveGoals({}), {
      calorieLimit: 2000,
      calorieBurnGoal: 400,
      proteinGoal: 150, // 30% of 2000 kcal at 4 kcal/g
      carbsGoal: 200, // 40% at 4 kcal/g
      fatGoal: 67, // 30% at 9 kcal/g
      waterGoal: 2500,
    });
  });

  it('uses explicit user values and ignores zero or negative ones', () => {
    const goals = deriveGoals({
      dailycaloriesintake: 2400,
      dailyproteingoal: 180,
      dailycarbsgoal: 0,
      dailyfatgoal: -5,
      dailywatergoal: 3000,
    });
    assert.equal(goals.calorieLimit, 2400);
    assert.equal(goals.proteinGoal, 180);
    assert.equal(goals.carbsGoal, Math.round((2400 * 0.4) / 4)); // 0 falls back to derived
    assert.equal(goals.fatGoal, Math.round((2400 * 0.3) / 9)); // negative falls back
    assert.equal(goals.waterGoal, 3000);
  });
});

describe('streaks', () => {
  const today = '2026-10-24';

  it('counts back from today when today is logged', () => {
    assert.equal(computeStreak(['2026-10-24', '2026-10-23', '2026-10-22'], today), 3);
  });

  it('starts from yesterday when today has nothing yet, so the streak is not shown as broken', () => {
    assert.equal(computeStreak(['2026-10-23', '2026-10-22'], today), 2);
  });

  it('stops at the first gap', () => {
    assert.equal(computeStreak(['2026-10-24', '2026-10-22'], today), 1);
  });

  it('returns zero with no logs', () => {
    assert.equal(computeStreak([], today), 0);
  });

  it('is capped at the lookback window', () => {
    const many = rangeKeys(addDays(today, -(MAX_STREAK_DAYS + 20)), today);
    assert.equal(computeStreak(many, today), MAX_STREAK_DAYS);
  });
});

describe('merging grouped rows into day rows', () => {
  const days = ['2026-10-23', '2026-10-24'];

  it('fills empty days with zeros and rounds totals', () => {
    const rows = mergeRows(
      days,
      [{ _id: '2026-10-24', calories: 812.4, protein: 40.26, carbs: 90, fat: 21.04, meals: 3 }],
      [{ _id: '2026-10-24', burnedKcal: 300.6, minutes: 45.4, count: 2 }],
      [{ _id: '2026-10-24', ml: 1750.2 }]
    );

    assert.deepEqual(rows[0], {
      date: '2026-10-23',
      food: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
      activity: { burnedKcal: 0, minutes: 0, count: 0 },
      waterMl: 0,
    });
    assert.equal(rows[1].food.calories, 812);
    assert.equal(rows[1].food.protein, 40.3);
    assert.equal(rows[1].food.meals, 3);
    assert.equal(rows[1].activity.burnedKcal, 301);
    assert.equal(rows[1].activity.count, 2);
    assert.equal(rows[1].waterMl, 1750);
  });

  it('ignores buckets that fall outside the requested days', () => {
    const rows = mergeRows(days, [{ _id: '2026-09-01', calories: 999, protein: 0, carbs: 0, fat: 0, meals: 1 }], [], []);
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.food.calories === 0));
  });
});

describe('aggregation pipelines', () => {
  const userId = '507f1f77bcf86cd799439011';

  it('scopes every pipeline to the requesting user and the timezone', () => {
    for (const build of [buildFoodPipeline, buildActivityPipeline, buildWaterPipeline]) {
      const [match, group] = build(userId, '2026-10-01', '2026-10-31', 'Asia/Calcutta');
      assert.equal(match.$match.user, userId);
      assert.equal(group.$group._id.$dateToString.timezone, 'Asia/Calcutta');
      assert.equal(group.$group._id.$dateToString.format, '%Y-%m-%d');
    }
  });

  it('falls back to createdAt for logs without a date', () => {
    const [match] = buildFoodPipeline(userId, '2026-10-01', '2026-10-31', 'UTC');
    const hasCreatedAtFallback = match.$match.$or.some((c) => c.createdAt && c.date?.$exists === false);
    assert.equal(hasCreatedAtFallback, true);
  });
});
