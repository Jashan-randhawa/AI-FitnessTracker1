import React, { useState, useEffect, useId } from "react";
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
    clearAlert();
    setEmailTouched(true);

    if (!isEmailValid) {
      toast.error(validationError || "Please enter a valid email address.");
      return;
    }

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
      } else if (errorType === "google") {
        setAlertKind("google");
        setAlertMessage(errorMsg);
      } else if (errorType === "email_failed") {
        setAlertKind("email_failed");
        setAlertMessage(errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
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
