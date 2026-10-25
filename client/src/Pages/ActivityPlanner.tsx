import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Dumbbell,
  Check,
  Plus,
  Flame,
  Trash2,
  Copy,
  Calendar,
  ArrowRight,
  Clock,
  Activity as ActivityIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../configs/api";
import { useappcontext } from "../Context/AppContext";
import type { ActivityEntry } from "../assets/types";
import { generateStructuredActivityPlan } from "../services/aiAssistantClient";
import {
  safeParseActivityPlan,
  type PlannedActivity,
  type ActivityDayPlan,
} from "../schemas/aiPlans.schema";

// ── Options & Presets ──────────────────────────────────────────
const DAYS_OPTIONS = [1, 3, 5, 7];

const FOCUS_OPTIONS = [
  { id: "Balanced", label: "Balanced", icon: "⚡", desc: "Cardio, strength, & functional mobility" },
  { id: "Fat Loss", label: "Fat Loss", icon: "🔥", desc: "High-calorie burn, HIIT, & metabolic circuits" },
  { id: "Strength", label: "Strength", icon: "🏋️", desc: "Progressive overload, hypertrophy, & lifts" },
  { id: "Endurance", label: "Endurance", icon: "🏃", desc: "Aerobic stamina, distance, & cardio conditioning" },
  { id: "Mobility", label: "Mobility", icon: "🧘", desc: "Joint health, flexibility, & active recovery" },
];

const LEVEL_OPTIONS = [
  { id: "Beginner", label: "Beginner", icon: "🟢", desc: "Foundational moves & safe form" },
  { id: "Intermediate", label: "Intermediate", icon: "🟡", desc: "Moderate volume & supersets" },
  { id: "Advanced", label: "Advanced", icon: "🔴", desc: "High volume & heavy progressive overload" },
];

const EQUIPMENT_OPTIONS = [
  { id: "Bodyweight", label: "Bodyweight", icon: "🤸", desc: "Zero equipment, calisthenics & core" },
  { id: "Gym", label: "Full Gym", icon: "🏢", desc: "Barbells, cables, & machines" },
  { id: "Home Dumbbells", label: "Home Dumbbells", icon: "🏠", desc: "Dumbbells & adjustable bench" },
  { id: "Mixed", label: "Mixed Gear", icon: "🔄", desc: "Hybrid gym, outdoor, & home" },
];

const ACTIVITY_COLORS: Record<string, { bg: string; text: string; icon: string; border: string }> = {
  walking: {
    bg: "bg-yellow-500/10 dark:bg-yellow-900/20",
    border: "border-yellow-500/30",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: "🚶",
  },
  running: {
    bg: "bg-orange-500/10 dark:bg-orange-900/20",
    border: "border-orange-500/30",
    text: "text-orange-600 dark:text-orange-400",
    icon: "🏃",
  },
  cycling: {
    bg: "bg-blue-500/10 dark:bg-blue-900/20",
    border: "border-blue-500/30",
    text: "text-blue-600 dark:text-blue-400",
    icon: "🚴",
  },
  swimming: {
    bg: "bg-cyan-500/10 dark:bg-cyan-900/20",
    border: "border-cyan-500/30",
    text: "text-cyan-600 dark:text-cyan-400",
    icon: "🏊",
  },
  yoga: {
    bg: "bg-violet-500/10 dark:bg-violet-900/20",
    border: "border-violet-500/30",
    text: "text-violet-600 dark:text-violet-400",
    icon: "🧘",
  },
  "weight training": {
    bg: "bg-rose-500/10 dark:bg-rose-900/20",
    border: "border-rose-500/30",
    text: "text-rose-600 dark:text-rose-400",
    icon: "🏋️",
  },
  custom: {
    bg: "bg-emerald-500/10 dark:bg-emerald-900/20",
    border: "border-emerald-500/30",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: "⚡",
  },
};

const STORAGE_KEY = "fittrack_saved_activity_plan";

const normalizeActivityEntry = (raw: unknown): ActivityEntry | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { id?: string; attributes?: Record<string, unknown> };
  if (item.attributes && typeof item.attributes === "object") {
    return { id: String(item.id ?? item.attributes.id ?? ""), ...(item.attributes as object) } as ActivityEntry;
  }
  return item as ActivityEntry;
};

