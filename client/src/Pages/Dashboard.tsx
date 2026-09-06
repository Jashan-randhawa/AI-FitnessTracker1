import { useEffect, useMemo, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useappcontext } from "../Context/AppContext";
import { useTheme } from "../Context/Themecontext";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import toast from "react-hot-toast";

// ── Helpers ────────────────────────────────────────────────
const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

const today = new Date().toDateString();

const getLastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { dateStr: d.toDateString(), day: d.toLocaleDateString("en-US", { weekday: "short" }) };
  });

const calcBMI = (weightKg: number, heightCm: number) => {
  const h = heightCm / 100;
  return parseFloat((weightKg / (h * h)).toFixed(1));
};

const bmiLabel = (bmi: number) => {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
};

const calcStreak = (foodLogs: any[], activityLogs: any[]): number => {
  let streak = 0;
  const d = new Date();
  const todayHasData =
    foodLogs.some((l) => new Date(resolveDate(l)).toDateString() === d.toDateString()) ||
    activityLogs.some((l) => new Date(resolveDate(l)).toDateString() === d.toDateString());
  if (!todayHasData) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const ds = d.toDateString();
    const hasFood = foodLogs.some((l) => new Date(resolveDate(l)).toDateString() === ds);
    const hasActivity = activityLogs.some((l) => new Date(resolveDate(l)).toDateString() === ds);
    if (hasFood || hasActivity) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
};

// ── Badge definitions ──────────────────────────────────────
const BADGE_DEFS = [
  { id: "first_log",    label: "First Step",      icon: "🥗", desc: "Logged your first meal",           check: (f: any[], _a: any[], _streak: number) => f.length >= 1 },
  { id: "streak_3",     label: "3-Day Streak",    icon: "🔥", desc: "Active 3 days in a row",           check: (_f: any[], _a: any[], streak: number) => streak >= 3 },
  { id: "streak_7",     label: "Week Warrior",    icon: "🏅", desc: "Active 7 days in a row",           check: (_f: any[], _a: any[], streak: number) => streak >= 7 },
  { id: "workouts_10",  label: "10 Workouts",     icon: "💪", desc: "Logged 10 activities",             check: (_f: any[], a: any[]) => a.length >= 10 },
  { id: "food_50",      label: "Nutrition Pro",   icon: "🥦", desc: "Logged 50 food entries",           check: (f: any[]) => f.length >= 50 },
  { id: "workouts_25",  label: "Fitness Fanatic", icon: "🏋️", desc: "Logged 25 activities",            check: (_f: any[], a: any[]) => a.length >= 25 },
  { id: "streak_30",    label: "Monthly Master",  icon: "🌟", desc: "Active 30 days in a row",          check: (_f: any[], _a: any[], streak: number) => streak >= 30 },
];

// ── Sub-components ─────────────────────────────────────────
const SkeletonCard = ({ height = "h-28" }: { height?: string }) => (
  <div className={`${height} rounded-2xl animate-pulse bg-slate-200 dark:bg-slate-800`} />
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-gray-600 dark:text-slate-300 font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

// ── Circular progress ring ─────────────────────────────────
const RingProgress = ({
  value, max, color, size = 120, strokeWidth = 10, label, sublabel,
}: {
  value: number; max: number; color: string; size?: number;
  strokeWidth?: number; label: string; sublabel: string;
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / Math.max(max, 1), 1);
  const dash = pct * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke="currentColor" strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700" />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease-out" }} />
      </svg>
      <div className="flex flex-col items-center -mt-1" style={{ marginTop: -(size / 2 + 28) }}>
        <span className="text-lg font-bold text-gray-900 dark:text-white" style={{ lineHeight: 1 }}>
          {Math.round(value)}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">/ {Math.round(max)}</span>
      </div>
      <div className="text-center mt-1" style={{ marginTop: size / 2 - 16 }}>
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">{sublabel}</p>
      </div>
    </div>
  );
};

