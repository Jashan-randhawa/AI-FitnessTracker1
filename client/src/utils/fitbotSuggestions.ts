/**
 * Deterministic suggestion chip generator for FitBot (Phase B / G6).
 *
 * Rules:
 * - Uses server-computed day summary and fresh weather observation (if available).
 * - No AI model call or dynamic inference is needed.
 * - Caps suggestion chips at 6, falling back to BASE_SUGGESTIONS when data is missing or empty.
 */

import type { DaySummary } from "../data/summaryStore";
import type { EnvironmentPayload } from "./environmentPayload";

export const BASE_SUGGESTIONS = [
  "What should I eat before a workout?",
  "Create a 7-day meal plan for weight loss",
  "How many calories should I eat daily?",
  "Best exercises to build core strength",
  "How to stay motivated to exercise?",
  "What's a good post-workout meal?",
];

export interface PlanScheduledContext {
  planDayScheduled?: boolean;
  focus?: string;
  day?: string;
}

export const getFitBotSuggestions = (
  summary?: DaySummary | null,
  weather?: EnvironmentPayload | null,
  planContext?: PlanScheduledContext | boolean | null
): string[] => {
  const chips: string[] = [];
  const seen = new Set<string>();

  const addChip = (text: string) => {
    if (!seen.has(text) && chips.length < 6) {
      seen.add(text);
      chips.push(text);
    }
  };

  if (summary) {
    const { food, activity, waterMl, goals } = summary;

    // Rule 1: Weather conditions (rain, extreme heat, or poor air quality)
    if (weather) {
      const isRain =
        weather.condition === "rain" ||
        weather.condition === "drizzle" ||
        weather.condition === "thunderstorm" ||
        (weather.precipitationProbability !== undefined && weather.precipitationProbability >= 60);
      const isExtremeHeat = weather.temperatureC !== undefined && weather.temperatureC >= 35;
      const isBadAir = weather.aqi !== undefined && weather.aqi > 150;

      if (isRain || isExtremeHeat || isBadAir) {
        addChip("Indoor workout for today");
      }
    }

    // Rule 2: Meals logged today
    if (food.meals === 0) {
      addChip("What's a healthy breakfast idea?");
    }

    // Rule 3: Remaining calories
    const remainingCalories = goals.calorieLimit - food.calories;
    if (food.meals > 0 && remainingCalories >= 350) {
      addChip("Dinner ideas for my remaining calories");
    } else if (remainingCalories <= 0) {
      addChip("How to balance calories after going over target?");
    }

    // Rule 4: Hydration deficit
    if (goals.waterGoal > 0 && waterMl < goals.waterGoal) {
      addChip("How do I hit my water goal?");
    }

    // Rule 5: Activity logged
    if (activity.count === 0) {
      addChip("Suggest a quick 20-minute workout");
    } else if (goals.calorieBurnGoal > 0 && activity.burnedKcal >= goals.calorieBurnGoal) {
      addChip("Post-workout recovery and stretching tips");
    }

    // Rule 6: Scheduled workout plan day (Phase G / N7)
    const isPlanScheduled =
      typeof planContext === "boolean"
        ? planContext
        : Boolean(planContext?.planDayScheduled);
    const planFocus = typeof planContext === "object" ? planContext?.focus : undefined;

    if (isPlanScheduled) {
      addChip(
        planFocus
          ? `Tips for today's ${planFocus} workout`
          : "Tips for today's scheduled workout"
      );
    }
  }

  // Fallback to BASE_SUGGESTIONS up to 6 chips
  for (const fallback of BASE_SUGGESTIONS) {
    if (chips.length >= 6) break;
    addChip(fallback);
  }

  return chips.slice(0, 6);
};