export default function ActivityPlanner() {
  const { user, setAllActivityLogs } = useappcontext();

  // Settings
  const [days, setDays] = useState(7);
  const [focus, setFocus] = useState("Balanced");
  const [level, setLevel] = useState("Beginner");
  const [equipment, setEquipment] = useState("Bodyweight");
  const [calorieBurnTarget, setCalorieBurnTarget] = useState<number>(user?.dailycaloriesburned || 400);

  // Sync default target calorie burn if user updates
  useEffect(() => {
    if (user?.dailycaloriesburned && calorieBurnTarget === 400) {
      setCalorieBurnTarget(user.dailycaloriesburned);
    }
  }, [user?.dailycaloriesburned]);

  // Plan State
  const [plan, setPlan] = useState<ActivityDayPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing request...");
  const [activeDay, setActiveDay] = useState(0);
  const [loggedActivities, setLoggedActivities] = useState<Set<string>>(new Set());
  const [planSaveStatus, setPlanSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [batchLogging, setBatchLogging] = useState(false);

  // 1. Load active plan from database on mount, fallback to localStorage
  useEffect(() => {
    let isSubscribed = true;
    api
      .get("/api/workout-plans/active")
      .then((res) => {
        if (!isSubscribed) return;
        const activePlan = res.data?.plan;
        if (activePlan && Array.isArray(activePlan.days) && activePlan.days.length > 0) {
          const parsed = safeParseActivityPlan({
            days: activePlan.days.map((d: any) => ({
              day: d.day,
              activities: d.exercises,
              recoveryFocus: d.focus,
            })),
          });

          if (parsed.success && parsed.data.length > 0) {
            setPlan(parsed.data);
            setPlanSaveStatus("saved");
            if (activePlan.daysPerWeek) setDays(activePlan.daysPerWeek);
            if (activePlan.split) setFocus(activePlan.split);
            if (activePlan.level) setLevel(activePlan.level);
            return;
          }
        }

        // Fallback to localStorage if no active plan returned
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            if (Array.isArray(parsedCache) && parsedCache.length > 0) {
              setPlan(parsedCache);
            }
          }
        } catch {
          // Ignore parse failure
        }
      })
      .catch(() => {
        // Fallback to localStorage if API unreachable
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsedCache = JSON.parse(cached);
            if (Array.isArray(parsedCache) && parsedCache.length > 0) {
              setPlan(parsedCache);
            }
          }
        } catch {
          // Ignore
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Save to localStorage whenever plan updates
  useEffect(() => {
    if (plan.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
      } catch {
        // Safe storage quota handling
      }
    }
  }, [plan]);

  // Generate Plan Handler
  const generatePlan = async () => {
    setLoading(true);
    setLoadingStep("Consulting FitBot AI Exercise Physiology Engine…");
    setLoggedActivities(new Set());
    setPlanSaveStatus("idle");

    try {
      const prompt = `Create a comprehensive, structured ${days === 1 ? "single-day" : `${days}-day`} workout and activity plan tailored for:
- Requested calorie burn: ${calorieBurnTarget} kcal/day
- Fitness Level: ${level}
- Primary Focus: ${focus}
- Equipment Access: ${equipment}

Return ONLY a valid JSON array of ${days} day object${days > 1 ? "s" : ""} (no markdown, no extra commentary):
[
  {
    "day": "Day 1",
    "activities": [
      {
        "name": "Dynamic Mobility Warm-Up",
        "type": "mobility",
        "duration": 20,
        "caloriesBurned": 90,
        "intensity": "low",
        "targetMuscles": ["hips", "core"],
        "notes": "Controlled range-of-motion flow to prime hips, shoulders, and spine",
        "warmup": "3 min ankle circles & arm swings",
        "cooldown": "2 min hamstring stretch"
      },
      {
        "name": "Bodyweight Circuit Training",
        "type": "weight training",
        "duration": 30,
        "caloriesBurned": 220,
        "intensity": "medium",
        "targetMuscles": ["quads", "chest", "core"],
        "notes": "3 rounds: 12 body squats, 10 push-ups, 30s plank",
        "warmup": "Dynamic hip openers",
        "cooldown": "Cobra stretch & child pose"
      }
    ],
    "totalDuration": 50,
    "totalCaloriesBurned": 310,
    "recoveryFocus": "Post-workout hydration and light calf stretching"
  }
]

Requirements:
- Each day must include 2 to 4 structured activities.
- Realistic duration (15 to 75 min total) and calorie burn estimates.
${days > 1 ? `- Progressive variation across days matching ${focus} and ${level}.` : `- Balanced single-day workout flow matching ${focus} and ${level}.`}
- Strictly adhere to equipment constraints: ${equipment}. Plan outdoor sessions only if the planning context shows suitable conditions; otherwise use indoor options.
- Follow the active workout plan's split from the planning context unless the primary focus says otherwise.
- Total daily calories burned should approximate ~${calorieBurnTarget} kcal.`;

      const parsedPlan = await generateStructuredActivityPlan(prompt);
      setPlan(parsedPlan);
      setActiveDay(0);
      toast.success(
        `Generated your ${parsedPlan.length === 1 ? "single-day" : `${parsedPlan.length}-day`} ${focus} training plan!`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate activity plan. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Quick Preset Helper
  const applyPreset = (
    presetDays: number,
    presetFocus: string,
    presetLevel: string,
    presetEquip: string,
    burnOffset: number
  ) => {
    setDays(presetDays);
    setFocus(presetFocus);
    setLevel(presetLevel);
    setEquipment(presetEquip);
    const newBurn = Math.max(150, (user?.dailycaloriesburned || 400) + burnOffset);
    setCalorieBurnTarget(newBurn);
  };

  // Confirm and Save to Backend Workout Plans
  const confirmAndSavePlan = async () => {
    if (plan.length === 0) return;
    setPlanSaveStatus("saving");
    try {
      await api.post("/api/workout-plans", {
        plan: {
          title: `${focus} ${days === 1 ? "1-Day" : `${days}-Day`} Routine`,
          goal: user?.goal || "maintain",
          level,
          daysPerWeek: days,
          split: focus,
          days: plan.map((d) => ({
            day: d.day,
            focus: d.recoveryFocus,
            duration: `${d.totalDuration} min`,
            exercises: d.activities,
          })),
          isActive: true,
        },
      });
      setPlanSaveStatus("saved");
      toast.success("Workout plan saved and activated on your profile!");
    } catch (err: unknown) {
      setPlanSaveStatus("idle");
      const msg =
        err instanceof Error ? err.message : "Failed to save workout plan. Please try again.";
      toast.error(msg);
    }
  };

  // Log single activity to /api/activitylogs
  const logActivity = async (activity: PlannedActivity, dayIndex: number, activityIndex: number) => {
    const key = `${dayIndex}-${activityIndex}`;
    setLoggedActivities((prev) => new Set([...prev, key]));

    try {
      const { data: raw } = await api.post("/api/activitylogs", {
        data: {
          name: activity.name,
          duration: activity.duration,
          calories: activity.caloriesBurned,
          caloriesBurned: activity.caloriesBurned,
          type: (activity.type || "custom").toLowerCase().trim(),
          intensity: (activity.intensity || "medium").toLowerCase().trim(),
          source: "planner",
          date: new Date().toISOString(),
        },
      });

      const entry = normalizeActivityEntry(raw);
      if (entry) {
        setAllActivityLogs((prev: ActivityEntry[]) => [entry, ...prev]);
      }
      toast.success(`Logged "${activity.name}" (${activity.caloriesBurned} kcal)`);
    } catch (err: unknown) {
      setLoggedActivities((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      const errorMsg =
        (err as any)?.response?.data?.error?.message ||
        (err as any)?.response?.data?.message ||
        (err as any)?.response?.data?.error ||
        (err instanceof Error ? err.message : `Failed to log "${activity.name}". Please try again.`);
      toast.error(errorMsg);
    }
  };

  // Log all activities for the active day in one click
  const logAllActivitiesForDay = async (dayPlan: ActivityDayPlan, dayIndex: number) => {
    if (!dayPlan.activities || dayPlan.activities.length === 0) return;
    setBatchLogging(true);

    let count = 0;
    let failed = 0;

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
            calories: activity.caloriesBurned,
            caloriesBurned: activity.caloriesBurned,
            type: (activity.type || "custom").toLowerCase().trim(),
            intensity: (activity.intensity || "medium").toLowerCase().trim(),
            source: "planner",
            date: new Date().toISOString(),
          },
        });

        const entry = normalizeActivityEntry(raw);
        if (entry) {
          setAllActivityLogs((prev: ActivityEntry[]) => [entry, ...prev]);
        }
        count++;
      } catch {
        setLoggedActivities((prev) => {
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
      toast.success(`All ${count} activities for ${dayPlan.day} logged to your fitness tracker!`);
    } else {
      toast("All activities for this day were already logged.");
    }
  };

  // Copy plan summary to clipboard
  const handleCopyPlan = () => {
    if (plan.length === 0) return;
    const text = plan
      .map(
        (d) =>
          `📅 ${d.day} (${d.totalDuration} min • ~${d.totalCaloriesBurned} kcal)\n` +
          `Recovery: ${d.recoveryFocus}\n` +
          (d.activities || [])
            .map(
              (a) =>
                `  • [${a.intensity?.toUpperCase()}] ${a.name} (${a.duration} min - ${a.caloriesBurned} kcal)`
            )
            .join("\n")
      )
      .join("\n\n");

    navigator.clipboard.writeText(text);
    toast.success("Activity plan summary copied to clipboard!");
  };

  // Discard plan
  const handleDiscardPlan = () => {
    setPlan([]);
    setActiveDay(0);
    setLoggedActivities(new Set());
    setPlanSaveStatus("idle");
    localStorage.removeItem(STORAGE_KEY);
    toast("Activity plan cleared.");
  };

  const currentDay = plan[activeDay];

  // Calculate day totals
  const dayStats = useMemo(() => {
    if (!currentDay || !currentDay.activities) {
      return { totalDuration: 0, totalBurn: 0, count: 0 };
    }
    return {
      totalDuration: currentDay.totalDuration || currentDay.activities.reduce((acc, a) => acc + (a.duration || 0), 0),
      totalBurn: currentDay.totalCaloriesBurned || currentDay.activities.reduce((acc, a) => acc + (a.caloriesBurned || 0), 0),
      count: currentDay.activities.length,
    };
  }, [currentDay]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200 pb-20">
      {/* ── Page Hero Header ────────────────────────────────────── */}
      <div className="page-header-activity-planner">
        <div className="max-w-4xl mx-auto flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold text-amber-50 border border-white/20 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Smart Training Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>💪</span> AI Activity Planner
            </h1>
            <p className="text-xs sm:text-sm text-amber-100/90 mt-1 max-w-xl">
              Personalized workout and activity routines engineered for your fitness goals, level, and gear.
            </p>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15">
            <span className="text-[10px] text-amber-100/80 uppercase tracking-wider font-bold">
              Daily Burn Target
            </span>
            <span className="text-xl font-black text-white">
              {calorieBurnTarget} <span className="text-xs font-normal text-amber-200">kcal</span>
            </span>
            <div className="flex items-center gap-2 text-[11px] text-amber-100/90 font-medium">
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
                <Dumbbell className="w-4 h-4 text-amber-500" />
                <span>Configure Workout Routine</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select your weekly schedule, focus area, and equipment access.
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
                Weekly Training Days
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {DAYS_OPTIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`py-2.5 px-3 text-xs sm:text-sm font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      days === d
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/25"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{d === 1 ? "1 Day" : `${d} Days`}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Training Focus */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Primary Training Focus
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {FOCUS_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFocus(f.id)}
                    className={`p-2.5 text-left rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      focus === f.id
                        ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className="text-base mb-1">{f.icon}</span>
                    <span className="text-xs font-bold leading-tight">{f.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                      {f.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Fitness Level & Equipment Access */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Fitness Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVEL_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLevel(l.id)}
                      className={`p-2 text-center rounded-2xl border transition-all cursor-pointer ${
                        level === l.id
                          ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-300"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <span className="block text-xs font-bold">{l.label}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 block truncate mt-0.5">
                        {l.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Equipment Access
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEquipment(e.id)}
                      className={`p-2 text-left rounded-2xl border transition-all cursor-pointer flex items-center gap-2 ${
                        equipment === e.id
                          ? "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-300"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <span className="text-sm shrink-0">{e.icon}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold block truncate">{e.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Daily Calorie Burn Target Adjuster */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target Daily Calorie Burn
                </label>
                <button
                  type="button"
                  onClick={() => setCalorieBurnTarget(user?.dailycaloriesburned || 400)}
                  className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Reset ({user?.dailycaloriesburned || 400} kcal)
                </button>
              </div>
              <div className="flex items-center gap-2 max-w-sm">
                <button
                  type="button"
                  onClick={() => setCalorieBurnTarget((prev) => Math.max(150, prev - 50))}
                  className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    min={150}
                    max={2500}
                    step={50}
                    value={calorieBurnTarget}
                    onChange={(e) => setCalorieBurnTarget(Number(e.target.value) || 400)}
                    className="w-full py-2.5 px-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-3 text-[11px] font-medium text-slate-400">
                    kcal
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCalorieBurnTarget((prev) => Math.min(2500, prev + 50))}
                  className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="button"
              onClick={generatePlan}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/25 active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate {days === 1 ? "Single Day" : `${days}-Day`} {focus} Routine</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Plan Active Results Section ─────────────────────────── */}
        {plan.length > 0 ? (
          <div className="space-y-5">
            {/* Action Bar */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Active Routine
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200">
                    {focus} • {plan.length === 1 ? "1 Day" : `${plan.length} Days`} • {level}
                  </span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
                  Save to profile to activate across your dashboard and live trackers.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={confirmAndSavePlan}
                  disabled={planSaveStatus === "saving" || planSaveStatus === "saved"}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                    planSaveStatus === "saved"
                      ? "bg-amber-600 text-white cursor-default"
                      : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                  }`}
                >
                  {planSaveStatus === "saving" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : planSaveStatus === "saved" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Active Plan Saved</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Save to My Plans</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => currentDay && logAllActivitiesForDay(currentDay, activeDay)}
                  disabled={batchLogging}
                  className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-60 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {batchLogging ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Logging…</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log All Day</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyPlan}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
                      {d.totalCaloriesBurned} kcal
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Day Card */}
            {currentDay && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xs space-y-6">
                {/* Day Header & Stat Grid */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span>📅</span> {currentDay.day} Workout Breakdown
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Recovery Focus: <span className="font-semibold text-amber-600 dark:text-amber-400">{currentDay.recoveryFocus}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Day Est. Burn
                        </span>
                        <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                          {dayStats.totalBurn} <span className="text-xs font-normal">kcal</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stat Grid */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                        Duration
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {dayStats.totalDuration} min
                      </span>
                    </div>

                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 block">
                        Burn
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        {dayStats.totalBurn} kcal
                      </span>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                        Exercises
                      </span>
                      <span className="text-base font-black text-gray-900 dark:text-white flex items-center justify-center gap-1">
                        <ActivityIcon className="w-3.5 h-3.5 text-emerald-500" />
                        {dayStats.count} planned
                      </span>
                    </div>
                  </div>
                </div>

                {/* Activities List */}
                <div className="space-y-3.5">
                  {(currentDay.activities || []).map((activity, aIdx) => {
                    const key = `${activeDay}-${aIdx}`;
                    const isLogged = loggedActivities.has(key);
                    const cfg =
                      ACTIVITY_COLORS[activity.type?.toLowerCase() || "custom"] ||
                      ACTIVITY_COLORS.custom;

                    return (
                      <motion.div
                        key={aIdx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: aIdx * 0.05 }}
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
                                {activity.name}
                              </h4>
                              <span
                                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                              >
                                {activity.type || "custom"}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {activity.intensity}
                              </span>
                            </div>

                            {activity.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                                {activity.notes}
                              </p>
                            )}

                            {/* Tags row: Duration, Burn, Target Muscles */}
                            <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
                              <span className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {activity.duration} min
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="font-extrabold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5" />
                                {activity.caloriesBurned} kcal
                              </span>

                              {Array.isArray(activity.targetMuscles) && activity.targetMuscles.length > 0 && (
                                <>
                                  <span className="text-slate-400 dark:text-slate-500">•</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    Target: {activity.targetMuscles.join(", ")}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Warmup / Cooldown tag row */}
                            {(activity.warmup || activity.cooldown) && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5 flex items-center gap-2 flex-wrap">
                                {activity.warmup && (
                                  <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                    Warm-up: {activity.warmup}
                                  </span>
                                )}
                                {activity.cooldown && (
                                  <span className="bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md">
                                    Cooldown: {activity.cooldown}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center sm:self-center">
                          <button
                            type="button"
                            onClick={() => logActivity(activity, activeDay, aIdx)}
                            disabled={isLogged}
                            className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              isLogged
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-default"
                                : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-white text-slate-700 dark:text-slate-200"
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
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-3xl mx-auto shadow-inner">
              💪
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Ready for your tailored workout plan?
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Choose your schedule and gear above, or click one of our popular training presets to generate immediately:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left">
              <button
                type="button"
                onClick={() => applyPreset(7, "Strength", "Intermediate", "Gym", +100)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🏋️</span> Full-Body Strength Overload
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  7 Days • Gym-based compound lifts, hypertrophy, and core strength.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(5, "Fat Loss", "Intermediate", "Home Dumbbells", +50)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🔥</span> Metabolic Fat Burn & HIIT
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  5 Days • Dumbbell circuits and high-tempo cardio intervals.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(3, "Endurance", "Intermediate", "Mixed", 0)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>🏃</span> Aerobic Stamina & Conditioning
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  3 Days • Running intervals, cycling tempos, and active recovery.
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset(1, "Balanced", "Beginner", "Bodyweight", 0)}
                className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span>⚡</span> Single-Day Full-Body Express
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  1 Day • Fast bodyweight workout session ready to complete today.
                </p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
