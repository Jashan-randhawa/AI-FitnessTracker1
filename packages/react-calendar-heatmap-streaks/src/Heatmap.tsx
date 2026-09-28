import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HeatmapProps,
  CalendarHeatmapProps,
  DayData,
  HeatmapTheme,
  ThemeColors,
} from './types';
import { computeStreaks, toLocalDateKey } from './streaks';

const THEME_MAP: Record<HeatmapTheme, ThemeColors> = {
  emerald: {
    0: 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700',
    1: 'bg-emerald-200 dark:bg-emerald-950/70 text-emerald-900 border-emerald-300 dark:border-emerald-800',
    2: 'bg-emerald-400 dark:bg-emerald-800/80 text-emerald-950',
    3: 'bg-emerald-500 dark:bg-emerald-600 text-white',
    4: 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs shadow-emerald-500/30',
    accent: 'text-emerald-500 dark:text-emerald-400',
    border: 'border-emerald-500',
    ring: 'ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900',
  },
  orange: {
    0: 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700',
    1: 'bg-orange-200 dark:bg-orange-950/70 text-orange-900 border-orange-300 dark:border-orange-800',
    2: 'bg-orange-400 dark:bg-orange-800/80 text-orange-950',
    3: 'bg-orange-500 dark:bg-orange-600 text-white',
    4: 'bg-orange-600 dark:bg-orange-500 text-white shadow-xs shadow-orange-500/30',
    accent: 'text-orange-500 dark:text-orange-400',
    border: 'border-orange-500',
    ring: 'ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-slate-900',
  },
  blue: {
    0: 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700',
    1: 'bg-blue-200 dark:bg-blue-950/70 text-blue-900 border-blue-300 dark:border-blue-800',
    2: 'bg-blue-400 dark:bg-blue-800/80 text-blue-950',
    3: 'bg-blue-500 dark:bg-blue-600 text-white',
    4: 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs shadow-blue-500/30',
    accent: 'text-blue-500 dark:text-blue-400',
    border: 'border-blue-500',
    ring: 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900',
  },
  purple: {
    0: 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700',
    1: 'bg-purple-200 dark:bg-purple-950/70 text-purple-900 border-purple-300 dark:border-purple-800',
    2: 'bg-purple-400 dark:bg-purple-800/80 text-purple-950',
    3: 'bg-purple-500 dark:bg-purple-600 text-white',
    4: 'bg-purple-600 dark:bg-purple-500 text-white shadow-xs shadow-purple-500/30',
    accent: 'text-purple-500 dark:text-purple-400',
    border: 'border-purple-500',
    ring: 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-slate-900',
  },
  slate: {
    0: 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700',
    1: 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100',
    2: 'bg-slate-400 dark:bg-slate-600 text-slate-900 dark:text-white',
    3: 'bg-slate-600 dark:bg-slate-500 text-white',
    4: 'bg-slate-800 dark:bg-slate-300 text-white dark:text-slate-900',
    accent: 'text-slate-600 dark:text-slate-300',
    border: 'border-slate-500',
    ring: 'ring-2 ring-slate-500 ring-offset-2 dark:ring-offset-slate-900',
  },
};

