// ── User ────────────────────────────────────────────────────
export type User = {
  id: string;
  username: string;
  email: string;
  token: string;
  provider?: string;
  hasPassword?: boolean;
  googleLinked?: boolean;
  emailVerified?: boolean;
  age?: number;
  weight?: number;
  height?: number;
  gender?: "male" | "female" | "other" | string;
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "very_active" | string;
  goal?: "lose" | "maintain" | "gain";
  dailycaloriesintake?: number;
  dailycaloriesburned?: number;
  dailyproteingoal?: number;
  dailycarbsgoal?: number;
  dailyfatgoal?: number;
  dailywatergoal?: number;
  dietaryRestrictions?: string[];
  dietStyle?: string;
  preferredCuisine?: string;
  customDietaryNotes?: string;
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
  createdAt?: string;
  aiGenerated?: boolean;
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
  intensity?: "low" | "medium" | "high";
  source?: "manual" | "planner" | "live-session" | "quick-log";
  planId?: string | null;
  planDay?: string | null;
  exercises?: Array<{
    name: string;
    sets: Array<{
      setNumber: number;
      weight: number;
      reps: number;
      completed: boolean;
      rpe?: number;
    }>;
  }>;
};

// ── Water Log entry ──
export type WaterEntry = {
  id: string;
  amount: number;  // ml
  date: string;
};

// ── Weight Log entry ──
export type WeightEntry = {
  id: string;
  weightKg: number;
  date: string;
  localDay?: string;
  notes?: string;
  source?: string;
};

// ── Auth credentials ──
export type Credentials = {
  username?: string;
  email: string;
  password: string;
};

// ── App context initial state & interface ──
export type AppContextType = {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  isUserFetched: boolean;
  fetchUser: (token: string, retries?: number) => Promise<void>;
  signup: (credentials: Credentials) => Promise<void>;
  login: (credentials: Credentials) => Promise<void>;
  googleLogin: (googleAccessToken: string) => Promise<void>;
  logout: () => void;
  onboardingCompleted: boolean;
  setOnboardingCompleted: React.Dispatch<React.SetStateAction<boolean>>;
  allFoodLogs: FoodEntry[];
  allActivityLogs: ActivityEntry[];
  allWaterLogs: WaterEntry[];
  setAllFoodLogs: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  setAllActivityLogs: React.Dispatch<React.SetStateAction<ActivityEntry[]>>;
  setAllWaterLogs: React.Dispatch<React.SetStateAction<WaterEntry[]>>;
  setSessionToken: (jwt: string, updatedUser?: Partial<NonNullable<User>>) => void;
};

export const initialState: AppContextType = {
  user: null,
  setUser: () => {},
  isUserFetched: false,
  fetchUser: async () => {},
  signup: async () => {},
  login: async () => {},
  googleLogin: async () => {},
  logout: () => {},
  onboardingCompleted: false,
  setOnboardingCompleted: () => {},
  allFoodLogs: [],
  allActivityLogs: [],
  allWaterLogs: [],
  setAllFoodLogs: () => {},
  setAllActivityLogs: () => {},
  setAllWaterLogs: () => {},
  setSessionToken: () => {},
};
