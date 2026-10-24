/**
 * Achievement presentation. Whether a badge is earned, and its progress, come
 * from the server's day summary (single source of truth). This file only holds
 * labels, icons and units.
 */

export interface BadgeMeta {
  id: string;
  label: string;
  icon: string;
  desc: string;
  unit?: string;
}

export interface BadgeView extends BadgeMeta {
  earned: boolean;
  current: number;
  target: number;
}

export const BADGE_META: BadgeMeta[] = [
  { id: "first_log", label: "First Step", icon: "🥗", desc: "Logged your first meal", unit: "meal" },
  { id: "streak_3", label: "3-Day Streak", icon: "🔥", desc: "Active 3 days in a row", unit: "days" },
  { id: "streak_7", label: "Week Warrior", icon: "🏅", desc: "Active 7 days in a row", unit: "days" },
  { id: "workouts_10", label: "10 Workouts", icon: "💪", desc: "Logged 10 activities", unit: "workouts" },
  { id: "food_50", label: "Nutrition Pro", icon: "🥦", desc: "Logged 50 food entries", unit: "meals" },
  { id: "workouts_25", label: "Fitness Fanatic", icon: "🏋️", desc: "Logged 25 activities", unit: "workouts" },
  { id: "streak_30", label: "Monthly Master", icon: "🌟", desc: "Active 30 days in a row", unit: "days" },
];

/** Joins the server's badge state onto the presentation list, in display order. */
export const withBadgeState = (
  states: { id: string; earned: boolean; current: number; target: number }[] | undefined
): BadgeView[] =>
  BADGE_META.map((meta) => {
    const state = states?.find((s) => s.id === meta.id);
    return {
      ...meta,
      earned: state?.earned ?? false,
      current: state?.current ?? 0,
      target: state?.target ?? 1,
    };
  });

/** The unearned badge closest to completion, or null when all are earned. */
export const nextBadge = (views: BadgeView[]) => {
  const unearned = views.filter((b) => !b.earned);
  if (unearned.length === 0) return null;
  let best = unearned[0];
  let bestRatio = -1;
  for (const b of unearned) {
    const ratio = b.target > 0 ? b.current / b.target : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = b;
    }
  }
  const pct = Math.min(Math.round((best.current / best.target) * 100), 100);
  return { badge: best, current: best.current, target: best.target, pct };
};
