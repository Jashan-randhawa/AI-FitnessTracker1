import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface SetData {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
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

  return (
    <motion.div
      layout
      animate={
        justToggled
          ? { scale: [1, 1.04, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-colors duration-500 ${
        set.completed
          ? "bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
          : "bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/50 text-gray-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      {/* Row Flash Overlay */}
      {justToggled && (
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
          className="absolute inset-0 bg-emerald-400/25 pointer-events-none rounded-xl"
        />
      )}

      {/* Set Number Badge */}
      <div className="flex items-center gap-3">
        <span
          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
            set.completed
              ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
              : "bg-slate-100 dark:bg-slate-700 text-gray-500 dark:text-slate-300"
          }`}
        >
          {set.setNumber}
        </span>

        {/* Inputs / Specs */}
        <div className="flex items-center gap-2 text-sm font-semibold">
          {onUpdate ? (
            <>
              <input
                type="number"
                value={set.weight}
                onChange={(e) => onUpdate(set.id, { weight: Number(e.target.value) || 0 })}
                disabled={set.completed}
                className="w-14 px-2 py-1 text-center text-sm font-bold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-gray-400 font-normal">kg ×</span>
              <input
                type="number"
                value={set.reps}
                onChange={(e) => onUpdate(set.id, { reps: Number(e.target.value) || 0 })}
                disabled={set.completed}
                className="w-12 px-2 py-1 text-center text-sm font-bold bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:border-emerald-500"
              />
              <span className="text-xs text-gray-400 font-normal">reps</span>
            </>
          ) : (
            <span>
              {set.weight} kg × {set.reps} reps
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons: Checkmark & Delete */}
      <div className="flex items-center gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(set.id)}
            className="w-7 h-7 rounded-lg text-gray-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer text-xs"
            title="Delete set"
          >
            ✕
          </button>
        )}

        {/* Tactile Animated SVG Checkmark */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.86 }}
          onClick={handleToggle}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
            set.completed
              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
              : "border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-400 text-transparent bg-slate-50/50 dark:bg-slate-800/40"
          }`}
        >
          <svg
            width="16"
            height="16"
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
