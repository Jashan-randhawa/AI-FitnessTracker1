import { useState, useMemo, useRef, useCallback } from "react";
import CalendarHeatmap from "../components/CalendarHeatmap";
import { useappcontext } from "../Context/AppContext";
import toast from "react-hot-toast";
import api from "../configs/api";

const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

const normalizeStrapiEntry = (raw: any) => {
  if (!raw) return null;
  if (raw.attributes && typeof raw.attributes === "object") {
    return { id: raw.id, ...raw.attributes };
  }
  return raw;
};

type ActivityType = "walking" | "running" | "cycling" | "swimming" | "yoga" | "weight training" | "custom";

const ACTIVITY_CONFIG: Record<string, { icon: string; color: string; bg: string; calsPerMin: number }> = {
  walking:           { icon: "🚶", color: "text-yellow-500",  bg: "bg-yellow-500/20",  calsPerMin: 5  },
  running:           { icon: "🏃", color: "text-orange-500",  bg: "bg-orange-500/20",  calsPerMin: 11 },
  cycling:           { icon: "🚴", color: "text-blue-500",    bg: "bg-blue-500/20",    calsPerMin: 8  },
  swimming:          { icon: "🏊", color: "text-cyan-500",    bg: "bg-cyan-500/20",    calsPerMin: 9  },
  yoga:              { icon: "🧘", color: "text-violet-500",  bg: "bg-violet-500/20",  calsPerMin: 4  },
  "weight training": { icon: "🏋️", color: "text-rose-500",   bg: "bg-rose-500/20",    calsPerMin: 7  },
  custom:            { icon: "⚡", color: "text-emerald-500", bg: "bg-emerald-500/20", calsPerMin: 6  },
};

const QUICK_ADD: ActivityType[] = ["walking", "running", "cycling", "swimming", "yoga", "weight training"];
const getConfig = (type: string) => ACTIVITY_CONFIG[type?.toLowerCase()] ?? ACTIVITY_CONFIG.custom;
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

