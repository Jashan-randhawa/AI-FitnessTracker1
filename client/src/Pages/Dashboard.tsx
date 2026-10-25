import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useappcontext } from "../Context/AppContext";
import { useTheme } from "../Context/Themecontext";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import toast from "react-hot-toast";
import { RefreshCw } from "lucide-react";
import AnimatedNumber from "../components/AnimatedNumber";
import { StaggerContainer, StaggerItem } from "../components/animations/StaggerList";
import { FitBotAvatar } from "../components/FitBotAvatar";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { fetchDailyFitnessTip } from "../services/aiAssistantClient";
import { dateKey } from "../utils/dailyTotals";
import { useDaySummary, useRangeSummary } from "../data/summaryStore";
import { localDayKey, addDaysKey } from "../utils/localDay";
import { summaryRowsToTotals } from "../utils/summaryTotals";
import { deriveGoals } from "../utils/deriveGoals";
import { withBadgeState, nextBadge } from "../utils/badges";
import {
  TIP_THROTTLE_MS,
  computeTipSignature,
  parseStoredTip,
  serializeStoredTip,
  shouldRefreshTip,
} from "../utils/dashboardTip";
import { createHandoffState } from "../utils/handoff";

// ── Helpers ────────────────────────────────────────────────
const getLastSevenDays = (_refDate?: string) =>
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

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
};

// ── useToday Hook ──────────────────────────────────────────
const useToday = (): string => {
  const [today, setToday] = useState(() => new Date().toDateString());

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const scheduleMidnightTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      const msUntilMidnight = Math.max(tomorrow.getTime() - now.getTime(), 1000);

      timerId = setTimeout(() => {
        setToday(new Date().toDateString());
        scheduleMidnightTimer();
      }, msUntilMidnight);
    };

    scheduleMidnightTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const current = new Date().toDateString();
        setToday((prev) => {
          if (prev !== current) {
            if (timerId) clearTimeout(timerId);
            scheduleMidnightTimer();
            return current;
          }
          return prev;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return today;
};

const SkeletonCard = ({ height = "h-28" }: { height?: string }) => (
  <div className={`${height} rounded-2xl skeleton-shimmer-card`} />
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
const RING_EASE = [0.16, 1, 0.3, 1] as const; // cubic-bezier(0.16, 1, 0.3, 1)

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
  const goalMet = pct >= 1;
  const wasGoalMet = useRef(false);
  const ringRef = useRef<HTMLDivElement>(null);

  // Fire a confetti burst exactly once, the moment the ring crosses 100%.
  useEffect(() => {
    if (goalMet && !wasGoalMet.current) {
      wasGoalMet.current = true;
      const rect = ringRef.current?.getBoundingClientRect();
      const origin = rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.5 };
      confetti({
        particleCount: 36,
        spread: 55,
        startVelocity: 28,
        gravity: 1,
        scalar: 0.7,
        origin,
        colors: [color, "#ffffff"],
        disableForReducedMotion: true,
      });
    } else if (!goalMet) {
      wasGoalMet.current = false;
    }
  }, [goalMet, color]);

  return (
    <div ref={ringRef} className="flex flex-col items-center gap-2">
      <div className={`relative ${goalMet ? "ring-goal-glow" : ""}`} style={{ width: size, height: size, borderRadius: "9999px" }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cx} r={r} fill="none"
            stroke="currentColor" strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-700" />
          <motion.circle
            cx={cx} cy={cx} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1, ease: RING_EASE }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-900 dark:text-white" style={{ lineHeight: 1 }}>
            <AnimatedNumber value={value} />
          </span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">/ {Math.round(max)}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{label}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">{sublabel}</p>
      </div>
    </div>
  );
};

// ── Water tracker quick-add ────────────────────────────────
const WATER_BTNS = [150, 250, 350, 500];

