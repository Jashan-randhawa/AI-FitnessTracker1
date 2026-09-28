import { describe, it, expect } from 'vitest';
import { computeStreaks, toLocalDateKey } from '../src/streaks';

describe('react-calendar-heatmap-streaks: computeStreaks', () => {
  it('returns zeroes for empty data', () => {
    const res = computeStreaks([]);
    expect(res).toEqual({
      currentStreak: 0,
      bestStreak: 0,
      totalActiveDays: 0,
    });
  });

  it('correctly handles a single day today', () => {
    const today = new Date('2026-06-15T12:00:00');
    const res = computeStreaks(['2026-06-15'], { today });
    expect(res.currentStreak).toBe(1);
    expect(res.bestStreak).toBe(1);
    expect(res.totalActiveDays).toBe(1);
  });

  it('correctly handles a single day yesterday (grace period)', () => {
    const today = new Date('2026-06-15T12:00:00');
    const res = computeStreaks(['2026-06-14'], { today });
    expect(res.currentStreak).toBe(1);
    expect(res.bestStreak).toBe(1);
    expect(res.totalActiveDays).toBe(1);
  });

  it('returns currentStreak 0 for older single day but retains bestStreak', () => {
    const today = new Date('2026-06-15T12:00:00');
    const res = computeStreaks(['2026-06-10'], { today });
    expect(res.currentStreak).toBe(0);
    expect(res.bestStreak).toBe(1);
    expect(res.totalActiveDays).toBe(1);
  });

  it('calculates streaks across month boundaries and leap days', () => {
    const today = new Date('2024-03-02T10:00:00'); // 2024 is leap year
    const dates = [
      '2024-02-27',
      '2024-02-28',
      '2024-02-29', // Leap day
      '2024-03-01',
      '2024-03-02',
    ];
    const res = computeStreaks(dates, { today });
    expect(res.currentStreak).toBe(5);
    expect(res.bestStreak).toBe(5);
    expect(res.totalActiveDays).toBe(5);
  });

  it('correctly handles streak gaps and tracks best streak history', () => {
    const today = new Date('2026-06-20T10:00:00');
    const dates = [
      // Older 5-day streak
      '2026-06-01',
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      // Gap on 06-06 to 06-17
      // Current 3-day streak
      '2026-06-18',
      '2026-06-19',
      '2026-06-20',
    ];
    const res = computeStreaks(dates, { today });
    expect(res.currentStreak).toBe(3);
    expect(res.bestStreak).toBe(5);
    expect(res.totalActiveDays).toBe(8);
  });

  it('groups 11:00 PM local date timestamps safely into the local date', () => {
    // 11 PM local
    const localLateNight = new Date(2026, 5, 10, 23, 15, 0); // June 10, 2026 23:15
    const key = toLocalDateKey(localLateNight);
    expect(key).toBe('2026-06-10');
  });
});
