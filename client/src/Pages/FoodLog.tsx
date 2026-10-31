import { resolveDate } from "../utils/dates";
import { useState, useMemo, useRef, useEffect, useCallback, type MutableRefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useappcontext } from "../Context/AppContext";
import type { FoodEntry } from "../assets/types";
import toast from "react-hot-toast";
import api from "../configs/api";
import { useTheme } from "../Context/Themecontext";
import DateDropdown from "../components/DateDropdown";
import CalendarHeatmap from "../components/CalendarHeatmap";
import { StaggerContainer, StaggerItem } from "../components/animations/StaggerList";
import AnimatedNumber from "../components/AnimatedNumber";
import { deriveGoals } from "../utils/deriveGoals";
import { enqueueOfflineMutation } from "../utils/offlineSyncQueue";
import { getAuthToken } from "../configs/authToken";
import { prepareImageForUpload, ImageResizeError } from "../utils/imageResize";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const sanitizeImageSrc = (value: string, allowedBlobUrls?: Set<string>): string => {
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol === "blob:") {
      if (allowedBlobUrls && !allowedBlobUrls.has(value)) return "";
      return value;
    }
    return "";
  } catch {
    return "";
  }
};

const MEAL_CONFIG: Record<MealType, { label: string; icon: string; color: string; bg: string; iconBg: string; border: string }> = {
  breakfast: { label: "Breakfast", icon: "☕", color: "text-amber-400",  bg: "bg-amber-400/15",  iconBg: "bg-amber-400/20",  border: "border-amber-400/30"  },
  lunch:     { label: "Lunch",     icon: "🥪", color: "text-orange-400", bg: "bg-orange-400/15", iconBg: "bg-orange-400/20", border: "border-orange-400/30" },
  dinner:    { label: "Dinner",    icon: "🌙", color: "text-blue-400",   bg: "bg-blue-400/15",   iconBg: "bg-blue-400/20",   border: "border-blue-400/30"   },
  snack:     { label: "Snack",     icon: "🍓", color: "text-pink-400",   bg: "bg-pink-400/15",   iconBg: "bg-pink-400/20",   border: "border-pink-400/30"   },
};

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

type LogEntryLike = {
  id?: string;
  name?: string;
  calories?: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  mealType?: MealType | string;
  mealtype?: MealType | string;
  date?: string;
  createdAt?: string;
  attributes?: Record<string, unknown>;
  aiGenerated?: boolean;
};

const normalizeFoodEntry = (raw: LogEntryLike | null | undefined): (FoodEntry & { aiGenerated?: boolean }) | null => {
  if (!raw) return null;
  if (raw.attributes && typeof raw.attributes === "object") {
    return { id: String(raw.id ?? ""), ...raw.attributes } as unknown as FoodEntry;
  }
  const rawMealType = String(raw.mealType ?? raw.mealtype ?? "snack").toLowerCase();
  const mealType: MealType = (MEAL_ORDER as readonly string[]).includes(rawMealType) ? (rawMealType as MealType) : "snack";
  return {
    id: String(raw.id ?? ""),
    name: raw.name ?? "",
    calories: raw.calories ?? 0,
    protein: raw.protein ?? undefined,
    carbs: raw.carbs ?? undefined,
    fat: raw.fat ?? undefined,
    mealType,
    date: raw.date ?? raw.createdAt ?? new Date().toISOString(),
    aiGenerated: raw.aiGenerated,
  };
};

// Resolve mealType from either casing (mealType or legacy mealtype)
const resolveMealType = (entry: { mealType?: string; mealtype?: string }): MealType => {
  const m = (entry.mealType ?? entry.mealtype ?? "snack").toLowerCase();
  return (MEAL_ORDER as readonly string[]).includes(m) ? (m as MealType) : "snack";
};

// ── Circular SVG Macro Gauge ──────────────────────────────────
export const CircularMacroGauge = ({
  value,
  max,
  color,
  label,
  unit = "g",
  size = 80,
  strokeWidth = 7,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(value, 0) / Math.max(max, 1), 1);
  const dash = pct * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-700/60"
          />
          <motion.circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-none">
            <AnimatedNumber value={Math.round(value)} />
          </span>
          <span className="text-[9px] text-gray-400 dark:text-slate-500">{unit}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300">{label}</p>
        <p className="text-[10px] text-gray-400 dark:text-slate-500">
          / {Math.round(max)}{unit}
        </p>
      </div>
    </div>
  );
};

