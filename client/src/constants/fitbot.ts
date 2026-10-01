/**
 * FitBot AI Assistant Configuration & Constants
 * Unified single source of truth for FitBot naming, roles, taglines, and versioning.
 */

export const FITBOT_CONFIG = {
  NAME: "FitBot",
  ROLE: "AI Coach",
  TAGLINE: "Your personal AI fitness & nutrition coach",
  GREETING: "Hey, I'm FitBot!",
  DESCRIPTION:
    "Your personal AI fitness and nutrition coach. I adapt to your goals, calorie balance, and past workouts.",
  VERSION: "1.3.0",
} as const;

export default FITBOT_CONFIG;
