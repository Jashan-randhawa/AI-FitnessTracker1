import { StreakOptions, StreakResult } from './types';

/**
 * Formats a Date or date string to a local "YYYY-MM-DD" key,
 * preventing UTC boundary shifting (e.g. 11:00 PM local time).
 */
export const toLocalDateKey = (dateInput: string | Date): string => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Computes current and best activity streaks from a list of dates or date strings.
 * Accurately tracks day-by-day continuity, including yesterday grace periods.
 */
export function computeStreaks(
  dates: (string | Date)[],
  options: StreakOptions = {}
): StreakResult {
  const { maxDays = 365, today = new Date() } = options;

  if (!dates || dates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, totalActiveDays: 0 };
  }

  const activeDates = new Set<string>();
  for (const dateItem of dates) {
    const key = toLocalDateKey(dateItem);
    if (key) activeDates.add(key);
  }

  if (activeDates.size === 0) {
    return { currentStreak: 0, bestStreak: 0, totalActiveDays: 0 };
  }

  const refDate = typeof today === 'string' ? new Date(today) : new Date(today);
  refDate.setHours(0, 0, 0, 0);

  let isCurrentStreakActive = false;
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  const todayKey = toLocalDateKey(refDate);

  // Walk backwards day-by-day from today
  for (let i = 0; i < maxDays; i++) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    const key = toLocalDateKey(d);

    if (activeDates.has(key)) {
      tempStreak++;

      if (i === 0) {
        isCurrentStreakActive = true;
      } else if (i === 1 && !activeDates.has(todayKey)) {
        // Active yesterday (grace period when today hasn't been logged yet)
        isCurrentStreakActive = true;
      }

      if (isCurrentStreakActive) {
        currentStreak++;
      }

      if (tempStreak > bestStreak) {
        bestStreak = tempStreak;
      }
    } else {
      if (i > 0) {
        isCurrentStreakActive = false;
      }
      tempStreak = 0;
    }
  }

  return {
    currentStreak,
    bestStreak,
    totalActiveDays: activeDates.size,
  };
}
