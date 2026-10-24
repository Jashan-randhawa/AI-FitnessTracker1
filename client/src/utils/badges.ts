export interface BadgeDef {
  id: string;
  label: string;
  icon: string;
  desc: string;
  unit?: string;
  check: (f: any[], a: any[], streak: number) => boolean;
  progress: (f: any[], a: any[], streak: number) => { current: number; target: number };
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_log",
    label: "First Step",
    icon: "🥗",
    desc: "Logged your first meal",
    unit: "meal",
    check: (f) => f.length >= 1,
    progress: (f) => ({ current: Math.min(f.length, 1), target: 1 }),
  },
  {
    id: "streak_3",
    label: "3-Day Streak",
    icon: "🔥",
    desc: "Active 3 days in a row",
    unit: "days",
    check: (_f, _a, streak) => streak >= 3,
    progress: (_f, _a, streak) => ({ current: Math.min(streak, 3), target: 3 }),
  },
  {
    id: "streak_7",
    label: "Week Warrior",
    icon: "🏅",
    desc: "Active 7 days in a row",
    unit: "days",
    check: (_f, _a, streak) => streak >= 7,
    progress: (_f, _a, streak) => ({ current: Math.min(streak, 7), target: 7 }),
  },
  {
    id: "workouts_10",
    label: "10 Workouts",
    icon: "💪",
    desc: "Logged 10 activities",
    unit: "workouts",
    check: (_f, a) => a.length >= 10,
    progress: (_f, a) => ({ current: Math.min(a.length, 10), target: 10 }),
  },
  {
    id: "food_50",
    label: "Nutrition Pro",
    icon: "🥦",
    desc: "Logged 50 food entries",
    unit: "meals",
    check: (f) => f.length >= 50,
    progress: (f) => ({ current: Math.min(f.length, 50), target: 50 }),
  },
  {
    id: "workouts_25",
    label: "Fitness Fanatic",
    icon: "🏋️",
    desc: "Logged 25 activities",
    unit: "workouts",
    check: (_f, a) => a.length >= 25,
    progress: (_f, a) => ({ current: Math.min(a.length, 25), target: 25 }),
  },
  {
    id: "streak_30",
    label: "Monthly Master",
    icon: "🌟",
    desc: "Active 30 days in a row",
    unit: "days",
    check: (_f, _a, streak) => streak >= 30,
    progress: (_f, _a, streak) => ({ current: Math.min(streak, 30), target: 30 }),
  },
];
