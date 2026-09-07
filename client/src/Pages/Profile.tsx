import { useState, useMemo } from "react";
import api from "../configs/api";
import toast from "react-hot-toast";
import { useappcontext } from "../Context/AppContext";
import { useTheme } from "../Context/Themecontext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GOAL_LABELS: Record<string, string> = {
  lose: "Lose Weight",
  maintain: "Maintain Weight",
  gain: "Gain Weight",
};

// ── Badge definitions (same as Dashboard) ──────────────────
const BADGE_DEFS = [
  { id: "first_log",   label: "First Step",       icon: "🥗", desc: "Logged your first meal"        },
  { id: "streak_3",    label: "3-Day Streak",     icon: "🔥", desc: "Active 3 days in a row"        },
  { id: "streak_7",    label: "Week Warrior",     icon: "🏅", desc: "Active 7 days in a row"        },
  { id: "workouts_10", label: "10 Workouts",      icon: "💪", desc: "Logged 10 activities"          },
  { id: "food_50",     label: "Nutrition Pro",    icon: "🥦", desc: "Logged 50 food entries"        },
  { id: "workouts_25", label: "Fitness Fanatic",  icon: "🏋️", desc: "Logged 25 activities"         },
  { id: "streak_30",   label: "Monthly Master",   icon: "🌟", desc: "Active 30 days in a row"       },
];

const resolveDate = (e: any) => e.date ?? e.createdAt ?? new Date().toISOString();

