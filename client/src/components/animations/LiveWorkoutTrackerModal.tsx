import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import toast from "react-hot-toast";
import WorkoutSetRow, { type SetData } from "./WorkoutSetRow";
import RestCountdownTimer from "./RestCountdownTimer";
import api from "../../configs/api";
import { useappcontext } from "../../Context/AppContext";
import type { ActivityEntry } from "../../assets/types";

const DRAFT_STORAGE_KEY = "fittrack_live_workout_draft";

interface LiveWorkoutTrackerModalProps {
  onClose: () => void;
  defaultExercise?: string;
}

const DEFAULT_SETS: SetData[] = [
  { id: "1", setNumber: 1, weight: 60, reps: 12, completed: false },
  { id: "2", setNumber: 2, weight: 60, reps: 10, completed: false },
  { id: "3", setNumber: 3, weight: 65, reps: 8, completed: false },
];

interface DraftState {
  exercise: string;
  sets: SetData[];
  startedAt: number;
}

export const LiveWorkoutTrackerModal = ({
  onClose,
  defaultExercise = "Barbell Bench Press",
}: LiveWorkoutTrackerModalProps) => {
  const { setAllActivityLogs } = useappcontext();
  const [exercise, setExercise] = useState(defaultExercise);
  const [sets, setSets] = useState<SetData[]>(DEFAULT_SETS);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restTimerKey, setRestTimerKey] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed: DraftState = JSON.parse(saved);
        if (parsed.exercise) setExercise(parsed.exercise);
        if (Array.isArray(parsed.sets) && parsed.sets.length > 0) setSets(parsed.sets);
        if (parsed.startedAt) setStartedAt(parsed.startedAt);
      }
    } catch {
      // Ignore corrupted draft
    }
  }, []);

  // Persist draft to localStorage on changes
  useEffect(() => {
    try {
      const draft: DraftState = {
        exercise,
        sets,
        startedAt,
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors
    }
  }, [exercise, sets, startedAt]);

  const completedCount = sets.filter((s) => s.completed).length;
  const isAllComplete = sets.length > 0 && completedCount === sets.length;

  const handleToggleComplete = (id: string, completed: boolean) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed } : s))
    );

    // If marked completed, trigger rest timer
    if (completed) {
      setShowRestTimer(true);
      setRestTimerKey((k) => k + 1);

      // Check if all sets completed
      const remainingIncomplete = sets.filter((s) => s.id !== id && !s.completed);
      if (remainingIncomplete.length === 0) {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#10b981", "#3b82f6", "#f59e0b"],
        });
      }
    }
  };

  const handleAddSet = () => {
    const nextNum = sets.length + 1;
    const lastSet = sets[sets.length - 1];
    const newSet: SetData = {
      id: `set-${Date.now()}`,
      setNumber: nextNum,
      weight: lastSet ? lastSet.weight : 50,
      reps: lastSet ? lastSet.reps : 10,
      completed: false,
    };
    setSets((prev) => [...prev, newSet]);
  };

  const handleDeleteSet = (id: string) => {
    setSets((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, setNumber: idx + 1 }))
    );
  };

  const handleUpdateSet = (
    id: string,
    fields: Partial<Pick<SetData, "reps" | "weight">>
  ) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...fields } : s))
    );
  };

  const handleFinishWorkout = async () => {
    if (completedCount === 0) {
      toast.error("Please complete at least one set before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const caloriesEstimate = Math.max(15, Math.round(elapsedMinutes * 6.5));

      const payload = {
        name: exercise.trim() || "Strength Workout",
        duration: elapsedMinutes,
        caloriesBurned: caloriesEstimate,
        type: "strength",
        intensity: "medium",
        source: "live-session",
        date: new Date().toISOString(),
        exercises: [
          {
            name: exercise.trim() || "Strength Workout",
            sets: sets.map((s) => ({
              setNumber: s.setNumber,
              weight: s.weight,
              reps: s.reps,
              completed: s.completed,
            })),
          },
        ],
      };

      const res = await api.post("/api/activitylogs", { data: payload });
      if (res.data) {
        setAllActivityLogs?.((prev: ActivityEntry[]) => [res.data, ...(prev || [])]);
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      toast.success("Workout session logged successfully!");
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save workout session";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    toast("Draft cleared", { icon: "🗑️" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 16px))" }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏋️</span>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Live Workout Tracker
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Draft auto-saved · Real-time rest intervals
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
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
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              Completed Sets:
            </span>
            <span className="font-bold text-emerald-500 font-mono text-sm">
              {completedCount} / {sets.length}
            </span>
          </div>

          {/* Sets List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
              <span>Set & Specs</span>
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
            className="w-full min-h-[44px] py-2.5 border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 text-slate-600 dark:text-slate-300 hover:text-emerald-500 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>+ Add Next Set</span>
          </motion.button>

          {/* Rest Countdown Timer */}
          {showRestTimer && (
            <div className="mt-4">
              <RestCountdownTimer
                key={restTimerKey}
                initialSeconds={60}
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

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDiscard}
            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
          >
            Discard
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            disabled={isSubmitting || completedCount === 0}
            onClick={handleFinishWorkout}
            className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              completedCount > 0 && !isSubmitting
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25 active:scale-95"
                : "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60"
            }`}
          >
            {isSubmitting ? "Logging..." : "Finish & Log Session"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default LiveWorkoutTrackerModal;