export function Heatmap<T>({
  data,
  getDate,
  getValue = () => 1,
  days = 84,
  thresholds = [0, 500, 1500, 2500],
  selectedDate,
  onSelectDate,
  theme = 'emerald',
  customTheme,
  title = 'Activity Heatmap',
  className = '',
  formatTooltip,
}: HeatmapProps<T>) {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);

  const colors = customTheme || THEME_MAP[theme] || THEME_MAP.emerald;

  // Aggregate day map & calculate streaks
  const { dayMap, currentStreak, bestStreak } = useMemo(() => {
    const map = new Map<string, { count: number; totalValue: number }>();
    const dateList: string[] = [];

    data.forEach((item) => {
      const rawDate = getDate(item);
      const key = toLocalDateKey(rawDate);
      if (!key) return;

      dateList.push(key);
      const prev = map.get(key) || { count: 0, totalValue: 0 };
      const val = getValue(item) || 0;

      map.set(key, {
        count: prev.count + 1,
        totalValue: prev.totalValue + val,
      });
    });

    const streakResult = computeStreaks(dateList);

    return {
      dayMap: map,
      currentStreak: streakResult.currentStreak,
      bestStreak: streakResult.bestStreak,
    };
  }, [data, getDate, getValue]);

  // Generate grid for requested number of days (default 84 days = 12 weeks)
  const dayList = useMemo(() => {
    const list: DayData[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = toLocalDateKey(d);
      const stats = dayMap.get(key) || { count: 0, totalValue: 0 };

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (stats.count > 0) {
        if (stats.totalValue > thresholds[3]) level = 4;
        else if (stats.totalValue > thresholds[2]) level = 3;
        else if (stats.totalValue > thresholds[1]) level = 2;
        else level = 1;
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
  }, [dayMap, days, thresholds]);

  const formattedSelected = selectedDate ? toLocalDateKey(selectedDate) : null;

  return (
    <div
      className={`bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 transition-colors ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </span>
          {currentStreak > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
              🔥 {currentStreak}d streak
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">Past {Math.round(days / 7)} weeks</span>
      </div>

      {/* Grid of days (7 rows x N columns) */}
      <div className="relative">
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
          {dayList.map((day) => {
            const isSelected = formattedSelected === day.dateStr;
            return (
              <button
                type="button"
                key={day.dateStr}
                onClick={() => onSelectDate?.(day.dateStr)}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`w-3.5 h-3.5 rounded-xs transition-all duration-150 cursor-pointer ${
                  colors[day.level]
                } ${isSelected ? colors.ring || 'ring-2 ring-emerald-500' : ''}`}
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
              {formatTooltip ? (
                formatTooltip(hoveredDay)
              ) : (
                <>
                  <span className="text-slate-300">
                    {hoveredDay.date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    :{' '}
                  </span>
                  <strong className="text-white">
                    {hoveredDay.count === 0
                      ? 'No activity'
                      : `${hoveredDay.totalValue.toLocaleString()} (${hoveredDay.count} ${
                          hoveredDay.count === 1 ? 'entry' : 'entries'
                        })`}
                  </strong>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend & Summary */}
      <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
        <span>Best: {bestStreak} days</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <span className={`w-2.5 h-2.5 rounded-xs ${colors[0]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colors[1]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colors[2]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colors[3]}`} />
          <span className={`w-2.5 h-2.5 rounded-xs ${colors[4]}`} />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Drop-in backwards-compatible CalendarHeatmap component matching FitTrack AI signature.
 */
export function CalendarHeatmap({
  logs,
  selectedDate,
  onSelectDate,
  colorTheme = 'emerald',
  type = 'food',
  className = '',
}: CalendarHeatmapProps) {
  const isFood = type === 'food';
  const thresholds: [number, number, number, number] = isFood
    ? [0, 800, 1500, 2200]
    : [0, 20, 40, 60];

  return (
    <Heatmap
      data={logs}
      getDate={(entry: any) => entry.date ?? entry.createdAt ?? new Date().toISOString()}
      getValue={(entry: any) =>
        isFood
          ? Number(entry.calories) || 0
          : Number(entry.duration) || Number(entry.caloriesBurned) || 0
      }
      thresholds={thresholds}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      theme={colorTheme}
      className={className}
      formatTooltip={(day) => (
        <>
          <span className="text-slate-300">
            {day.date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            :{' '}
          </span>
          <strong className="text-white">
            {day.count === 0
              ? 'No activity'
              : isFood
              ? `${day.totalValue.toLocaleString()} kcal (${day.count} ${
                  day.count === 1 ? 'entry' : 'entries'
                })`
              : `${day.totalValue} mins (${day.count} ${
                  day.count === 1 ? 'activity' : 'activities'
                })`}
          </strong>
        </>
      )}
    />
  );
}

export default CalendarHeatmap;
