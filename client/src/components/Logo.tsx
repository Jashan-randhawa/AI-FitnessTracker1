type LogoProps = {
  /** Pixel size of the icon square */
  size?: number;
  /** Show the "FitTrack" wordmark next to the icon */
  showText?: boolean;
  /** Tailwind text-size class for the wordmark */
  textClassName?: string;
};

/**
 * Animated FitTrack brand mark — a dark rounded-square tile holding a
 * teal→green gradient bolt, with a slow breathing glow and a shimmering
 * gradient sweep through the bolt itself. Used anywhere the app needs its
 * icon (nav rails, drawers, splash/loading screens).
 */
const Logo = ({ size = 36, showText = true, textClassName = "text-[17px]" }: LogoProps) => {
  const boltSize = Math.round(size * 0.56);

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className="fittrack-logo-mark relative flex items-center justify-center rounded-xl shrink-0 overflow-hidden"
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
            <linearGradient id="fittrack-bolt-grad" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2dd4bf">
                <animate attributeName="stop-color" values="#2dd4bf;#4ade80;#2dd4bf" dur="3.2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#4ade80">
                <animate attributeName="stop-color" values="#4ade80;#2dd4bf;#4ade80" dur="3.2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" fill="url(#fittrack-bolt-grad)" />
        </svg>
      </div>

      {showText && (
        <span className={`${textClassName} font-semibold tracking-tight text-gray-900 dark:text-white transition-colors duration-200`}>
          Fit
          <span className="fittrack-logo-text-grad">Track</span>
        </span>
      )}
    </div>
  );
};

export default Logo;
