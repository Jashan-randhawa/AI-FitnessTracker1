import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

interface AuthCardLayoutProps {
  children: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  heroHeadline?: string;
  heroSub?: string;
}

export const AuthCardLayout: React.FC<AuthCardLayoutProps> = ({
  children,
  backTo = "/",
  backLabel = "Back to sign in",
  heroHeadline = "Small steps, taken daily, build real strength.",
  heroSub = "Track workouts, meals, and progress in one calm place — built to fit into your day, not take it over.",
}) => {
  const navigate = useNavigate();

  return (
    <div className="auth-root">
      {/* Left hero panel — warm-light wash matching Login.tsx */}
      <div className="auth-hero">
        <div className="auth-hero-nav">
          <span>AI Fitness Tracker</span>
        </div>
        <div className="auth-hero-copy">
          <h1 className="auth-hero-headline">{heroHeadline}</h1>
          <p className="auth-hero-sub">{heroSub}</p>
        </div>
        <div className="auth-wordmark">Fittrack</div>
      </div>

      {/* Right panel — form on parchment */}
      <div className="auth-panel-wrap">
        <main className="auth-card">
          {backTo && (
            <button
              type="button"
              className="auth-back"
              onClick={() => navigate(backTo)}
              aria-label={backLabel}
            >
              <ArrowLeftIcon size={16} aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};

export default AuthCardLayout;
