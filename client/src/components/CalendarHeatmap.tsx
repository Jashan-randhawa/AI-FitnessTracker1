import { useMemo, useState } from "react";

interface Props {
  logs: { date?: string; createdAt?: string; calories?: number; amount?: number }[];
  colorClass?: string; // e.g. "bg-emerald-400"
  label?: string;
  onDayClick?: (dateStr: string) => void;
}

const resolveDate = (e: any) => e.date ?? e.createdAt ?? new Date().toISOString();

export default function CalendarHeatmap({ logs, colorClass = "bg-emerald-400", label = "Log", onDayClick }: Props) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();

  // Build a map of dateKey → total calories (or count) for the viewed month
  const dayMap = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l) => {
      const d = new Date(resolveDate(l));
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        map[key] = (map[key] ?? 0) + (l.calories ?? l.amount ?? 1);
      }
    });
    return map;
  }, [logs, year, month]);

  const maxVal = Math.max(...Object.values(dayMap), 1);

  // Days in month and first weekday offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthName = viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayDate = today.getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const getOpacity = (day: number) => {
    const val = dayMap[day.toString()] ?? 0;
    if (!val) return 0;
    return Math.max(0.2, val / maxVal);
  };

  const prev = () => setViewMonth(new Date(year, month - 1, 1));
  const next = () => setViewMonth(new Date(year, month + 1, 1));

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-white">{label} Calendar</p>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer text-lg leading-none px-1">‹</button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[110px] text-center">{monthName}</span>
          <button onClick={next} className="text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer text-lg leading-none px-1">›</button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const logged = !!dayMap[day.toString()];
          const opacity = getOpacity(day);
          const isToday = isCurrentMonth && day === todayDate;
          const dateStr = new Date(year, month, day).toISOString().slice(0, 10);

          return (
            <button
              key={day}
              title={logged ? `${dayMap[day.toString()]} logged` : undefined}
              onClick={() => onDayClick?.(dateStr)}
              className={`relative aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium transition-all cursor-pointer
                ${isToday ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-transparent" : ""}
                ${logged ? "text-white" : "text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"}
              `}
              style={logged ? {
                backgroundColor: `color-mix(in srgb, var(--heat-color, #10b981) ${Math.round(opacity * 100)}%, transparent)`,
              } : undefined}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[10px] text-slate-400">Less</span>
        {[0.15, 0.35, 0.6, 0.85, 1].map((o, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm ${colorClass}`}
            style={{ opacity: o }}
          />
        ))}
        <span className="text-[10px] text-slate-400">More</span>
      </div>
    </div>
  );
}
