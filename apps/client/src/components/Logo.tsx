import { useId } from "react";

type LogoProps = {
  /** Pixel size of the icon square */
  size?: number;
  /** Show the "FitTrack" wordmark next to the icon */
  showText?: boolean;
  /** Tailwind text-size class for the wordmark */
  textClassName?: string;
  /** Optional badge next to wordmark, e.g. "AI" or "v2.0" */
  badge?: string;
};

/**
 * Animated FitTrack brand mark — a dark rounded-square tile holding a
 * teal→green gradient bolt, with a slow breathing glow and a shimmering
 * gradient sweep through the bolt itself. Used anywhere the app needs its
 * icon (nav rails, drawers, splash/loading screens).
 */
const Logo = ({
  size = 36,
  showText = true,
  textClassName = "text-[17px]",
  badge,
}: LogoProps) => {
  const boltSize = Math.round(size * 0.56);
  const uniqueId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `fittrack-bolt-grad-${uniqueId}`;

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="fittrack-logo-mark relative flex items-center justify-center rounded-xl shrink-0 overflow-hidden shadow-xs shadow-emerald-500/20"
        style={{ width: size, height: size }}
      >
        <svg
          width={boltSize}
          height={boltSize}
          viewBox="0 0 24 24"
          fill="none"
          className="relative z-10"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2dd4bf">
                <animate attributeName="stop-color" values="#2dd4bf;#4ade80;#2dd4bf" dur="3.2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#4ade80">
                <animate attributeName="stop-color" values="#4ade80;#2dd4bf;#4ade80" dur="3.2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          <path
            d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"
            fill={`url(#${gradId})`}
            className="drop-shadow-[0_0_5px_rgba(45,212,191,0.5)]"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`${textClassName} font-bold tracking-tight text-gray-900 dark:text-white transition-colors duration-200`}>
            Fit
            <span className="fittrack-logo-text-grad">Track</span>
          </span>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-700/40 shrink-0">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
