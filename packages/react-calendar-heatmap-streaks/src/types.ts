import React from 'react';

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  totalActiveDays: number;
}

export interface StreakOptions {
  /** The reference date to evaluate streaks relative to (default: today) */
  today?: Date | string;
  /** Max history window in days (default: 365) */
  maxDays?: number;
  /** Timezone for evaluating local calendar days (e.g. 'UTC', or local by default) */
  timeZone?: string;
}

export interface DayData {
  date: Date;
  dateStr: string;
  count: number;
  totalValue: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export type HeatmapTheme = 'emerald' | 'orange' | 'blue' | 'purple' | 'slate';

export interface ThemeColors {
  0: string;
  1: string;
  2: string;
  3: string;
  4: string;
  accent?: string;
  border?: string;
  ring?: string;
}

export interface HeatmapProps<T> {
  data: T[];
  getDate: (item: T) => string | Date;
  getValue?: (item: T) => number;
  days?: number;
  thresholds?: [number, number, number, number];
  selectedDate?: string | null;
  onSelectDate?: (dateStr: string) => void;
  theme?: HeatmapTheme;
  customTheme?: ThemeColors;
  title?: string;
  className?: string;
  formatTooltip?: (day: DayData) => React.ReactNode;
}

export interface CalendarHeatmapProps {
  logs: any[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  colorTheme?: 'emerald' | 'orange' | 'blue';
  type?: 'food' | 'activity';
  className?: string;
}
