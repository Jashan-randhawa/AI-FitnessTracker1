import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Utensils,
  Check,
  Plus,
  Flame,
  Trash2,
  Copy,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";
import toast from "react-hot-toast";
import { generateStructuredMealPlan } from "../services/aiAssistantClient";
import type { Meal, DayPlan } from "../schemas/aiPlans.schema";
import type { FoodEntry } from "../assets/types";

// ── Options & Presets ──────────────────────────────────────────
const DAYS_OPTIONS = [1, 3, 5, 7];

const DIET_STYLES = [
  { id: "Balanced", label: "Balanced", icon: "⚖️", desc: "Equal macro balance for daily energy" },
  { id: "High Protein", label: "High Protein", icon: "💪", desc: "Muscle repair and satiety focus" },
  { id: "Low Carb", label: "Low Carb", icon: "🥑", desc: "Steady blood sugar and healthy fats" },
  { id: "Keto", label: "Keto", icon: "🧀", desc: "High fat, moderate protein, minimal carbs" },
  { id: "Mediterranean", label: "Mediterranean", icon: "🫒", desc: "Whole grains, fish, and olive oil" },
  { id: "Clean Eating", label: "Clean Eating", icon: "🥗", desc: "Unprocessed whole foods and greens" },
  { id: "Vegetarian", label: "Vegetarian", icon: "🌱", desc: "Plant-forward with eggs and dairy" },
  { id: "Vegan", label: "Vegan", icon: "🥬", desc: "100% plant-powered nutrition" },
];

const CUISINES = [
  "Any",
  "Mediterranean",
  "Asian",
  "American",
  "Indian",
  "Mexican",
  "Italian",
  "Middle Eastern",
  "Japanese",
];

const RESTRICTIONS = [
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Low Sodium",
  "High Fiber",
];

const MEAL_CONFIG: Record<
  string,
  { label: string; icon: string; color: string; bg: string; iconBg: string; border: string }
> = {
  breakfast: {
    label: "Breakfast",
    icon: "☕",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    iconBg: "bg-amber-500/20",
    border: "border-amber-500/30",
  },
  lunch: {
    label: "Lunch",
    icon: "🥪",
    color: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10",
    iconBg: "bg-orange-500/20",
    border: "border-orange-500/30",
  },
  dinner: {
    label: "Dinner",
    icon: "🌙",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/10",
    iconBg: "bg-blue-500/20",
    border: "border-blue-500/30",
  },
  snack: {
    label: "Snack",
    icon: "🍓",
    color: "text-pink-500 dark:text-pink-400",
    bg: "bg-pink-500/10",
    iconBg: "bg-pink-500/20",
    border: "border-pink-500/30",
  },
};

const STORAGE_KEY = "fittrack_saved_meal_plan";

