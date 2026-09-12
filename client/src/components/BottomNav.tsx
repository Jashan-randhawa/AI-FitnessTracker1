import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Utensils,
  Activity,
  Dumbbell,
  Sparkles,
} from "lucide-react";

interface TabItem {
  path: string;
  label: string;
  icon: typeof Home;
}

const tabs: TabItem[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/food", label: "Food", icon: Utensils },
  { path: "/activity", label: "Activity", icon: Activity },
  { path: "/workouts", label: "Workouts", icon: Dumbbell },
  { path: "/ai-assistant", label: "AI Coach", icon: Sparkles },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.3)] safe-area-pb"
    >
      <div className="grid grid-cols-5 h-15 max-w-md mx-auto items-center px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.path}
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center py-1 relative cursor-pointer select-none group"
            >
              {/* Active pill indicator */}
              {active && (
                <motion.span
                  layoutId="activeBottomTab"
                  className="absolute -top-1 w-8 h-1 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}

              <div
                className={`p-1 rounded-xl transition-all duration-150 ${
                  active
                    ? "text-emerald-600 dark:text-emerald-400 scale-110"
                    : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.8} />
              </div>

              <span
                className={`text-[10px] tracking-tight transition-all duration-150 ${
                  active
                    ? "font-bold text-emerald-600 dark:text-emerald-400"
                    : "font-medium text-slate-500 dark:text-slate-400"
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
