import React, { useId } from "react";

export type FitBotAvatarSize = "xs" | "sm" | "md" | "lg";
export type FitBotAvatarState = "idle" | "thinking" | "error";

export interface FitBotAvatarProps {
  /** Size preset: xs (22px), sm (30px), md (40px), lg (64px) */
  size?: FitBotAvatarSize;
  /** State preset: idle, thinking (twinkling spark + glow ring), error (rose accent) */
  state?: FitBotAvatarState;
  /** Optional custom class names */
  className?: string;
  /** Optional accessible title/tooltip */
  title?: string;
}

const SIZE_CONFIG: Record<
  FitBotAvatarSize,
  { dimension: number; radiusClass: string; boltRatio: number }
> = {
  xs: { dimension: 22, radiusClass: "rounded-md", boltRatio: 0.62 },
  sm: { dimension: 30, radiusClass: "rounded-xl", boltRatio: 0.6 },
  md: { dimension: 40, radiusClass: "rounded-xl", boltRatio: 0.58 },
  lg: { dimension: 64, radiusClass: "rounded-2xl", boltRatio: 0.56 },
};

/**
 * FitBotAvatar — Unified assistant brand mark.
 * Reuses the FitTrack dark rounded tile and teal→green bolt,
 * augmented with a distinct white assistant spark.
 *
 * Fully responsive to reduced motion preferences.
 */
export const FitBotAvatar: React.FC<FitBotAvatarProps> = ({
  size = "md",
  state = "idle",
  className = "",
  title = "FitBot AI Assistant",
}) => {
  const { dimension, radiusClass, boltRatio } = SIZE_CONFIG[size];
  const boltSize = Math.round(dimension * boltRatio);
  const rawId = useId();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const gradBoltId = `fitbot-bolt-grad-${safeId}`;

  const isThinking = state === "thinking";
  const isError = state === "error";

  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-all duration-200 overflow-visible ${radiusClass} ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {/* Tile Base */}
      <div
        className={`absolute inset-0 ${radiusClass} overflow-hidden transition-all duration-200 ${
          isError
            ? "border border-rose-500/60 shadow-xs shadow-rose-500/30"
            : isThinking
            ? "border border-emerald-400/80 fitbot-avatar-thinking-ring"
            : "border border-slate-700/60 shadow-xs shadow-emerald-500/10"
        }`}
        style={{
          background: isError
            ? "linear-gradient(155deg, #1c1014 0%, #2d1218 100%)"
            : "linear-gradient(155deg, #0f1c22 0%, #16262c 100%)",
        }}
      >
        {/* Subtle radial sheen */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: isError
              ? "radial-gradient(circle at 30% 20%, rgba(244, 63, 94, 0.3), transparent 70%)"
              : "radial-gradient(circle at 30% 20%, rgba(45, 212, 191, 0.35), transparent 70%)",
          }}
        />
      </div>

      {/* SVG Icon: FitTrack Bolt + White Assistant Spark */}
      <svg
        width={boltSize}
        height={boltSize}
        viewBox="0 0 24 24"
        fill="none"
        className="relative z-10"
        aria-hidden="true"
      >
        <defs>
          {/* Bolt Linear Gradient */}
          <linearGradient id={gradBoltId} x1="0%" y1="0%" x2="100%" y2="100%">
            {isError ? (
              <>
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </>
            ) : isThinking ? (
              <>
                <stop offset="0%" stopColor="#2dd4bf">
                  <animate
                    attributeName="stop-color"
                    values="#2dd4bf;#4ade80;#38bdf8;#2dd4bf"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop offset="100%" stopColor="#4ade80">
                  <animate
                    attributeName="stop-color"
                    values="#4ade80;#38bdf8;#2dd4bf;#4ade80"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </stop>
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#4ade80" />
              </>
            )}
          </linearGradient>
        </defs>

        {/* FitTrack Lightning Bolt */}
        <path
          d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"
          fill={`url(#${gradBoltId})`}
          className={
            isError
              ? "drop-shadow-[0_0_4px_rgba(244,63,94,0.6)]"
              : "drop-shadow-[0_0_5px_rgba(45,212,191,0.55)]"
          }
        />

        {/* Assistant Spark (4-pointed star in upper right) */}
        <path
          d="M18.5 1.5 C18.5 2.8 19.1 3.5 20.8 4 C19.1 4.5 18.5 5.2 18.5 6.5 C18.5 5.2 17.9 4.5 16.2 4 C17.9 3.5 18.5 2.8 18.5 1.5 Z"
          fill="#ffffff"
          className={
            isThinking
              ? "fitbot-avatar-spark-twinkle drop-shadow-[0_0_5px_rgba(255,255,255,0.95)]"
              : "drop-shadow-[0_0_2.5px_rgba(255,255,255,0.7)]"
          }
        />
      </svg>
    </div>
  );
};

export default FitBotAvatar;
