// ── Strapi User ─────────────────────────────────────────────
export type User = {
  id: string;
  username: string;
  email: string;
  token: string;
  age?: number;
  weight?: number;
  height?: number;
  goal?: "lose" | "maintain" | "gain";
  dailycaloriesintake?: number;
  dailycaloriesburned?: number;
  createdAt?: string;
  updatedAt?: string;
} | null;

// ── Food Log entry ──
export type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  date: string;
};

// ── Activity Log entry ──
export type ActivityEntry = {
  id: string;
  name?: string;
  type?: string;
  duration: number;
  calories?: number;
  caloriesBurned?: number;
  date: string;
};

// ── Water Log entry ──
export type WaterEntry = {
  id: string;
  amount: number;  // ml
  date: string;
};

// ── Auth credentials ──
export type Credentials = {
  username?: string;
  email: string;
  password: string;
};

// ── App context initial state ──
export const initialState = {
  user: null as User,
  setUser: (_: any) => {},
  isUserFetched: false,
  fetchUser: async (_: string) => {},
  signup: async (_: Credentials) => {},
  login: async (_: Credentials) => {},
  googleLogin: async (_: string) => {},
  logout: () => {},
  onboardingCompleted: false,
  setOnboardingCompleted: (_: boolean) => {},
  allFoodLogs: [] as FoodEntry[],
  allActivityLogs: [] as ActivityEntry[],
  allWaterLogs: [] as WaterEntry[],
  setAllFoodLogs: (_: any) => {},
  setAllActivityLogs: (_: any) => {},
  setAllWaterLogs: (_: any) => {},
};