const calcStreak = (foodLogs: any[], activityLogs: any[]): number => {
  let streak = 0;
  const d = new Date();
  const todayHasData =
    foodLogs.some((l) => new Date(resolveDate(l)).toDateString() === d.toDateString()) ||
    activityLogs.some((l) => new Date(resolveDate(l)).toDateString() === d.toDateString());
  if (!todayHasData) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 365; i++) {
    const ds = d.toDateString();
    if (foodLogs.some((l) => new Date(resolveDate(l)).toDateString() === ds) ||
        activityLogs.some((l) => new Date(resolveDate(l)).toDateString() === ds)) {
      streak++; d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
};

// ── Edit Profile Modal ──────────────────────────────────────
const EditProfileModal = ({ user, onClose, onSave }: {
  user: any; onClose: () => void; onSave: (d: any) => Promise<void>;
}) => {
  const [age, setAge] = useState(String(user?.age ?? ""));
  const [weight, setWeight] = useState(String(user?.weight ?? ""));
  const [height, setHeight] = useState(String(user?.height ?? ""));
  const [goal, setGoal] = useState(user?.goal ?? "maintain");
  const [caloriesIn, setCaloriesIn] = useState(String(user?.dailycaloriesintake ?? ""));
  const [caloriesOut, setCaloriesOut] = useState(String(user?.dailycaloriesburned ?? ""));

  const handleSave = async () => {
    await onSave({ age: Number(age), weight: Number(weight), height: Number(height), goal, dailycaloriesintake: Number(caloriesIn) || undefined, dailycaloriesburned: Number(caloriesOut) || undefined });
    onClose();
  };

  const inputCls = "w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-gray-900 dark:hover:text-white text-xl leading-none cursor-pointer">✕</button>
        </div>
        <div className="space-y-3 mb-6">
          {[
            { label: "Age", val: age, set: setAge, type: "number" },
            { label: "Weight (kg)", val: weight, set: setWeight, type: "number" },
            { label: "Height (cm)", val: height, set: setHeight, type: "number" },
            { label: "Daily Calorie Intake Goal", val: caloriesIn, set: setCaloriesIn, type: "number" },
            { label: "Daily Calories Burned Goal", val: caloriesOut, set: setCaloriesOut, type: "number" },
          ].map(({ label, val, set, type }) => (
            <div key={label}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input type={type} className={inputCls} value={val} onChange={(e) => set(e.target.value)} />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {(["lose", "maintain", "gain"] as const).map((g) => (
                <button key={g} onClick={() => setGoal(g)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${goal === g ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500"}`}>
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={handleSave} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors cursor-pointer">
          Save Changes
        </button>
      </div>
    </div>
  );
};

// ── Info Row ─────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/30">
    <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700/60 rounded-lg flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">{icon}</div>
    <div>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

// ── Shareable progress card ───────────────────────────────────
const ShareCard = ({ user, streak, foodCount, activityCount, onClose }: {
  user: any; streak: number; foodCount: number; activityCount: number; onClose: () => void;
}) => {
  // Draw the progress card on a Canvas — no external library needed
  const downloadCard = () => {
    try {
      const canvas = document.createElement("canvas");
      const scale = 2;
      canvas.width = 360 * scale;
      canvas.height = 260 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.roundRect(0, 0, 360, 260, 16);
      ctx.fill();

      // Header icon circle
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(20, 20, 40, 40, 10);
      ctx.fill();
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.fillText("💪", 40, 47);

      // Header text
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText(`${user?.username ?? "User"}'s Progress`, 72, 38);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), 72, 54);

      // Stat cards
      const stats = [
        { label: "Active Streak", value: `${streak} days`,      icon: "🔥", color: "#f59e0b", x: 20,  y: 80  },
        { label: "Food Entries",  value: `${foodCount} logged`,  icon: "🍽️", color: "#10b981", x: 190, y: 80  },
        { label: "Workouts",      value: `${activityCount} done`,icon: "🏋️", color: "#3b82f6", x: 20,  y: 170 },
        { label: "Goal",          value: GOAL_LABELS[user?.goal ?? ""] ?? "—", icon: "🎯", color: "#8b5cf6", x: 190, y: 170 },
      ];
      stats.forEach(({ label, value, icon, color, x, y }) => {
        // Card bg
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.roundRect(x, y, 150, 70, 10);
        ctx.fill();
        ctx.strokeStyle = color + "55";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Icon
        ctx.font = "18px serif";
        ctx.fillText(icon, x + 12, y + 24);
        // Value
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px system-ui, sans-serif";
        ctx.fillText(value, x + 12, y + 46);
        // Label
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(label, x + 12, y + 62);
      });

      // Footer
      ctx.fillStyle = "#475569";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Tracked with AI Fitness Tracker", 180, 248);

      // Download
      const link = document.createElement("a");
      link.download = "fittrack-progress.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Progress card saved!");
    } catch {
      toast.error("Could not generate image.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm">
        {/* The shareable card */}
        <div className="rounded-2xl p-6 bg-slate-900 text-white" style={{ fontFamily: "system-ui, sans-serif" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-lg">💪</div>
            <div>
              <p className="font-bold text-base">{user?.username ?? "User"}'s Progress</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Active Streak", value: `${streak} days`, icon: "🔥", color: "bg-amber-500/20 border-amber-500/30" },
              { label: "Food Entries", value: `${foodCount} logged`, icon: "🍽️", color: "bg-emerald-500/20 border-emerald-500/30" },
              { label: "Workouts", value: `${activityCount} done`, icon: "🏋️", color: "bg-blue-500/20 border-blue-500/30" },
              { label: "Goal", value: GOAL_LABELS[user?.goal ?? ""] ?? "—", icon: "🎯", color: "bg-violet-500/20 border-violet-500/30" },
            ].map((s) => (
              <div key={s.label} className={`${s.color} border rounded-xl p-3`}>
                <div className="text-lg mb-1">{s.icon}</div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-4">Tracked with AI Fitness Tracker</p>
        </div>
        {/* Actions */}
        <div className="flex gap-3 mt-3">
          <button onClick={downloadCard} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer">
            📥 Download
          </button>
          <button onClick={onClose} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ── PDF Export ───────────────────────────────────────────────
const exportPDF = (allFoodLogs: any[], allActivityLogs: any[], user: any, streak: number, earnedBadges: any[]) => {
  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    // ── Header banner ──
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 0, pageW, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("FitTrack — Progress Report", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${user?.username ?? "User"}  ·  Generated on ${today}`, 14, 20);

    // ── Stats summary row ──
    const stats = [
      { label: "Food Entries",    value: String(allFoodLogs.length)    },
      { label: "Activities",      value: String(allActivityLogs.length) },
      { label: "Active Streak",   value: `${streak} days`              },
      { label: "Badges Earned",   value: `${earnedBadges.length}`      },
    ];
    const boxW = (pageW - 28) / 4;
    let bx = 14;
    stats.forEach(({ label, value }) => {
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(bx, 34, boxW - 2, 20, 3, 3, "F");
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(value, bx + (boxW - 2) / 2, 44, { align: "center" });
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(label, bx + (boxW - 2) / 2, 50, { align: "center" });
      bx += boxW;
    });

    // ── Profile info ──
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Profile", 14, 64);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 66, pageW - 14, 66);

    const profile = [
      ["Age",            user?.age     ? `${user.age} years`          : "—"],
      ["Weight",         user?.weight  ? `${user.weight} kg`          : "—"],
      ["Height",         user?.height  ? `${user.height} cm`          : "—"],
      ["Goal",           GOAL_LABELS[user?.goal ?? ""] ?? "—"                ],
      ["Calorie Target", user?.dailycaloriesintake ? `${user.dailycaloriesintake} kcal/day` : "—"],
      ["Member Since",   user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB") : "—"],
    ];
    autoTable(doc, {
      startY: 68,
      head: [],
      body: profile,
      theme: "plain",
      styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42] },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50, textColor: [100, 116, 139] },
        1: { cellWidth: "auto" },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Food logs table ──
    const afterProfile = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Food Logs", 14, afterProfile);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, afterProfile + 2, pageW - 14, afterProfile + 2);

    if (allFoodLogs.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("No food logs recorded yet.", 14, afterProfile + 10);
    } else {
      autoTable(doc, {
        startY: afterProfile + 5,
        head: [["Date", "Name", "Meal Type", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"]],
        body: allFoodLogs.map((l) => [
          new Date(resolveDate(l)).toLocaleDateString("en-GB"),
          l.name ?? "—",
          l.mealType ?? "—",
          l.calories ?? 0,
          l.protein ?? 0,
          l.carbs ?? 0,
          l.fat ?? 0,
        ]),
        theme: "grid",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 14, right: 14 },
      });
    }

    // ── Activity logs table ──
    const afterFood = (doc as any).lastAutoTable?.finalY ?? afterProfile + 15;
    const actY = afterFood + 8;

    // Add new page if not enough space
    if (actY > 250) doc.addPage();
    const actStart = actY > 250 ? 14 : actY;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Activity Logs", 14, actStart);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, actStart + 2, pageW - 14, actStart + 2);

    if (allActivityLogs.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("No activity logs recorded yet.", 14, actStart + 10);
    } else {
      autoTable(doc, {
        startY: actStart + 5,
        head: [["Date", "Name / Type", "Duration (min)", "Calories Burned"]],
        body: allActivityLogs.map((l) => [
          new Date(resolveDate(l)).toLocaleDateString("en-GB"),
          l.name ?? l.type ?? "—",
          l.duration ?? "—",
          l.calories ?? l.caloriesBurned ?? "—",
        ]),
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        margin: { left: 14, right: 14 },
      });
    }

    // ── Footer on every page ──
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("Generated by AI Fitness Tracker", 14, 292);
      doc.text(`Page ${i} of ${totalPages}`, pageW - 14, 292, { align: "right" });
    }

    doc.save(`fittrack-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF report downloaded!");
  } catch {
    toast.error("Could not generate PDF.");
  }
};

// ── Main Profile Page ─────────────────────────────────────────
export default function Profile() {
  const { user, setUser, allFoodLogs, allActivityLogs, logout } = useappcontext();
  const { theme, toggleTheme } = useTheme();
  const [showEdit, setShowEdit] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return "—";
    return new Date(user.createdAt).toLocaleDateString("en-GB");
  }, [user]);

  const streak = useMemo(() => calcStreak(allFoodLogs, allActivityLogs), [allFoodLogs, allActivityLogs]);

  const earnedBadges = useMemo(() => {
    return BADGE_DEFS.filter((b) => {
      if (b.id === "first_log")   return allFoodLogs.length >= 1;
      if (b.id === "streak_3")    return streak >= 3;
      if (b.id === "streak_7")    return streak >= 7;
      if (b.id === "workouts_10") return allActivityLogs.length >= 10;
      if (b.id === "food_50")     return allFoodLogs.length >= 50;
      if (b.id === "workouts_25") return allActivityLogs.length >= 25;
      if (b.id === "streak_30")   return streak >= 30;
      return false;
    });
  }, [allFoodLogs, allActivityLogs, streak]);

  const handleSave = async (data: any) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/api/users/${user?.id}`, data, { headers: { Authorization: `Bearer ${token}` } });
      setUser((prev: any) => ({ ...prev, ...data }));
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to update profile");
    }
  };

  const svgProps = { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">

      {/* Header */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60 px-5 pt-12 pb-5 lg:pt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Manage your account</p>
          </div>
          <button
            onClick={() => setShowShareCard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            📤 Share Progress
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[1fr,1fr] lg:gap-6 lg:items-start">

        {/* Left */}
        <div className="space-y-4 mb-6 lg:mb-0">
          {/* Profile card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                <svg {...svgProps} stroke="white"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
              </div>
              <div>
                <p className="text-base font-bold">{user?.username ?? "User"}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Member since {memberSince}</p>
              </div>
            </div>
            <InfoRow label="Age"    value={user?.age    ? `${user.age} years` : "—"} icon={<svg {...svgProps} stroke="#818cf8"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} />
            <InfoRow label="Weight" value={user?.weight ? `${user.weight} kg` : "—"} icon={<svg {...svgProps} stroke="#c084fc"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>} />
            <InfoRow label="Height" value={user?.height ? `${user.height} cm` : "—"} icon={<svg {...svgProps} stroke="#34d399"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>} />
            <InfoRow label="Goal"   value={GOAL_LABELS[user?.goal ?? ""] ?? user?.goal ?? "—"} icon={<svg {...svgProps} stroke="#fb923c"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>} />
            <InfoRow label="Calorie Target" value={user?.dailycaloriesintake ? `${user.dailycaloriesintake} kcal/day` : "—"} icon={<svg {...svgProps} stroke="#f97316"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M12 6v6l4 2" /></svg>} />
            <button onClick={() => setShowEdit(true)}
              className="w-full mt-2 py-3 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 text-sm font-semibold rounded-xl transition-all cursor-pointer">
              Edit Profile
            </button>
          </div>

          {/* Badges shelf */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold">Achievements</p>
              <span className="text-xs text-slate-400">{earnedBadges.length}/{BADGE_DEFS.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BADGE_DEFS.map((b) => {
                const earned = earnedBadges.some((e) => e.id === b.id);
                return (
                  <div key={b.id} title={b.desc}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${earned ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30" : "bg-slate-100 dark:bg-slate-700/30 border-slate-200 dark:border-slate-600/20 opacity-50"}`}>
                    <span className={`text-lg ${earned ? "" : "grayscale"}`}>{b.icon}</span>
                    <div>
                      <p className={`font-semibold ${earned ? "text-amber-700 dark:text-amber-400" : "text-slate-500"}`}>{b.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{b.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <p className="text-sm font-bold mb-4">Your Stats</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Food entries",  value: allFoodLogs.length,     color: "text-emerald-500" },
                { label: "Activities",    value: allActivityLogs.length, color: "text-blue-500"    },
                { label: "Active streak", value: `${streak}d`,           color: "text-amber-500"   },
                { label: "Badges earned", value: earnedBadges.length,    color: "text-violet-500"  },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/30 rounded-xl p-4 text-center">
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Data export */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <p className="text-sm font-bold mb-1">Export Your Data</p>
            <p className="text-xs text-slate-400 mb-3">Download a full PDF report with your profile, food logs and activity history.</p>
            <button
              onClick={() => exportPDF(allFoodLogs, allActivityLogs, user, streak, earnedBadges)}
              className="w-full py-3 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-sm font-semibold rounded-xl transition-all cursor-pointer"
            >
              📥 Download PDF
            </button>
          </div>

          {/* Theme */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">App Theme</p>
                <p className="text-xs text-slate-400">Switch between light and dark mode</p>
              </div>
              <button onClick={toggleTheme} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-all">
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          </div>

          {/* Logout */}
          <button onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-transparent hover:bg-rose-100 dark:hover:bg-rose-500/10 border border-rose-300 dark:border-rose-500/50 text-rose-600 dark:text-rose-400 font-semibold rounded-xl transition-all cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {showEdit && <EditProfileModal user={user} onClose={() => setShowEdit(false)} onSave={handleSave} />}
      {showShareCard && (
        <ShareCard
          user={user} streak={streak}
          foodCount={allFoodLogs.length} activityCount={allActivityLogs.length}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}
