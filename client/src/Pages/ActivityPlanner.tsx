import { useState } from "react";
import toast from "react-hot-toast";
import api from "../configs/api";
import { useappcontext } from "../Context/AppContext";
import type { ActivityEntry } from "../assets/types";

type PlannedActivity = {
  name: string;
  type: string;
  duration: number;
  caloriesBurned: number;
  intensity: "low" | "medium" | "high";
  targetMuscles: string[];
  notes: string;
  warmup?: string;
  cooldown?: string;
};

type ActivityDayPlan = {
  day: string;
  activities: PlannedActivity[];
  totalDuration: number;
  totalCaloriesBurned: number;
  recoveryFocus: string;
};

const DAYS_OPTIONS = [3, 5, 7];
const FOCUS_OPTIONS = ["Balanced", "Fat Loss", "Strength", "Endurance", "Mobility"];
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
const EQUIPMENT_OPTIONS = ["Bodyweight", "Gym", "Home Dumbbells", "Mixed"];

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  walking: { bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/40", text: "text-yellow-600 dark:text-yellow-400", icon: "🚶" },
  running: { bg: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40", text: "text-orange-600 dark:text-orange-400", icon: "🏃" },
  cycling: { bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40", text: "text-blue-600 dark:text-blue-400", icon: "🚴" },
  swimming: { bg: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/40", text: "text-cyan-600 dark:text-cyan-400", icon: "🏊" },
  yoga: { bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40", text: "text-violet-600 dark:text-violet-400", icon: "🧘" },
  "weight training": { bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40", text: "text-rose-600 dark:text-rose-400", icon: "🏋️" },
  custom: { bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40", text: "text-emerald-600 dark:text-emerald-400", icon: "⚡" },
};

const normalizeStrapiEntry = (raw: unknown): ActivityEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { id?: string; attributes?: Record<string, unknown> };
  if (item.attributes && typeof item.attributes === "object") {
    return { id: String(item.id ?? item.attributes.id ?? ""), ...(item.attributes as object) } as ActivityEntry;
  }
  return item as ActivityEntry;
};

const planFromReply = (reply: string) => {
  const cleaned = reply.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned) as ActivityDayPlan[];
};

export default function ActivityPlanner() {
  const { user, setAllActivityLogs } = useappcontext();
  const [days, setDays] = useState(7);
  const [focus, setFocus] = useState("Balanced");
  const [level, setLevel] = useState("Beginner");
  const [equipment, setEquipment] = useState("Bodyweight");
  const [plan, setPlan] = useState<ActivityDayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [loggedActivities, setLoggedActivities] = useState<Set<string>>(new Set());

  const calorieBurnTarget = user?.dailycaloriesburned ?? 400;

  const generatePlan = async () => {
    setLoading(true);
    setPlan([]);
    setActiveDay(0);
    setLoggedActivities(new Set());
    try {
      const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, "");
      const token = localStorage.getItem("token");
      const prompt = `Create a detailed ${days}-day workout and activity plan for this user:
- Goal: ${user?.goal ?? "maintain"} weight
- Daily calorie burn target: ${calorieBurnTarget} kcal
- Fitness level: ${level}
- Primary focus: ${focus}
- Equipment access: ${equipment}
- Weight: ${user?.weight ?? 70}kg

Return ONLY valid JSON (no markdown). Output an array of ${days} day objects:
[
  {
    "day": "Day 1",
    "activities": [
      {
        "name": "Brisk Walk",
        "type": "walking",
        "duration": 35,
        "caloriesBurned": 180,
        "intensity": "low",
        "targetMuscles": ["legs", "core"],
        "notes": "Maintain pace where talking is possible",
        "warmup": "5 min easy walk",
        "cooldown": "3 min slow walk"
      }
    ],
    "totalDuration": 50,
    "totalCaloriesBurned": 320,
    "recoveryFocus": "Hydration and light stretching"
  }
]

Requirements:
- Each day must include 2-4 activities.
- Use realistic duration and calorie burn values.
- Mix cardio, strength, and mobility across the week.
- Include progressive overload or variation across days.
- Match level and equipment constraints.
- Keep daily totalCaloriesBurned close to ${calorieBurnTarget}.`;

      const res = await fetch(`${STRAPI_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      if (!res.ok) throw new Error(`AI assistant: ${res.status}`);
      const data = (await res.json()) as { reply?: string };
      if (!data.reply) throw new Error("Empty AI response");
      const parsed = planFromReply(data.reply);
      setPlan(parsed);
    } catch {
      toast.error("Failed to generate activity plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const logActivity = async (activity: PlannedActivity, dayIndex: number, activityIndex: number) => {
    const key = `${dayIndex}-${activityIndex}`;
    const token = localStorage.getItem("token");
    setLoggedActivities((prev) => new Set([...prev, key]));
    try {
      const { data: raw } = await api.post("/api/activitylogs", {
        data: {
          name: activity.name,
          duration: activity.duration,
          caloriesBurned: activity.caloriesBurned,
          date: new Date().toISOString(),
        },
      }, { headers: { Authorization: `Bearer ${token}` } });

      const entry = normalizeStrapiEntry(raw);
      if (!entry) throw new Error("Invalid activity response");
      setAllActivityLogs((prev: ActivityEntry[]) => {
        if (prev.some((log) => log.id === entry.id)) return prev;
        return [...prev, entry];
      });
      toast.success(`${activity.name} logged!`);
    } catch {
      setLoggedActivities((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.error("Failed to log activity");
    }
  };

  const logAllActivitiesForDay = async (dayPlan: ActivityDayPlan, dayIndex: number) => {
    const token = localStorage.getItem("token");
    let count = 0;
    for (let i = 0; i < dayPlan.activities.length; i++) {
      const key = `${dayIndex}-${i}`;
      if (loggedActivities.has(key)) continue;
      const activity = dayPlan.activities[i];
      setLoggedActivities((prev) => new Set([...prev, key]));
      try {
        const { data: raw } = await api.post("/api/activitylogs", {
          data: {
            name: activity.name,
            duration: activity.duration,
            caloriesBurned: activity.caloriesBurned,
            date: new Date().toISOString(),
          },
        }, { headers: { Authorization: `Bearer ${token}` } });
        const entry = normalizeStrapiEntry(raw);
        if (!entry) continue;
        setAllActivityLogs((prev: ActivityEntry[]) => {
          if (prev.some((log) => log.id === entry.id)) return prev;
          return [...prev, entry];
        });
        count++;
      } catch {
        // Skip and continue logging remaining items.
      }
    }
    toast.success(`${count} activities logged for ${dayPlan.day}!`);
  };

  const currentDay = plan[activeDay];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200 pb-10">
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60 px-5 pt-12 pb-5 lg:pt-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight">Activity Planner</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">AI-built training plans based on your profile and goals</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
          <p className="text-sm font-bold mb-4">Plan Settings</p>

          <div className="mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Duration</p>
            <div className="flex gap-2">
              {DAYS_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${days === d ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Training focus</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFocus(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${focus === f ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Fitness level</p>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${level === l ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Equipment</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEquipment(e)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${equipment === e ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Burn target: <span className="font-bold text-gray-900 dark:text-white">{calorieBurnTarget} kcal/day</span></span>
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
              <>💪 Generate {days}-Day Plan</>
            )}
          </button>
        </div>

        {plan.length > 0 && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {plan.map((d, i) => (
                <button
                  key={`${d.day}-${i}`}
                  onClick={() => setActiveDay(i)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeDay === i ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {d.day}
                </button>
              ))}
            </div>

            {currentDay && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-base">{currentDay.day}</h2>
                    <p className="text-xs text-slate-400">~{currentDay.totalDuration} min • ~{currentDay.totalCaloriesBurned} kcal</p>
                  </div>
                  <button
                    onClick={() => logAllActivitiesForDay(currentDay, activeDay)}
                    className="text-xs px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors cursor-pointer"
                  >
                    Log all activities
                  </button>
                </div>

                {currentDay.activities.map((activity, activityIdx) => {
                  const key = `${activeDay}-${activityIdx}`;
                  const cfg = ACTIVITY_COLORS[activity.type?.toLowerCase()] ?? ACTIVITY_COLORS.custom;
                  const logged = loggedActivities.has(key);
                  return (
                    <div key={key} className={`${cfg.bg} border rounded-2xl p-4`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xl mt-0.5">{cfg.icon}</span>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.text} mb-0.5`}>{activity.type || "custom"}</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{activity.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activity.notes}</p>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-semibold text-gray-700 dark:text-slate-200">{activity.duration} min</span>
                              <span>{activity.caloriesBurned} kcal</span>
                              <span className="capitalize">{activity.intensity}</span>
                            </div>
                            {!!activity.targetMuscles?.length && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Target: {activity.targetMuscles.join(", ")}
                              </p>
                            )}
                            {(activity.warmup || activity.cooldown) && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {activity.warmup ? `Warm-up: ${activity.warmup}` : ""}{activity.warmup && activity.cooldown ? " • " : ""}{activity.cooldown ? `Cooldown: ${activity.cooldown}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => !logged && logActivity(activity, activeDay, activityIdx)}
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

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Recovery focus</p>
                  <p className="text-sm text-gray-800 dark:text-slate-200 mt-1">{currentDay.recoveryFocus}</p>
                </div>
              </div>
            )}

            <button
              onClick={generatePlan}
              className="w-full py-3 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ↻ Regenerate plan
            </button>
          </>
        )}

        {plan.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500">
            <div className="text-5xl mb-4">💪</div>
            <p className="text-base font-medium text-gray-900 dark:text-white mb-1">No plan yet</p>
            <p className="text-sm">Choose your settings above and generate your activity plan</p>
          </div>
        )}
      </div>
    </div>
  );
}
