// ── Strapi User (field names must match schema.json exactly) ──
export type User = {
  id: string;
  username: string;
  email: string;
  token: string;

  // optional profile fields
  age?: number;
  weight?: number;
  height?: number;
  goal?: "lose" | "maintain" | "gain";

  // ⚠️ These MUST be lowercase — exact Strapi schema field names
  dailycaloriesintake?: number;   // schema: "dailycaloriesintake"
  dailycaloriesburned?: number;   // schema: "dailycaloriesburned"

  createdAt?: string;
  updatedAt?: string;
} | null;

// ── Food Log entry ──
export type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
  date: string;
};

// ── Activity Log entry ──
export type ActivityEntry = {
  id: string;
  name?: string;
  type?: string;
  duration: number;
  calories?: number;        // actual DB field name in Strapi
  caloriesBurned?: number;  // kept for local/optimistic entries
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
  setAllFoodLogs: (_: any) => {},
  setAllActivityLogs: (_: any) => {},
};
