export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
  burned: number;
  minutes: number;
  water: number;
  hasFood: boolean;
  hasActivity: boolean;
}

export interface LogDateEntry {
  date?: string | Date;
  createdAt?: string | Date;
  [key: string]: unknown;
}

export interface FoodLogItem extends LogDateEntry {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface ActivityLogItem extends LogDateEntry {
  calories?: number;
  caloriesBurned?: number;
  duration?: number;
}

export interface WaterLogItem extends LogDateEntry {
  amount?: number;
}

export const dateKey = (
  entry?: LogDateEntry | null,
  now: Date | string | number = Date.now()
): string => {
  const raw = entry?.date ?? entry?.createdAt ?? (now instanceof Date ? now.toISOString() : now);
  return new Date(raw as string | number | Date).toDateString();
};

const createEmptyDayTotals = (): DayTotals => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  meals: 0,
  burned: 0,
  minutes: 0,
  water: 0,
  hasFood: false,
  hasActivity: false,
});

export const buildDailyTotals = (
  foodLogs: FoodLogItem[] = [],
  activityLogs: ActivityLogItem[] = [],
  waterLogs: WaterLogItem[] = []
): Map<string, DayTotals> => {
  const map = new Map<string, DayTotals>();

  const getOrCreate = (key: string): DayTotals => {
    let day = map.get(key);
    if (!day) {
      day = createEmptyDayTotals();
      map.set(key, day);
    }
    return day;
  };

  for (const f of foodLogs) {
    if (!f) continue;
    const key = dateKey(f);
    const day = getOrCreate(key);
    day.calories += f.calories ?? 0;
    day.protein += f.protein ?? 0;
    day.carbs += f.carbs ?? 0;
    day.fat += f.fat ?? 0;
    day.meals += 1;
    day.hasFood = true;
  }

  for (const a of activityLogs) {
    if (!a) continue;
    const key = dateKey(a);
    const day = getOrCreate(key);
    day.burned += a.calories ?? a.caloriesBurned ?? 0;
    day.minutes += a.duration ?? 0;
    day.hasActivity = true;
  }

  for (const w of waterLogs) {
    if (!w) continue;
    const key = dateKey(w);
    const day = getOrCreate(key);
    day.water += w.amount ?? 0;
  }

  return map;
};

export const calcStreakFromMap = (
  map: Map<string, DayTotals>,
  today: string = new Date().toDateString()
): number => {
  const todayTotals = map.get(today);
  const todayHasData = Boolean(todayTotals && (todayTotals.hasFood || todayTotals.hasActivity));
  const d = new Date(today);
  d.setHours(12, 0, 0, 0);

  if (!todayHasData) {
    d.setDate(d.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const ds = d.toDateString();
    const day = map.get(ds);
    if (day && (day.hasFood || day.hasActivity)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};
