import type { DayTotals } from "./dailyTotals";
import type { DayRow } from "../data/summaryStore";
import { keyToDateString } from "./localDay";

/**
 * Converts server day rows into the DayTotals shape the Dashboard already
 * uses, keyed by toDateString() so existing lookups keep working.
 */
export const summaryRowsToTotals = (rows: DayRow[]): Map<string, DayTotals> => {
  const map = new Map<string, DayTotals>();
  for (const row of rows) {
    map.set(keyToDateString(row.date), {
      calories: row.food.calories,
      protein: row.food.protein,
      carbs: row.food.carbs,
      fat: row.food.fat,
      meals: row.food.meals,
      burned: row.activity.burnedKcal,
      minutes: row.activity.minutes,
      water: row.waterMl,
      hasFood: row.food.meals > 0,
      hasActivity: row.activity.count > 0,
    });
  }
  return map;
};
