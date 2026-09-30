import React from "react";
import { AlertCircleIcon, ChromeIcon } from "lucide-react";

export type AlertKind = "not_found" | "google" | "rate_limited" | "email_failed" | null;

interface AlertBannerProps {
  kind: AlertKind;
  message: string;
  onGoogleSignIn?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  kind,
  message,
  onGoogleSignIn,
}) => {
  if (!kind) return null;

  const isGoogle = kind === "google";
  const isRateLimit = kind === "rate_limited";
  const borderColor = isGoogle
    ? "rgba(99,102,241,0.35)"
    : isRateLimit
    ? "rgba(234,179,8,0.35)"
    : "rgba(239,68,68,0.35)";
  const bgColor = isGoogle
    ? "rgba(99,102,241,0.08)"
    : isRateLimit
    ? "rgba(234,179,8,0.08)"
    : "rgba(239,68,68,0.08)";
  const iconColor = isGoogle
    ? "#818cf8"
    : isRateLimit
    ? "#fbbf24"
    : "#f87171";
  const Icon = isGoogle ? ChromeIcon : AlertCircleIcon;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Icon size={18} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
        <span style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.5 }}>
          {message}
        </span>
      </div>

      {isGoogle && onGoogleSignIn && (
        <button
          type="button"
          onClick={onGoogleSignIn}
          aria-label="Continue with Google sign in"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            minHeight: 44,
            padding: "10px 16px",
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 8,
            color: "#a5b4fc",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
          }}
        >
          <ChromeIcon size={16} aria-hidden="true" />
          Sign in with Google
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
