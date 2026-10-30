import { describe, it, expect } from 'vitest';
import { buildDailyTotals, dateKey } from '../utils/dailyTotals';

describe('dailyTotals unit tests', () => {
  it('computes correct dateKey from date or createdAt fields', () => {
    const entryWithDate = { date: '2026-10-30T10:00:00.000Z' };
    const key1 = dateKey(entryWithDate);
    expect(key1).toBe(new Date('2026-10-30T10:00:00.000Z').toDateString());

    const entryWithCreatedAt = { createdAt: '2026-10-29T14:30:00.000Z' };
    const key2 = dateKey(entryWithCreatedAt);
    expect(key2).toBe(new Date('2026-10-29T14:30:00.000Z').toDateString());
  });

  it('aggregates nutrition, activity, and water logs per day', () => {
    const day1Iso = '2026-10-30T08:00:00.000Z';
    const day2Iso = '2026-10-31T09:00:00.000Z';

    const foodLogs = [
      { date: day1Iso, calories: 500, protein: 30, carbs: 50, fat: 15 },
      { date: day1Iso, calories: 700, protein: 40, carbs: 70, fat: 20 },
      { date: day2Iso, calories: 400, protein: 25, carbs: 45, fat: 10 },
    ];

    const activityLogs = [
      { date: day1Iso, calories: 300, duration: 45 },
      { date: day2Iso, caloriesBurned: 200, duration: 30 },
    ];

    const waterLogs = [
      { date: day1Iso, amount: 1500 },
      { date: day1Iso, amount: 750 },
      { date: day2Iso, amount: 2000 },
    ];

    const totalsMap = buildDailyTotals(foodLogs, activityLogs, waterLogs);

    const day1Key = new Date(day1Iso).toDateString();
    const day2Key = new Date(day2Iso).toDateString();

    const day1Totals = totalsMap.get(day1Key);
    expect(day1Totals).toBeDefined();
    expect(day1Totals?.calories).toBe(1200);
    expect(day1Totals?.protein).toBe(70);
    expect(day1Totals?.carbs).toBe(120);
    expect(day1Totals?.fat).toBe(35);
    expect(day1Totals?.meals).toBe(2);
    expect(day1Totals?.burned).toBe(300);
    expect(day1Totals?.minutes).toBe(45);
    expect(day1Totals?.water).toBe(2250);
    expect(day1Totals?.hasFood).toBe(true);
    expect(day1Totals?.hasActivity).toBe(true);

    const day2Totals = totalsMap.get(day2Key);
    expect(day2Totals).toBeDefined();
    expect(day2Totals?.calories).toBe(400);
    expect(day2Totals?.burned).toBe(200);
    expect(day2Totals?.water).toBe(2000);
  });

  it('handles empty log arrays gracefully', () => {
    const totalsMap = buildDailyTotals([], [], []);
    expect(totalsMap.size).toBe(0);
  });
});
