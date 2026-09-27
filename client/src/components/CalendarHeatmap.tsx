import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface CalendarHeatmapProps {
  logs: any[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  colorTheme?: "emerald" | "orange" | "blue";
  type?: "food" | "activity";
}

interface DayData {
  date: Date;
  dateStr: string;
  count: number;
  totalValue: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

export default function CalendarHeatmap({
  logs,
  selectedDate,
  onSelectDate,
  colorTheme = "emerald",
  type = "food",
}: CalendarHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  // Group logs by YYYY-MM-DD
  const { dayMap, currentStreak, bestStreak } = useMemo(() => {
    const map = new Map<string, { count: number; totalValue: number }>();

    logs.forEach((log) => {
      const d = new Date(resolveDate(log));
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().split("T")[0];
      const prev = map.get(key) || { count: 0, totalValue: 0 };

      let val = 0;
      if (type === "food") {
        val = Number(log.calories) || 0;
      } else {
        val = Number(log.duration) || Number(log.caloriesBurned) || 0;
      }

      map.set(key, {
        count: prev.count + 1,
        totalValue: prev.totalValue + val,
      });
    });

    // Calculate streaks over the past 365 days
    let streak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    const now = new Date();

    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      if (map.has(key)) {
        tempStreak++;
        if (i === 0 || i === 1) streak = tempStreak;
        if (tempStreak > maxStreak) maxStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }

    return { dayMap: map, currentStreak: streak, bestStreak: maxStreak };
  }, [logs, type]);

  // Generate grid for last 12 weeks (84 days)
  const days = useMemo(() => {
    const list: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = 84; // 12 weeks
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const stats = dayMap.get(key) || { count: 0, totalValue: 0 };

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (stats.count > 0) {
        if (type === "food") {
          if (stats.totalValue > 2200) level = 4;
          else if (stats.totalValue > 1500) level = 3;
          else if (stats.totalValue > 800) level = 2;
          else level = 1;
        } else {
          // activity (minutes)
          if (stats.totalValue >= 60) level = 4;
          else if (stats.totalValue >= 40) level = 3;
          else if (stats.totalValue >= 20) level = 2;
          else level = 1;
        }
      }

      list.push({
        date: d,
        dateStr: key,
        count: stats.count,
        totalValue: stats.totalValue,
        level,
      });
    }

    return list;
  }, [dayMap, type]);

  // Theme color maps
  const colorMap = {
    emerald: {
      0: "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700",
      1: "bg-emerald-200 dark:bg-emerald-950/70 text-emerald-900 border-emerald-300 dark:border-emerald-800",
      2: "bg-emerald-400 dark:bg-emerald-800/80 text-emerald-950",
      3: "bg-emerald-500 dark:bg-emerald-600 text-white",
      4: "bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs shadow-emerald-500/30",
      accent: "text-emerald-500 dark:text-emerald-400",
      border: "border-emerald-500",
      ring: "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900",
    },
    orange: {
      0: "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700",
      1: "bg-orange-200 dark:bg-orange-950/70 text-orange-900 border-orange-300 dark:border-orange-800",
      2: "bg-orange-400 dark:bg-orange-800/80 text-orange-950",
      3: "bg-orange-500 dark:bg-orange-600 text-white",
      4: "bg-orange-600 dark:bg-orange-500 text-white shadow-xs shadow-orange-500/30",
      accent: "text-orange-500 dark:text-orange-400",
      border: "border-orange-500",
      ring: "ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900",
    },
    blue: {
      0: "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700",
      1: "bg-blue-200 dark:bg-blue-950/70 text-blue-900 border-blue-300 dark:border-blue-800",
      2: "bg-blue-400 dark:bg-blue-800/80 text-blue-950",
      3: "bg-blue-500 dark:bg-blue-600 text-white",
      4: "bg-blue-600 dark:bg-blue-500 text-white shadow-xs shadow-blue-500/30",
      accent: "text-blue-500 dark:text-blue-400",
      border: "border-blue-500",
      ring: "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900",
    },
  }[colorTheme];

  const formattedSelected = selectedDate
    ? new Date(selectedDate).toISOString().split("T")[0]
    : null;

  return (
    <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Activity Heatmap
          </span>
          {currentStreak > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              🔥 {currentStreak}d streak
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">Past 12 weeks</span>
      </div>

      {/* Grid of days (7 rows x 12 columns) */}
      <div className="relative">
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
          {days.map((day) => {
            const isSelected = formattedSelected === day.dateStr;
            return (
              <button
                type="button"
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-3.5 h-3.5 rounded-xs transition-all duration-150 cursor-pointer ${
                  colorMap[day.level]
                } ${isSelected ? colorMap.ring : ""}`}
                aria-label={`${day.dateStr}: ${day.count} entries`}
              />
            );
          })}
        </div>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {hoveredDay && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute left-1/2 -bottom-9 -translate-x-1/2 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-900 text-white shadow-lg pointer-events-none whitespace-nowrap z-20 border border-slate-700"
            >
              <span className="text-slate-300">
                {hoveredDay.date.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                :
              </span>{" "}
              <strong className="text-white">
                {hoveredDay.count === 0
                  ? "No activity"
                  : type === "food"
                  ? `${hoveredDay.totalValue.toLocaleString()} kcal (${hoveredDay.count} ${
                      hoveredDay.count === 1 ? "entry" : "entries"
                    })`
                  : `${hoveredDay.totalValue} mins (${hoveredDay.count} ${
                      hoveredDay.count === 1 ? "activity" : "activities"
                    })`}
              </strong>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend & Summary */}
      <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
        <span>Best: {bestStreak} days</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <span className={`w-2.5 h-2.5 rounded-xs ${colorMap[0]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colorMap[1]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colorMap[2]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colorMap[3]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colorMap[4]}`} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
