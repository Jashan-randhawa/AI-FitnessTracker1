import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

interface RestCountdownTimerProps {
  initialSeconds?: number;
  onFinish?: () => void;
  className?: string;
  autoStart?: boolean;
}

export const RestCountdownTimer = ({
  initialSeconds = 60,
  onFinish,
  className = "",
  autoStart = false,
}: RestCountdownTimerProps) => {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);

  const targetEndTimeRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Wall-clock accurate timer (resilient to tab throttling & backgrounding)
  useEffect(() => {
    if (!isRunning) {
      targetEndTimeRef.current = null;
      return;
    }

    if (!targetEndTimeRef.current) {
      targetEndTimeRef.current = Date.now() + timeLeft * 1000;
    }

    const interval = setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const remainingMs = targetEndTimeRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        setIsRunning(false);
        targetEndTimeRef.current = null;
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        onFinishRef.current?.();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggleRunning = () => {
    if (isRunning) {
      setIsRunning(false);
      targetEndTimeRef.current = null;
    } else {
      const nextTime = timeLeft === 0 ? totalSeconds : timeLeft;
      setTimeLeft(nextTime);
      targetEndTimeRef.current = null;
      setIsRunning(true);
    }
  };

  const resetTimer = (sec: number = totalSeconds) => {
    setTotalSeconds(sec);
    setTimeLeft(sec);
    targetEndTimeRef.current = null;
    setIsRunning(true);
  };

  const progressPct = totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 0;
  const isUrgent = isRunning && timeLeft <= 3 && timeLeft > 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300 ${
        isUrgent
          ? "animate-rest-heartbeat border-rose-500/60 bg-rose-500/10 text-rose-500 shadow-lg shadow-rose-500/20"
          : "border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 text-gray-900 dark:text-white"
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base select-none">⏱️</span>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Rest Interval
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xl font-black font-mono tracking-tight transition-transform ${
              isUrgent ? "scale-110 text-rose-500" : "text-emerald-500"
            }`}
          >
            {formattedTime}
          </span>
          <button
            type="button"
            onClick={toggleRunning}
            className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
              isRunning
                ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 active:scale-95"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm active:scale-95"
            }`}
          >
            {isRunning ? "Pause" : timeLeft === 0 ? "Restart" : "Start"}
          </button>
        </div>
      </div>

      {/* Shrinking Horizontal Bar */}
      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden relative">
        <motion.div
          className={`h-full rounded-full transition-colors duration-300 ${
            isUrgent ? "bg-rose-500" : "bg-emerald-500"
          }`}
          style={{ width: `${progressPct}%` }}
          transition={{ ease: "linear" }}
        />
      </div>

      {/* Quick Interval Preset Pills */}
      <div className="flex items-center justify-between gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/40">
        <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">Presets:</span>
        <div className="flex gap-1.5">
          {[30, 60, 90, 120].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => resetTimer(sec)}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer active:scale-95 ${
                totalSeconds === sec && isRunning
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                  : "bg-slate-100 dark:bg-slate-700/40 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RestCountdownTimer;
