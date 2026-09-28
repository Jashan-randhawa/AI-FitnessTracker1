import { describe, it, expect } from 'vitest';
import {
  toggleSetState,
  appendNextSet,
  removeSet,
  updateSet,
  calculateVolume,
} from '../src/useWorkoutSession';
import { SetData } from '../src/types';

describe('react-workout-tracker: workout session logic', () => {
  const sampleSets: SetData[] = [
    { id: '1', setNumber: 1, weight: 60, reps: 10, completed: false },
    { id: '2', setNumber: 2, weight: 60, reps: 10, completed: false },
    { id: '3', setNumber: 3, weight: 70, reps: 8, completed: false },
  ];

  it('toggles set completion status', () => {
    const updated = toggleSetState(sampleSets, '2', true);
    expect(updated[1].completed).toBe(true);
    expect(updated[0].completed).toBe(false);

    const toggledOff = toggleSetState(updated, '2', false);
    expect(toggledOff[1].completed).toBe(false);
  });

  it('appends a new set matching previous weight and reps', () => {
    const next = appendNextSet(sampleSets);
    expect(next.length).toBe(4);
    expect(next[3].setNumber).toBe(4);
    expect(next[3].weight).toBe(70);
    expect(next[3].reps).toBe(8);
    expect(next[3].completed).toBe(false);
  });

  it('removes a set and correctly reindexes remaining sets', () => {
    const removed = removeSet(sampleSets, '2');
    expect(removed.length).toBe(2);
    expect(removed[0].id).toBe('1');
    expect(removed[0].setNumber).toBe(1);
    expect(removed[1].id).toBe('3');
    expect(removed[1].setNumber).toBe(2);
  });

  it('updates weight or reps on a set', () => {
    const updated = updateSet(sampleSets, '1', { weight: 65, reps: 12 });
    expect(updated[0].weight).toBe(65);
    expect(updated[0].reps).toBe(12);
    // Other sets unchanged
    expect(updated[1].weight).toBe(60);
  });

  it('calculates total volume for completed sets only', () => {
    // None completed yet
    expect(calculateVolume(sampleSets)).toBe(0);

    // Complete set 1 (60 * 10 = 600) and set 3 (70 * 8 = 560) => 1160 kg
    const completedSets = toggleSetState(
      toggleSetState(sampleSets, '1', true),
      '3',
      true
    );
    expect(calculateVolume(completedSets)).toBe(1160);
  });
});
