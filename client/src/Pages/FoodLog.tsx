import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useappcontext } from "../Context/AppContext";
import toast from "react-hot-toast";
import api from "../configs/api";
import { useTheme } from "../Context/Themecontext";
import CalendarHeatmap from "../components/CalendarHeatmap";

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

// ── AI Evaluation Result Panel ─────────────────────────────
interface AIEvaluation {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  healthScore: number; // 1-10
  scoreLabel: string;
  insight: string;
  tip: string;
  badges: string[];
}

const ScoreRing = ({ score }: { score: number }) => {
  const pct = score / 10;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = score >= 7 ? "#34d399" : score >= 4 ? "#fbbf24" : "#f87171";
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-200 dark:text-slate-700" />
      <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 30 30)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
      <text x="30" y="35" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>{score}</text>
    </svg>
  );
};

// ── Add Food Modal ─────────────────────────────────────────
const AddFoodModal = ({
  defaultMeal, setShowForm, onAdd,
}: {
  defaultMeal: MealType;
  setShowForm: (show: boolean) => void;
  onAdd: (entry: any) => void;
}) => {
  const [formData, setFormData] = useState({
    name: "", calories: 0, mealType: defaultMeal,
    protein: 0, carbs: 0, fat: 0,
  });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEval, setAiEval] = useState<AIEvaluation | null>(null);

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-emerald-500 transition-colors";

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
            protein: formData.protein || null,
            carbs: formData.carbs || null,
            fat: formData.fat || null,
            mealtype: formData.mealType,
            date: new Date().toISOString(),
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onAdd(normalizeStrapiEntry(raw));
      setFormData({ name: "", calories: 0, mealType: defaultMeal, protein: 0, carbs: 0, fat: 0 });
      setAiEval(null);
      setShowForm(false);
      toast.success("Entry added!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to add food log");
    } finally {
      setLoading(false);
    }
  };

  const handleAIEstimate = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) return toast.error("Enter a food name first");

    setAiLoading(true);
    setAiEval(null);
    try {
      const prompt = `You are a nutrition expert. Analyze this food entry and return ONLY valid JSON (no markdown, no explanation):

Food: "${trimmedName}"
${formData.calories ? `User-entered calories: ${formData.calories} kcal` : ""}
${formData.protein ? `User-entered protein: ${formData.protein}g` : ""}
${formData.carbs ? `User-entered carbs: ${formData.carbs}g` : ""}
${formData.fat ? `User-entered fat: ${formData.fat}g` : ""}

Return JSON with these exact keys:
{
  "name": "cleaned food name",
  "calories": number (kcal for typical serving),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "healthScore": number (1-10, where 10=extremely nutritious/whole food, 1=highly processed/unhealthy),
  "scoreLabel": "short label like 'Excellent', 'Good', 'Fair', 'Poor'",
  "insight": "1 sentence about this food's nutritional profile",
  "tip": "1 short actionable tip to make this meal healthier or pair it well",
  "badges": ["array", "of", "1-3", "short", "tags"] (e.g. "High Protein", "Low Fat", "Whole Food", "Processed", "High Fiber", "Good Fats")
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);
      const data = await response.json();
      const text = (data.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim();
      const parsed: AIEvaluation = JSON.parse(text);

      if (!parsed.calories || !parsed.name) throw new Error("Invalid AI response");

      setAiEval(parsed);
      setFormData((prev) => ({
        ...prev,
        name: parsed.name || trimmedName,
        calories: Number(parsed.calories) || prev.calories,
        protein: Number(parsed.protein) || prev.protein,
        carbs: Number(parsed.carbs) || prev.carbs,
        fat: Number(parsed.fat) || prev.fat,
      }));
      toast.success("AI evaluation complete!");
    } catch (error: any) {
      // Fallback to backend if Anthropic API fails
      try {
        const token = localStorage.getItem("token");
        const res = await api.post(
          "/api/food-estimate",
          { name: trimmedName },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const { name, calories, protein, carbs, fat } = res.data.result ?? {};
        if (calories === undefined) throw new Error("Invalid estimate");
        setFormData((prev) => ({
          ...prev,
          name: name || trimmedName,
          calories: Number(calories) || 0,
          protein: Number(protein) || 0,
          carbs: Number(carbs) || 0,
          fat: Number(fat) || 0,
        }));
        toast.success("Calories and macros estimated");
      } catch {
        toast.error("Could not estimate nutrition. Please fill in manually.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowForm(false)} />
      <form onSubmit={handleSubmit}
        className="relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Food Entry</h2>
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

        {/* Main inputs */}
        <div className="space-y-3 mb-4">
          <input
            className={inputCls}
            placeholder="Food name (e.g. Grilled Chicken)"
            value={formData.name}
            onChange={(e) => { setFormData((p) => ({ ...p, name: e.target.value })); setAiEval(null); }}
            autoFocus
          />
          <button
            type="button"
            onClick={handleAIEstimate}
            disabled={!formData.name.trim() || aiLoading || loading}
            className="w-full py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-black bg-emerald-400 hover:bg-emerald-500"
          >
            {aiLoading ? (
              <>
                <div role="status" aria-label="Estimating nutrition" className="w-4 h-4 rounded-full animate-spin border-2 border-black/30 border-t-black" />
                <span aria-live="polite">Analyzing with AI…</span>
              </>
            ) : (
              <>✨ Evaluate calories & macros with AI</>
            )}
          </button>

          {/* ── AI Evaluation Panel ── */}
          {aiEval && !aiLoading && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-4 space-y-3 animate-in fade-in">
              {/* Score row */}
              <div className="flex items-center gap-4">
                <ScoreRing score={aiEval.healthScore} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{aiEval.scoreLabel}</span>
                    {aiEval.badges.map((b) => (
                      <span key={b} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 border border-emerald-400/25">{b}</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{aiEval.insight}</p>
                </div>
              </div>
              {/* Tip */}
              <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
                <span className="text-base shrink-0">💡</span>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{aiEval.tip}</p>
              </div>
              {/* Macro pills */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { label: "Calories", val: `${aiEval.calories}`, unit: "kcal", color: "text-orange-500" },
                  { label: "Protein",  val: `${aiEval.protein}`,  unit: "g",    color: "text-blue-500"   },
                  { label: "Carbs",    val: `${aiEval.carbs}`,    unit: "g",    color: "text-amber-500"  },
                  { label: "Fat",      val: `${aiEval.fat}`,      unit: "g",    color: "text-pink-500"   },
                ].map(({ label, val, unit, color }) => (
                  <div key={label} className="rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 p-2">
                    <p className={`text-sm font-bold ${color}`}>{val}</p>
                    <p className="text-[9px] text-slate-500">{unit}</p>
                    <p className="text-[9px] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <input
            type="number" min="0"
            className={inputCls}
            placeholder="Calories (kcal) *"
            value={formData.calories || ""}
            onChange={(e) => setFormData((p) => ({ ...p, calories: Number(e.target.value) }))}
          />
        </div>

        {/* Macros section */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
            Macros <span className="font-normal normal-case">(optional)</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "protein", label: "Protein (g)", color: "focus:border-blue-500" },
              { key: "carbs",   label: "Carbs (g)",   color: "focus:border-amber-500" },
              { key: "fat",     label: "Fat (g)",     color: "focus:border-pink-500"  },
            ].map(({ key, label, color }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-medium">{label}</label>
                <input
                  type="number" min="0" step="0.1"
                  className={`w-full rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-slate-400 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 focus:outline-none ${color} transition-colors`}
                  placeholder="0"
                  value={(formData as any)[key] || ""}
                  onChange={(e) => setFormData((p) => ({ ...p, [key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
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
      {/* Macros row — only shown when at least one macro is logged */}
      {(entry.protein || entry.carbs || entry.fat) ? (
        <div className="flex gap-3 mt-1">
          {entry.protein ? <span className="text-[11px] text-blue-500 font-medium">P: {Math.round(entry.protein)}g</span> : null}
          {entry.carbs   ? <span className="text-[11px] text-amber-500 font-medium">C: {Math.round(entry.carbs)}g</span>   : null}
          {entry.fat     ? <span className="text-[11px] text-pink-500 font-medium">F: {Math.round(entry.fat)}g</span>     : null}
        </div>
      ) : null}
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

// ── Camera Modal (getUserMedia — works on desktop & mobile) ─
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80">
          <p className="text-sm font-semibold text-white">Take a Photo</p>
          <button type="button" onClick={() => { stopStream(); onClose(); }} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg leading-none">✕</button>
        </div>

        {/* Video / Error */}
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

        {/* Snap button */}
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
  const { allFoodLogs, setAllFoodLogs, isUserFetched } = useappcontext();
  const { theme, toggleTheme } = useTheme();
  const [showForm, setShowForm]       = useState(false);
  const [defaultMeal, setDefaultMeal] = useState<MealType>("breakfast");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [snapPreview, setSnapPreview] = useState<string | null>(null);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openCamera = () => { setShowSnapMenu(false); setShowCamera(true); };

  const today = new Date().toDateString();

  const todayLogs = useMemo(() => {
    const target = filterDate
      ? new Date(filterDate).toDateString()
      : today;
    return allFoodLogs.filter((l) => new Date(resolveDate(l)).toDateString() === target);
  }, [allFoodLogs, filterDate]);

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
    // Optimistic update — remove from UI immediately, restore on failure
    setAllFoodLogs((prev: any[]) => prev.filter((l) => l.id !== id));
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/api/foodlogs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Entry deleted");
    } catch (error: any) {
      // Restore the entry by re-fetching logs on failure
      const token = localStorage.getItem("token");
      if (token) {
        const { data } = await api.get("/api/foodlogs", { headers: { Authorization: `Bearer ${token}` } });
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setAllFoodLogs(list);
      }
      toast.error(error?.response?.data?.error?.message || "Failed to delete entry");
    }
  };

 const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ""; // Reset input so same file can be uploaded again

  const previewUrl = URL.createObjectURL(file);
  setSnapPreview(previewUrl);
  setIsAnalyzing(true);

  // 1. Determine mealType by time of day
  const hour = new Date().getHours();
  let mealType: MealType = "snack";
  if (hour >= 0 && hour < 12)       mealType = "breakfast";
  else if (hour >= 12 && hour < 16) mealType = "lunch";
  else if (hour >= 16 && hour < 21) mealType = "dinner";
  else                               mealType = "snack";

  try {
    // 2. Prepare Multipart Form Data
    const formData = new FormData();
    formData.append("image", file); // must match ctx.request.files?.image in controller

    const token = localStorage.getItem("token");

    // 3. Call your backend endpoint (configured in image-analysis.ts)
    // This offloads the API key and Gemini logic to the server
    const response = await api.post("/api/image-analysis", formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    // Controller returns { success: true, result: { name, calories, protein, carbs, fat } }
    const { name, calories, protein, carbs, fat } = response.data.result;

    // 4. Save the analyzed data to your Strapi FoodLogs collection
    const { data: raw } = await api.post(
      "/api/foodlogs",
      {
        data: {
          name,
          calories,
          protein: protein ?? 0,
          carbs: carbs ?? 0,
          fat: fat ?? 0,
          mealtype: mealType,
          mealType: mealType, // Sending both for compatibility
          date: new Date().toISOString(),
          aiGenerated: true,
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // 5. Update local UI state
    handleAdd(normalizeStrapiEntry(raw));
    toast.success(`Logged: ${name} · ${calories} kcal`);

  } catch (error: any) {
    console.error("AI Food Snap error:", error);
    toast.error(error?.response?.data?.error?.message || "Could not analyze image. Please add manually.");
    openModal(mealType);
  } finally {
    setIsAnalyzing(false);
    setSnapPreview(null);
    URL.revokeObjectURL(previewUrl);
  }
};

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    // Reuse handleImageChange logic by constructing a synthetic event-like call
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const fakeInput = document.createElement("input");
    fakeInput.type = "file";
    Object.defineProperty(fakeInput, "files", { value: dataTransfer.files });
    handleImageChange({ target: fakeInput } as any);
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
      {showCamera && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />}

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
          <CalendarHeatmap
            logs={allFoodLogs}
            colorClass="bg-emerald-400"
            label="Food"
            onDayClick={(dateStr) => setFilterDate((prev) => prev === dateStr ? null : dateStr)}
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

          {/* AI Food Snap button */}
          <button
            type="button"
            onClick={() => !isAnalyzing && setShowSnapMenu(true)}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 py-3.5 font-semibold rounded-xl cursor-pointer disabled:opacity-50 text-black bg-emerald-500 hover:bg-emerald-600 transition-colors"
          >
            {isAnalyzing ? (
              <><div className="w-4 h-4 rounded-full animate-spin border-2 border-black/30 border-t-black" />Analyzing…</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>AI Food Snap ✨</>
            )}
          </button>

          {/* Centered dialog modal */}
          {showSnapMenu && !isAnalyzing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSnapMenu(false)} />
              <div className="relative z-10 w-full max-w-xs mx-4 rounded-2xl shadow-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white">AI Food Snap ✨</p>
                    <p className="text-xs text-slate-500 mt-0.5">Choose how to add your food photo</p>
                  </div>
                  <button type="button" onClick={() => setShowSnapMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer text-lg leading-none">✕</button>
                </div>

                {/* Options */}
                <div className="p-4 flex flex-col gap-3">
                  {/* Upload from gallery */}
                  <button
                    type="button"
                    onClick={() => { setShowSnapMenu(false); inputRef.current?.click(); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-400/50 transition-all cursor-pointer group"
                  >
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-400/15 text-emerald-500 group-hover:bg-emerald-400/25 transition-colors shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900 dark:text-white">Upload Image</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose a photo from your gallery</p>
                    </div>
                  </button>

                  {/* Take photo */}
                  <button
                    type="button"
                    onClick={() => { setShowSnapMenu(false); openCamera(); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-400/50 transition-all cursor-pointer group"
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

          {/* Hidden input for gallery */}
          <input onChange={handleImageChange} type="file" accept="image/*" hidden ref={inputRef} />
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