// ── Add Activity Modal ─────────────────────────────────────
const AddActivityModal = ({
  defaultType, onClose, onAdd,
}: {
  defaultType: string;
  onClose: () => void;
  onAdd: (entry: { name: string; duration: number; caloriesBurned: number }) => Promise<void>;
}) => {
  const { user } = useappcontext();
  const [name, setName] = useState(defaultType !== "custom" ? defaultType : "");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    met_value: number;
    intensity: "low" | "medium" | "high";
    suggestion: string;
  } | null>(null);

  // Debounce timer ref — fires AI estimate 600ms after the user stops typing
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const INTENSITY_STYLE: Record<string, string> = {
    low:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    high:   "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };

  // Call /api/calorie-estimate and fill in calories from the AI response
  const fetchAiEstimate = useCallback(async (activityName: string, durationMin: string) => {
    if (!activityName.trim() || !durationMin || Number(durationMin) <= 0) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const token = localStorage.getItem("token");
      const { data } = await api.post(
        "/api/calorie-estimate",
        { activity: activityName, duration: Number(durationMin), weight: user?.weight },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success && data.data) {
        setCalories(String(data.data.calories_burned));
        setAiResult({
          met_value: data.data.met_value,
          intensity: data.data.intensity,
          suggestion: data.data.suggestion,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "AI estimate failed";
      toast.error(`AI: ${msg}`);
      console.error("calorie-estimate error:", err?.response?.data ?? err);
    } finally {
      setAiLoading(false);
    }
  }, [user?.weight]);

  // Trigger AI estimate with debounce whenever name or duration changes
  const scheduleEstimate = (nextName: string, nextDuration: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAiEstimate(nextName, nextDuration), 600);
  };

  const handleDurationChange = (val: string) => {
    setDuration(val);
    setAiResult(null);
    scheduleEstimate(name, val);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setAiResult(null);
    scheduleEstimate(val, duration);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !duration) {
      return toast("Please enter both activity name and duration");
    }
    await onAdd({ name: name.trim(), duration: Number(duration), caloriesBurned: Number(calories) || 0 });
    onClose();
  };

  const inputCls = "w-full bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Log Activity</h2>
            <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
              <span>✦</span> AI calorie estimation
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xl leading-none cursor-pointer">✕</button>
        </div>

        {/* Quick type pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {QUICK_ADD.map((a) => {
            const cfg = getConfig(a);
            return (
              <button
                key={a}
                onClick={() => handleNameChange(a)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer ${
                  name.toLowerCase() === a
                    ? `${cfg.bg} ${cfg.color} border-current`
                    : "bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500"
                }`}
              >
                <span>{cfg.icon}</span>
                <span className="capitalize">{a}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 mb-4">
          <input
            className={`${inputCls} capitalize`}
            placeholder="Activity name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className={inputCls}
              placeholder="Duration (min)"
              value={duration}
              onChange={(e) => handleDurationChange(e.target.value)}
            />
            <div className="relative">
              <input
                type="number"
                className={`${inputCls} pr-10`}
                placeholder="Calories burned"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
              {aiLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Result Card */}
        {aiResult && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <span>✦</span> AI Estimate
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 dark:text-slate-400">
                  MET {aiResult.met_value.toFixed(1)}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${INTENSITY_STYLE[aiResult.intensity]}`}>
                  {aiResult.intensity}
                </span>
              </div>
            </div>
            {aiResult.suggestion && (
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                💡 {aiResult.suggestion}
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !duration || aiLoading}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors duration-200 cursor-pointer"
        >
          {aiLoading ? "Estimating…" : "Log Activity"}
        </button>
      </div>
    </div>
  );
};

// ── Activity Entry Row ─────────────────────────────────────
const ActivityRow = ({ entry, onDelete }: { entry: any; onDelete: (id: string) => void }) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const cfg = getConfig(entry.name ?? entry.type);

  const handleConfirmToggle = (id: string) => {
    setConfirmId((prev) => (prev === id ? null : id));
    setTimeout(() => setConfirmId(null), 3000);
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-3.5 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/70 border-b border-slate-100 dark:border-slate-700/30 last:border-0 transition-colors duration-150"
      style={{ background: confirmId === entry.id ? "rgba(239,68,68,0.05)" : undefined }}
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 ${cfg.bg} rounded-xl flex items-center justify-center`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white capitalize">{entry.name ?? entry.type}</p>
          <p className="text-xs text-gray-400 dark:text-slate-400">{formatTime(resolveDate(entry))}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{entry.duration} min</p>
          <p className="text-xs text-gray-400 dark:text-slate-400">{entry.caloriesBurned ?? entry.calories ?? 0} kcal</p>
        </div>
        {confirmId === entry.id ? (
          <button
            onClick={() => { onDelete(entry.id); setConfirmId(null); }}
            className="text-[11px] font-bold text-rose-400 border border-rose-500/40 rounded-lg px-2 py-0.5 cursor-pointer hover:bg-rose-500/10 transition-colors"
          >
            Confirm?
          </button>
        ) : (
          <button
            onClick={() => handleConfirmToggle(entry.id)}
            className="text-gray-300 dark:text-slate-500 hover:text-rose-500 transition-colors duration-200 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main Activity Log ──────────────────────────────────────
export default function ActivityLog() {
  const { allActivityLogs, setAllActivityLogs } = useappcontext();
  const [showModal, setShowModal] = useState(false);
  const [defaultType, setDefaultType] = useState("custom");
  const [filterDate, setFilterDate] = useState<string | null>(null);

  const today = new Date().toDateString();

  const todayLogs = useMemo(() => {
    const target = filterDate
      ? new Date(filterDate).toDateString()
      : today;
    return allActivityLogs.filter((l) => new Date(resolveDate(l)).toDateString() === target);
  }, [allActivityLogs, filterDate]);

  const totalMinutes = useMemo(
    () => todayLogs.reduce((s, l) => s + (l.duration ?? 0), 0),
    [todayLogs]
  );

  const openModal = (type: string) => { setDefaultType(type); setShowModal(true); };

  const handleAdd = async ({ name, duration, caloriesBurned }: { name: string; duration: number; caloriesBurned: number }) => {
    try {
      const token = localStorage.getItem("token");
      const { data: raw } = await api.post(
        "/api/activitylogs",
        { data: { name, duration, caloriesBurned, date: new Date().toISOString() } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const entry = normalizeStrapiEntry(raw);
      if (!entry) return;
      const normalized = { ...entry, date: resolveDate(entry) };
      setAllActivityLogs((prev: any[]) => {
        if (prev.some((l) => l.id === normalized.id)) return prev;
        return [...prev, normalized];
      });
      toast.success(`${name} logged!`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to log activity");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/api/activitylogs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllActivityLogs((prev: any[]) => prev.filter((l) => l.id !== id));
      toast.success("Activity deleted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to delete activity");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60 px-5 pt-12 pb-5 lg:pt-8 transition-colors duration-200">
        <div className="flex items-start justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
            <p className="text-sm text-gray-400 dark:text-slate-400 mt-0.5">Track your workouts</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 dark:text-slate-400">Active Today</p>
            <p className="text-2xl font-bold text-blue-500 dark:text-blue-400">{totalMinutes} min</p>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[380px,1fr] lg:gap-6 lg:items-start">

        {/* ── Left Panel ── */}
        <div className="space-y-3 mb-6 lg:mb-0">
          <CalendarHeatmap
            logs={allActivityLogs}
            colorClass="bg-orange-400"
            label="Activity"
            onDayClick={(dateStr) => setFilterDate((prev) => prev === dateStr ? null : dateStr)}
          />
          {filterDate && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing: {new Date(filterDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </p>
              <button onClick={() => setFilterDate(null)} className="text-xs text-orange-500 hover:text-orange-600 cursor-pointer">
                Show today
              </button>
            </div>
          )}
          {/* Quick Add */}
          <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 transition-colors duration-200">
            <p className="text-sm font-semibold mb-3">Quick Add</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD.map((a) => {
                const cfg = getConfig(a);
                return (
                  <button
                    key={a}
                    onClick={() => openModal(a)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600/50 text-xs text-gray-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500 transition-all duration-200 cursor-pointer"
                  >
                    <span>{cfg.icon}</span>
                    <span className="capitalize">{a}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Custom */}
          <button
            onClick={() => openModal("custom")}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors duration-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Custom Activity
          </button>
        </div>

        {/* ── Right Panel ── */}
        <div>
          {todayLogs.length > 0 ? (
            <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl overflow-hidden transition-colors duration-200">
              {/* Section header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold">Today's Activities</p>
                  <p className="text-xs text-gray-400 dark:text-slate-400">{todayLogs.length} logged</p>
                </div>
              </div>

              {/* Entries */}
              <div>
                {todayLogs.map((entry) => (
                  <ActivityRow key={entry.id} entry={entry} onDelete={handleDelete} />
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/30 transition-colors duration-200">
                <span className="text-sm text-gray-400 dark:text-slate-400">Total Active Time</span>
                <span className="text-sm font-bold text-blue-500 dark:text-blue-400">{totalMinutes} minutes</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30 rounded-2xl transition-colors duration-200">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl mb-4">💪</div>
              <p className="text-gray-600 dark:text-slate-300 font-semibold">No activities logged yet</p>
              <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Use Quick Add or the button to log a workout</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddActivityModal defaultType={defaultType} onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}