const WaterTracker = ({
  logs,
  onAdd,
  onRemoveLast,
  today,
  todayTotal: propTodayTotal,
  waterGoal = 2500,
}: {
  logs?: any[];
  onAdd: (ml: number) => void;
  onRemoveLast?: () => void;
  today: string;
  todayTotal?: number;
  waterGoal?: number;
}) => {
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const calculatedTotal = useMemo(
    () => (logs ?? []).filter((l) => dateKey(l) === today).reduce((s, l) => s + (l.amount ?? 0), 0),
    [logs, today]
  );
  const todayTotal = propTodayTotal ?? calculatedTotal;
  const pct = Math.min((todayTotal / Math.max(waterGoal, 1)) * 100, 100);
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
        Goal: {waterGoal} ml · {Math.max(waterGoal - todayTotal, 0)} ml remaining
      </p>

      {/* Quick-add buttons */}
      <div className="flex gap-2 flex-wrap mb-2">
        {WATER_BTNS.map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="flex-1 sm:flex-initial text-center px-3 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 active:scale-95 text-white transition-all cursor-pointer"
          >
            +{ml} ml
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex-1 sm:flex-initial text-center px-3 py-2 rounded-xl text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 active:scale-95 transition-all cursor-pointer"
        >
          Custom
        </button>
      </div>

      {onRemoveLast && todayTotal > 0 && (
        <button
          onClick={onRemoveLast}
          className="mb-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Remove last entry
        </button>
      )}

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

// ── Responsive hook ────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
};

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const today = useToday();
  const isMobile = useIsMobile();
  const { user, allWaterLogs, setAllWaterLogs, isUserFetched } = useappcontext();
  const { theme } = useTheme();
  const isLight = theme.toString() === "light";
  const navigate = useNavigate();

  const [dailyTip, setDailyTip] = useState("");
  const [tipLoading, setTipLoading] = useState(false);
  const [chartTab, setChartTab] = useState<"calories" | "protein" | "carbs" | "fat">("calories");
  const [showAllBadges, setShowAllBadges] = useState(false);

  // Totals, streak, goals and achievements come from the server's summaries.
  // The 14-day range covers this week and the week before it (for trends).
  const todayKey = useMemo(() => localDayKey(new Date(today)), [today]);
  const daySummary = useDaySummary(todayKey);
  const rangeSummary = useRangeSummary(addDaysKey(todayKey, -13), todayKey);
  const daily = useMemo(
    () => summaryRowsToTotals(rangeSummary.data?.days ?? []),
    [rangeSummary.data]
  );

  const todayTotals = daily.get(today);
  const totalCaloriesToday = todayTotals?.calories ?? 0;
  const totalCaloriesBurnedToday = todayTotals?.burned ?? 0;
  const totalActivityMinutes = todayTotals?.minutes ?? 0;
  const mealsLoggedToday = todayTotals?.meals ?? 0;
  const waterTodayTotal = todayTotals?.water ?? 0;

  const goals = useMemo(() => daySummary.data?.goals ?? deriveGoals(user), [daySummary.data, user]);
  const calorieLimit = goals.calorieLimit;
  const calorieBurnGoal = goals.calorieBurnGoal;
  const bmi = user?.weight && user?.height ? calcBMI(user.weight, user.height) : null;

  const streak = daySummary.data?.streak ?? 0;
  const netCalories = totalCaloriesToday - totalCaloriesBurnedToday;
  const netColor = netCalories > calorieLimit * 0.1 ? "text-rose-500" : netCalories < 0 ? "text-sky-500" : "text-emerald-500";
  const greeting = useMemo(() => getGreeting(), []);

  // ── Badges (earned state and progress from the server) ──
  const badgeViews = useMemo(() => withBadgeState(daySummary.data?.badges), [daySummary.data]);
  const earnedBadges = useMemo(() => badgeViews.filter((b) => b.earned), [badgeViews]);
  const nextBadgeProgress = useMemo(() => nextBadge(badgeViews), [badgeViews]);

  // ── Macro totals today ───────────────────────────────────
  const macrosToday = useMemo(() => ({
    protein: todayTotals?.protein ?? 0,
    carbs: todayTotals?.carbs ?? 0,
    fat: todayTotals?.fat ?? 0,
  }), [todayTotals]);

  // ── Weekly chart data ────────────────────────────────────
  const weeklyData = useMemo(() => {
    const days = getLastSevenDays(today);
    return days.map(({ dateStr, day }) => {
      const totals = daily.get(dateStr);
      return {
        day,
        Calories: totals?.calories ?? 0,
        Protein: Math.round(totals?.protein ?? 0),
        Carbs: Math.round(totals?.carbs ?? 0),
        Fat: Math.round(totals?.fat ?? 0),
        Burned: totals?.burned ?? 0,
      };
    });
  }, [daily, today]);

  // ── Weekly Summary Strip & Trend vs Last Week ────────────
  const weeklySummary = useMemo(() => {
    const days = getLastSevenDays();
    let foodDaysCount = 0;
    let activityDaysCount = 0;
    let totalCalories = 0;
    let totalBurned = 0;
    let totalProtein = 0;
    let daysOnTarget = 0;

    for (const { dateStr } of days) {
      const dayTotals = daily.get(dateStr);
      if (dayTotals) {
        if (dayTotals.hasFood || dayTotals.meals > 0) {
          foodDaysCount++;
          totalCalories += dayTotals.calories;
          totalProtein += dayTotals.protein;
          if (dayTotals.calories <= calorieLimit) {
            daysOnTarget++;
          }
        }
        if (dayTotals.hasActivity || dayTotals.burned > 0 || dayTotals.minutes > 0) {
          activityDaysCount++;
          totalBurned += dayTotals.burned;
        }
      }
    }

    const avgCalories = foodDaysCount > 0 ? Math.round(totalCalories / foodDaysCount) : null;
    const avgBurned = activityDaysCount > 0 ? Math.round(totalBurned / activityDaysCount) : null;
    const avgProtein = foodDaysCount > 0 ? Math.round(totalProtein / foodDaysCount) : null;

    // Trend vs previous 7 days (days -13 to -7)
    let prevFoodDaysCount = 0;
    let prevTotalCalories = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const prevTotals = daily.get(d.toDateString());
      if (prevTotals && (prevTotals.hasFood || prevTotals.meals > 0)) {
        prevFoodDaysCount++;
        prevTotalCalories += prevTotals.calories;
      }
    }

    let calorieTrend: { percent: number; direction: "up" | "down" | "flat" } | null = null;
    if (foodDaysCount >= 3 && prevFoodDaysCount >= 3 && avgCalories !== null) {
      const prevAvgCalories = Math.round(prevTotalCalories / prevFoodDaysCount);
      if (prevAvgCalories > 0) {
        const diff = Math.round(((avgCalories - prevAvgCalories) / prevAvgCalories) * 100);
        calorieTrend = {
          percent: Math.abs(diff),
          direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        };
      }
    }

    return {
      avgCalories,
      avgBurned,
      daysOnTarget,
      avgProtein,
      calorieTrend,
    };
  }, [daily, calorieLimit]);

  // ── Chart config by tab ──────────────────────────────────
  const CHART_CFG = {
    calories: { key: "Calories", color: "#10b981", burnKey: "Burned", burnColor: "#f97316" },
    protein:  { key: "Protein",  color: "#3b82f6" },
    carbs:    { key: "Carbs",    color: "#f59e0b" },
    fat:      { key: "Fat",      color: "#ec4899" },
  } as const;

  // ── Water log helpers ────────────────────────────────────
  const handleRemoveLastWater = useCallback(async () => {
    const todayLogs = allWaterLogs.filter((l) => dateKey(l) === today);
    const last = [...todayLogs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    if (!last) return;
    const id = last.id;
    setAllWaterLogs((prev: any[]) => prev.filter((e) => e.id !== id));
    try {
      await api.delete(`/api/waterlogs/${id}`);
    } catch {
      toast.error("Could not remove that entry");
      try {
        const { data } = await api.get("/api/waterlogs");
        setAllWaterLogs(Array.isArray(data) ? data : []);
      } catch {
        // Next live update or page load will resync the list.
      }
    }
  }, [allWaterLogs, today, setAllWaterLogs]);

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
      // Normalise response — may be nested under .data or flat
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

  // ── Daily AI tip (Phase A / G3) ───────────────────────────
  const tipLoadingRef = useRef(false);

  const fetchTip = useCallback(
    async (force = false) => {
      if (!isUserFetched || tipLoadingRef.current) return;
      const cacheKey = `fittrack_daily_tip_${today}`;
      let rawStored: string | null = null;
      try {
        rawStored = sessionStorage.getItem(cacheKey);
      } catch {
        /* silent */
      }
      const parsed = parseStoredTip(rawStored);
      const currentSignature = computeTipSignature(daySummary.data);

      if (!force && !shouldRefreshTip(parsed, currentSignature)) {
        if (parsed?.tip) {
          setDailyTip(parsed.tip);
        }
        return;
      }

      tipLoadingRef.current = true;
      setTipLoading(true);
      try {
        // Goal, weight, and today's totals come from the server context.
        const tip = await fetchDailyFitnessTip("");
        if (tip) {
          setDailyTip(tip);
          try {
            sessionStorage.setItem(
              cacheKey,
              serializeStoredTip(tip, currentSignature, Date.now())
            );
          } catch {
            /* silent */
          }
        }
      } catch {
        // Keep previous tip on error
      } finally {
        tipLoadingRef.current = false;
        setTipLoading(false);
      }
    },
    [isUserFetched, today, daySummary.data]
  );

  useEffect(() => {
    try {
      sessionStorage.removeItem("fittrack_daily_tip");
    } catch {
      /* silent */
    }

    if (!isUserFetched) return;
    const cacheKey = `fittrack_daily_tip_${today}`;
    try {
      const rawStored = sessionStorage.getItem(cacheKey);
      const parsed = parseStoredTip(rawStored);
      if (parsed?.tip) {
        setDailyTip(parsed.tip);
      } else {
        setDailyTip("");
      }
    } catch {
      /* silent */
    }

    fetchTip(false);
  }, [isUserFetched, today, daySummary.data, fetchTip]);

  // Dynamic tip freshness re-check (Phase G / N5)
  // Schedules a wake-up as soon as the throttle window expires based on stored tip timestamp,
  // with a 1-minute heartbeat and visibility-change re-check so tips never wait past throttle.
  useEffect(() => {
    if (!isUserFetched) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const checkFreshness = () => {
      const cacheKey = `fittrack_daily_tip_${today}`;
      try {
        const stored = parseStoredTip(sessionStorage.getItem(cacheKey));
        if (stored?.timestamp) {
          const elapsed = Date.now() - stored.timestamp;
          if (elapsed >= TIP_THROTTLE_MS) {
            fetchTip(false);
          } else {
            const remaining = Math.max(1000, TIP_THROTTLE_MS - elapsed);
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fetchTip(false), remaining);
          }
        } else {
          fetchTip(false);
        }
      } catch {
        fetchTip(false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkFreshness();
      }
    };

    const interval = setInterval(checkFreshness, 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isUserFetched, today, fetchTip]);

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
        <div className="relative z-10 px-4 -mt-12 space-y-4 max-w-2xl mx-auto">
          {["h-32", "h-28", "h-24", "h-24", "h-40", "h-52"].map((h, i) => (
            <SkeletonCard key={i} height={h} />
          ))}
        </div>
      </div>
    );
  }

  const cfg = CHART_CFG[chartTab];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white pb-10 overflow-y-auto transition-colors duration-200">

      {/* Hero */}
      <div className="page-header-dashboard">
        <p className="text-emerald-100 text-xs font-medium mb-1">Welcome back!</p>
        <h1 className="text-2xl font-bold tracking-tight text-white">{greeting}, {user?.username ?? "User"} 👋</h1>
        {user?.goal && (
          <div className="mt-4 flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <span className="text-amber-300 text-base">🎯</span>
            <span className="text-amber-100 text-xs font-medium">
              Goal: <span className="font-bold text-white">{user.goal}</span>
            </span>
          </div>
        )}
      </div>

      <motion.div variants={StaggerContainer} initial="hidden" animate="show" className="relative z-10 px-4 -mt-8 sm:-mt-12 space-y-4 max-w-2xl mx-auto">

        {/* Streak + Net */}
        <motion.div variants={StaggerItem} className="grid grid-cols-2 gap-4">
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-2xl">🔥</span>
            <span className="text-2xl font-bold text-amber-500 mt-1"><AnimatedNumber value={streak} /> {streak === 1 ? "day" : "days"}</span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Active Streak</span>
            <span className="text-xs text-amber-500/70 dark:text-amber-500/60">{streak > 0 ? "Keep it going!" : "Start today!"}</span>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-2xl">⚖️</span>
            <span className={`text-2xl font-bold mt-1 ${netColor}`}>{netCalories > 0 ? "+" : ""}<AnimatedNumber value={netCalories} /> kcal</span>
            <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Net Calories</span>
            <span className="text-xs text-gray-400 dark:text-slate-500">Eaten − Burned</span>
          </div>
        </motion.div>

        {/* ── Circular rings: calories consumed + burned ── */}
        <motion.div variants={StaggerItem} className={cardCls}>
          <h3 className="text-sm font-bold mb-3 sm:mb-4">Today's Goals</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4 justify-items-center">
            <RingProgress value={totalCaloriesToday} max={calorieLimit} color="#0064e0" size={isMobile ? 94 : 120} strokeWidth={isMobile ? 8 : 10} label="Calories In" sublabel="consumed" />
            <RingProgress value={totalCaloriesBurnedToday} max={calorieBurnGoal} color="#f97316" size={isMobile ? 94 : 120} strokeWidth={isMobile ? 8 : 10} label="Calories Out" sublabel="burned" />
            <RingProgress value={totalActivityMinutes} max={60} color="#a121ce" size={isMobile ? 94 : 120} strokeWidth={isMobile ? 8 : 10} label="Active Time" sublabel="minutes" />
          </div>
        </motion.div>

        {/* ── Water tracker ── */}
        <motion.div variants={StaggerItem}>
          <WaterTracker logs={allWaterLogs} onAdd={handleAddWater} onRemoveLast={handleRemoveLastWater} today={today} todayTotal={waterTodayTotal} waterGoal={goals.waterGoal} />
        </motion.div>

        {/* ── Macro breakdown ── */}
        <motion.div variants={StaggerItem} className={softCardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Today's Macros</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: "Protein",
                value: macrosToday.protein,
                goal: goals.proteinGoal,
                color: "text-blue-500",
                barColor: "bg-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                label: "Carbs",
                value: macrosToday.carbs,
                goal: goals.carbsGoal,
                color: "text-amber-500",
                barColor: "bg-amber-500",
                bg: "bg-amber-500/10",
              },
              {
                label: "Fat",
                value: macrosToday.fat,
                goal: goals.fatGoal,
                color: "text-pink-500",
                barColor: "bg-pink-500",
                bg: "bg-pink-500/10",
              },
            ].map((m) => {
              const pct = Math.min(Math.round((m.value / Math.max(m.goal, 1)) * 100), 100);
              return (
                <div key={m.label} className={`${m.bg} rounded-xl p-3 flex flex-col justify-between`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">{m.label}</span>
                    <span className={`text-xs font-bold ${m.color}`}>{pct}%</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                    <AnimatedNumber value={m.value} /> <span className="text-xs font-normal text-gray-400 dark:text-slate-400">/ {m.goal} g</span>
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                    <div
                      className={`h-full ${m.barColor} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {macrosToday.protein === 0 && macrosToday.carbs === 0 && macrosToday.fat === 0 && (
            <p className="text-xs text-gray-400 dark:text-slate-500 text-center mt-3">
              Log meals with macro details to see your breakdown
            </p>
          )}
        </motion.div>

        {/* ── Achievements ── */}
        <motion.div variants={StaggerItem} className={softCardCls}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Achievements</h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">{earnedBadges.length}/{badgeViews.length} earned</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(showAllBadges ? badgeViews : badgeViews.slice(0, 4)).map((b) => {
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

          {/* Next closest badge progress */}
          {nextBadgeProgress && (
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/40">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>{nextBadgeProgress.badge.icon}</span>
                  Next: {nextBadgeProgress.badge.label}
                </span>
                <span className="text-gray-500 dark:text-slate-400 font-medium">
                  {nextBadgeProgress.current} / {nextBadgeProgress.target} {nextBadgeProgress.badge.unit ?? ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${nextBadgeProgress.pct}%` }}
                />
              </div>
            </div>
          )}

          {badgeViews.length > 4 && (
            <button onClick={() => setShowAllBadges(!showAllBadges)} className="mt-3 text-xs text-emerald-500 hover:text-emerald-600 cursor-pointer">
              {showAllBadges ? "Show less" : `Show all ${badgeViews.length} badges`}
            </button>
          )}
        </motion.div>

        {/* ── Today's Summary ── */}
        <motion.div variants={StaggerItem} className={softCardCls}>
          <h3 className="text-sm font-bold mb-4">Today's Summary</h3>
          <div className="space-y-0">
            {[
              { label: "Meals Logged",       value: mealsLoggedToday,                    unit: "",     icon: "🍽️" },
              { label: "Calories Consumed",  value: totalCaloriesToday,                  unit: " kcal", icon: "🔥" },
              { label: "Calories Burned",    value: totalCaloriesBurnedToday,            unit: " kcal", icon: "⚡" },
              { label: "Active Time",        value: totalActivityMinutes,                unit: " min",  icon: "⏱️" },
              { label: "Water Intake",       value: waterTodayTotal,                    unit: " ml",  icon: "💧" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                  <span>{row.icon}</span><span>{row.label}</span>
                </div>
                <span className="text-sm font-bold"><AnimatedNumber value={row.value} />{row.unit}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── BMI + Body ── */}
        {bmi && (
          <motion.div variants={StaggerItem} className={softCardCls}>
            <p className="text-xs text-gray-400 dark:text-slate-400 mb-3">Body Metrics</p>
            <div className="flex justify-between text-sm mb-3">
              <span className="text-gray-400 dark:text-slate-400">BMI</span>
              <span className="text-emerald-500 font-bold">{bmi} — {bmiLabel(bmi)}</span>
            </div>
            <BmiBar value={bmi} />
          </motion.div>
        )}

        {/* ── Weekly chart with macro tabs & summary strip ── */}
        <motion.div variants={StaggerItem} className={softCardCls}>
          <h3 className="text-sm font-bold mb-3">Weekly Trends</h3>

          {/* ── Weekly Summary Strip ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-slate-100/80 dark:bg-slate-700/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Avg Calories In</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {weeklySummary.avgCalories !== null ? `${weeklySummary.avgCalories.toLocaleString()} kcal` : "—"}
                </span>
                {weeklySummary.calorieTrend && (
                  <span
                    className={`text-[10px] font-semibold ${
                      weeklySummary.calorieTrend.direction === "up"
                        ? "text-rose-500"
                        : weeklySummary.calorieTrend.direction === "down"
                        ? "text-emerald-500"
                        : "text-slate-400"
                    }`}
                    title={`${weeklySummary.calorieTrend.direction === "up" ? "+" : "-"}${weeklySummary.calorieTrend.percent}% vs previous 7 days`}
                  >
                    {weeklySummary.calorieTrend.direction === "up" ? "▲" : weeklySummary.calorieTrend.direction === "down" ? "▼" : "•"}
                    {weeklySummary.calorieTrend.percent}%
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-700/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Avg Burned</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                {weeklySummary.avgBurned !== null ? `${weeklySummary.avgBurned.toLocaleString()} kcal` : "—"}
              </p>
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-700/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Days on Target</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                {weeklySummary.daysOnTarget}/7
              </p>
            </div>

            <div className="bg-slate-100/80 dark:bg-slate-700/30 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Avg Protein</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                {weeklySummary.avgProtein !== null ? `${weeklySummary.avgProtein}g` : "—"}
              </p>
            </div>
          </div>

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
              {chartTab === "calories" && (
                <>
                  <ReferenceLine
                    y={calorieLimit}
                    stroke={isLight ? "#059669" : "#10b981"}
                    strokeDasharray="3 3"
                  />
                  <ReferenceLine
                    y={calorieBurnGoal}
                    stroke={isLight ? "#ea580c" : "#f97316"}
                    strokeDasharray="3 3"
                  />
                </>
              )}
              {chartTab === "protein" && (
                <ReferenceLine
                  y={goals.proteinGoal}
                  stroke={isLight ? "#2563eb" : "#3b82f6"}
                  strokeDasharray="3 3"
                />
              )}
              {chartTab === "carbs" && (
                <ReferenceLine
                  y={goals.carbsGoal}
                  stroke={isLight ? "#d97706" : "#f59e0b"}
                  strokeDasharray="3 3"
                />
              )}
              {chartTab === "fat" && (
                <ReferenceLine
                  y={goals.fatGoal}
                  stroke={isLight ? "#db2777" : "#ec4899"}
                  strokeDasharray="3 3"
                />
              )}
              <Bar dataKey={cfg.key} name={cfg.key} radius={[4, 4, 0, 0]} fill={cfg.color}>
                {chartTab === "calories" && weeklyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.Calories > calorieLimit ? "#f43f5e" : cfg.color}
                  />
                ))}
              </Bar>
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
            {chartTab === "calories" && (
              <div className="flex items-center gap-1.5 text-xs text-rose-500">
                <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Over Limit
              </div>
            )}
            {chartTab !== "calories" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-3.5 h-0 border-t-2 border-dashed" style={{ borderColor: cfg.color }} /> Target ({chartTab === "protein" ? goals.proteinGoal : chartTab === "carbs" ? goals.carbsGoal : goals.fatGoal}g)
              </div>
            )}
          </div>
        </motion.div>

        {/* Daily AI Tip */}
        <motion.div variants={StaggerItem} className={cardCls}>
          <div className="flex items-center justify-between gap-2.5 mb-3">
            <div className="flex items-center gap-2.5">
              <FitBotAvatar size="xs" state={tipLoading ? "thinking" : "idle"} />
              <span className="text-sm font-bold text-gray-900 dark:text-white">FitBot's Tip for Today</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTip(true)}
              disabled={tipLoading}
              title="Refresh tip"
              aria-label="Refresh tip"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tipLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {tipLoading && !dailyTip ? (
            <div className="flex gap-1.5 items-center py-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
            </div>
          ) : dailyTip ? (
            <div className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${tipLoading ? "opacity-70 transition-opacity" : ""}`}>
              <MarkdownMessage content={dailyTip} />
              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    navigate("/ai", {
                      state: createHandoffState(
                        "dashboard",
                        "ask_followup",
                        `Regarding today's tip: "${dailyTip.replace(/\n/g, " ").slice(0, 150)}..." - could you give me specific steps to apply this?`
                      ),
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  <span>💬</span> Discuss with FitBot &rarr;
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Log your food or activity to get a personalized tip.</p>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={StaggerItem}>
          <h3 className="text-sm font-bold mb-3 text-gray-900 dark:text-white">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Log Food", icon: "🍽️", path: "/food", color: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400", handoff: null },
              { label: "Log Workout", icon: "💪", path: "/activity", color: "bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400", handoff: null },
              { label: "Ask FitBot", icon: "⚡", path: "/ai", color: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400", handoff: createHandoffState("dashboard", "ask_followup", "Hello FitBot, how is my fitness progress tracking today?") },
              { label: "Meal Planner", icon: "📅", path: "/planner", color: "bg-pink-500/10 border-pink-200 dark:border-pink-500/30 text-pink-700 dark:text-pink-400", handoff: createHandoffState("dashboard", "plan_rest_of_today", "Plan meals for today matching my remaining targets.") },
              { label: "Activity Planner", icon: "🏃", path: "/activity-planner", color: "bg-sky-500/10 border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-400", handoff: createHandoffState("dashboard", "plan_rest_of_today", "Plan a workout routine matching today's activity goal.") },
            ].map(({ label, icon, path, color, handoff }) => (
              <button
                key={label}
                onClick={() => navigate(path, handoff ? { state: handoff } : undefined)}
                className={`flex items-center gap-3 p-4 rounded-2xl border ${color} hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg active:scale-[0.98] transition-all duration-150 cursor-pointer text-left`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
