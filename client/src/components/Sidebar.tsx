import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Utensils,
  Activity,
  Dumbbell,
  CalendarDays,
  CalendarCheck,
  Sparkles,
  CloudSun,
  BookOpen,
  User,
  Sun,
  Moon,
  Menu,
  X,
  ChevronsUpDown,
  ArrowLeftRight,
  LogOut,
} from "lucide-react";
import { useTheme } from "../Context/Themecontext";
import { useappcontext } from "../Context/AppContext";
import Logo from "./Logo";

type NavItemConfig = {
  path: string;
  label: string;
  icon: typeof Home;
  badge?: string | null;
  section: "TRACKING" | "PLANNING" | "INTELLIGENCE" | "ACCOUNT";
};

const navItems: NavItemConfig[] = [
  { path: "/", label: "Dashboard", icon: Home, section: "TRACKING" },
  { path: "/food", label: "Food Log", icon: Utensils, section: "TRACKING" },
  { path: "/activity", label: "Activity Log", icon: Activity, section: "TRACKING" },
  { path: "/workouts", label: "Workouts", icon: Dumbbell, section: "TRACKING" },
  { path: "/planner", label: "Meal Planner", icon: CalendarDays, section: "PLANNING" },
  { path: "/activity-planner", label: "Activity Planner", icon: CalendarCheck, section: "PLANNING" },
  { path: "/ai", label: "AI Assistant", icon: Sparkles, badge: "AI", section: "INTELLIGENCE" },
  { path: "/weather", label: "Weather", icon: CloudSun, section: "INTELLIGENCE" },
  { path: "/blog", label: "Blog", icon: BookOpen, section: "INTELLIGENCE" },
  { path: "/profile", label: "Profile", icon: User, section: "ACCOUNT" },
];

const sections = [
  { key: "TRACKING", title: "TRACKING" },
  { key: "PLANNING", title: "PLANNING" },
  { key: "INTELLIGENCE", title: "INTELLIGENCE" },
  { key: "ACCOUNT", title: "ACCOUNT" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useappcontext();
  const isLight = theme.toString() === "light";

  // Desktop hover state: collapsed by default, opens only on hover
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 160);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Desktop Spacer Rail (reserves width in layout so page content never shifts) ── */}
      <div className="hidden lg:block w-[68px] shrink-0 pointer-events-none" />

      {/* ── Desktop Sidebar: Collapsible Rail + Flyout (Opens only on hover) ── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex fixed top-0 left-0 h-screen z-40 select-none"
      >
        {/* Rail (Always visible slim column matching left image) */}
        <div className="w-[68px] h-full bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-3 z-20 shrink-0 transition-colors duration-200">
          {/* macOS window traffic light dots (matching reference image) */}
          <div className="flex items-center gap-1.5 pt-1.5 pb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
          </div>

          {/* Logo Tile */}
          <button
            onClick={() => handleNavigate("/")}
            className="mb-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            title="FitTrack Dashboard"
          >
            <Logo size={36} showText={false} />
          </button>

          {/* Rail Navigation Icons */}
          <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto no-scrollbar">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  title={item.label}
                  className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                    active
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                      : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rail Bottom Action (Theme Toggle) */}
          <div className="pt-2 pb-2 flex flex-col items-center border-t border-slate-100 dark:border-slate-800/80 w-full">
            <button
              onClick={toggleTheme}
              title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              {isLight ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </div>

        {/* Expanded Panel (Flyout Drawer - opens smoothly beside rail on hover as in right image) */}
        <div
          className={`h-full bg-slate-50/98 dark:bg-slate-900/98 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800 shadow-2xl transition-all duration-200 ease-out flex flex-col overflow-hidden ${
            isHovered
              ? "w-[245px] opacity-100 pointer-events-auto border-r"
              : "w-0 opacity-0 pointer-events-none border-r-0"
          }`}
        >
          <div className="w-[245px] shrink-0 flex flex-col h-full">
            {/* Header: App Info & Workspace */}
            <div className="px-4 pt-4 pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">FitTrack AI</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                      v2.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {user?.email || "store.fittrack.ai"}
                  </p>
                </div>
                <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
              </div>

              {/* Switch view / stores sub-action matching reference */}
              <button
                onClick={() => handleNavigate("/profile")}
                className="mt-2.5 flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Switch view</span>
              </button>
            </div>

            {/* Navigation Groups */}
            <div className="flex-1 px-3 py-3 overflow-y-auto no-scrollbar space-y-3.5">
              {sections.map((section) => {
                const items = navItems.filter((i) => i.section === section.key);
                return (
                  <div key={section.key}>
                    <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                      <span>{section.title}</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {items.map((item) => {
                        const active = isActive(item.path);
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleNavigate(item.path)}
                            className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer w-full text-left ${
                              active
                                ? "bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-2xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                className={`w-4 h-4 shrink-0 ${
                                  active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                                }`}
                                strokeWidth={active ? 2.2 : 1.8}
                              />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {item.badge && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: User Details & Theme Toggle */}
            <div className="p-3 border-t border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  <span>{isLight ? "Dark Mode" : "Light Mode"}</span>
                </div>
                <span className="text-[10px] uppercase font-semibold text-slate-400">
                  {isLight ? "OFF" : "ON"}
                </span>
              </button>

              {user && (
                <div className="flex items-center justify-between pt-1.5 px-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(user.username || "U")[0].toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                      {user.username || "Account"}
                    </span>
                  </div>
                  {logout && (
                    <button
                      onClick={logout}
                      title="Log Out"
                      className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Topbar (< lg) ── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 transition-colors duration-200">
        <Logo size={28} textClassName="text-[15px]" />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile Drawer Overlay ── */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Mobile Drawer Panel ── */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-[260px] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Mobile Header with traffic lights & Close */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">FitTrack</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Navigation List */}
        <div className="flex-1 px-3 py-3 overflow-y-auto space-y-3">
          {sections.map((section) => {
            const items = navItems.filter((i) => i.section === section.key);
            return (
              <div key={section.key}>
                <div className="px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  {section.title}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {items.map((item) => {
                    const active = isActive(item.path);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item.path)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                          active
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${active ? "text-emerald-500" : "text-slate-400"}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Footer Theme Toggle */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{isLight ? "Dark Mode" : "Light Mode"}</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
