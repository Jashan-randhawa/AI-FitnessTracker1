import { useState } from "react";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";
import toast from "react-hot-toast";
import { generateStructuredMealPlan } from "../services/aiAssistantClient";
import type { Meal, DayPlan } from "../schemas/aiPlans.schema";

const CUISINES = ["Any", "Mediterranean", "Asian", "American", "Indian", "Mexican", "Italian"];
const DAYS_OPTIONS = [3, 5, 7];

const MEAL_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  breakfast: { bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40", text: "text-amber-600 dark:text-amber-400", icon: "☕" },
  lunch:     { bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40", text: "text-orange-600 dark:text-orange-400", icon: "🥪" },
  dinner:    { bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40",   text: "text-blue-600 dark:text-blue-400",   icon: "🌙" },
  snack:     { bg: "bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800/40",   text: "text-pink-600 dark:text-pink-400",   icon: "🍓" },
};

export default function MealPlanner() {
  const { user, setAllFoodLogs } = useappcontext();
  const [days, setDays] = useState(7);
  const [cuisine, setCuisine] = useState("Any");
  const [plan, setPlan] = useState<DayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set());
  const [activeDay, setActiveDay] = useState(0);

  const calorieTarget = user?.dailycaloriesintake ?? 2000;

  const generatePlan = async () => {
    setLoading(true);
    setPlan([]);
    setLoggedMeals(new Set());
    try {
      const prompt = `Generate a ${days}-day meal plan for someone with the following profile:
- Goal: ${user?.goal ?? "maintain"} weight
- Daily calorie target: ${calorieTarget} kcal
- Preferred cuisine: ${cuisine}
- Weight: ${user?.weight ?? 70}kg

Return ONLY a valid JSON array (no markdown, no text outside JSON) with ${days} objects, one per day:
[
  {
    "day": "Day 1",
    "meals": [
      { "name": "Oatmeal with berries", "calories": 320, "protein": 12, "carbs": 58, "fat": 6, "mealType": "breakfast", "description": "Quick and filling" },
      { "name": "Grilled chicken salad", "calories": 450, "protein": 40, "carbs": 20, "fat": 18, "mealType": "lunch", "description": "High protein" },
      { "name": "Salmon with vegetables", "calories": 520, "protein": 42, "carbs": 30, "fat": 22, "mealType": "dinner", "description": "Omega-3 rich" },
      { "name": "Greek yogurt", "calories": 150, "protein": 15, "carbs": 10, "fat": 4, "mealType": "snack", "description": "Protein boost" }
    ],
    "totalCalories": 1440
  }
]

Requirements:
- Each day should have exactly 4 meals: breakfast, lunch, dinner, snack
- Total daily calories should be close to ${calorieTarget}
- Include realistic protein/carbs/fat macros
- Vary the meals across days (no exact repeats)
- Match the ${cuisine} cuisine preference where possible`;

      const parsedPlan = await generateStructuredMealPlan(prompt);
      setPlan(parsedPlan);
      setActiveDay(0);
      toast.success(`Generated ${parsedPlan.length}-day meal plan!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate meal plan. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logMeal = async (meal: Meal, dayIndex: number, mealIndex: number) => {
    const key = `${dayIndex}-${mealIndex}`;
    const token = localStorage.getItem("token");

    // Optimistic UI
    setLoggedMeals((prev) => new Set([...prev, key]));

    try {
      const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_STRAPI_API_URL || "")?.replace(/\/$/, "");
      const res = await fetch(`${API_URL}/api/foodlogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            mealType: meal.mealType,
            date: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to log");

      // Refresh food logs in context
      try {
        const refreshRes = await api.get("/api/foodlogs");
        const list = Array.isArray(refreshRes.data) ? refreshRes.data : refreshRes.data?.data || [];
        setAllFoodLogs(list);
      } catch { /* context update optional */ }

      toast.success(`Logged "${meal.name}" (${meal.calories} kcal)`);
    } catch {
      // Revert optimistic update
      setLoggedMeals((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.error(`Failed to log "${meal.name}"`);
    }
  };

  const currentDay = plan[activeDay];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 pt-6 px-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>🥗</span> AI Meal Planner
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Personalized meal plans aligned with your {calorieTarget} kcal/day target
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Plan Duration
            </label>
            <div className="flex gap-2">
              {DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    days === d
                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
              Cuisine Preference
            </label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={generatePlan}
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/20"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating your plan...
            </>
          ) : (
            <>✨ Generate {days}-Day Meal Plan</>
          )}
        </button>
      </div>

      {/* Plan Results */}
      {plan.length > 0 && (
        <div className="space-y-4">
          {/* Day Selector Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {plan.map((d, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                  activeDay === i
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {d.day}
                <span className="ml-1.5 opacity-60 text-[10px]">
                  {d.totalCalories ? `${d.totalCalories} kcal` : ""}
                </span>
              </button>
            ))}
          </div>

          {/* Active Day Plan */}
          {currentDay && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {currentDay.day}
                </h2>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Total:{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {currentDay.totalCalories ||
                      (currentDay.meals || []).reduce((acc, m) => acc + (m.calories || 0), 0)}{" "}
                    kcal
                  </span>
                </div>
              </div>

              {/* Meals Grid */}
              <div className="space-y-3">
                {(currentDay.meals || []).map((meal, mIdx) => {
                  const key = `${activeDay}-${mIdx}`;
                  const isLogged = loggedMeals.has(key);
                  const colors = MEAL_COLORS[meal.mealType] || MEAL_COLORS.snack;

                  return (
                    <div
                      key={mIdx}
                      className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-base border shrink-0 ${colors.bg}`}
                        >
                          {colors.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                              {meal.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${colors.bg} ${colors.text}`}
                            >
                              {meal.mealType}
                            </span>
                          </div>
                          {meal.description && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                              {meal.description}
                            </p>
                          )}
                          <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              {meal.calories} kcal
                            </span>
                            <span>P: {meal.protein}g</span>
                            <span>C: {meal.carbs}g</span>
                            <span>F: {meal.fat}g</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => logMeal(meal, activeDay, mIdx)}
                        disabled={isLogged}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                          isLogged
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 cursor-default"
                            : "bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {isLogged ? "✓ Logged" : "+ Log to Tracker"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
