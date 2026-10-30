import { describe, it, expect } from 'vitest';
import { withBadgeState, nextBadge, BADGE_META } from '../utils/badges';

describe('badges unit tests', () => {
  it('initializes badge views from server badge state', () => {
    const serverStates = [
      { id: 'first_log', earned: true, current: 1, target: 1 },
      { id: 'streak_3', earned: false, current: 2, target: 3 },
    ];

    const views = withBadgeState(serverStates);
    expect(views.length).toBe(BADGE_META.length);

    const firstLog = views.find((v) => v.id === 'first_log');
    expect(firstLog?.earned).toBe(true);
    expect(firstLog?.current).toBe(1);

    const streak3 = views.find((v) => v.id === 'streak_3');
    expect(streak3?.earned).toBe(false);
    expect(streak3?.current).toBe(2);
    expect(streak3?.target).toBe(3);

    // Unprovided badges should have default unearned state
    const streak7 = views.find((v) => v.id === 'streak_7');
    expect(streak7?.earned).toBe(false);
    expect(streak7?.current).toBe(0);
  });

  it('calculates the next closest badge towards completion', () => {
    const views = withBadgeState([
      { id: 'first_log', earned: true, current: 1, target: 1 },
      { id: 'streak_3', earned: false, current: 2, target: 3 }, // 66.7%
      { id: 'workouts_10', earned: false, current: 8, target: 10 }, // 80% -> closest!
    ]);

    const next = nextBadge(views);
    expect(next).not.toBeNull();
    expect(next?.badge.id).toBe('workouts_10');
    expect(next?.current).toBe(8);
    expect(next?.target).toBe(10);
    expect(next?.pct).toBe(80);
  });

  it('returns null when all badges are earned', () => {
    const allEarned = BADGE_META.map((m) => ({
      id: m.id,
      earned: true,
      current: 10,
      target: 10,
    }));

    const views = withBadgeState(allEarned);
    const next = nextBadge(views);
    expect(next).toBeNull();
  });
});
