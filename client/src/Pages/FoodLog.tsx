import { useState, useMemo, useRef } from "react";
import { useappcontext } from "../Context/AppContext";
import toast from "react-hot-toast";
import api from "../configs/api";
import { useTheme } from "../Context/Themecontext";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_CONFIG: Record<MealType, { label: string; icon: string; color: string; bg: string; iconBg: string; border: string }> = {
  breakfast: { label: "Breakfast", icon: "☕", color: "text-amber-400",  bg: "bg-amber-400/15",  iconBg: "bg-amber-400/20",  border: "border-amber-400/30"  },
  lunch:     { label: "Lunch",     icon: "🥪", color: "text-orange-400", bg: "bg-orange-400/15", iconBg: "bg-orange-400/20", border: "border-orange-400/30" },
  dinner:    { label: "Dinner",    icon: "🌙", color: "text-blue-400",   bg: "bg-blue-400/15",   iconBg: "bg-blue-400/20",   border: "border-blue-400/30"   },
  snack:     { label: "Snack",     icon: "🍓", color: "text-pink-400",   bg: "bg-pink-400/15",   iconBg: "bg-pink-400/20",   border: "border-pink-400/30"   },
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

// Controller returns entity directly (no attributes wrapper)
const normalizeStrapiEntry = (raw: any) => {
  if (!raw) return null;
  if (raw.attributes && typeof raw.attributes === "object") {
    return { id: raw.id, ...raw.attributes };
  }
  // Strapi stores as lowercase — normalize mealtype → mealType
  if (raw.mealtype && !raw.mealType) raw.mealType = raw.mealtype;
  return raw;
};

const resolveDate = (entry: any): string =>
  entry.date ?? entry.createdAt ?? new Date().toISOString();

// Resolve mealType from either casing Strapi might return
const resolveMealType = (entry: any): MealType => {
  const m = entry.mealType ?? entry.mealtype ?? "snack";
  return MEAL_ORDER.includes(m) ? m : "snack";
};

// ── Add Food Modal ─────────────────────────────────────────
const AddFoodModal = ({
  defaultMeal, setShowForm, onAdd,
}: {
  defaultMeal: MealType;
  setShowForm: (show: boolean) => void;
  onAdd: (entry: any) => void;
}) => {
  const [formData, setFormData] = useState({ name: "", calories: 0, mealType: defaultMeal });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.calories)
      return toast.error("Please provide both name and calories");
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data: raw } = await api.post(
        "/api/foodlogs",
        {
          data: {
            name: formData.name.trim(),
            calories: formData.calories,
            mealtype: formData.mealType,   // ← lowercase: matches Strapi schema
            mealType: formData.mealType,   // ← also send camelCase as fallback
            date: new Date().toISOString(),
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onAdd(normalizeStrapiEntry(raw));
      setFormData({ name: "", calories: 0, mealType: defaultMeal });
      setShowForm(false);
      toast.success("Entry added!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to add food log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
      <form onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Food Entry</h2>
          </div>
          <button type="button" onClick={() => setShowForm(false)}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none cursor-pointer">✕</button>
        </div>

        {/* Meal type */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {MEAL_ORDER.map((m) => {
            const cfg = MEAL_CONFIG[m];
            return (
              <button type="button" key={m}
                onClick={() => setFormData((p) => ({ ...p, mealType: m }))}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  formData.mealType === m ? `${cfg.bg} border-current ${cfg.color}` : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 bg-slate-100 dark:bg-slate-700/50"
                }`}
              >
                <span className="text-base">{cfg.icon}</span>{cfg.label}
              </button>
            );
          })}
        </div>

        {/* Inputs */}
        <div className="space-y-3 mb-5">
          <input
            className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Food name (e.g. Toast & Milk)"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            autoFocus
          />
          <input
            type="number"
            className="w-full rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="Calories (kcal)"
            value={formData.calories || ""}
            onChange={(e) => setFormData((p) => ({ ...p, calories: Number(e.target.value) }))}
          />
        </div>

        <button type="submit"
          disabled={!formData.name.trim() || !formData.calories || loading}
          className="w-full py-3 font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-black bg-emerald-500 hover:bg-emerald-600"
        >
          {loading
            ? <div className="w-4 h-4 rounded-full animate-spin border-2 border-black/30 border-t-black" />
            : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Add Entry</>
          }
        </button>
      </form>
    </div>
  );
};

// ── Food Item Card ─────────────────────────────────────────
// Shows: item name · calories · meal type badge
const FoodItemCard = ({ entry, onDelete }: {
  entry: any;
  onDelete: (id: string) => void;
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const mealType = resolveMealType(entry);
  const cfg = MEAL_CONFIG[mealType];

  const handleConfirmToggle = (id: string) => {
    setConfirmId((prev) => (prev === id ? null : id));
    setTimeout(() => setConfirmId(null), 3000);
  };

  return (
    <div
      className={`rounded-2xl p-4 transition-all duration-150 border ${confirmId === entry.id ? "bg-rose-950/30 dark:bg-rose-950/40 border-rose-500/30" : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50"}`}
    >
      {/* Top row: name + delete */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {entry.aiGenerated && (
            <span className="shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-1.5 py-0.5">✨ AI</span>
          )}
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{entry.name}</p>
        </div>
        {confirmId === entry.id ? (
          <button onClick={() => { onDelete(entry.id); setConfirmId(null); }}
            className="shrink-0 text-[11px] font-bold text-rose-400 border border-rose-500/40 rounded-lg px-2 py-0.5 cursor-pointer hover:bg-rose-500/10 transition-colors">
            Confirm?
          </button>
        ) : (
          <button onClick={() => handleConfirmToggle(entry.id)}
            className="shrink-0 text-slate-600 hover:text-rose-500 transition-colors cursor-pointer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom row: calories + meal type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.calories}</span>
          <span className="text-xs text-slate-500">kcal</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
    </div>
  );
};

// ── Meal Section ───────────────────────────────────────────
const MealSection = ({ mealType, entries, onDelete }: {
  mealType: MealType; entries: any[]; onDelete: (id: string) => void;
}) => {
  if (entries.length === 0) return null;
  const cfg = MEAL_CONFIG[mealType];
  const total = entries.reduce((s, e) => s + (e.calories ?? 0), 0);


  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${cfg.iconBg} rounded-xl flex items-center justify-center text-lg`}>{cfg.icon}</div>
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{cfg.label}</p>
            <p className="text-xs text-slate-500">{entries.length} item{entries.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{total} kcal</span>
      </div>

      {/* Food item cards */}
      <div className="px-4 pb-4 space-y-2">
        {entries.map((entry) => (
          <FoodItemCard
            key={entry.id ?? entry.name}
            entry={entry}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

// ── AI Snap Loading Overlay ────────────────────────────────
const AISnapLoadingOverlay = ({ imagePreview }: { imagePreview: string }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div className="relative z-10 flex flex-col items-center gap-5 p-8 rounded-3xl shadow-2xl max-w-xs w-full mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500/25">
        <img src={imagePreview} alt="Food snap" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/20 via-transparent to-transparent animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-full animate-spin border-[3px] border-emerald-500/20 border-t-emerald-500" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Analyzing your meal…</p>
        <p className="text-xs text-slate-500 text-center">AI is identifying the food and estimating calories</p>
      </div>
    </div>
  </div>
);

// ── Main Page ──────────────────────────────────────────────
export default function FoodLog() {
  const { allFoodLogs, setAllFoodLogs, isUserFetched } = useappcontext();
  const { theme, toggleTheme } = useTheme();
  const [showForm, setShowForm]       = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<MealType>("breakfast");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapPreview, setSnapPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toDateString();

  const todayLogs = useMemo(
    () => allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === today),
    [allFoodLogs]
  );

  const totalCalories = useMemo(
    () => todayLogs.reduce((s, l) => s + (l.calories ?? 0), 0),
    [todayLogs]
  );

  const byMeal = useMemo(() => {
    const map: Record<MealType, typeof todayLogs> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    todayLogs.forEach((l) => {
      const m = resolveMealType(l);
      map[m].push(l);
    });
    return map;
  }, [todayLogs]);

  const openModal = (meal: MealType) => { setDefaultMeal(meal); setShowForm(true); };

  const handleAdd = (entry: any) => {
    if (!entry) return;
    const normalized = { ...entry, date: resolveDate(entry) };
    // Normalize mealtype → mealType
    if (normalized.mealtype && !normalized.mealType) normalized.mealType = normalized.mealtype;
    setAllFoodLogs((prev: any[]) => {
      if (prev.some((l) => l.id === normalized.id)) return prev;
      return [...prev, normalized];
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/api/foodlogs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllFoodLogs((prev: any[]) => prev.filter((l) => l.id !== id));
      toast.success("Entry deleted");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to delete entry");
    }
  };

 const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ""; // Reset so same file can be re-uploaded

  // Fail fast: reject oversized images before any network call
  if (file.size > 10 * 1024 * 1024) {
    toast.error("Image too large. Please use a photo under 10MB.");
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  setSnapPreview(previewUrl);
  setIsAnalyzing(true);

  // Determine mealType by time of day
  const hour = new Date().getHours();
  let mealType: MealType = "snack";
  if (hour >= 0 && hour < 12)       mealType = "breakfast";
  else if (hour >= 12 && hour < 16) mealType = "lunch";
  else if (hour >= 16 && hour < 21) mealType = "dinner";
  else                               mealType = "snack";

  try {
    const formData = new FormData();
    formData.append("image", file);

    const token = localStorage.getItem("token");

    const response = await api.post("/api/image-analysis", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
      timeout: 20000, // 20s client-side guard — prevents infinite spinner
    });

    const { name, calories } = response.data.result;

    const { data: raw } = await api.post(
      "/api/foodlogs",
      {
        data: {
          name,
          calories,
          mealtype: mealType,
          mealType: mealType,
          date: new Date().toISOString(),
          aiGenerated: true,
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    handleAdd(normalizeStrapiEntry(raw));
    toast.success(`Logged: ${name} · ${calories} kcal`);

  } catch (error: any) {
    console.error("AI Food Snap error:", error);
    const msg =
      error?.code === "ECONNABORTED"
        ? "Analysis timed out. Please try again."
        : error?.response?.data?.error?.message || "Could not analyze image. Please add manually.";
    toast.error(msg);
    openModal(mealType);
  } finally {
    setIsAnalyzing(false);
    setSnapPreview(null);
    URL.revokeObjectURL(previewUrl); // Always free blob URL
  }
};
  const hasMeals = MEAL_ORDER.some((m) => byMeal[m].length > 0);

  if (!isUserFetched) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
        <div className="px-6 pt-10 pb-6 max-w-6xl mx-auto flex items-start justify-between border-b border-slate-200 dark:border-slate-800/60">
          <div>
            <h1 className="text-2xl font-bold">Food Log</h1>
            <p className="text-sm text-slate-500 mt-0.5">Track your daily intake</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Today's Total</p>
            <div className="h-8 w-28 rounded-lg animate-pulse mt-0.5 bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 w-full lg:grid lg:grid-cols-[380px,1fr] lg:gap-6">
          <div className="space-y-3 mb-6 lg:mb-0">
            {[1,2,3].map(i => <div key={i} className="rounded-2xl h-14 animate-pulse bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />)}
          </div>
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="rounded-2xl h-28 animate-pulse bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
      {isAnalyzing && snapPreview && <AISnapLoadingOverlay imagePreview={snapPreview} />}

      {/* ── Header ── */}
      <div className="px-6 pt-10 pb-6 max-w-6xl mx-auto flex items-start justify-between border-b border-slate-200 dark:border-slate-800/60">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Food Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your daily intake</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">Today's Total</p>
            <p className="text-2xl font-bold text-emerald-400">{totalCalories} kcal</p>
          </div>
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-6 pb-10 lg:grid lg:grid-cols-[380px,1fr] lg:gap-6 lg:items-start">

        {/* ── Left Panel ── */}
        <div className="space-y-3 mb-6 lg:mb-0">
          <div className="rounded-2xl p-5 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Add</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_ORDER.map((m) => {
                const cfg = MEAL_CONFIG[m];
                return (
                  <button type="button" key={m} onClick={() => openModal(m)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 transition-all cursor-pointer"
                  >
                    <span>{cfg.icon}</span>{cfg.label.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => openModal("breakfast")}
            className="w-full flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl cursor-pointer text-black bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Food Entry
          </button>

          <button type="button" onClick={() => inputRef.current?.click()} disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl cursor-pointer disabled:opacity-50 text-black bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            {isAnalyzing ? (
              <><div className="w-4 h-4 rounded-full animate-spin border-2 border-black/30 border-t-black" />Analyzing…</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>AI Food Snap ✨</>
            )}
            <input onChange={handleImageChange} type="file" accept="image/*" hidden ref={inputRef} />
          </button>
        </div>

        {/* ── Right Panel ── */}
        <div className="space-y-4">
          {hasMeals ? (
            MEAL_ORDER.map((m) => (
              <MealSection key={m} mealType={m} entries={byMeal[m]} onDelete={handleDelete} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-slate-100 dark:bg-slate-700/60">🍽️</div>
              <p className="text-slate-300 font-semibold">No meals logged yet</p>
              <p className="text-slate-600 text-sm mt-1">Use Quick Add or AI Food Snap to get started</p>
            </div>
          )}
        </div>
      </div>

      {showForm && <AddFoodModal defaultMeal={defaultMeal} setShowForm={setShowForm} onAdd={handleAdd} />}
    </div>
  );
}
