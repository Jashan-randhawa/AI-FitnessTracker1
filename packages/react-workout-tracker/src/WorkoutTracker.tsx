import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkoutTrackerProps } from './types';
import { useWorkoutSession } from './useWorkoutSession';
import { WorkoutSetRow } from './WorkoutSetRow';
import { RestCountdownTimer } from './RestCountdownTimer';

export const WorkoutTracker: React.FC<WorkoutTrackerProps> = ({
  exercises,
  defaultExercise = 'Barbell Bench Press',
  restSeconds = 60,
  onFinish,
  onClose,
  celebrate = true,
}) => {
  const initialName =
    typeof exercises === 'string'
      ? exercises
      : Array.isArray(exercises) && exercises.length > 0
      ? exercises[0].name
      : defaultExercise;

  const triggerCelebration = async () => {
    if (!celebrate) return;
    try {
      const g = typeof window !== 'undefined' ? (window as any) : {};
      const confettiFn =
        g.confetti ||
        (await (Function('return import("canvas-confetti")')() as Promise<any>))?.default;
      if (typeof confettiFn === 'function') {
        confettiFn({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#f59e0b'],
        });
      }
    } catch {
      // canvas-confetti optional
    }
  };

  const {
    exercise,
    setExercise,
    sets,
    completedCount,
    isAllComplete,
    showRestTimer,
    restTimerKey,
    handleToggleComplete,
    handleAddSet,
    handleDeleteSet,
    handleUpdateSet,
  } = useWorkoutSession({
    initialExercise: initialName,
    onAllCompleted: (summary) => {
      triggerCelebration();
      onFinish?.(summary);
    },
  });

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏋️</span>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Workout Set Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live sets, reps, weight & rest intervals
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Exercise Input */}
      <div>
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
          Exercise Name
        </label>
        <input
          type="text"
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
          placeholder="e.g. Barbell Squats"
        />
      </div>

      {/* Sets Progress Status */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Completed Sets:</span>
        <span className="font-bold text-emerald-500 font-mono">
          {completedCount} / {sets.length}
        </span>
      </div>

      {/* Sets List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
          <span>Set & Load</span>
          <span>Done</span>
        </div>
        <AnimatePresence initial={false}>
          {sets.map((s) => (
            <WorkoutSetRow
              key={s.id}
              set={s}
              onToggleComplete={handleToggleComplete}
              onDelete={sets.length > 1 ? handleDeleteSet : undefined}
              onUpdate={handleUpdateSet}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Add Set Button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={handleAddSet}
        className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
      >
        <span>+ Add Next Set</span>
      </motion.button>

      {/* Rest Countdown Timer */}
      {showRestTimer && (
        <div className="mt-4">
          <RestCountdownTimer
            key={restTimerKey}
            initialSeconds={restSeconds}
            autoStart={true}
            onFinish={() => {}}
          />
        </div>
      )}

      {isAllComplete && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            🎉 All sets completed! Outstanding work.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkoutTracker;
