import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsiblePlanCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  onSavePlan?: () => void;
  children: React.ReactNode;
}

export const CollapsiblePlanCard = ({
  title,
  subtitle,
  badge,
  defaultOpen = true,
  icon,
  onSavePlan,
  children,
}: CollapsiblePlanCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className="my-3 rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 overflow-hidden shadow-sm transition-shadow"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              {icon}
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 font-bold text-xs">
              ✦
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {title}
              </h4>
              {badge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="text-gray-400 dark:text-slate-500 shrink-0 ml-2"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="plan-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-700/50 p-3 sm:p-4 bg-slate-50/50 dark:bg-slate-900/30 text-gray-900 dark:text-slate-100"
          >
            {children}
            {onSavePlan && (
              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Preview and save this routine to your active profile workouts.
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSavePlan();
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                >
                  <span>💾</span> Save Workout Plan
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsiblePlanCard;
