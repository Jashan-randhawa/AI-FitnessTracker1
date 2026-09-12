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
  hasDividerAfter?: boolean;
};

const navItems: NavItemConfig[] = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/food", label: "Food Log", icon: Utensils },
  { path: "/activity", label: "Activity Log", icon: Activity },
  { path: "/workouts", label: "Workouts", icon: Dumbbell, hasDividerAfter: true },
  { path: "/planner", label: "Meal Planner", icon: CalendarDays },
  { path: "/activity-planner", label: "Activity Planner", icon: CalendarCheck, hasDividerAfter: true },
  { path: "/ai", label: "AI Assistant", icon: Sparkles, badge: "AI" },
  { path: "/weather", label: "Weather", icon: CloudSun },
  { path: "/blog", label: "Blog", icon: BookOpen, hasDividerAfter: true },
  { path: "/profile", label: "Profile", icon: User },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useappcontext();
  const isLight = theme.toString() === "light";

  // Desktop hover state: collapsed by default (w-68px), expands on hover (w-313px)
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
    if (path === "/ai" || path === "/ai-assistant") {
      return location.pathname === "/ai" || location.pathname === "/ai-assistant" || location.pathname.startsWith("/ai");
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Desktop Spacer Rail (keeps page content in place without layout shifts) ── */}
      <div className="hidden lg:block w-[68px] shrink-0 pointer-events-none" />

      {/* ── Desktop Sidebar: Row-by-Row 100% Aligned (Rail + Panel) ── */}
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden lg:block fixed top-0 left-0 h-screen z-40 select-none transition-all duration-200 ease-out overflow-hidden overflow-x-hidden ${
          isHovered ? "w-[313px] shadow-2xl" : "w-[68px] shadow-none"
        }`}
      >
        <div className="w-[313px] h-full flex flex-col py-2.5 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 overflow-x-hidden overflow-y-auto no-scrollbar relative [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Subtle tinted background for the expanded panel portion (x >= 68px) */}
          <div className="absolute top-0 left-[68px] right-0 bottom-0 bg-slate-50/98 dark:bg-slate-900/98 border-l border-slate-200/70 dark:border-slate-800 pointer-events-none" />

          {/* Unified Rows Container: each row has fixed height matching rail and panel */}
          <div className="relative z-10 flex flex-col h-full justify-between overflow-x-hidden">
            {/* Top section */}
            <div className="overflow-x-hidden">
              {/* Row 0: Window traffic light dots */}
              <div className="flex items-center h-7 w-full mb-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Navigation
                  </span>
                </div>
              </div>

              {/* Row 1: Logo (Rail) <-> Workspace Header (Panel) */}
              <div className="flex items-center h-11 w-full">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={() => handleNavigate("/")}
                    className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    title="FitTrack Dashboard"
                  >
                    <Logo size={36} showText={false} />
                  </button>
                </div>
                <div className="flex-1 min-w-0 h-11 flex items-center justify-between px-3">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">FitTrack AI</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 shrink-0">
                        v2.0
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {user?.email || "store.fittrack.ai"}
                    </p>
                  </div>
                  <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Subtle divider below header */}
              <div className="flex items-center h-3.5 w-full my-0.5">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <div className="w-8 h-px bg-slate-200/80 dark:bg-slate-800" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-3">
                  <div className="w-full h-px bg-slate-200/70 dark:bg-slate-800" />
                </div>
              </div>

              {/* Navigation Item Rows: 100% Aligned Row-by-Row */}
              <div className="flex flex-col space-y-0.5 overflow-x-hidden">
                {navItems.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <div key={item.path} className="w-full overflow-x-hidden">
                      <div className="flex items-center h-10 w-full">
                        {/* Rail Cell (Icon button) */}
                        <div className="w-[68px] shrink-0 flex items-center justify-center">
                          <button
                            onClick={() => handleNavigate(item.path)}
                            title={item.label}
                            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer ${
                              active
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                                : "text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                            }`}
                          >
                            <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                            {active && (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-emerald-500" />
                            )}
                          </button>
                        </div>

                        {/* Panel Cell (Icon + Label button) */}
                        <div className="flex-1 min-w-0 flex items-center px-2">
                          <button
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
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 shrink-0">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Optional subtle section divider */}
                      {item.hasDividerAfter && (
                        <div className="flex items-center h-2.5 w-full my-0.5">
                          <div className="w-[68px] shrink-0 flex items-center justify-center">
                            <div className="w-5 h-px bg-slate-100 dark:bg-slate-800" />
                          </div>
                          <div className="flex-1 min-w-0 flex items-center px-3">
                            <div className="w-full h-px bg-slate-200/50 dark:bg-slate-800" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom section (Theme toggle & User account) */}
            <div className="mt-auto overflow-x-hidden">
              {/* Divider before footer */}
              <div className="flex items-center h-3 w-full my-1">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <div className="w-8 h-px bg-slate-200/80 dark:bg-slate-800" />
                </div>
                <div className="flex-1 min-w-0 flex items-center px-3">
                  <div className="w-full h-px bg-slate-200/70 dark:bg-slate-800" />
                </div>
              </div>

              {/* Theme Toggle Row: 100% Aligned */}
              <div className="flex items-center h-10 w-full">
                <div className="w-[68px] shrink-0 flex items-center justify-center">
                  <button
                    onClick={toggleTheme}
                    title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    {isLight ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <div className="flex-1 min-w-0 flex items-center px-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isLight ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
                      <span className="truncate">{isLight ? "Dark Mode" : "Light Mode"}</span>
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 shrink-0">
                      {isLight ? "OFF" : "ON"}
                    </span>
                  </button>
                </div>
              </div>

              {/* User Account Row: 100% Aligned (Rail avatar + Panel details without duplicate avatar circle) */}
              {user && (
                <div className="flex items-center h-10 w-full mt-0.5">
                  <div className="w-[68px] shrink-0 flex items-center justify-center">
                    <button
                      onClick={() => handleNavigate("/profile")}
                      title={user.username || "Profile"}
                      className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs cursor-pointer hover:opacity-90 shrink-0"
                    >
                      {(user.username || "U")[0].toUpperCase()}
                    </button>
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between px-3">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {user.username || "Account"}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                        {user.email || "Active"}
                      </span>
                    </div>
                    {logout && (
                      <button
                        onClick={logout}
                        title="Log Out"
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Mobile Topbar (< lg) ── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200">
        <button
          onClick={() => handleNavigate("/")}
          className="cursor-pointer"
        >
          <Logo size={28} textClassName="text-[15px]" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            aria-label="Toggle theme"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
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
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-[280px] max-w-[85vw] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${
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
        <div className="flex-1 px-3 py-3 overflow-y-auto space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <div key={item.path}>
                <button
                  onClick={() => handleNavigate(item.path)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium w-full text-left transition-colors cursor-pointer ${
                    active
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-xs"
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
                {item.hasDividerAfter && (
                  <div className="my-1.5 mx-2 border-b border-slate-100 dark:border-slate-800/80" />
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Footer: User Profile + Logout + Theme Toggle */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
          {user && (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
              <div
                onClick={() => handleNavigate("/profile")}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-linear-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
                  {user.username ? user.username.slice(0, 2).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {user.username || "Account"}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    {user.email || "Active"}
                  </p>
                </div>
              </div>
              {logout && (
                <button
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                  }}
                  title="Log Out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0 ml-1"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>{isLight ? "Dark Mode" : "Light Mode"}</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {isLight ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