export default function MealPlanner() {
  const { user, setAllFoodLogs } = useappcontext();

  // Settings
  const [days, setDays] = useState(7);
  const [dietStyle, setDietStyle] = useState("Balanced");
  const [cuisine, setCuisine] = useState("Any");
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [targetCalories, setTargetCalories] = useState<number>(user?.dailycaloriesintake || 2000);

  // Sync default target calories if user updates
  useEffect(() => {
    if (user?.dailycaloriesintake && targetCalories === 2000) {
      setTargetCalories(user.dailycaloriesintake);
    }
  }, [user?.dailycaloriesintake]);

  // Plan State
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing request...");
  const [activeDay, setActiveDay] = useState(0);
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set());
  const [batchLogging, setBatchLogging] = useState(false);

  // Restore saved meal plan from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPlan(parsed);
          setActiveDay(0);
        }
      }
    } catch {
      // Ignore parse failure
    }
  }, []);

  // Save to localStorage whenever plan updates
  useEffect(() => {
    if (plan.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        // LocalStorage quota safety
      }
    }
  }, [plan]);

  // Toggle restriction helper
  const toggleRestriction = (item: string) => {
    setSelectedRestrictions((prev) =>
      prev.includes(item) ? prev.filter((r) => r !== item) : [...prev, item]
    );
  };

  // Generate Plan Handler
  const generatePlan = async () => {
    setLoading(true);
    setLoadingStep("Consulting FitBot AI Nutrition Engine…");
    setLoggedMeals(new Set());

    try {
      const restrictionsText =
        selectedRestrictions.length > 0
          ? `\n- Dietary restrictions/allergies: ${selectedRestrictions.join(", ")}`
          : "";

      const prompt = `Generate a comprehensive ${days === 1 ? "single-day" : `${days}-day`} structured meal plan tailored for:
- User Goal: ${user?.goal || "maintain"} weight
- Target Calories: ${targetCalories} kcal/day
- Dietary Focus: ${dietStyle}
- Preferred Cuisine: ${cuisine}
- Body Weight: ${user?.weight || 70}kg${restrictionsText}

Return ONLY a valid JSON array of ${days} day object${days > 1 ? "s" : ""} (no markdown, no extra commentary):
[
  {
    "day": "Day 1",
    "meals": [
      { "name": "Avocado & Egg Toast", "calories": 420, "protein": 22, "carbs": 38, "fat": 18, "mealType": "breakfast", "description": "Poached eggs on toasted sourdough with smashed avocado" },
      { "name": "Mediterranean Quinoa Bowl", "calories": 540, "protein": 36, "carbs": 58, "fat": 16, "mealType": "lunch", "description": "Herb grilled chicken, cucumbers, kalamata olives, and feta" },
      { "name": "Baked Salmon with Roasted Vegetables", "calories": 590, "protein": 44, "carbs": 28, "fat": 24, "mealType": "dinner", "description": "Wild salmon fillet with asparagus, sweet potato, and olive oil" },
      { "name": "Greek Yogurt with Berries & Walnuts", "calories": 250, "protein": 18, "carbs": 20, "fat": 8, "mealType": "snack", "description": "Creamy low-fat yogurt with honey and raw walnuts" }
    ],
    "totalCalories": 1800
  }
]

Requirements:
- Each day must include 4 distinct meals: breakfast, lunch, dinner, snack.
- Total daily calories must be close to ${targetCalories} kcal (±10%).
- Ensure realistic, high-quality macro balances (protein, carbs, fat).
${days > 1 ? "- Never duplicate identical dishes across consecutive days." : "- Ensure vibrant variety across all 4 meals."}
- Respect the ${dietStyle} lifestyle and ${cuisine} cuisine preferences.`;

      const parsedPlan = await generateStructuredMealPlan(prompt);
      setPlan(parsedPlan);
      setActiveDay(0);
      toast.success(
        `Generated your ${parsedPlan.length === 1 ? "single-day" : `${parsedPlan.length}-day`} ${dietStyle} meal plan!`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate meal plan. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick Preset Helper
  const applyPreset = (
    presetDays: number,
    presetStyle: string,
    presetCuisine: string,
    calOffset: number
  ) => {
    setDays(presetDays);
    setDietStyle(presetStyle);
    setCuisine(presetCuisine);
    const newCal = Math.max(1200, (user?.dailycaloriesintake || 2000) + calOffset);
    setTargetCalories(newCal);
  };

  // Log single meal to FoodLog
  const logMeal = async (meal: Meal, dayIndex: number, mealIndex: number) => {
    const key = `${dayIndex}-${mealIndex}`;
    setLoggedMeals((prev) => new Set([...prev, key]));

    try {
      const { data: raw } = await api.post("/api/foodlogs", {
        data: {
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein || null,
          carbs: meal.carbs || null,
          fat: meal.fat || null,
          mealType: meal.mealType,
          date: new Date().toISOString(),
        },
      });

      const entry = (raw?.data || raw) as FoodEntry;
      if (entry) {
        setAllFoodLogs((prev: FoodEntry[]) => [entry, ...prev]);
      }
      toast.success(`Logged "${meal.name}" (${meal.calories} kcal)`);
    } catch {
      setLoggedMeals((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.error(`Failed to log "${meal.name}". Please try again.`);
    }
  };

  // Log all meals for the active day in one click
  const logAllMealsForDay = async (dayPlan: DayPlan, dayIndex: number) => {
    if (!dayPlan.meals || dayPlan.meals.length === 0) return;
    setBatchLogging(true);

    let count = 0;
    let failed = 0;

    for (let i = 0; i < dayPlan.meals.length; i++) {
      const key = `${dayIndex}-${i}`;
      if (loggedMeals.has(key)) continue;

      const meal = dayPlan.meals[i];
      setLoggedMeals((prev) => new Set([...prev, key]));

      try {
        const { data: raw } = await api.post("/api/foodlogs", {
          data: {
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein || null,
            carbs: meal.carbs || null,
            fat: meal.fat || null,
            mealType: meal.mealType,
            date: new Date().toISOString(),
          },
        });

        const entry = (raw?.data || raw) as FoodEntry;
        if (entry) {
          setAllFoodLogs((prev: FoodEntry[]) => [entry, ...prev]);
        }
        count++;
      } catch {
        setLoggedMeals((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        failed++;
      }
    }

    setBatchLogging(false);
    if (failed > 0) {
      toast.error(`${count} logged, ${failed} failed. Tap individual items to retry.`);
    } else if (count > 0) {
      toast.success(`All ${count} meals for ${dayPlan.day} logged to your food tracker!`);
    } else {
      toast("All meals for this day were already logged.");
    }
  };

  // Copy plan summary to clipboard
  const handleCopyPlan = () => {
    if (plan.length === 0) return;
    const text = plan
      .map(
        (d) =>
          `📅 ${d.day} (~${d.totalCalories} kcal)\n` +
          d.meals
            .map(
              (m) =>
                `  • [${m.mealType.toUpperCase()}] ${m.name} (${m.calories} kcal - P:${m.protein}g C:${m.carbs}g F:${m.fat}g)`
            )
            .join("\n")
      )
      .join("\n\n");

    navigator.clipboard.writeText(text);
    toast.success("Meal plan summary copied to clipboard!");
  };

  // Discard plan
  const handleDiscardPlan = () => {
    setPlan([]);
    setActiveDay(0);
    setLoggedMeals(new Set());
    localStorage.removeItem(STORAGE_KEY);
    toast("Meal plan cleared.");
  };

  const currentDay = plan[activeDay];

  // Calculate day totals
  const dayStats = useMemo(() => {
    if (!currentDay || !currentDay.meals) {
      return { totalCal: 0, totalP: 0, totalC: 0, totalF: 0 };
    }
    return currentDay.meals.reduce(
      (acc, m) => ({
        totalCal: acc.totalCal + (m.calories || 0),
        totalP: acc.totalP + (m.protein || 0),
        totalC: acc.totalC + (m.carbs || 0),
        totalF: acc.totalF + (m.fat || 0),
      }),
      { totalCal: 0, totalP: 0, totalC: 0, totalF: 0 }
    );
  }, [currentDay]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200 pb-20">
      {/* ── Page Hero Header ────────────────────────────────────── */}
      <div className="page-header-planner">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-teal-50 border border-white/20 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Smart Nutrition Planner</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🥗</span> AI Meal Planner
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/90 mt-1 max-w-xl">
              Personalized meal plans built for your goals, calorie budget, and dietary lifestyle.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15">
            <span className="text-[10px] text-teal-100/80 uppercase tracking-wider font-bold">
              Daily Target
            </span>
            <span className="text-xl font-black text-white">
              {targetCalories} <span className="text-xs font-normal text-teal-200">kcal</span>
            </span>
            <div className="flex items-center gap-2 text-[11px] text-teal-100/90 font-medium">
              <span>Goal: {user?.goal || "maintain"}</span>
              <span>•</span>
              <span>{user?.weight || 70} kg</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Plan Configuration Card ─────────────────────────────── */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <span>Customize Your Plan</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure your dietary style, target calories, and days.
              </p>
            </div>

            {plan.length > 0 && (
              <button
                type="button"
                onClick={handleDiscardPlan}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Plan</span>
              </button>
            )}
          </div>

          <div className="space-y-5">
            {/* 1. Duration */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Plan Duration
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      days === d
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{d === 1 ? "1 Day" : `${d} Days`}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Dietary Lifestyle */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Dietary Focus & Lifestyle
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DIET_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setDietStyle(style.id)}
                    className={`p-2.5 text-left rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      dietStyle === style.id
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className="text-base mb-1">{style.icon}</span>
                    <span className="text-xs font-bold leading-tight">{style.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                      {style.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Cuisine & Target Calories Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Cuisine Preference
                </label>
                <select
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="w-full py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>
                      {c === "Any" ? "🌐 Any Cuisine (Varied Global)" : c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Daily Calorie Target
                  </label>
                  <button
                    type="button"
                    onClick={() => setTargetCalories(user?.dailycaloriesintake || 2000)}
                    className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Reset ({user?.dailycaloriesintake || 2000} kcal)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetCalories((prev) => Math.max(1200, prev - 50))}
                    className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min={1200}
                      max={5000}
                      step={50}
                      value={targetCalories}
                      onChange={(e) => setTargetCalories(Number(e.target.value) || 2000)}
                      className="w-full py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-3 text-[11px] font-medium text-slate-400">
                      kcal
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargetCalories((prev) => Math.min(5000, prev + 50))}
                    className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Dietary Restrictions & Tags */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Allergies & Preferences (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {RESTRICTIONS.map((res) => {
                  const active = selectedRestrictions.includes(res);
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => toggleRestriction(res)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{res}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              onClick={generatePlan}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/25 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate {days === 1 ? "Single Day" : `${days}-Day`} {dietStyle} Plan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Plan Active Results Section ─────────────────────────── */}
        {plan.length > 0 ? (
          <div className="space-y-5">
            {/* Action Bar */}
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200">
                    Active Plan
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-200/60 dark:bg-emerald-800/50 text-emerald-900 dark:text-emerald-200">
                    {dietStyle} • {plan.length === 1 ? "1 Day" : `${plan.length} Days`}
                  </span>
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-1">
                  Each day includes 4 tailored meals meeting your ~{targetCalories} kcal goal.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => currentDay && logAllMealsForDay(currentDay, activeDay)}
                  disabled={batchLogging}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20"
                >
                  {batchLogging ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Logging Day…</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log All Meals Today</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyPlan}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  title="Copy Plan Summary"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Day Selector Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {plan.map((d, idx) => {
                const isActive = activeDay === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveDay(idx)}
                    className={`px-4 py-2.5 rounded-2xl whitespace-nowrap text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                      isActive
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md scale-102"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{d.day}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? "bg-white/20 dark:bg-slate-900/10 text-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {d.totalCalories} kcal
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Day Card */}
            {currentDay && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
                {/* Day Header & Macro Bar */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📅</span> {currentDay.day} Meal Breakdown
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Planned: {dayStats.totalCal} kcal • Target: {targetCalories} kcal
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Day Total
                        </span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {dayStats.totalCal} <span className="text-xs font-normal">kcal</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Macro Progress Grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                        Protein
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white">
                        {dayStats.totalP}g
                      </span>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                        Carbs
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white">
                        {dayStats.totalC}g
                      </span>
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                        Fat
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white">
                        {dayStats.totalF}g
                      </span>
                    </div>
                  </div>
                </div>

                {/* Meals List */}
                <div className="space-y-3.5">
                  {(currentDay.meals || []).map((meal, mIdx) => {
                    const key = `${activeDay}-${mIdx}`;
                    const isLogged = loggedMeals.has(key);
                    const cfg = MEAL_CONFIG[meal.mealType] || MEAL_CONFIG.snack;

                    return (
                      <motion.div
                        key={mIdx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: mIdx * 0.05 }}
                        className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-slate-50/50 dark:bg-slate-800/30"
                      >
                        <div className="flex items-start gap-3.5">
                          <span
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 border ${cfg.bg} ${cfg.border}`}
                          >
                            {cfg.icon}
                          </span>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {meal.name}
                              </h4>
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                              >
                                {cfg.label}
                              </span>
                            </div>

                            {meal.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                                {meal.description}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-xs pt-1">
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5" />
                                {meal.calories} kcal
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                P: {meal.protein}g
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                C: {meal.carbs}g
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                F: {meal.fat}g
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center sm:self-center">
                          <button
                            type="button"
                            onClick={() => logMeal(meal, activeDay, mIdx)}
                            disabled={isLogged}
                            className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              isLogged
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 cursor-default"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {isLogged ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Logged</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Log to Tracker</span>
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Empty State & Quick Inspo ──────────────────────────── */
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 text-center shadow-xs space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl mx-auto shadow-inner">
              🥗
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Ready for your tailored nutrition plan?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose your days and dietary lifestyle above, or click one of our popular smart
                presets to generate immediately:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
              <button
                type="button"
                onClick={() => applyPreset(7, "High Protein", "Any", +200)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>💪</span> High-Protein Muscle Builder
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  7 Days • High-protein balance for active training & recovery.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(5, "Mediterranean", "Mediterranean", 0)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🫒</span> Mediterranean Vitality
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  5 Days • Fresh greens, olive oil, lean seafood, and whole grains.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(3, "Low Carb", "Any", -200)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🥑</span> Clean Low-Carb Cut
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  3 Days • Healthy fats and lean proteins for a quick dietary reset.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(1, "Balanced", "Any", 0)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>⚡</span> Single-Day Quick Reset
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  1 Day • Balanced 4-meal nutrition blueprint ready for today.
                </p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