// ── Water tracker quick-add ────────────────────────────────
const WATER_BTNS = [150, 250, 350, 500];
const DAILY_WATER_GOAL = 2500; // ml

const WaterTracker = ({ logs, onAdd, onRemove }: {
  logs: any[]; onAdd: (ml: number) => void; onRemove: (id: string) => void;
}) => {
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const todayTotal = useMemo(
    () => logs.filter((l) => new Date(resolveDate(l)).toDateString() === today)
              .reduce((s, l) => s + (l.amount ?? 0), 0),
    [logs]
  );
  const todayLogs = useMemo(
    () => logs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [logs]
  );
  const pct = Math.min((todayTotal / DAILY_WATER_GOAL) * 100, 100);
  const glasses = Math.round(todayTotal / 250);

  const handleCustomAdd = () => {
    const v = parseInt(customAmount);
    if (v > 0) {
      onAdd(v);
      setCustomAmount("");
      setShowCustom(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💧</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">Water Intake</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">{todayTotal} ml · {glasses} glasses today</p>
        </div>
        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{Math.round(pct)}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 bg-blue-400 dark:bg-blue-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-blue-500 dark:text-blue-400 mb-3">
        Goal: {DAILY_WATER_GOAL} ml · {Math.max(DAILY_WATER_GOAL - todayTotal, 0)} ml remaining
      </p>

      {/* Quick-add buttons */}
      <div className="flex gap-2 flex-wrap mb-2">
        {WATER_BTNS.map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer"
          >
            +{ml} ml
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
        >
          Custom
        </button>
      </div>

      {/* Inline custom amount input */}
      {showCustom && (
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            min="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCustomAdd()}
            placeholder="Amount in ml"
            className="flex-1 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-gray-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleCustomAdd}
            className="px-4 py-2 rounded-full text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer"
          >
            Add
          </button>
        </div>
      )}

      {/* Today's entries */}
      {todayLogs.length > 0 && (
        <div className="mt-1 space-y-1.5 max-h-28 overflow-y-auto">
          {todayLogs.slice().reverse().map((l) => (
            <div key={l.id} className="flex items-center justify-between text-xs">
              <span className="text-blue-600 dark:text-blue-300">💧 {l.amount} ml</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">
                  {new Date(resolveDate(l)).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <button
                  onClick={() => onRemove(l.id)}
                  className="text-gray-300 hover:text-rose-400 transition-colors cursor-pointer text-base leading-none"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── BmiBar ─────────────────────────────────────────────────
const BmiBar = ({ value }: { value: number }) => {
  const segments = [
    { label: "Under", color: "bg-sky-400" },
    { label: "Normal", color: "bg-emerald-400" },
    { label: "Over", color: "bg-amber-400" },
    { label: "Obese", color: "bg-rose-500" },
  ];
  const pct = Math.min(((value - 10) / 30) * 100, 100);
  return (
    <div className="mt-2">
      <div className="relative flex gap-0.5 h-2 rounded-full overflow-hidden">
        {segments.map((s) => <div key={s.label} className={`flex-1 ${s.color} opacity-40`} />)}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-emerald-400 shadow-lg shadow-emerald-400/50 transition-all duration-1000"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {segments.map((s) => <span key={s.label} className="text-[10px] text-gray-400 dark:text-slate-500">{s.label}</span>)}
      </div>
    </div>
  );
};

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const [visible, setVisible] = useState(false);
  const { user, allFoodLogs, allActivityLogs, allWaterLogs, setAllWaterLogs, isUserFetched } = useappcontext();
  const { theme } = useTheme();
  const isLight = theme.toString() === "light";
  const navigate = useNavigate();

  const [dailyTip, setDailyTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);
  const [chartTab, setChartTab] = useState<"calories" | "protein" | "carbs" | "fat">("calories");
  const [showAllBadges, setShowAllBadges] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  const todayFoodLogs = useMemo(
    () => allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [allFoodLogs]
  );
  const todayActivityLogs = useMemo(
    () => allActivityLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [allActivityLogs]
  );

  const totalCaloriesToday = useMemo(() => todayFoodLogs.reduce((s, l) => s + (l.calories ?? 0), 0), [todayFoodLogs]);
  const totalCaloriesBurnedToday = useMemo(() => todayActivityLogs.reduce((s, l) => s + (l.calories ?? l.caloriesBurned ?? 0), 0), [todayActivityLogs]);
  const totalActivityMinutes = useMemo(() => todayActivityLogs.reduce((s, l) => s + (l.duration ?? 0), 0), [todayActivityLogs]);

  const calorieLimit = user?.dailycaloriesintake ?? 2000;
  const calorieBurnGoal = user?.dailycaloriesburned ?? 400;
  const bmi = user?.weight && user?.height ? calcBMI(user.weight, user.height) : null;

  const streak = useMemo(() => calcStreak(allFoodLogs, allActivityLogs), [allFoodLogs, allActivityLogs]);
  const netCalories = totalCaloriesToday - totalCaloriesBurnedToday;
  const netLabel = netCalories > 0 ? `+${netCalories}` : `${netCalories}`;
  const netColor = netCalories > calorieLimit * 0.1 ? "text-rose-500" : netCalories < 0 ? "text-sky-500" : "text-emerald-500";

  // ── Badges ──────────────────────────────────────────────
  const earnedBadges = useMemo(
    () => BADGE_DEFS.filter((b) => b.check(allFoodLogs, allActivityLogs, streak)),
    [allFoodLogs, allActivityLogs, streak]
  );

  // ── Macro totals today ───────────────────────────────────
  const macrosToday = useMemo(() => ({
    protein: todayFoodLogs.reduce((s, l) => s + (l.protein ?? 0), 0),
    carbs: todayFoodLogs.reduce((s, l) => s + (l.carbs ?? 0), 0),
    fat: todayFoodLogs.reduce((s, l) => s + (l.fat ?? 0), 0),
  }), [todayFoodLogs]);

  // ── Weekly chart data ────────────────────────────────────
  const weeklyData = useMemo(() => {
    const days = getLastSevenDays();
    return days.map(({ dateStr, day }) => {
      const dayFood = allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === dateStr);
      return {
        day,
        Calories: dayFood.reduce((s, l) => s + (l.calories ?? 0), 0),
        Protein: Math.round(dayFood.reduce((s, l) => s + (l.protein ?? 0), 0)),
        Carbs: Math.round(dayFood.reduce((s, l) => s + (l.carbs ?? 0), 0)),
        Fat: Math.round(dayFood.reduce((s, l) => s + (l.fat ?? 0), 0)),
        Burned: allActivityLogs.filter((l) => new Date(resolveDate(l)).toDateString() === dateStr)
          .reduce((s, l) => s + (l.calories ?? l.caloriesBurned ?? 0), 0),
      };
    });
  }, [allFoodLogs, allActivityLogs]);

  // ── Chart config by tab ──────────────────────────────────
  const CHART_CFG = {
    calories: { key: "Calories", color: "#10b981", burnKey: "Burned", burnColor: "#f97316" },
    protein:  { key: "Protein",  color: "#3b82f6" },
    carbs:    { key: "Carbs",    color: "#f59e0b" },
    fat:      { key: "Fat",      color: "#ec4899" },
  } as const;

  // ── Water log helpers ────────────────────────────────────
  const handleAddWater = useCallback(async (ml: number) => {
    const token = localStorage.getItem("token");
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = { id: tmpId, amount: ml, date: new Date().toISOString() };
    // Show immediately in UI
    setAllWaterLogs((prev: any[]) => [optimistic, ...prev]);
    try {
      const { data: raw } = await api.post(
        "/api/waterlogs",
        { data: { amount: ml, date: new Date().toISOString() } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Normalise Strapi response — may be nested under .data or flat
      const saved = raw?.data ?? raw;
      const entry = saved?.attributes
        ? { id: saved.id, ...saved.attributes }
        : { id: saved?.id ?? tmpId, amount: saved?.amount ?? ml, date: saved?.date ?? new Date().toISOString() };
      // Replace optimistic entry with real server entry
      setAllWaterLogs((prev: any[]) => prev.map((e) => e.id === tmpId ? entry : e));
    } catch {
      // Roll back
      setAllWaterLogs((prev: any[]) => prev.filter((e) => e.id !== tmpId));
      toast.error("Failed to save water entry");
    }
  }, [setAllWaterLogs]);

  const handleRemoveWater = useCallback(async (id: string) => {
    // Skip remove for optimistic (tmp) entries that haven't saved yet
    if (String(id).startsWith("tmp-")) {
      setAllWaterLogs((prev: any[]) => prev.filter((e) => e.id !== id));
      return;
    }
    const token = localStorage.getItem("token");
    // Optimistic remove
    setAllWaterLogs((prev: any[]) => prev.filter((e) => e.id !== id));
    try {
      await api.delete(`/api/waterlogs/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      toast.error("Failed to remove water entry — try again");
      // Re-fetch to restore correct state
      try {
        const { data } = await api.get("/api/waterlogs", { headers: { Authorization: `Bearer ${token}` } });
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setAllWaterLogs(list.map((e: any) => e?.attributes ? { id: e.id, ...e.attributes } : e));
      } catch { /* silent */ }
    }
  }, [setAllWaterLogs]);

  // ── Daily AI tip ─────────────────────────────────────────
  useEffect(() => {
    if (!isUserFetched || dailyTip || tipLoading) return;
    const stored = sessionStorage.getItem("fittrack_daily_tip");
    if (stored) { setDailyTip(stored); return; }
    const fetchTip = async () => {
      setTipLoading(true);
      try {
        const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, "");
        const token = localStorage.getItem("token");
        const userCtx = [
          user?.goal ? `goal: ${user.goal} weight` : "",
          user?.weight ? `weight: ${user.weight}kg` : "",
          totalCaloriesToday ? `consumed today: ${totalCaloriesToday} kcal` : "",
          totalCaloriesBurnedToday ? `burned today: ${totalCaloriesBurnedToday} kcal` : "",
        ].filter(Boolean).join(", ");
        const prompt = `Give me ONE short, actionable fitness tip for today (max 2 sentences). ${userCtx ? `User context: ${userCtx}.` : ""}`;
        const res = await fetch(`${STRAPI_URL}/api/ai-assistant/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }] }),
        });
        const data = await res.json();
        const tip = data.reply || "";
        setDailyTip(tip);
        sessionStorage.setItem("fittrack_daily_tip", tip);
      } catch { /* silent */ }
      finally { setTipLoading(false); }
    };
    fetchTip();
  }, [isUserFetched]);

  const cardCls = `bg-white dark:bg-slate-800/90 dark:backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5`;
  const softCardCls = `bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5`;
  const tabCls = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
      active ? "bg-emerald-500 text-white" : "text-gray-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
    }`;

  if (!isUserFetched) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
        <div className="bg-emerald-500 px-5 pt-10 pb-20" />
        <div className="px-4 -mt-12 space-y-4 max-w-2xl mx-auto">
          {[32, 28, 24, 24, 40, 52].map((h, i) => <SkeletonCard key={i} height={`h-${h}`} />)}
        </div>
      </div>
    );
  }

  const cfg = CHART_CFG[chartTab];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white pb-10 overflow-y-auto transition-colors duration-200">

      {/* Hero — flat brand fill, not a gradient. Meta's hero pattern is
          photography/solid-first; introducing a teal blend here would be
          exactly the kind of stray third accent the system's Don'ts forbid. */}
      <div className="bg-emerald-500 px-5 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute top-10 -right-4 w-24 h-24 rounded-full bg-white/5" />
        <p className="text-emerald-100 text-xs font-medium mb-1">Welcome back!</p>
        <h1 className="text-2xl font-bold tracking-tight text-white">Hi there! 👋 {user?.username ?? "User"}</h1>
        {user?.goal && (
          <div className="mt-4 flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <span className="text-amber-300 text-base">🎯</span>
            <span className="text-amber-100 text-xs font-medium">
              Goal: <span className="font-bold text-white">{user.goal}</span>
            </span>
          </div>
        )}
      </div>

      <div className="px-4 -mt-12 space-y-4 max-w-2xl mx-auto">

        {/* Streak + Net */}
        <div className={`grid grid-cols-2 gap-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "150ms" }}>
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-2xl">🔥</span>
            <span className="text-2xl font-bold text-amber-500 mt-1">{streak} {streak === 1 ? "day" : "days"}</span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Active Streak</span>
            <span className="text-xs text-amber-500/70 dark:text-amber-500/60">{streak > 0 ? "Keep it going!" : "Start today!"}</span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-2xl">⚖️</span>
            <span className={`text-2xl font-bold mt-1 ${netColor}`}>{netLabel} kcal</span>
            <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Net Calories</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">Eaten − Burned</span>
          </div>
        </div>

        {/* ── Circular rings: calories consumed + burned ── */}
        <div className={`${cardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "0ms" }}>
          <h3 className="text-sm font-bold mb-4">Today's Goals</h3>
          <div className="flex flex-wrap justify-center gap-4 md:flex-nowrap md:justify-around">
            <RingProgress value={totalCaloriesToday} max={calorieLimit} color="#0064e0" size={120} label="Calories In" sublabel="consumed" />
            <RingProgress value={totalCaloriesBurnedToday} max={calorieBurnGoal} color="#f97316" size={120} label="Calories Out" sublabel="burned" />
            <RingProgress value={totalActivityMinutes} max={60} color="#a121ce" size={120} label="Active Time" sublabel="minutes" />
          </div>
        </div>

        {/* ── Water tracker ── */}
        <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <WaterTracker logs={allWaterLogs} onAdd={handleAddWater} onRemove={handleRemoveWater} />
        </div>

        {/* ── Macro breakdown ── */}
        <div className={`${softCardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "250ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Today's Macros</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Protein", value: macrosToday.protein, color: "text-blue-500", bg: "bg-blue-500/10", unit: "g" },
              { label: "Carbs",   value: macrosToday.carbs,   color: "text-amber-500", bg: "bg-amber-500/10", unit: "g" },
              { label: "Fat",     value: macrosToday.fat,     color: "text-pink-500", bg: "bg-pink-500/10", unit: "g" },
            ].map((m) => (
              <div key={m.label} className={`${m.bg} rounded-xl p-3 text-center`}>
                <p className={`text-lg font-bold ${m.color}`}>{Math.round(m.value)}{m.unit}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          {macrosToday.protein === 0 && macrosToday.carbs === 0 && macrosToday.fat === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-3">
              Log meals with macro details to see your breakdown
            </p>
          )}
        </div>

        {/* ── Achievements ── */}
        <div className={`${softCardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Achievements</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">{earnedBadges.length}/{BADGE_DEFS.length} earned</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(showAllBadges ? BADGE_DEFS : BADGE_DEFS.slice(0, 4)).map((b) => {
              const earned = earnedBadges.some((e) => e.id === b.id);
              return (
                <div
                  key={b.id}
                  title={b.desc}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                    earned
                      ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400"
                      : "bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/30 text-slate-400 dark:text-slate-600"
                  }`}
                >
                  <span className={earned ? "" : "grayscale opacity-40"}>{b.icon}</span>
                  {b.label}
                </div>
              );
            })}
          </div>
          {BADGE_DEFS.length > 4 && (
            <button onClick={() => setShowAllBadges(!showAllBadges)} className="mt-3 text-xs text-emerald-500 hover:text-emerald-600 cursor-pointer">
              {showAllBadges ? "Show less" : `Show all ${BADGE_DEFS.length} badges`}
            </button>
          )}
        </div>

        {/* ── Today's Summary ── */}
        <div className={`${softCardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "350ms" }}>
          <h3 className="text-sm font-bold mb-4">Today's Summary</h3>
          <div className="space-y-0">
            {[
              { label: "Meals Logged",       value: todayFoodLogs.length,               icon: "🍽️" },
              { label: "Calories Consumed",  value: `${totalCaloriesToday} kcal`,        icon: "🔥" },
              { label: "Calories Burned",    value: `${totalCaloriesBurnedToday} kcal`,  icon: "⚡" },
              { label: "Active Time",        value: `${totalActivityMinutes} min`,        icon: "⏱️" },
              { label: "Water Intake",       value: `${allWaterLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today).reduce((s, l) => s + (l.amount ?? 0), 0)} ml`, icon: "💧" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                  <span>{row.icon}</span><span>{row.label}</span>
                </div>
                <span className="text-sm font-bold">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BMI + Body ── */}
        {bmi && (
          <div className={`${softCardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "400ms" }}>
            <p className="text-xs text-gray-400 dark:text-slate-400 mb-3">Body Metrics</p>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400 dark:text-slate-400">BMI</span>
              <span className="text-emerald-500 font-bold">{bmi} — {bmiLabel(bmi)}</span>
            </div>
            <BmiBar value={bmi} />
          </div>
        )}

        {/* ── Weekly chart with macro tabs ── */}
        <div className={`${softCardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "450ms" }}>
          <h3 className="text-sm font-bold mb-1">Weekly Trends</h3>
          {/* Tab bar */}
          <div className="flex gap-1 mb-4 mt-2 flex-wrap">
            {(["calories", "protein", "carbs", "fat"] as const).map((t) => (
              <button key={t} onClick={() => setChartTab(t)} className={tabCls(chartTab === t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} barGap={4} barCategoryGap="30%">
              <XAxis dataKey="day" tick={{ fill: isLight ? "#9ca3af" : "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }} />
              <Bar dataKey={cfg.key} name={cfg.key} radius={[4, 4, 0, 0]} fill={cfg.color} />
              {"burnKey" in cfg && <Bar dataKey={cfg.burnKey} name={cfg.burnKey} radius={[4, 4, 0, 0]} fill={cfg.burnColor} />}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.color }} /> {cfg.key}
            </div>
            {"burnKey" in cfg && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-400">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: cfg.burnColor }} /> {cfg.burnKey}
              </div>
            )}
          </div>
        </div>

        {/* Daily AI Tip */}
        <div className={`${cardCls} transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "500ms" }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-violet-500/15 rounded-xl flex items-center justify-center text-base">💡</div>
            <span className="text-sm font-bold">FitBot's Tip for Today</span>
          </div>
          {tipLoading ? (
            <div className="flex gap-1.5 items-center py-1">
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
            </div>
          ) : dailyTip ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{dailyTip}</p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Log your food or activity to get a personalized tip.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "600ms" }}>
          <h3 className="text-sm font-bold mb-3 text-gray-900 dark:text-white">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Log Food",      icon: "🍽️", path: "/food",      color: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400" },
              { label: "Log Workout",   icon: "💪", path: "/activity",  color: "bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400" },
              { label: "Ask FitBot",    icon: "🤖", path: "/ai",        color: "bg-violet-500/10 border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400" },
              { label: "Meal Planner",  icon: "📅", path: "/planner",   color: "bg-pink-500/10 border-pink-200 dark:border-pink-500/30 text-pink-700 dark:text-pink-400" },
              { label: "Activity Planner", icon: "🏃", path: "/activity-planner", color: "bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-400" },
            ].map(({ label, icon, path, color }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`flex items-center gap-3 p-4 rounded-2xl border ${color} hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 cursor-pointer text-left`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
