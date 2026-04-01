import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useappcontext } from "../Context/AppContext";
import { useTheme } from "../Context/Themecontext";

// ── Helpers ────────────────────────────────────────────────

// Strapi entityService returns `createdAt` not `date` unless explicitly set.
// Resolve whichever field exists — same logic used in FoodLog.tsx
const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

const today = new Date().toDateString();

const getLastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      dateStr: d.toDateString(),
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });

const calcBMI = (weightKg: number, heightCm: number) => {
  const h = heightCm / 100;
  return parseFloat((weightKg / (h * h)).toFixed(1));
};

const bmiLabel = (bmi: number) => {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25)   return "Normal";
  if (bmi < 30)   return "Overweight";
  return "Obese";
};

// ── Sub-components ─────────────────────────────────────────
const ProgressBar = ({ value, max, color, bg }: { value: number; max: number; color: string; bg: string }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={`w-full h-2 rounded-full ${bg} overflow-hidden`}>
      <div className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const StatCard = ({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: string }) => (
  <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col gap-1 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200">
    <span className="text-xl">{icon}</span>
    <span className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</span>
    <span className="text-xs font-medium text-gray-600 dark:text-slate-300">{label}</span>
    <span className="text-xs text-gray-400 dark:text-slate-500">{sub}</span>
  </div>
);

const BmiBar = ({ value }: { value: number }) => {
  const segments = [
    { label: "Under",  color: "bg-sky-400"     },
    { label: "Normal", color: "bg-emerald-400"  },
    { label: "Over",   color: "bg-amber-400"    },
    { label: "Obese",  color: "bg-rose-500"     },
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

// ── Skeleton loader ────────────────────────────────────────
const SkeletonCard = ({ height = "h-28" }: { height?: string }) => (
  <div className={`${height} rounded-2xl animate-pulse bg-slate-200 dark:bg-slate-800`} />
);

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const [visible, setVisible] = useState(false);
  const { user, allFoodLogs, allActivityLogs, isUserFetched } = useappcontext();
  const { theme } = useTheme();
  const isLight = theme.toString() === "light";

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  // ── Today's food logs — resolve date from either `date` or `createdAt`
  const todayFoodLogs = useMemo(
    () => allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [allFoodLogs]
  );

  // ── Today's activity logs — same date resolution
  const todayActivityLogs = useMemo(
    () => allActivityLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [allActivityLogs]
  );

  const totalCaloriesToday = useMemo(
    () => todayFoodLogs.reduce((sum, l) => sum + (l.calories ?? 0), 0),
    [todayFoodLogs]
  );

  const totalCaloriesBurnedToday = useMemo(
    () => todayActivityLogs.reduce((sum, l) => sum + (l.calories ?? l.caloriesBurned ?? 0), 0),
    [todayActivityLogs]
  );

  const totalActivityMinutes = useMemo(
    () => todayActivityLogs.reduce((sum, l) => sum + (l.duration ?? 0), 0),
    [todayActivityLogs]
  );

  // Goals come from user profile set during onboarding (stored in Strapi users table)
  const calorieLimit    = user?.dailycaloriesintake ?? 2000;
  const calorieBurnGoal = user?.dailycaloriesburned ?? 400;

  const bmi = user?.weight && user?.height ? calcBMI(user.weight, user.height) : null;

  // ── Weekly chart — use resolveDate for both log types
  const weeklyData = useMemo(() => {
    const days = getLastSevenDays();
    return days.map(({ dateStr, day }) => ({
      day,
      Intake: allFoodLogs
        .filter((l) => new Date(resolveDate(l)).toDateString() === dateStr)
        .reduce((s, l) => s + (l.calories ?? 0), 0),
      Burned: allActivityLogs
        .filter((l) => new Date(resolveDate(l)).toDateString() === dateStr)
        .reduce((s, l) => s + (l.calories ?? l.caloriesBurned ?? 0), 0),
    }));
  }, [allFoodLogs, allActivityLogs]);

  const fadeClass = () =>
    `transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`;

  const cardCls    = `bg-white dark:bg-slate-800/90 dark:backdrop-blur border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5`;
  const softCardCls = `bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5`;

  // ── Skeleton while Strapi data is loading on reload
  if (!isUserFetched) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-10">
        <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 pt-10 pb-20" />
        <div className="px-4 -mt-12 space-y-4 max-w-2xl mx-auto">
          <SkeletonCard height="h-32" />
          <SkeletonCard height="h-32" />
          <div className="grid grid-cols-2 gap-4">
            <SkeletonCard height="h-24" />
            <SkeletonCard height="h-24" />
          </div>
          <SkeletonCard height="h-40" />
          <SkeletonCard height="h-52" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white pb-10 overflow-y-auto transition-colors duration-200">

      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 pt-10 pb-20 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute top-10 -right-4 w-24 h-24 rounded-full bg-white/5" />
        <p className="text-emerald-100 text-xs font-medium mb-1">Welcome back!</p>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Hi there! 👋 {user?.username ?? "User"}
        </h1>
        {user?.goal && (
          <div className="mt-4 flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 rounded-xl px-4 py-2.5 backdrop-blur-sm">
            <span className="text-amber-300 text-base">🎯</span>
            <span className="text-amber-100 text-xs font-medium">
              Goal: <span className="font-bold text-white">{user.goal}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Cards ── */}
      <div className="px-4 -mt-12 space-y-4 max-w-2xl mx-auto">

        {/* Calories Consumed — live from allFoodLogs */}
        <div className={`${cardCls} ${fadeClass()}`} style={{ transitionDelay: "0ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-lg">🔥</div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Calories Consumed</span>
                <span className="text-xs text-gray-400 dark:text-slate-400">
                  Limit: <span className="text-gray-900 dark:text-white font-bold">{calorieLimit}</span>
                </span>
              </div>
              <div className="text-2xl font-bold text-emerald-500 mt-0.5">{totalCaloriesToday}</div>
            </div>
          </div>
          <ProgressBar value={totalCaloriesToday} max={calorieLimit} color="bg-emerald-500" bg="bg-slate-200 dark:bg-slate-700" />
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-2">
            Still remaining:{" "}
            <span className="text-emerald-500 font-semibold">
              {Math.max(calorieLimit - totalCaloriesToday, 0)} kcal
            </span>
          </p>
        </div>

        {/* Calories Burned — live from allActivityLogs */}
        <div className={`${cardCls} ${fadeClass()}`} style={{ transitionDelay: "100ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-lg">⚡</div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold">Calories Burned</span>
                <span className="text-xs text-gray-400 dark:text-slate-400">
                  Goal: <span className="text-gray-900 dark:text-white font-bold">{calorieBurnGoal} kcal</span>
                </span>
              </div>
              <div className="text-2xl font-bold text-orange-500 mt-0.5">{totalCaloriesBurnedToday} kcal</div>
            </div>
          </div>
          <ProgressBar value={totalCaloriesBurnedToday} max={calorieBurnGoal} color="bg-orange-500" bg="bg-slate-200 dark:bg-slate-700" />
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-2">
            {totalCaloriesBurnedToday >= calorieBurnGoal
              ? <span className="text-emerald-500 font-semibold">✓ Burn goal reached!</span>
              : <span>Remaining: <span className="text-orange-500 font-semibold">{calorieBurnGoal - totalCaloriesBurnedToday} kcal</span></span>
            }
          </p>
        </div>

        {/* Meals + Workouts */}
        <div className={`grid grid-cols-2 gap-4 ${fadeClass()}`} style={{ transitionDelay: "200ms" }}>
          <StatCard label="Meals Logged"  value={todayFoodLogs.length}     sub="Today"              icon="🍽️" />
          <StatCard label="Workouts"      value={todayActivityLogs.length}  sub="Activities logged"  icon="💪" />
        </div>

        {/* Goal + Body Metrics */}
        <div className={`grid grid-cols-2 gap-4 ${fadeClass()}`} style={{ transitionDelay: "300ms" }}>
          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200">
            <div className="w-9 h-9 bg-violet-500/20 rounded-xl flex items-center justify-center text-lg mb-3">🎯</div>
            <div>
              <p className="text-xs text-gray-400 dark:text-slate-400 mb-1">Your Goal</p>
              <p className="text-sm font-bold capitalize">{user?.goal ?? "—"}</p>
            </div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200">
            <p className="text-xs text-gray-400 dark:text-slate-400 mb-3">Body Metrics</p>
            <div className="space-y-2 text-xs mb-3">
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-400">⚖️ Weight</span>
                <span className="font-semibold">{user?.weight ? `${user.weight} kg` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-400">📏 Height</span>
                <span className="font-semibold">{user?.height ? `${user.height} cm` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-400">BMI</span>
                <span className="text-emerald-500 font-bold">{bmi ?? "—"}</span>
              </div>
            </div>
            {bmi && <BmiBar value={bmi} />}
            {bmi && <p className="text-[10px] text-center text-gray-400 dark:text-slate-400 mt-2">{bmiLabel(bmi)}</p>}
          </div>
        </div>

        {/* Today's Summary */}
        <div className={`${softCardCls} ${fadeClass()}`} style={{ transitionDelay: "400ms" }}>
          <h3 className="text-sm font-bold mb-4">Today's Summary</h3>
          <div className="space-y-0">
            {[
              { label: "Meals Logged",      value: todayFoodLogs.length,                icon: "🍽️" },
              { label: "Calories Consumed", value: `${totalCaloriesToday} kcal`,         icon: "🔥" },
              { label: "Calories Burned",   value: `${totalCaloriesBurnedToday} kcal`,   icon: "⚡" },
              { label: "Active Time",       value: `${totalActivityMinutes} min`,         icon: "⏱️" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-200 dark:border-slate-700/40 last:border-0">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                  <span>{row.icon}</span>
                  <span>{row.label}</span>
                </div>
                <span className="text-sm font-bold">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Chart */}
        <div className={`${softCardCls} ${fadeClass()}`} style={{ transitionDelay: "500ms" }}>
          <h3 className="text-sm font-bold mb-1">This Week's Progress</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">Calories in vs. burned</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} barGap={4} barCategoryGap="30%">
              <XAxis
                dataKey="day"
                tick={{ fill: isLight ? "#9ca3af" : "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="Intake" name="Intake" radius={[4, 4, 0, 0]} fill="#10b981" />
              <Bar dataKey="Burned" name="Burned" radius={[4, 4, 0, 0]} fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Intake
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-400">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Burned
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}