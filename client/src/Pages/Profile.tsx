import { useState, useMemo } from "react";
import api from "../configs/api";
import toast from "react-hot-toast";
import { useappcontext } from "../Context/AppContext";
import { useTheme } from "../Context/Themecontext";

const GOAL_LABELS: Record<string, string> = {
  lose: "Lose Weight",
  maintain: "Maintain Weight",
  gain: "Gain Weight",
};

// ── Edit Profile Modal ─────────────────────────────────────
const EditProfileModal = ({
  user,
  onClose,
  onSave,
}: {
  user: any;
  onClose: () => void;
  onSave: (data: { age: number; weight: number; height: number; goal: string }) => Promise<void>;
}) => {
  const [age, setAge] = useState(String(user?.age ?? ""));
  const [weight, setWeight] = useState(String(user?.weight ?? ""));
  const [height, setHeight] = useState(String(user?.height ?? ""));
  const [goal, setGoal] = useState(user?.goal ?? "maintain");

  const handleSave = async () => {
    await onSave({ age: Number(age), weight: Number(weight), height: Number(height), goal });
    onClose();
  };

  const inputCls = "w-full bg-slate-700/60 dark:bg-slate-700/60 border border-slate-600 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-white dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-xl leading-none cursor-pointer">✕</button>
        </div>

        <div className="space-y-3 mb-6">
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Age</label>
            <input type="number" className={inputCls} placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Weight (kg)</label>
            <input type="number" className={inputCls} placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Height (cm)</label>
            <input type="number" className={inputCls} placeholder="Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Goal</label>
            <div className="grid grid-cols-3 gap-2">
              {(["lose", "maintain", "gain"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 cursor-pointer ${
                    goal === g
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
                  }`}
                >
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors duration-200 cursor-pointer"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

// ── Info Row ───────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-4 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600/50 transition-colors duration-200">
    <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700/60 rounded-lg flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-300">
      {icon}
    </div>
    <div>
      <p className="text-xs text-slate-600 dark:text-slate-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  </div>
);

// ── Main Profile Page ──────────────────────────────────────
export default function Profile() {
  const { user, setUser, allFoodLogs, allActivityLogs, logout } = useappcontext();
  const { theme, toggleTheme } = useTheme();
  const [showEdit, setShowEdit] = useState(false);

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return "—";
    return new Date(user.createdAt).toLocaleDateString("en-GB");
  }, [user]);

  const handleSave = async (data: { age: number; weight: number; height: number; goal: string }) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/api/users/${user?.id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser((prev: any) => ({ ...prev, ...data }));
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || "Failed to update profile");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-gray-900 dark:text-white transition-colors duration-200">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60 px-5 pt-12 pb-5 lg:pt-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Profile</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">Manage your settings</p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[1fr,1fr] lg:gap-6 lg:items-start">

        {/* ── Left: Profile Card ── */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 space-y-3 mb-6 lg:mb-0">

          {/* Avatar + Name */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">{user?.username ?? "User"}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Member since {memberSince}</p>
            </div>
          </div>

          {/* Info Rows */}
          <InfoRow label="Age" value={user?.age ? `${user.age} years` : "—"} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>} />
          <InfoRow label="Weight" value={user?.weight ? `${user.weight} kg` : "—"} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></svg>} />
          <InfoRow label="Height" value={user?.height ? `${user.height} cm` : "—"} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>} />
          <InfoRow label="Goal" value={GOAL_LABELS[user?.goal ?? ""] ?? user?.goal ?? "—"} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>} />

          {/* Edit Button */}
          <button
            onClick={() => setShowEdit(true)}
            className="w-full mt-2 py-3 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600/50 hover:border-slate-400 dark:hover:border-slate-500 text-gray-900 dark:text-white text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer"
          >
            Edit Profile
          </button>
        </div>

        {/* ── Right: Stats + Theme + Logout ── */}
        <div className="space-y-4">

          {/* Stats */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">Your Stats</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{allFoodLogs.length}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Food entries</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{allActivityLogs.length}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Activities</p>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">App Theme</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Switch between light and dark mode</p>
              </div>
              <button
                onClick={toggleTheme}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-medium text-gray-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200"
              >
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </button>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-transparent hover:bg-rose-100 dark:hover:bg-rose-500/10 border border-rose-300 dark:border-rose-500/50 hover:border-rose-400 dark:hover:border-rose-500 text-rose-600 dark:text-rose-400 font-semibold rounded-xl transition-all duration-200 cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {showEdit && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}