import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface SetData {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  rpe?: number;
}

interface WorkoutSetRowProps {
  set: SetData;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, fields: Partial<Pick<SetData, "reps" | "weight">>) => void;
}

export const WorkoutSetRow = ({
  set,
  onToggleComplete,
  onDelete,
  onUpdate,
}: WorkoutSetRowProps) => {
  const [justToggled, setJustToggled] = useState(false);

  const handleToggle = () => {
    const nextState = !set.completed;
    if (nextState) {
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 700);
    }
    onToggleComplete(set.id, nextState);
  };

  const adjustWeight = (delta: number) => {
    if (!onUpdate || set.completed) return;
    const next = Math.max(0, Math.round((set.weight + delta) * 10) / 10);
    onUpdate(set.id, { weight: next });
  };

  const adjustReps = (delta: number) => {
    if (!onUpdate || set.completed) return;
    const next = Math.max(1, set.reps + delta);
    onUpdate(set.id, { reps: next });
  };

  return (
    <motion.div
      layout
      animate={
        justToggled
          ? { scale: [1, 1.03, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 rounded-2xl border transition-colors duration-300 ${
        set.completed
          ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/35 text-emerald-950 dark:text-emerald-100"
          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-gray-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600 shadow-sm"
      }`}
    >
      {/* Row Flash Overlay */}
      {justToggled && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="absolute inset-0 bg-emerald-400/20 pointer-events-none rounded-2xl"
        />
      )}

      {/* Set Number & Spec Inputs */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
        <span
          className={`w-7 h-7 rounded-xl text-xs font-black flex items-center justify-center transition-colors shrink-0 ${
            set.completed
              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
              : "bg-slate-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
          }`}
        >
          {set.setNumber}
        </span>

        {/* Weight Stepper */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
          {onUpdate && !set.completed && (
            <button
              type="button"
              onClick={() => adjustWeight(-2.5)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer select-none"
              title="-2.5 kg"
            >
              -
            </button>
          )}
          <input
            type="number"
            step="0.5"
            value={set.weight}
            onChange={(e) => onUpdate && onUpdate(set.id, { weight: Number(e.target.value) || 0 })}
            disabled={set.completed}
            className="w-12 text-center text-xs sm:text-sm font-bold bg-transparent border-0 focus:outline-none"
          />
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium pr-1">kg</span>
          {onUpdate && !set.completed && (
            <button
              type="button"
              onClick={() => adjustWeight(2.5)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer select-none"
              title="+2.5 kg"
            >
              +
            </button>
          )}
        </div>

        <span className="text-slate-400 font-bold text-xs select-none">×</span>

        {/* Reps Stepper */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
          {onUpdate && !set.completed && (
            <button
              type="button"
              onClick={() => adjustReps(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer select-none"
              title="-1 rep"
            >
              -
            </button>
          )}
          <input
            type="number"
            value={set.reps}
            onChange={(e) => onUpdate && onUpdate(set.id, { reps: Number(e.target.value) || 0 })}
            disabled={set.completed}
            className="w-10 text-center text-xs sm:text-sm font-bold bg-transparent border-0 focus:outline-none"
          />
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium pr-1">reps</span>
          {onUpdate && !set.completed && (
            <button
              type="button"
              onClick={() => adjustReps(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer select-none"
              title="+1 rep"
            >
              +
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons: Delete & 44px Checkmark */}
      <div className="flex items-center gap-2 ml-auto">
        {onDelete && !set.completed && (
          <button
            type="button"
            onClick={() => onDelete(set.id)}
            className="min-w-[36px] min-h-[36px] sm:w-8 sm:h-8 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer text-xs"
            title="Delete set"
            aria-label="Delete set"
          >
            ✕
          </button>
        )}

        {/* 44px Tactile Animated SVG Checkmark */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.88 }}
          onClick={handleToggle}
          aria-label={set.completed ? "Mark set incomplete" : "Complete set"}
          className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            set.completed
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
              : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 text-transparent bg-slate-50/50 dark:bg-slate-800/40"
          }`}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <AnimatePresence>
              {set.completed && (
                <motion.polyline
                  points="20 6 9 17 4 12"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  exit={{ pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default WorkoutSetRow;
