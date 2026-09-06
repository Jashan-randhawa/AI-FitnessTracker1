import { useState } from "react";
import { useappcontext } from "../Context/AppContext";
import api from "../configs/api";
import toast from "react-hot-toast";

type Meal = { name: string; calories: number; protein: number; carbs: number; fat: number; mealType: string; description: string };
type DayPlan = { day: string; meals: Meal[]; totalCalories: number };

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
      const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, "");
      const token = localStorage.getItem("token");

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

      const res = await fetch(`${STRAPI_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      const data = await res.json();
      const raw = data.reply ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed: DayPlan[] = JSON.parse(cleaned);
      setPlan(parsed);
      setActiveDay(0);
    } catch (e) {
      toast.error("Failed to generate plan. Please try again.");
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
      const { data: raw } = await api.post("/api/foodlogs", {
        data: {
          name: meal.name,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          mealtype: meal.mealType,
          mealType: meal.mealType,
          date: new Date().toISOString(),
        },
      }, { headers: { Authorization: `Bearer ${token}` } });

      // Add to global state
      setAllFoodLogs((prev: any[]) => [raw, ...prev]);
      toast.success(`${meal.name} logged!`);
    } catch {
      setLoggedMeals((prev) => { const n = new Set(prev); n.delete(key); return n; });
      toast.error("Failed to log meal");
    }
  };

  const logAllMealsForDay = async (dayPlan: DayPlan, dayIndex: number) => {
    const token = localStorage.getItem("token");
    let count = 0;
    for (let i = 0; i < dayPlan.meals.length; i++) {
      const key = `${dayIndex}-${i}`;
      if (loggedMeals.has(key)) continue;
      const meal = dayPlan.meals[i];
      setLoggedMeals((prev) => new Set([...prev, key]));
      try {
        const { data: raw } = await api.post("/api/foodlogs", {
          data: { name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat, mealtype: meal.mealType, mealType: meal.mealType, date: new Date().toISOString() },
        }, { headers: { Authorization: `Bearer ${token}` } });
        setAllFoodLogs((prev: any[]) => [raw, ...prev]);
        count++;
      } catch { /* skip */ }
    }
    toast.success(`${count} meals logged for ${dayPlan.day}!`);
  };

  const currentDay = plan[activeDay];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200 pb-10">

      {/* Header */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60 px-5 pt-12 pb-5 lg:pt-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight">Meal Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">AI-generated plans tailored to your goals</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Config card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
          <p className="text-sm font-bold mb-4">Plan Settings</p>

          <div className="mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Duration</p>
            <div className="flex gap-2">
              {DAYS_OPTIONS.map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${days === d ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Cuisine preference</p>
            <div className="flex flex-wrap gap-2">
              {CUISINES.map((c) => (
                <button key={c} onClick={() => setCuisine(c)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${cuisine === c ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Calorie target: <span className="font-bold text-gray-900 dark:text-white">{calorieTarget} kcal/day</span></span>
            <span>Goal: <span className="font-bold text-gray-900 dark:text-white capitalize">{user?.goal ?? "maintain"}</span></span>
          </div>

          <button
            onClick={generatePlan}
            disabled={loading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
                <span className="ml-2">Generating your plan…</span>
              </>
            ) : (
              <>📅 Generate {days}-Day Plan</>
            )}
          </button>
        </div>

        {/* Plan results */}
        {plan.length > 0 && (
          <>
            {/* Day tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plan.map((d, i) => (
                <button key={i} onClick={() => setActiveDay(i)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeDay === i ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
                  {d.day}
                </button>
              ))}
            </div>

            {/* Day plan */}
            {currentDay && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-base">{currentDay.day}</h2>
                    <p className="text-xs text-slate-400">~{currentDay.totalCalories} kcal total</p>
                  </div>
                  <button
                    onClick={() => logAllMealsForDay(currentDay, activeDay)}
                    className="text-xs px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors cursor-pointer"
                  >
                    Log all meals
                  </button>
                </div>

                {currentDay.meals.map((meal, mealIdx) => {
                  const key = `${activeDay}-${mealIdx}`;
                  const cfg = MEAL_COLORS[meal.mealType] ?? MEAL_COLORS.snack;
                  const logged = loggedMeals.has(key);
                  return (
                    <div key={mealIdx} className={`${cfg.bg} border rounded-2xl p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-0.5">{cfg.icon}</span>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.text} mb-0.5`}>{meal.mealType}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{meal.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{meal.description}</p>
                            <div className="flex gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-gray-700 dark:text-slate-200">{meal.calories} kcal</span>
                              <span>P: {meal.protein}g</span>
                              <span>C: {meal.carbs}g</span>
                              <span>F: {meal.fat}g</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => !logged && logMeal(meal, activeDay, mealIdx)}
                          disabled={logged}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            logged
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                              : "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600"
                          }`}
                        >
                          {logged ? "✓ Logged" : "+ Log"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Regenerate */}
            <button onClick={generatePlan} className="w-full py-3 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              ↻ Regenerate plan
            </button>
          </>
        )}

        {/* Empty state */}
        {plan.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <div className="text-5xl mb-4">📅</div>
            <p className="text-base font-medium text-gray-900 dark:text-white mb-1">No plan yet</p>
            <p className="text-sm">Configure your preferences above and hit Generate</p>
          </div>
        )}
      </div>
    </div>
  );
}
