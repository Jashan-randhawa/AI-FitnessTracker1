import React, { useState, useEffect, useRef, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  CheckIcon,
  SparklesIcon,
} from "lucide-react";
import api, { API_BASE_URL } from "../configs/api";
import toast, { Toaster } from "react-hot-toast";
import AuthCardLayout from "../components/auth/AuthCardLayout";
import AlertBanner, { type AlertKind } from "../components/auth/AlertBanner";
import { forgotPasswordSchema } from "../schemas/auth.schema";
import "../styles/authFlow.css";

type Step = "email" | "sent";

const DOMAIN_TYPO_MAP: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "iclud.com": "icloud.com",
  "iclou.com": "icloud.com",
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const emailInputId = useId();
  const errorDescId = useId();
  const typoDescId = useId();

  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [alertKind, setAlertKind] = useState<AlertKind>(null);
  const [alertMessage, setAlertMessage] = useState("");
  const [suggestedEmail, setSuggestedEmail] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Validate email using Zod schema
  const validationResult = forgotPasswordSchema.safeParse({ email });
  const isEmailValid = validationResult.success;
  const validationError = !validationResult.success ? validationResult.error.issues[0]?.message : null;

  // Detect common domain typos
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    const parts = trimmed.split("@");
    if (parts.length === 2 && parts[1]) {
      const typo = DOMAIN_TYPO_MAP[parts[1]];
      if (typo) {
        setSuggestedEmail(`${parts[0]}@${typo}`);
        return;
      }
    }
    setSuggestedEmail(null);
  }, [email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const clearAlert = () => {
    setAlertKind(null);
    setAlertMessage("");
  };

  const handleApplySuggestion = () => {
    if (suggestedEmail) {
      setEmail(suggestedEmail);
      setSuggestedEmail(null);
      setEmailTouched(true);
      toast.success("Email suggestion applied!");
    }
  };

  // ── Submit email ───────────────────────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    clearAlert();
    setEmailTouched(true);

    if (!isEmailValid) {
      toast.error(validationError || "Please enter a valid email address.");
      return;
    }

    inFlightRef.current = true;
    setLoading(true);

    try {
      await api.post("/api/password-reset/request", { email: email.trim() });
      toast.success("Reset link sent! Check your inbox.");
      setResendCooldown(60);
      setStep("sent");
    } catch (err: any) {
      const errorType = err.response?.data?.error?.type as AlertKind;
      const errorMsg = err.response?.data?.error?.message || "Something went wrong.";

      if (errorType === "rate_limited") {
        setAlertKind("rate_limited");
        setAlertMessage(errorMsg);
      } else if (errorType === "not_found") {
        setAlertKind("not_found");
        setAlertMessage(errorMsg);
      } else if (errorType === "email_failed") {
        setAlertKind("email_failed");
        setAlertMessage(errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (inFlightRef.current || resendCooldown > 0 || loading) return;
    inFlightRef.current = true;
    clearAlert();
    setLoading(true);

    try {
      await api.post("/api/password-reset/request", { email: email.trim() });
      toast.success("Another link has been sent.");
      setResendCooldown(60);
    } catch (err: any) {
      const errorType = err.response?.data?.error?.type as AlertKind;
      const errorMsg =
        err.response?.data?.error?.message || "Could not resend. Try again.";
      if (errorType === "email_failed") {
        setAlertKind("email_failed");
        setAlertMessage(errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  return (
    <>
      <Toaster />
      <AuthCardLayout
        backTo="/"
        backLabel="Back to sign in"
        heroHeadline="Account recovery, simplified."
        heroSub="Enter your account email to receive a secure password reset link and resume your health journey."
      >
        {/* ── Step 1: Enter email ── */}
        {step === "email" && (
          <section aria-labelledby="fp-heading">
            <div className="auth-icon-wrap" aria-hidden="true">
              <MailIcon size={20} color="#192830" />
            </div>
            <h1 id="fp-heading" className="auth-title">Forgot password?</h1>
            <p className="auth-sub">
              Enter your account email and we'll send you a secure reset link — valid
              for 10 minutes.
            </p>

            <AlertBanner
              kind={alertKind}
              message={alertMessage}
              onGoogleSignIn={() => {
                window.location.href = `${API_BASE_URL}/api/connect/google`;
              }}
            />

            <form onSubmit={handleRequest} noValidate>
              <div className="auth-field">
                <label htmlFor={emailInputId}>Email address</label>
                <div className="auth-input-wrap">
                  <MailIcon className="auth-input-icon" aria-hidden="true" />
                  <input
                    id={emailInputId}
                    className={`auth-input ${
                      emailTouched && !isEmailValid && email.length > 0
                        ? "invalid"
                        : emailTouched && isEmailValid
                        ? "valid"
                        : ""
                    }`}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearAlert();
                    }}
                    onBlur={() => setEmailTouched(true)}
                    required
                    autoFocus
                    disabled={loading}
                    aria-required="true"
                    aria-invalid={emailTouched && !isEmailValid && email.length > 0}
                    aria-describedby={`${
                      emailTouched && !isEmailValid && email.length > 0
                        ? errorDescId
                        : ""
                    } ${suggestedEmail ? typoDescId : ""}`}
                  />
                  {isEmailValid && (
                    <span className="auth-valid-badge" aria-label="Valid email format">
                      <CheckIcon size={16} />
                    </span>
                  )}
                </div>

                {suggestedEmail && (
                  <div
                    id={typoDescId}
                    role="status"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#faf3e3",
                      border: "1px solid #e6c988",
                      borderRadius: 6,
                      padding: "8px 12px",
                      marginTop: 8,
                      fontSize: 12,
                      color: "#93671e",
                      fontFamily: "'Inter', sans-serif",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <SparklesIcon size={14} color="#c9932f" aria-hidden="true" />
                    <span>
                      Did you mean{" "}
                      <button
                        type="button"
                        onClick={handleApplySuggestion}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#192830",
                          fontWeight: 600,
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: "2px 4px",
                          fontFamily: "inherit",
                        }}
                        aria-label={`Replace email with suggestion ${suggestedEmail}`}
                      >
                        {suggestedEmail}
                      </button>
                      ?
                    </span>
                  </div>
                )}

                {emailTouched && !isEmailValid && email.length > 0 && (
                  <div
                    id={errorDescId}
                    role="alert"
                    style={{
                      fontSize: 12,
                      color: "#833a29",
                      marginTop: 4,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {validationError || "Please enter a valid email address."}
                  </div>
                )}
              </div>

              <button
                className="auth-btn"
                type="submit"
                disabled={loading || (emailTouched && !isEmailValid)}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <div className="auth-spinner" aria-hidden="true" />
                    <span>Sending reset link…</span>
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px", gap: 12 }}>
                <div style={{ flex: 1, height: 1, backgroundColor: "#e4e7da" }} />
                <span style={{ fontSize: 12, color: "#8f948c", textTransform: "uppercase", letterSpacing: "0.05em" }}>Or</span>
                <div style={{ flex: 1, height: 1, backgroundColor: "#e4e7da" }} />
              </div>

              <button
                type="button"
                onClick={() => {
                  window.location.href = `${API_BASE_URL}/api/connect/google`;
                }}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with Google
              </button>
            </form>
          </section>
        )}

        {/* ── Step 2: Link sent ── */}
        {step === "sent" && (
          <section aria-labelledby="sent-heading">
            <div className="auth-icon-wrap green" aria-hidden="true">
              <CheckCircleIcon size={22} color="#059669" />
            </div>
            <h1 id="sent-heading" className="auth-title">Check your inbox</h1>
            <p className="auth-sub">
              A password reset link has been dispatched to{" "}
              <span className="auth-chip">{email}</span>.
            </p>

            <AlertBanner
              kind={alertKind}
              message={alertMessage}
              onGoogleSignIn={() => {
                window.location.href = `${API_BASE_URL}/api/connect/google`;
              }}
            />

            <div className="auth-hint-box" role="note">
              <p style={{ margin: "0 0 10px 0" }}>
                📧 <strong>Next step:</strong> Click the link in the email to set a new password.
              </p>
              <p style={{ margin: 0 }}>
                It expires in <strong style={{ color: "#14181a" }}>10 minutes</strong> and
                can only be used <strong style={{ color: "#14181a" }}>once</strong>. If you
                don't see it, check your spam/junk folder.
              </p>
            </div>

            <div className="auth-resend-row">
              Didn't receive the email?&nbsp;
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                aria-label={
                  resendCooldown > 0
                    ? `Resend link disabled. Available in ${resendCooldown} seconds`
                    : "Resend reset link email"
                }
              >
                <RefreshCwIcon size={14} className={loading ? "auth-spin" : ""} aria-hidden="true" />
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend link"}
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button
                type="button"
                className="auth-secondary-btn"
                onClick={() => navigate("/")}
              >
                <ArrowLeftIcon size={16} aria-hidden="true" /> Back to Sign In
              </button>
            </div>
          </section>
        )}
      </AuthCardLayout>
    </>
  );
};

export default ForgotPassword;
