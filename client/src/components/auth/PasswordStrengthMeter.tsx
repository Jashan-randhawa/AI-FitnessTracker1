import React from "react";
import { CheckIcon } from "lucide-react";

export interface Requirement {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: Requirement[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "uppercase", label: "At least one uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "number", label: "At least one number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "At least one special character (!@#$%^&*)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export const getPasswordScore = (pw: string): number => {
  return PASSWORD_REQUIREMENTS.reduce((score, req) => (req.test(pw) ? score + 1 : score), 0);
};

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#6366f1"];

interface PasswordStrengthMeterProps {
  password: string;
  checklistId?: string;
  strengthDescId?: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  checklistId,
  strengthDescId,
}) => {
  const score = getPasswordScore(password);

  return (
    <div>
      {/* Multi-segment strength bar */}
      {password && (
        <div id={strengthDescId} style={{ marginBottom: 12 }}>
          <div
            className="strength-row"
            aria-hidden="true"
            style={{ display: "flex", gap: 4, marginTop: 8, marginBottom: 4 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background:
                    i < score ? STRENGTH_COLORS[score] : "rgba(255, 255, 255, 0.08)",
                  transition: "background 0.3s",
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              textAlign: "right",
              color: STRENGTH_COLORS[score],
            }}
            role="status"
            aria-live="polite"
          >
            Password strength: {STRENGTH_LABELS[score]}
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <div
        id={checklistId}
        role="region"
        aria-label="Password requirements"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {PASSWORD_REQUIREMENTS.map((req) => {
          const isMet = req.test(password);
          return (
            <div
              key={req.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: isMet ? "#86efac" : "#6b7280",
                transition: "color 0.2s",
              }}
              aria-label={`${req.label}: ${isMet ? "satisfied" : "not satisfied"}`}
            >
              {isMet ? (
                <CheckIcon size={14} color="#22c55e" aria-hidden="true" />
              ) : (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#4b5563",
                    margin: 4,
                  }}
                  aria-hidden="true"
                />
              )}
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
