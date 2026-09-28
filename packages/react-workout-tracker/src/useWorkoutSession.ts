import { useState, useCallback, useMemo } from 'react';
import { SetData, UseWorkoutSessionOptions, WorkoutSessionSummary } from './types';

export const DEFAULT_INITIAL_SETS: SetData[] = [
  { id: '1', setNumber: 1, weight: 60, reps: 12, completed: false },
  { id: '2', setNumber: 2, weight: 60, reps: 10, completed: false },
  { id: '3', setNumber: 3, weight: 65, reps: 8, completed: false },
];

/**
 * Pure functions for state transitions & metric calculations.
 */
export const toggleSetState = (
  sets: SetData[],
  id: string,
  completed: boolean
): SetData[] => sets.map((s) => (s.id === id ? { ...s, completed } : s));

export const appendNextSet = (
  sets: SetData[],
  defaultWeight = 50,
  defaultReps = 10
): SetData[] => {
  const nextNum = sets.length + 1;
  const lastSet = sets[sets.length - 1];
  const newSet: SetData = {
    id: `set-${Date.now()}-${nextNum}`,
    setNumber: nextNum,
    weight: lastSet ? lastSet.weight : defaultWeight,
    reps: lastSet ? lastSet.reps : defaultReps,
    completed: false,
  };
  return [...sets, newSet];
};

export const removeSet = (sets: SetData[], id: string): SetData[] =>
  sets
    .filter((s) => s.id !== id)
    .map((s, idx) => ({ ...s, setNumber: idx + 1 }));

export const updateSet = (
  sets: SetData[],
  id: string,
  fields: Partial<Pick<SetData, 'reps' | 'weight'>>
): SetData[] => sets.map((s) => (s.id === id ? { ...s, ...fields } : s));

export const calculateVolume = (sets: SetData[]): number =>
  sets
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);

export function useWorkoutSession(options: UseWorkoutSessionOptions = {}) {
  const {
    initialExercise = 'Barbell Bench Press',
    initialSets = DEFAULT_INITIAL_SETS,
    defaultWeight = 50,
    defaultReps = 10,
    onAllCompleted,
  } = options;

  const [exercise, setExercise] = useState(initialExercise);
  const [sets, setSets] = useState<SetData[]>(initialSets);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);

  const completedCount = useMemo(
    () => sets.filter((s) => s.completed).length,
    [sets]
  );

  const isAllComplete = useMemo(
    () => sets.length > 0 && completedCount === sets.length,
    [sets.length, completedCount]
  );

  const totalVolumeKg = useMemo(() => calculateVolume(sets), [sets]);

  const handleToggleComplete = useCallback(
    (id: string, completed: boolean) => {
      setSets((prev) => {
        const nextSets = toggleSetState(prev, id, completed);

        if (completed) {
          setShowRestTimer(true);
          setRestTimerKey((k) => k + 1);

          const allDone = nextSets.length > 0 && nextSets.every((s) => s.completed);
          if (allDone && onAllCompleted) {
            const summary: WorkoutSessionSummary = {
              exercise,
              sets: nextSets,
              totalCompletedSets: nextSets.length,
              totalVolumeKg: calculateVolume(nextSets),
            };
            onAllCompleted(summary);
          }
        }

        return nextSets;
      });
    },
    [exercise, onAllCompleted]
  );

  const handleAddSet = useCallback(() => {
    setSets((prev) => appendNextSet(prev, defaultWeight, defaultReps));
  }, [defaultWeight, defaultReps]);

  const handleDeleteSet = useCallback((id: string) => {
    setSets((prev) => removeSet(prev, id));
  }, []);

  const handleUpdateSet = useCallback(
    (id: string, fields: Partial<Pick<SetData, 'reps' | 'weight'>>) => {
      setSets((prev) => updateSet(prev, id, fields));
    },
    []
  );

  const resetSession = useCallback(() => {
    setSets(initialSets);
    setShowRestTimer(false);
  }, [initialSets]);

  return {
    exercise,
    setExercise,
    sets,
    setSets,
    completedCount,
    isAllComplete,
    totalVolumeKg,
    showRestTimer,
    setShowRestTimer,
    restTimerKey,
    handleToggleComplete,
    handleAddSet,
    handleDeleteSet,
    handleUpdateSet,
    resetSession,
  };
}
