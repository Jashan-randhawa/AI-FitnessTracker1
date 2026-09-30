import React, { useState, useEffect, useId } from "react";
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
import AuthCardLayout from "../components/auth/AuthCardLayout";
import PasswordStrengthMeter, { getPasswordScore } from "../components/auth/PasswordStrengthMeter";
import { resetPasswordSchema } from "../schemas/auth.schema";
import "../styles/authFlow.css";

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

    // Client-side Zod validation
    const validation = resetPasswordSchema.safeParse({
      code,
      newPassword: password,
      confirmPassword,
    });

    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Invalid password details.";
      toast.error(firstError);
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

  const strength = getPasswordScore(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const isSubmitDisabled = pageState === "saving" || strength < 3 || !passwordsMatch;

  return (
    <>
      <Toaster />
      <AuthCardLayout backTo="/" backLabel="Back to sign in">
        {/* ── Loading Skeleton for Token Validation ── */}
        {pageState === "validating" && (
          <div role="status" aria-live="polite" aria-label="Verifying password reset code">
            <div
              className="auth-shimmer"
              style={{ width: 54, height: 54, borderRadius: 14, marginBottom: 20 }}
            />
            <div
              className="auth-shimmer"
              style={{ width: "65%", height: 28, marginBottom: 12 }}
            />
            <div
              className="auth-shimmer"
              style={{ width: "90%", height: 16, marginBottom: 30 }}
            />
            <div
              className="auth-shimmer"
              style={{ width: "100%", height: 46, marginBottom: 18 }}
            />
            <div
              className="auth-shimmer"
              style={{ width: "100%", height: 46, marginBottom: 24 }}
            />
            <div
              className="auth-shimmer"
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
            <div className="auth-icon-wrap red" aria-hidden="true">
              <AlertCircleIcon size={24} color="#f87171" />
            </div>
            <h1 id="rp-invalid-heading" className="auth-title">Link unavailable</h1>
            <p className="auth-sub" role="alert">{invalidReason}</p>
            <button
              type="button"
              className="auth-btn"
              onClick={() => navigate("/forgot-password")}
            >
              Request a new link
            </button>
          </section>
        )}

        {/* ── Password Form (Ready or Saving) ── */}
        {(pageState === "ready" || pageState === "saving") && (
          <section aria-labelledby="rp-form-heading">
            <div className="auth-icon-wrap" aria-hidden="true">
              <ShieldCheckIcon size={24} color="#818cf8" />
            </div>
            <h1 id="rp-form-heading" className="auth-title">Set new password</h1>
            <p className="auth-sub">
              Link verified. Choose a strong new password that satisfies the security requirements below.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              {/* New password input */}
              <div className="auth-field">
                <label htmlFor={newPwId}>New password</label>
                <div className="auth-input-wrap">
                  <LockIcon className="auth-input-icon" aria-hidden="true" />
                  <input
                    id={newPwId}
                    className="auth-input"
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
                    className="auth-eye"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    aria-pressed={showPw}
                  >
                    {showPw ? <EyeOffIcon size={18} aria-hidden="true" /> : <EyeIcon size={18} aria-hidden="true" />}
                  </button>
                </div>

                {/* Password strength meter & requirements checklist */}
                <PasswordStrengthMeter
                  password={password}
                  checklistId={checklistId}
                  strengthDescId={strengthDescId}
                />
              </div>

              {/* Confirm password input */}
              <div className="auth-field">
                <label htmlFor={confirmPwId}>Confirm password</label>
                <div className="auth-input-wrap">
                  <LockIcon className="auth-input-icon" aria-hidden="true" />
                  <input
                    id={confirmPwId}
                    className="auth-input"
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
                    className="auth-eye"
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
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, color: "#f87171", fontSize: 12, marginTop: 4 }}
                    role="alert"
                  >
                    <XIcon size={14} aria-hidden="true" /> Passwords do not match
                  </div>
                )}
                {passwordsMatch && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, color: "#86efac", fontSize: 12, marginTop: 4 }}
                    role="status"
                  >
                    <CheckIcon size={14} aria-hidden="true" /> Passwords match
                  </div>
                )}
              </div>

              <button
                className="auth-btn"
                type="submit"
                disabled={isSubmitDisabled}
                aria-busy={pageState === "saving"}
              >
                {pageState === "saving" ? (
                  <>
                    <div className="auth-spinner" aria-hidden="true" />
                    <span>Updating password…</span>
                  </>
                ) : (
                  "Set New Password"
                )}
              </button>
            </form>
          </section>
        )}

        {/* ── Success Screen with Countdown ── */}
        {pageState === "done" && (
          <div style={{ textAlign: "center" }} role="status" aria-live="polite">
            <div
              className="auth-icon-wrap green auth-pop-in"
              style={{ margin: "0 auto 20px" }}
              aria-hidden="true"
            >
              <CheckCircleIcon size={30} color="#22c55e" />
            </div>
            <h1 className="auth-title">Password updated!</h1>
            <p className="auth-sub">
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
              className="auth-secondary-btn"
              onClick={() => navigate("/")}
            >
              <ArrowLeftIcon size={16} aria-hidden="true" /> Sign In Now
            </button>
          </div>
        )}
      </AuthCardLayout>
    </>
  );
};

export default ResetPassword;
