import { useState, useEffect, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowLeftIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Password requirements and evaluation helpers
// ─────────────────────────────────────────────────────────────────────────────
interface Requirement {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { id: "length", label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { id: "uppercase", label: "At least one uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "number", label: "At least one number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "At least one special character (!@#$%^&*)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const getStrength = (pw: string) => {
  return REQUIREMENTS.reduce((score, req) => (req.test(pw) ? score + 1 : score), 0);
};

const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#6366f1"];

type PageState = "validating" | "ready" | "invalid" | "saving" | "done";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const newPwId = useId();
  const confirmPwId = useId();
  const checklistId = useId();
  const strengthDescId = useId();

  const [pageState, setPageState] = useState<PageState>("validating");
  const [invalidReason, setInvalidReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // ── On mount: validate the ?code= token ────────────────────────────────────
  useEffect(() => {
    if (!code) {
      queueMicrotask(() => {
        setInvalidReason("No reset code found in this link. Please request a new one.");
        setPageState("invalid");
      });
      return;
    }

    api
      .get(`/api/password-reset/validate?code=${encodeURIComponent(code)}`)
      .then(() => setPageState("ready"))
      .catch((err: any) => {
        const msg =
          err.response?.data?.message ||
          "This link is invalid or has expired. Please request a new one.";
        setInvalidReason(msg);
        setPageState("invalid");
      });
  }, [code]);

  // ── Auto-redirect timer when done ──────────────────────────────────────────
  useEffect(() => {
    if (pageState !== "done") return;
    setRedirectCountdown(5);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [pageState, navigate]);

  // ── Submit new password ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const currentScore = getStrength(password);
    if (currentScore < 3) {
      toast.error("Please satisfy more password requirements.");
      return;
    }

    setPageState("saving");
    try {
      await api.post("/api/password-reset/reset", {
        code,
        newPassword: password,
      });
      setPageState("done");
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        "Something went wrong. Please request a new reset link.";
      toast.error(msg);
      if (
        msg.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("used")
      ) {
        setInvalidReason(msg);
        setPageState("invalid");
      } else {
        setPageState("ready");
      }
    }
  };

  const strength = getStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isSubmitDisabled = pageState === "saving" || strength < 3 || !passwordsMatch;

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

        .rp-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #0a0a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          position: relative;
          overflow: hidden;
        }
        .rp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.13;
          animation: rp-drift 14s ease-in-out infinite alternate;
        }
        .rp-blob-1 { width:450px;height:450px;background:#6366f1;top:-120px;left:-80px; }
        .rp-blob-2 { width:350px;height:350px;background:#06b6d4;bottom:-80px;right:-60px;animation-delay:-7s; }
        @keyframes rp-drift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(25px,35px) scale(1.07); }
        }
        .rp-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 36px 28px;
          backdrop-filter: blur(12px);
          box-sizing: border-box;
        }
        @media(min-width: 480px) {
          .rp-card { padding: 40px 36px; }
        }
        .rp-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          padding: 8px 0;
          margin-bottom: 24px;
          transition: color 0.2s;
          min-height: 44px;
        }
        .rp-back:hover, .rp-back:focus-visible { color: #f3f4f6; outline: none; }
        .rp-icon-wrap {
          width: 54px; height: 54px;
          border-radius: 14px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .rp-icon-wrap.green {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.25);
        }
        .rp-icon-wrap.red {
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.25);
        }
        .rp-title {
          font-family: 'Syne', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .rp-sub {
          font-size: 13.5px;
          color: #9ca3af;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .rp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .rp-field label {
          font-size: 11.5px;
          font-weight: 600;
          color: #9ca3af;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .rp-input-wrap { position: relative; }
        .rp-input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #4b5563;
          width: 18px;
          height: 18px;
          pointer-events: none;
        }
        .rp-input {
          width: 100%;
          min-height: 46px;
          padding: 12px 44px 12px 42px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #f9fafb;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .rp-input::placeholder { color: #4b5563; }
        .rp-input:focus {
          border-color: rgba(99,102,241,0.6);
          background: rgba(99,102,241,0.06);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
        }
        .rp-eye {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 6px;
          padding: 0;
          transition: color 0.2s;
        }
        .rp-eye:hover, .rp-eye:focus-visible { color: #f3f4f6; outline: none; }
        
        /* Strength bar */
        .strength-row { display: flex; gap: 4px; margin-top: 8px; margin-bottom: 4px; }
        .strength-seg {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
          transition: background 0.3s;
        }
        .strength-label {
          font-size: 12px;
          font-weight: 500;
          text-align: right;
          margin-bottom: 12px;
          transition: color 0.3s;
        }

        /* Requirements checklist */
        .rp-checklist {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .rp-check-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
          transition: color 0.2s;
        }
        .rp-check-item.met {
          color: #86efac;
        }
        .rp-check-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .rp-btn {
          width: 100%;
          min-height: 48px;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border: none;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
        }
        .rp-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }
        .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .rp-btn:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }

        .rp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: rp-spin 0.7s linear infinite;
        }
        @keyframes rp-spin { to { transform: rotate(360deg); } }

        .rp-secondary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: none;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 10px;
          padding: 12px 24px;
          min-height: 44px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #a5b4fc;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 16px;
        }
        .rp-secondary-btn:hover, .rp-secondary-btn:focus-visible {
          background: rgba(99,102,241,0.1);
          border-color: rgba(99,102,241,0.6);
          outline: none;
        }

        /* Loading Skeleton */
        .rp-skeleton-pulse {
          background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
          background-size: 200% 100%;
          animation: rp-shimmer 1.8s infinite;
          border-radius: 8px;
        }
        @keyframes rp-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .rp-success-icon {
          animation: rp-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes rp-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div className="rp-root">
        <div className="rp-blob rp-blob-1" aria-hidden="true" />
        <div className="rp-blob rp-blob-2" aria-hidden="true" />
        <main className="rp-card">
          <button
            className="rp-back"
            onClick={() => navigate("/")}
            aria-label="Return to Sign In page"
          >
            <ArrowLeftIcon size={16} aria-hidden="true" /> Back to sign in
          </button>

          {/* ── 2.4: Loading Skeleton for Token Validation ── */}
          {pageState === "validating" && (
            <div role="status" aria-live="polite" aria-label="Verifying password reset code">
              <div
                className="rp-skeleton-pulse"
                style={{ width: 54, height: 54, borderRadius: 14, marginBottom: 20 }}
              />
              <div
                className="rp-skeleton-pulse"
                style={{ width: "65%", height: 28, marginBottom: 12 }}
              />
              <div
                className="rp-skeleton-pulse"
                style={{ width: "90%", height: 16, marginBottom: 30 }}
              />
              <div
                className="rp-skeleton-pulse"
                style={{ width: "100%", height: 46, marginBottom: 18 }}
              />
              <div
                className="rp-skeleton-pulse"
                style={{ width: "100%", height: 46, marginBottom: 24 }}
              />
              <div
                className="rp-skeleton-pulse"
                style={{ width: "100%", height: 48, borderRadius: 10 }}
              />
              <p
                style={{
                  fontSize: 13,
                  color: "#9ca3af",
                  textAlign: "center",
                  marginTop: 18,
                }}
              >
                Verifying your reset link…
              </p>
            </div>
          )}

          {/* ── Invalid / Expired Screen ── */}
          {pageState === "invalid" && (
            <section aria-labelledby="rp-invalid-heading">
              <div className="rp-icon-wrap red" aria-hidden="true">
                <AlertCircleIcon size={24} color="#f87171" />
              </div>
              <h1 id="rp-invalid-heading" className="rp-title">Link unavailable</h1>
              <p className="rp-sub" role="alert">{invalidReason}</p>
              <button
                type="button"
                className="rp-btn"
                onClick={() => navigate("/forgot-password")}
              >
                Request a new link
              </button>
            </section>
          )}

          {/* ── Password Form (Ready or Saving) ── */}
          {(pageState === "ready" || pageState === "saving") && (
            <section aria-labelledby="rp-form-heading">
              <div className="rp-icon-wrap" aria-hidden="true">
                <ShieldCheckIcon size={24} color="#818cf8" />
              </div>
              <h1 id="rp-form-heading" className="rp-title">Set new password</h1>
              <p className="rp-sub">
                Link verified. Choose a strong new password that satisfies the security requirements below.
              </p>

              <form onSubmit={handleSubmit} noValidate>
                {/* New password input */}
                <div className="rp-field">
                  <label htmlFor={newPwId}>New password</label>
                  <div className="rp-input-wrap">
                    <LockIcon className="rp-input-icon" aria-hidden="true" />
                    <input
                      id={newPwId}
                      className="rp-input"
                      type={showPw ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      disabled={pageState === "saving"}
                      aria-required="true"
                      aria-describedby={`${checklistId} ${strengthDescId}`}
                    />
                    <button
                      type="button"
                      className="rp-eye"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                    >
                      {showPw ? <EyeOffIcon size={18} aria-hidden="true" /> : <EyeIcon size={18} aria-hidden="true" />}
                    </button>
                  </div>

                  {/* Multi-segment strength bar */}
                  {password && (
                    <div id={strengthDescId}>
                      <div className="strength-row" aria-hidden="true">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="strength-seg"
                            style={{
                              background:
                                i < strength ? strengthColor[strength] : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className="strength-label"
                        style={{ color: strengthColor[strength] }}
                        role="status"
                        aria-live="polite"
                      >
                        Password strength: {strengthLabel[strength]}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 2.2: Password Requirements Checklist UI ── */}
                <div id={checklistId} className="rp-checklist" role="region" aria-label="Password requirements">
                  {REQUIREMENTS.map((req) => {
                    const isMet = req.test(password);
                    return (
                      <div
                        key={req.id}
                        className={`rp-check-item ${isMet ? "met" : ""}`}
                        aria-label={`${req.label}: ${isMet ? "satisfied" : "not satisfied"}`}
                      >
                        {isMet ? (
                          <CheckIcon size={14} className="rp-check-icon" color="#22c55e" aria-hidden="true" />
                        ) : (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#4b5563",
                              margin: "4px",
                            }}
                            aria-hidden="true"
                          />
                        )}
                        <span>{req.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Confirm password input */}
                <div className="rp-field">
                  <label htmlFor={confirmPwId}>Confirm password</label>
                  <div className="rp-input-wrap">
                    <LockIcon className="rp-input-icon" aria-hidden="true" />
                    <input
                      id={confirmPwId}
                      className="rp-input"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={pageState === "saving"}
                      aria-required="true"
                      aria-invalid={passwordsMismatch}
                      style={{
                        borderColor: passwordsMismatch
                          ? "rgba(239,68,68,0.5)"
                          : passwordsMatch
                          ? "rgba(34,197,94,0.4)"
                          : undefined,
                      }}
                    />
                    <button
                      type="button"
                      className="rp-eye"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                      aria-pressed={showConfirm}
                    >
                      {showConfirm ? (
                        <EyeOffIcon size={18} aria-hidden="true" />
                      ) : (
                        <EyeIcon size={18} aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {passwordsMismatch && (
                    <div className="rp-check-item" style={{ color: "#f87171", marginTop: 4 }} role="alert">
                      <XIcon size={14} aria-hidden="true" /> Passwords do not match
                    </div>
                  )}
                  {passwordsMatch && (
                    <div className="rp-check-item met" style={{ color: "#86efac", marginTop: 4 }} role="status">
                      <CheckIcon size={14} aria-hidden="true" /> Passwords match
                    </div>
                  )}
                </div>

                <button
                  className="rp-btn"
                  type="submit"
                  disabled={isSubmitDisabled}
                  aria-busy={pageState === "saving"}
                >
                  {pageState === "saving" ? (
                    <>
                      <div className="rp-spinner" aria-hidden="true" />
                      <span>Updating password…</span>
                    </>
                  ) : (
                    "Set New Password"
                  )}
                </button>
              </form>
            </section>
          )}

          {/* ── 2.6: Success Done Screen with Countdown ── */}
          {pageState === "done" && (
            <div style={{ textAlign: "center" }} role="status" aria-live="polite">
              <div
                className="rp-icon-wrap green rp-success-icon"
                style={{ margin: "0 auto 20px" }}
                aria-hidden="true"
              >
                <CheckCircleIcon size={30} color="#22c55e" />
              </div>
              <h1 className="rp-title">Password updated!</h1>
              <p className="rp-sub">
                Your password has been successfully and securely updated.
                <br />
                {redirectCountdown !== null && redirectCountdown > 0 ? (
                  <span style={{ color: "#c7d2fe", fontWeight: 500, display: "inline-block", marginTop: 8 }}>
                    Redirecting to Sign In in {redirectCountdown}s…
                  </span>
                ) : (
                  "You can now sign in with your new credentials."
                )}
              </p>
              <button
                type="button"
                className="rp-secondary-btn"
                onClick={() => navigate("/")}
              >
                <ArrowLeftIcon size={16} aria-hidden="true" /> Sign In Now
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ResetPassword;
