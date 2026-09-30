import React from "react";
import { CheckIcon } from "lucide-react";
import {
  PASSWORD_REQUIREMENTS,
  getPasswordScore,
} from "../../schemas/auth.schema";

const STRENGTH_LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

const STRENGTH_COLORS = ["#833a29", "#b85f47", "#c9932f", "#059669", "#192830"];

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
        <div id={strengthDescId} style={{ marginBottom: 14 }}>
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
                    i < score ? STRENGTH_COLORS[score] : "#e4e7da",
                  transition: "background 0.25s",
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
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "-0.01em",
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
          background: "#ffffff",
          border: "1px solid #d7d7cb",
          borderRadius: 6,
          padding: "12px 14px",
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 7,
          boxSizing: "border-box",
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
                color: isMet ? "#14181a" : "#8f948c",
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.01em",
                transition: "color 0.2s",
              }}
              aria-label={`${req.label}: ${isMet ? "satisfied" : "not satisfied"}`}
            >
              {isMet ? (
                <CheckIcon size={14} color="#059669" aria-hidden="true" />
              ) : (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#b4b6a9",
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
