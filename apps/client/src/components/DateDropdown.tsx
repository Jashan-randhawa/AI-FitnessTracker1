import { useMemo, useRef, useState, useEffect } from "react";

interface Props {
  logs: { date?: string; createdAt?: string; calories?: number; amount?: number }[];
  colorClass?: string; // e.g. "text-emerald-400" — used for the calendar icon accent
  label?: string;
  selectedDate: string | null; // yyyy-mm-dd, null = today
  onSelectDate: (dateStr: string | null) => void;
}

const resolveDate = (e: any) => e.date ?? e.createdAt ?? new Date().toISOString();

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function DateDropdown({ logs, colorClass = "text-emerald-400", label = "Daily Log", selectedDate, onSelectDate }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const todayKey = toDateKey(new Date());

  const { options, counts } = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => {
      const d = new Date(resolveDate(l));
      const key = toDateKey(d);
      map[key] = (map[key] ?? 0) + (l.calories ?? l.amount ?? 1);
    });
    const keys = Object.keys(map).sort((a, b) => (a < b ? 1 : -1));
    return { options: keys, counts: map };
  }, [logs]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const formatLabel = (key: string) => {
    if (key === todayKey) return "Today";
    const d = new Date(key + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  };

  const activeKey = selectedDate ?? todayKey;

  const handlePick = (key: string) => {
    onSelectDate(key === todayKey ? null : key);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative flex w-full sm:w-auto sm:inline-flex items-center justify-between sm:justify-start gap-2 sm:gap-3 pl-3.5 pr-2 py-2 rounded-2xl bg-slate-900 dark:bg-slate-900 border border-slate-800">
      {/* Icon + label */}
      <div className="flex items-center gap-2 min-w-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className={`${colorClass} shrink-0`}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v3M16 3v3" />
          <circle cx="12" cy="13" r="1" fill="currentColor" />
        </svg>
        <span className="text-white font-semibold text-sm sm:text-base whitespace-nowrap truncate">{label}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700 shrink-0" />

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-600 text-white text-xs sm:text-base hover:border-slate-400 transition-colors cursor-pointer shrink-0"
      >
        <span>{formatLabel(activeKey)}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 min-w-[180px] max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
          <button
            type="button"
            onClick={() => handlePick(todayKey)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-800 cursor-pointer
              ${activeKey === todayKey ? "text-white font-semibold" : "text-slate-400"}`}
          >
            <span>Today</span>
            {counts[todayKey] ? <span className="text-[10px] text-slate-500">{Math.round(counts[todayKey])}</span> : null}
          </button>

          {options.filter((k) => k !== todayKey).length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">No other logged days yet</p>
          ) : (
            options
              .filter((k) => k !== todayKey)
              .map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => handlePick(key)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-slate-800 cursor-pointer
                    ${activeKey === key ? "text-white font-semibold" : "text-slate-400"}`}
                >
                  <span>{formatLabel(key)}</span>
                  <span className="text-[10px] text-slate-500">{Math.round(counts[key])}</span>
                </button>
              ))
          )}
        </div>
      )}
    </div>
  );
}