// ── Interactive Food Snap Low-Confidence Adjustment Modal ─────
type FoodSnapReviewData = {
  previewUrl: string;
  mealType: MealType;
  analysis: {
    dishTitle: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFats: number;
    overallConfidence: number;
    items?: Array<{
      name: string;
      weightGrams: number;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      confidenceScore: number;
    }>;
  };
};

const FoodSnapAdjustmentModal = ({
  data,
  onCommit,
  onCancel,
  allowedPreviewUrlsRef,
}: {
  data: FoodSnapReviewData;
  onCommit: (adjusted: LogEntryLike) => Promise<void>;
  onCancel: () => void;
  allowedPreviewUrlsRef: MutableRefObject<Set<string>>;
}) => {
  const [portionMultiplier, setPortionMultiplier] = useState(1.0);
  const [oilAdjustmentKcal, setOilAdjustmentKcal] = useState(0);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(data.mealType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { analysis } = data;

  const baseCalories = analysis.totalCalories || 0;
  const baseProtein = analysis.totalProtein || 0;
  const baseCarbs = analysis.totalCarbs || 0;
  const baseFats = analysis.totalFats || 0;

  // Additional fat grams estimated at ~9 kcal per gram of cooking oil
  const additionalFatGrams = Math.round((oilAdjustmentKcal / 9) * 10) / 10;

  const adjustedCalories = Math.max(0, Math.round(baseCalories * portionMultiplier + oilAdjustmentKcal));
  const adjustedProtein = Math.max(0, Math.round(baseProtein * portionMultiplier * 10) / 10);
  const adjustedCarbs = Math.max(0, Math.round(baseCarbs * portionMultiplier * 10) / 10);
  const adjustedFats = Math.max(0, Math.round((baseFats * portionMultiplier + additionalFatGrams) * 10) / 10);

  const confidencePct = Math.round((analysis.overallConfidence || 0.6) * 100);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onCommit({
        name: analysis.dishTitle || "Analyzed Meal",
        calories: adjustedCalories,
        protein: adjustedProtein,
        carbs: adjustedCarbs,
        fat: adjustedFats,
        mealtype: selectedMealType,
        mealType: selectedMealType,
        date: new Date().toISOString(),
        aiGenerated: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-900">
              <img src={sanitizeImageSrc(data.previewUrl, allowedPreviewUrlsRef.current)} alt="Snap preview" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                  {analysis.dishTitle || "Meal Review"}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                  {confidencePct}% Conf
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI flagged for verification. Adjust portion & oil below:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-gray-900 dark:hover:text-white text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Meal Type Picker */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {MEAL_ORDER.map((m) => {
            const cfg = MEAL_CONFIG[m];
            return (
              <button
                type="button"
                key={m}
                onClick={() => setSelectedMealType(m)}
                className={`py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  selectedMealType === m
                    ? `${cfg.bg} border-current ${cfg.color}`
                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400 bg-slate-50 dark:bg-slate-700/40"
                }`}
              >
                <span>{cfg.icon}</span> {cfg.label}
              </button>
            );
          })}
        </div>

        {/* 1-Tap Portion Adjustment Chips */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
            1-Tap Portion Adjustment
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "0.5x Half", mult: 0.5 },
              { label: "0.75x Small", mult: 0.75 },
              { label: "1.0x Normal", mult: 1.0 },
              { label: "1.25x Generous", mult: 1.25 },
              { label: "1.5x Large", mult: 1.5 },
              { label: "2.0x Double", mult: 2.0 },
            ].map((chip) => (
              <button
                type="button"
                key={chip.mult}
                onClick={() => setPortionMultiplier(chip.mult)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  portionMultiplier === chip.mult
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-400"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* 1-Tap Oil / Cooking Method Chips */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
            1-Tap Oil & Dressing Adjustments
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Oil-Free (-50 kcal)", delta: -50 },
              { label: "Light Oil (-30 kcal)", delta: -30 },
              { label: "As Detected (±0)", delta: 0 },
              { label: "+1 tsp Oil (+45 kcal)", delta: 45 },
              { label: "+1 tbsp Oil (+120 kcal)", delta: 120 },
              { label: "Heavy Ghee/Oil (+150 kcal)", delta: 150 },
              { label: "+Extra Dressing (+80 kcal)", delta: 80 },
            ].map((chip) => (
              <button
                type="button"
                key={chip.delta}
                onClick={() => setOilAdjustmentKcal(chip.delta)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  oilAdjustmentKcal === chip.delta
                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-700/60 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-amber-400"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Adjusted Macro Preview */}
        <div className="rounded-2xl p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 mb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Adjusted Totals
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🔥</span>
              <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                <AnimatedNumber value={adjustedCalories} />
              </span>
              <span className="text-xs text-slate-500">kcal</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-[10px] font-bold text-blue-500">Protein</p>
              <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                <AnimatedNumber value={adjustedProtein} />g
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] font-bold text-amber-500">Carbs</p>
              <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                <AnimatedNumber value={adjustedCarbs} />g
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20">
              <p className="text-[10px] font-bold text-pink-500">Fat</p>
              <p className="text-sm font-extrabold text-pink-600 dark:text-pink-400">
                <AnimatedNumber value={adjustedFats} />g
              </p>
            </div>
          </div>
        </div>

        {/* Itemized Detected Ingredients */}
        {analysis.items && analysis.items.length > 0 && (
          <div className="mb-5 space-y-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Detected Ingredients ({analysis.items.length})
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {analysis.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700"
                >
                  <span className="font-medium text-gray-800 dark:text-slate-200 truncate">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 text-slate-500 dark:text-slate-400">
                    <span>{Math.round(item.weightGrams * portionMultiplier)}g</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {Math.round(item.calories * portionMultiplier)} kcal
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-1/3 py-3 rounded-full border border-slate-300 dark:border-slate-600 font-semibold text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="w-2/3 py-3 rounded-full bg-emerald-500 hover:bg-emerald-600 font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirm & Log Meal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Add Food Modal ─────────────────────────────────────────
const AddFoodModal = ({
  defaultMeal, setShowForm, onAdd,
}: {
  defaultMeal: MealType;
  setShowForm: (show: boolean) => void;
  onAdd: (entry: LogEntryLike | null | undefined) => void;
}) => {
  const [name, setName]         = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein]   = useState("");
  const [carbs, setCarbs]       = useState("");
  const [fat, setFat]           = useState("");
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [loading, setLoading]   = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ protein: number; carbs: number; fat: number } | null>(null);
  const [aiFit, setAiFit] = useState<{ message: string; caloriePercentageOfRemaining: number } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-emerald-500 transition-colors";

  // Auto-estimate via /api/food-estimate as user types (debounced 700ms)
  const fetchAiEstimate = useCallback(async (foodName: string) => {
    if (!foodName.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    setAiFit(null);
    try {
      const response = await api.post(
        "/api/food-estimate",
        { name: foodName.trim() }
      );
      const result = response.data.result;
      const fit = response.data.fit;
      if (result?.calories === undefined || result?.calories === null)
        throw new Error("Invalid estimate response from server");

      setCalories(String(result.calories));
      setProtein(String(result.protein ?? 0));
      setCarbs(String(result.carbs ?? 0));
      setFat(String(result.fat ?? 0));
      setAiResult({ protein: result.protein ?? 0, carbs: result.carbs ?? 0, fat: result.fat ?? 0 });
      setAiFit(fit || null);
    } catch (error: unknown) {
      const axiosErr = axios.isAxiosError(error) ? error : null;
      const resData = axiosErr?.response?.data as { error?: { message?: string } } | undefined;
      const message =
        resData?.error?.message ||
        (error instanceof Error ? error.message : "Could not estimate nutrition");
      toast.error(message);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const scheduleEstimate = (foodName: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setAiResult(null);
    setAiFit(null);
    debounceRef.current = setTimeout(() => fetchAiEstimate(foodName), 700);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    scheduleEstimate(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !calories)
      return toast.error("Please provide both name and calories");
    const payloadData = {
      name: name.trim(),
      calories: Number(calories),
      protein: Number(protein) || null,
      carbs: Number(carbs) || null,
      fat: Number(fat) || null,
      mealtype: mealType,
      date: new Date().toISOString(),
    };

    setLoading(true);
    try {
      const { data: raw } = await api.post(
        "/api/foodlogs",
        { data: payloadData }
      );
      onAdd(normalizeFoodEntry(raw));
      setShowForm(false);
      toast.success("Entry added!");
    } catch (error: unknown) {
      const axiosErr = axios.isAxiosError(error) ? error : null;
      if (!navigator.onLine || axiosErr?.code === "ERR_NETWORK" || (error instanceof Error && error.message.toLowerCase().includes("network"))) {
        await enqueueOfflineMutation({
          endpoint: "/api/foodlogs",
          method: "POST",
          data: { data: payloadData },
          description: `${payloadData.name} (${payloadData.calories} kcal)`,
        });
        const optimisticEntry = {
          id: `offline-${Date.now()}`,
          ...payloadData,
          createdAt: new Date().toISOString(),
        };
        onAdd(normalizeFoodEntry(optimisticEntry));
        setShowForm(false);
        toast.success("Saved offline. Will sync automatically when back online 📶");
        return;
      }
      const resData = axiosErr?.response?.data as { error?: { message?: string } } | undefined;
      toast.error(resData?.error?.message || "Failed to add food log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
      <form onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Food Entry</h2>
            <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
              <span>✦</span> AI nutrition estimation
            </p>
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
                onClick={() => setMealType(m)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                  mealType === m ? `${cfg.bg} border-current ${cfg.color}` : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 bg-slate-100 dark:bg-slate-700/50"
                }`}
              >
                <span className="text-base">{cfg.icon}</span>{cfg.label}
              </button>
            );
          })}
        </div>

        {/* Food name — triggers AI on typing */}
        <div className="space-y-3 mb-4">
          <input
            className={inputCls}
            placeholder="Food name (e.g. Grilled Chicken)"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            autoFocus
          />

          {/* Calories with spinner */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number" min="0"
                className={`${inputCls} pr-10`}
                placeholder="Calories (kcal) *"
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
            <input
              type="number" min="0" step="0.1"
              className={inputCls}
              placeholder="Protein (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" min="0" step="0.1"
              className={inputCls}
              placeholder="Carbs (g)"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
            />
            <input
              type="number" min="0" step="0.1"
              className={inputCls}
              placeholder="Fat (g)"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
            />
          </div>
        </div>

        {/* AI Result Card */}
        {aiResult && (
          <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <span>✦</span> AI Estimate
            </span>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-slate-400">
              <span className="text-blue-500 font-medium">P: {aiResult.protein}g</span>
              <span className="text-amber-500 font-medium">C: {aiResult.carbs}g</span>
              <span className="text-pink-500 font-medium">F: {aiResult.fat}g</span>
            </div>
            {aiFit && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                🎯 {aiFit.message}
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              💡 Edit any value above if needed before saving.
            </p>
          </div>
        )}

        <button type="submit"
          disabled={!name.trim() || !calories || loading || aiLoading}
          className="w-full py-3 font-bold rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white bg-emerald-500 hover:bg-emerald-600"
        >
          {loading
            ? <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
            : aiLoading
            ? "Estimating…"
            : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Add Entry</>
          }
        </button>
      </form>
    </div>
  );
};

// ── Food Item Card ─────────────────────────────────────────
const FoodItemCard = ({ entry, onDelete }: {
  entry: FoodEntry;
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
    <motion.div
      layout
      variants={StaggerItem}
      className={`rounded-2xl p-4 transition-all duration-150 border hover:-translate-y-0.5 hover:shadow-md ${confirmId === entry.id ? "bg-rose-950/30 dark:bg-rose-950/40 border-rose-500/30" : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/50"}`}
    >
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

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-gray-900 dark:text-white">{entry.calories}</span>
          <span className="text-xs text-slate-500">kcal</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      {(entry.protein || entry.carbs || entry.fat) ? (
        <div className="flex gap-3 mt-1">
          {entry.protein ? <span className="text-[11px] text-blue-500 font-medium">P: {Math.round(entry.protein)}g</span> : null}
          {entry.carbs   ? <span className="text-[11px] text-amber-500 font-medium">C: {Math.round(entry.carbs)}g</span>   : null}
          {entry.fat     ? <span className="text-[11px] text-pink-500 font-medium">F: {Math.round(entry.fat)}g</span>     : null}
        </div>
      ) : null}
    </motion.div>
  );
};

// ── Meal Section ───────────────────────────────────────────
const MealSection = ({ mealType, entries, onDelete }: {
  mealType: MealType; entries: FoodEntry[]; onDelete: (id: string) => void;
}) => {
  if (entries.length === 0) return null;
  const cfg = MEAL_CONFIG[mealType];
  const total = entries.reduce((s, e) => s + (e.calories ?? 0), 0);

  return (
    <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50">
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

      <motion.div variants={StaggerContainer} initial="hidden" animate="show" className="px-4 pb-4 space-y-2">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <FoodItemCard
              key={entry.id ?? entry.name}
              entry={entry}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ── AI Snap Loading Overlay ────────────────────────────────
const AISnapLoadingOverlay = ({
  imagePreview,
  status = "analyzing",
}: {
  imagePreview: string;
  status?: "preparing" | "analyzing";
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div className="relative z-10 flex flex-col items-center gap-5 p-8 rounded-3xl shadow-2xl max-w-xs w-full mx-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-emerald-500/25">
        <img
          src={sanitizeImageSrc(imagePreview)}
          alt="Food snap"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/20 via-transparent to-transparent animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="w-8 h-8 rounded-full animate-spin border-[3px] border-emerald-500/20 border-t-emerald-500" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          {status === "preparing" ? "Preparing photo…" : "Analyzing your meal…"}
        </p>
        <p className="text-xs text-slate-500 text-center">
          {status === "preparing"
            ? "Optimizing resolution and compressing image for fast recognition"
            : "Gemini Vision is parsing ingredients and calculating macros"}
        </p>
      </div>
    </div>
  </div>
);

// ── Camera Modal ───────────────────────────────────────────
const CameraModal = ({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => setError("Camera access denied or not available."));
    return stopStream;
  }, [stopStream]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopStream();
      onCapture(file);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { stopStream(); onClose(); }} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-700">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80">
          <p className="text-sm font-semibold text-white">Take a Photo</p>
          <button type="button" onClick={() => { stopStream(); onClose(); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg leading-none">✕</button>
        </div>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
          {error ? (
            <p className="text-slate-400 text-sm text-center px-6">{error}</p>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!ready && <div className="absolute inset-0 flex items-center justify-center"><div className="w-8 h-8 rounded-full animate-spin border-2 border-white/20 border-t-white" /></div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-center py-5 bg-slate-900/80">
          <button
            type="button"
            onClick={handleSnap}
            disabled={!ready || !!error}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Capture photo"
          >
            <div className="w-10 h-10 rounded-full bg-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────
export default function FoodLog() {
  const { allFoodLogs, setAllFoodLogs, isUserFetched, user } = useappcontext();
  const { theme, toggleTheme } = useTheme();
  const [showForm, setShowForm]       = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<MealType>("breakfast");
  const [snapStatus, setSnapStatus]   = useState<"preparing" | "analyzing" | null>(null);
  const isAnalyzing = Boolean(snapStatus);
  const [snapPreview, setSnapPreview] = useState<string | null>(null);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [snapReviewData, setSnapReviewData] = useState<FoodSnapReviewData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const allowedPreviewUrlsRef = useRef<Set<string>>(new Set());

  const openCamera = () => { setShowSnapMenu(false); setShowCamera(true); };

  const today = new Date().toDateString();

  const todayLogs = useMemo(() => {
    const target = filterDate
      ? new Date(filterDate).toDateString()
      : today;
    return allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === target);
  }, [allFoodLogs, filterDate, today]);

  const totalCalories = useMemo(
    () => todayLogs.reduce((s, l) => s + (l.calories ?? 0), 0),
    [todayLogs]
  );

  const todayMacros = useMemo(() => {
    return todayLogs.reduce(
      (acc, l) => ({
        protein: acc.protein + (Number(l.protein) || 0),
        carbs: acc.carbs + (Number(l.carbs) || 0),
        fat: acc.fat + (Number(l.fat) || 0),
      }),
      { protein: 0, carbs: 0, fat: 0 }
    );
  }, [todayLogs]);

  const userGoals = useMemo(() => deriveGoals(user), [user]);

  const byMeal = useMemo(() => {
    const map: Record<MealType, typeof todayLogs> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    todayLogs.forEach((l) => {
      const m = resolveMealType(l);
      map[m].push(l);
    });
    return map;
  }, [todayLogs]);

  const openModal = (meal: MealType) => { setDefaultMeal(meal); setShowForm(true); };

  const handleAdd = (entry: (Partial<FoodEntry> & { mealtype?: MealType }) | LogEntryLike | null | undefined) => {
    if (!entry) return;
    const normalized = { ...entry, date: resolveDate(entry) } as FoodEntry;
    if ("mealtype" in entry && entry.mealtype && !normalized.mealType) {
      normalized.mealType = entry.mealtype as MealType;
    }
    setAllFoodLogs((prev: FoodEntry[]) => {
      if (prev.some((l) => l.id === normalized.id)) return prev;
      return [...prev, normalized];
    });
  };

  const handleDelete = async (id: string) => {
    setAllFoodLogs((prev: FoodEntry[]) => prev.filter((l) => l.id !== id));
    try {
      await api.delete(`/api/foodlogs/${id}`);
      toast.success("Entry deleted");
    } catch (error: unknown) {
      const token = getAuthToken();
      if (token) {
        const { data } = await api.get("/api/foodlogs");
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setAllFoodLogs(list);
      }
      const axiosErr = axios.isAxiosError(error) ? error : null;
      const resData = axiosErr?.response?.data as { error?: { message?: string } } | undefined;
      toast.error(resData?.error?.message || "Failed to delete entry");
    }
  };

  const processImageFile = async (file: File) => {
    if (snapStatus) return; // double-submit guard
    let currentPreviewUrl: string | null = null;

    const hour = new Date().getHours();
    let mealType: MealType = "snack";
    if (hour >= 0 && hour < 12)       mealType = "breakfast";
    else if (hour >= 12 && hour < 16) mealType = "lunch";
    else if (hour >= 16 && hour < 21) mealType = "dinner";
    else                               mealType = "snack";

    try {
      setSnapStatus("preparing");

      // Immediate preview so the user gets instant visual feedback
      try {
        currentPreviewUrl = URL.createObjectURL(file);
        allowedPreviewUrlsRef.current.add(currentPreviewUrl);
        setSnapPreview(currentPreviewUrl);
      } catch {
        // Fall back gracefully if object URL allocation fails
      }

      // Resize and compress client-side to <= 1024px and clean JPEG
      const prepared = await prepareImageForUpload(file, { generateDataUrl: true });

      // If resized successfully, point preview to resized output
      if (prepared.blob) {
        try {
          const resizedUrl = URL.createObjectURL(prepared.blob);
          allowedPreviewUrlsRef.current.add(resizedUrl);
          if (currentPreviewUrl) {
            URL.revokeObjectURL(currentPreviewUrl);
            allowedPreviewUrlsRef.current.delete(currentPreviewUrl);
          }
          currentPreviewUrl = resizedUrl;
          setSnapPreview(resizedUrl);
        } catch {
          // Keep current preview if allocation fails
        }
      }

      setSnapStatus("analyzing");

      const formData = new FormData();
      const ext = prepared.mime === "image/webp" ? ".webp" : ".jpg";
      const baseName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "food-snap";
      formData.append("image", prepared.blob, `${baseName}${ext}`);

      // Single-Roundtrip: request analysis with ?autoSave=true
      const response = await api.post("/api/image-analysis?autoSave=true", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data = response.data;
      const analysis = data.analysis || data.result;

      if (data.autoSaved && data.savedRecord) {
        // High confidence (>= 0.75): auto-saved in 1 HTTP roundtrip!
        handleAdd(normalizeFoodEntry(data.savedRecord));
        const confPct = Math.round((analysis?.overallConfidence ?? 0.8) * 100);
        const fitMsg = data?.fit?.message ? ` (${data.fit.message})` : "";
        toast.success(
          `✨ Auto-saved: ${analysis?.dishTitle || data.savedRecord.name} · ${data.savedRecord.calories} kcal (${confPct}% conf)${fitMsg}`
        );
        if (currentPreviewUrl) {
          URL.revokeObjectURL(currentPreviewUrl);
          allowedPreviewUrlsRef.current.delete(currentPreviewUrl);
          currentPreviewUrl = null;
        }
      } else {
        // Lower confidence (< 0.75): render interactive 1-tap portion/oil adjustment chips before committing
        setSnapReviewData({
          previewUrl: currentPreviewUrl || "",
          mealType,
          analysis: analysis || {
            dishTitle: "Detected Food",
            totalCalories: data.result?.calories || 300,
            totalProtein: data.result?.protein || 10,
            totalCarbs: data.result?.carbs || 30,
            totalFats: data.result?.fat || 10,
            overallConfidence: analysis?.overallConfidence || 0.65,
          },
        });
        currentPreviewUrl = null;
      }
    } catch (error: unknown) {
      console.error("AI Food Snap error:", error);
      if (error instanceof ImageResizeError) {
        toast.error(error.friendlyMessage);
      } else {
        const axiosErr = axios.isAxiosError(error) ? error : null;
        const resData = axiosErr?.response?.data as { error?: { message?: string }; message?: string } | undefined;
        const status = axiosErr?.response?.status;

        if (status === 413) {
          toast.error("Image is too large for the server (over 4MB). Please choose a smaller photo.");
        } else if (status === 415) {
          toast.error("Unsupported image type. Please use JPEG, PNG, or WebP.");
        } else if (status === 400) {
          toast.error(resData?.error?.message || resData?.message || "Invalid image file. Please choose a different photo.");
        } else {
          toast.error(resData?.error?.message || resData?.message || "Could not analyze image. Please add manually.");
        }
        openModal(mealType);
      }
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
        allowedPreviewUrlsRef.current.delete(currentPreviewUrl);
        currentPreviewUrl = null;
      }
    } finally {
      setSnapStatus(null);
      setSnapPreview(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    processImageFile(file);
  };

  const handleCommitAdjustedSnap = async (payload: LogEntryLike) => {
    try {
      const { data: raw } = await api.post(
        "/api/foodlogs",
        { data: payload }
      );
      handleAdd(normalizeFoodEntry(raw));
      toast.success(`Logged: ${payload.name} · ${payload.calories} kcal`);
      if (snapReviewData?.previewUrl) {
        URL.revokeObjectURL(snapReviewData.previewUrl);
      }
      setSnapReviewData(null);
    } catch (err: unknown) {
      const axiosErr = axios.isAxiosError(err) ? err : null;
      const resData = axiosErr?.response?.data as { error?: { message?: string } } | undefined;
      toast.error(resData?.error?.message || "Failed to log meal");
      throw err;
    }
  };

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    processImageFile(file);
  };

  const hasMeals = MEAL_ORDER.some((m) => byMeal[m].length > 0);

  if (!isUserFetched) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">
        <div className="page-header-food">
          <div className="max-w-6xl mx-auto flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Food Log</h1>
              <p className="text-sm text-amber-100/90 mt-0.5">Track your daily intake</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-100/80">Today's Total</p>
              <div className="h-8 w-28 rounded-lg animate-pulse mt-0.5 bg-white/20" />
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-6 w-full lg:grid lg:grid-cols-[380px,1fr] lg:gap-6">
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
      {isAnalyzing && snapPreview && (
        <AISnapLoadingOverlay imagePreview={snapPreview} status={snapStatus || "analyzing"} />
      )}
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}
      {snapReviewData && (
        <FoodSnapAdjustmentModal
          data={snapReviewData}
          allowedPreviewUrlsRef={allowedPreviewUrlsRef}
          onCommit={handleCommitAdjustedSnap}
          onCancel={() => {
            if (snapReviewData.previewUrl) {
              URL.revokeObjectURL(snapReviewData.previewUrl);
              allowedPreviewUrlsRef.current.delete(snapReviewData.previewUrl);
            }
            setSnapReviewData(null);
          }}
        />
      )}

      {/* ── Header ── */}
      <div className="page-header-food">
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Food Log</h1>
            <p className="text-sm text-amber-100/90 mt-0.5">Track your daily intake</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-amber-100/80">Today's Total</p>
              <p className="text-2xl font-bold text-white">
                <AnimatedNumber value={totalCalories} /> kcal
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 hover:bg-white/25 border border-white/20 text-white transition-colors duration-200 cursor-pointer backdrop-blur-sm"
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
      </div>

      {/* ── Macro Overview Gauges (Circular SVG & Rolling Numbers) ── */}
      <div className="max-w-6xl mx-auto px-6 pt-5">
        <div className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Daily Macro Targets
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Live progress with rolling counters</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {Math.round((totalCalories / Math.max(userGoals.calorieLimit, 1)) * 100)}% of Calorie Budget
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <CircularMacroGauge
              value={totalCalories}
              max={userGoals.calorieLimit}
              color="#10b981"
              label="Calories"
              unit="kcal"
            />
            <CircularMacroGauge
              value={todayMacros.protein}
              max={userGoals.proteinGoal}
              color="#3b82f6"
              label="Protein"
              unit="g"
            />
            <CircularMacroGauge
              value={todayMacros.carbs}
              max={userGoals.carbsGoal}
              color="#f59e0b"
              label="Carbs"
              unit="g"
            />
            <CircularMacroGauge
              value={todayMacros.fat}
              max={userGoals.fatGoal}
              color="#ec4899"
              label="Fat"
              unit="g"
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 lg:grid lg:grid-cols-[380px,1fr] lg:gap-6 lg:items-start">

        {/* ── Left Panel ── */}
        <div className="space-y-3 mb-6 lg:mb-0">
          <DateDropdown
            logs={allFoodLogs}
            colorClass="text-emerald-400"
            label="Food Log"
            selectedDate={filterDate}
            onSelectDate={(dateStr) => setFilterDate(dateStr)}
          />
          {filterDate && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Showing: {new Date(filterDate).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </p>
              <button onClick={() => setFilterDate(null)} className="text-xs text-emerald-500 hover:text-emerald-600 cursor-pointer">
                Show today
              </button>
            </div>
          )}

          <CalendarHeatmap
            logs={allFoodLogs}
            selectedDate={filterDate}
            onSelectDate={(dateStr) => setFilterDate(dateStr)}
            colorTheme="emerald"
            type="food"
          />

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
            className="w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-full cursor-pointer text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Food Entry
          </button>

          {/* AI Food Snap button */}
          <button
            type="button"
            onClick={() => !isAnalyzing && setShowSnapMenu(true)}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 py-3.5 font-bold rounded-full cursor-pointer disabled:opacity-50 text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            {snapStatus === "preparing" ? (
              <><div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />Preparing photo…</>
            ) : snapStatus === "analyzing" ? (
              <><div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />Analyzing…</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>AI Food Snap ✨</>
            )}
          </button>

          {showSnapMenu && !isAnalyzing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSnapMenu(false)} />
              <div className="relative z-10 w-full max-w-xs mx-4 rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">AI Food Snap ✨</p>
                    <p className="text-xs text-slate-500 mt-0.5">Choose how to add your food photo</p>
                  </div>
                  <button type="button" onClick={() => setShowSnapMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer text-lg leading-none">✕</button>
                </div>

                <div className="p-4 flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => { setShowSnapMenu(false); inputRef.current?.click(); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400/50 disabled:opacity-50 transition-all cursor-pointer group"
                  >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-400/15 text-emerald-500 group-hover:bg-emerald-400/25 transition-colors shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white">Upload Image</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose a photo from your gallery</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => { setShowSnapMenu(false); openCamera(); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-400/50 disabled:opacity-50 transition-all cursor-pointer group"
                  >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-400/15 text-blue-500 group-hover:bg-blue-400/25 transition-colors shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white">Take Photo</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Use your camera to snap a meal</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          <input onChange={handleImageChange} type="file" accept="image/jpeg,image/png,image/webp" hidden ref={inputRef} disabled={isAnalyzing} />
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
