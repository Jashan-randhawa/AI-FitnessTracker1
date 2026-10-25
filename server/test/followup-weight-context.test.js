process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-12345';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  WEIGHT_TREND_DAYS,
  WEIGHT_EVIDENCE_MIN_ENTRIES,
  weightTrendLine,
  buildFitnessContext,
  serializeFitnessContext,
} = require('../src/services/fitnessContext.service');
const { deriveGoals } = require('../src/utils/goals');

const ZERO_FOOD = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 };
const ZERO_ACTIVITY = { burnedKcal: 0, minutes: 0, count: 0 };

const newUser = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  goal: 'maintain',
  weight: 75,
  height: 178,
  age: 28,
  ...overrides,
});

const defaultLoaders = (overrides = {}) => ({
  computeDaySummary: async ({ user, date }) => ({
    timezone: 'UTC',
    date,
    isToday: true,
    goals: deriveGoals(user),
    food: ZERO_FOOD,
    activity: ZERO_ACTIVITY,
    waterMl: 0,
    streak: 0,
    lifetime: { foodCount: 0, activityCount: 0 },
    badges: [],
  }),
  computeRangeSummary: async ({ user, from, to }) => ({
    timezone: 'UTC',
    from,
    to,
    goals: deriveGoals(user),
    days: [{ date: from, food: ZERO_FOOD, activity: ZERO_ACTIVITY, waterMl: 0 }],
  }),
  findActivePlan: async () => null,
  findRecentWeightLogs: async () => [],
  ...overrides,
});

const FIXED_NOW = new Date('2026-10-25T10:00:00Z');

describe('Weight History in Shared Fitness Context (G9)', () => {
  it('exposes WEIGHT_TREND_DAYS = 30 and WEIGHT_EVIDENCE_MIN_ENTRIES = 3', () => {
    assert.equal(WEIGHT_TREND_DAYS, 30);
    assert.equal(WEIGHT_EVIDENCE_MIN_ENTRIES, 3);
  });

  it('omits weight trend line when no weight logs exist', async () => {
    const user = newUser();
    const ctx = await buildFitnessContext({
      user,
      timeZone: 'UTC',
      now: FIXED_NOW,
      deps: defaultLoaders({
        findRecentWeightLogs: async () => [],
      }),
    });

    assert.equal(ctx.weightTrend.status, 'none');
    assert.equal(ctx.weightTrend.evidence, false);

    const serialized = serializeFitnessContext(ctx);
    assert.ok(!serialized.text.includes('Weight trend'));
  });

  it('reports insufficient evidence when fewer than 3 entries exist', async () => {
    const user = newUser();
    const logs = [
      { weightKg: 73.5, date: new Date('2026-10-24T08:00:00Z') },
      { weightKg: 74.0, date: new Date('2026-10-20T08:00:00Z') },
    ];

    const ctx = await buildFitnessContext({
      user,
      timeZone: 'UTC',
      now: FIXED_NOW,
      deps: defaultLoaders({
        findRecentWeightLogs: async () => logs,
      }),
    });

    assert.equal(ctx.weightTrend.status, 'ok');
    assert.equal(ctx.weightTrend.entries, 2);
    assert.equal(ctx.weightTrend.evidence, false);

    const serialized = serializeFitnessContext(ctx);
    assert.ok(
      serialized.text.includes(
        'Weight trend (last 30 days): insufficient evidence (2 entries; need at least 3 to establish a trend).'
      )
    );
  });

  it('serializes trend with sufficient evidence when 3 or more entries exist', async () => {
    const user = newUser();
    const logs = [
      { weightKg: 72.5, date: new Date('2026-10-24T08:00:00Z') },
      { weightKg: 73.2, date: new Date('2026-10-18T08:00:00Z') },
      { weightKg: 74.5, date: new Date('2026-10-10T08:00:00Z') },
      { weightKg: 75.0, date: new Date('2026-10-02T08:00:00Z') },
    ];

    const ctx = await buildFitnessContext({
      user,
      timeZone: 'UTC',
      now: FIXED_NOW,
      deps: defaultLoaders({
        findRecentWeightLogs: async () => logs,
      }),
    });

    assert.equal(ctx.weightTrend.status, 'ok');
    assert.equal(ctx.weightTrend.entries, 4);
    assert.equal(ctx.weightTrend.latest, 72.5);
    assert.equal(ctx.weightTrend.oldest, 75.0);
    assert.equal(ctx.weightTrend.deltaKg, -2.5);
    assert.equal(ctx.weightTrend.evidence, true);

    const serialized = serializeFitnessContext(ctx);
    assert.ok(
      serialized.text.includes(
        'Weight trend (last 30 days): 75 kg to 72.5 kg (-2.5 kg across 4 entries). Evidence: sufficient.'
      )
    );
  });

  it('gracefully handles loader failure without crashing the whole context', async () => {
    const user = newUser();
    const ctx = await buildFitnessContext({
      user,
      timeZone: 'UTC',
      now: FIXED_NOW,
      deps: defaultLoaders({
        findRecentWeightLogs: async () => {
          throw new Error('Database connection failed');
        },
      }),
    });

    assert.equal(ctx.weightTrend.status, 'unavailable');
    const serialized = serializeFitnessContext(ctx);
    assert.ok(serialized.text.includes('Weight trend (last 30 days): unavailable.'));
  });

  it('correctly formats weightTrendLine for standalone helper calls', () => {
    assert.equal(weightTrendLine(null), null);
    assert.equal(weightTrendLine({ status: 'none' }), null);
    assert.equal(
      weightTrendLine({ status: 'unavailable' }),
      'Weight trend (last 30 days): unavailable.'
    );
    assert.equal(
      weightTrendLine({ status: 'ok', evidence: false, entries: 1 }),
      'Weight trend (last 30 days): insufficient evidence (1 entry; need at least 3 to establish a trend).'
    );
    assert.equal(
      weightTrendLine({
        status: 'ok',
        evidence: true,
        entries: 3,
        oldest: 80,
        latest: 82.3,
        deltaKg: 2.3,
      }),
      'Weight trend (last 30 days): 80 kg to 82.3 kg (+2.3 kg across 3 entries). Evidence: sufficient.'
    );
  });
});
