import { useState, useEffect, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ChromeIcon,
  CheckIcon,
  SparklesIcon,
} from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";

type Step = "email" | "sent";
type AlertKind = "not_found" | "google" | "rate_limited" | "email_failed" | null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// ─────────────────────────────────────────────────────────────────────────────
// Alert banner component with ARIA support
// ─────────────────────────────────────────────────────────────────────────────
const AlertBanner = ({
  kind,
  message,
  onGoogleSignIn,
}: {
  kind: AlertKind;
  message: string;
  onGoogleSignIn: () => void;
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

      {isGoogle && (
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

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
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

  // Real-time validation status
  const isEmailValid = EMAIL_REGEX.test(email.trim());

  // Check for common domain typos
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
      toast.error("Please enter a valid email address.");
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

  const handleGoogleSignIn = () => {
    window.location.href = "/";
  };

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        .fp-root{font-family:'DM Sans',sans-serif;min-height:100vh;background:#0a0a0f;display:flex;align-items:center;justify-content:center;padding:16px;position:relative;overflow:hidden;}
        .fp-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.13;animation:fp-drift 14s ease-in-out infinite alternate;}
        .fp-blob-1{width:450px;height:450px;background:#6366f1;top:-120px;left:-80px;}
        .fp-blob-2{width:350px;height:350px;background:#06b6d4;bottom:-80px;right:-60px;animation-delay:-7s;}
        @keyframes fp-drift{from{transform:translate(0,0) scale(1);}to{transform:translate(25px,35px) scale(1.07);}}
        .fp-card{position:relative;z-index:1;width:100%;max-width:440px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:36px 28px;backdrop-filter:blur(12px);box-sizing:border-box;}
        @media(min-width:480px){.fp-card{padding:40px 36px;}}
        .fp-back{display:inline-flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;color:#9ca3af;font-size:14px;font-family:'DM Sans',sans-serif;padding:8px 0;margin-bottom:24px;transition:color 0.2s;min-height:44px;}
        .fp-back:hover, .fp-back:focus-visible{color:#f3f4f6;outline:none;}
        .fp-icon-wrap{width:54px;height:54px;border-radius:14px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:20px;}
        .fp-icon-wrap.green{background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.25);}
        .fp-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:-0.02em;}
        .fp-sub{font-size:13.5px;color:#9ca3af;line-height:1.6;margin-bottom:22px;}
        .fp-field{display:flex;flex-direction:column;gap:6px;margin-bottom:18px;}
        .fp-field label{font-size:11.5px;font-weight:600;color:#9ca3af;letter-spacing:0.06em;text-transform:uppercase;}
        .fp-input-wrap{position:relative;}
        .fp-input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#4b5563;width:18px;height:18px;pointer-events:none;transition:color 0.2s;}
        .fp-input{width:100%;min-height:46px;padding:12px 42px 12px 42px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#f9fafb;outline:none;transition:border-color 0.2s,background 0.2s,box-shadow 0.2s;box-sizing:border-box;}
        .fp-input::placeholder{color:#4b5563;}
        .fp-input:focus{border-color:rgba(99,102,241,0.6);background:rgba(99,102,241,0.06);box-shadow:0 0 0 3px rgba(99,102,241,0.15);}
        .fp-input.invalid{border-color:rgba(239,68,68,0.5);background:rgba(239,68,68,0.04);}
        .fp-input.valid{border-color:rgba(34,197,94,0.4);}
        .fp-valid-badge{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:#22c55e;display:flex;align-items:center;pointer-events:none;}
        .fp-typo-box{display:flex;align-items:center;gap:6px;background:rgba(99,102,241,0.08);border:1px dashed rgba(99,102,241,0.3);border-radius:8px;padding:8px 12px;margin-top:6px;font-size:12px;color:#c7d2fe;}
        .fp-typo-btn{background:none;border:none;color:#818cf8;font-weight:600;text-decoration:underline;cursor:pointer;padding:2px 4px;font-family:inherit;}
        .fp-error-text{font-size:12px;color:#f87171;margin-top:4px;}
        .fp-btn{width:100%;min-height:48px;padding:14px;background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,0.35);transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .fp-btn:hover:not(:disabled){box-shadow:0 6px 28px rgba(99,102,241,0.5);transform:translateY(-1px);}
        .fp-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none!important;}
        .fp-btn:focus-visible{outline:2px solid #818cf8;outline-offset:2px;}
        .fp-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:fp-spin 0.7s linear infinite;}
        @keyframes fp-spin{to{transform:rotate(360deg);}}
        .fp-email-chip{display:inline-block;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);border-radius:6px;padding:3px 10px;font-size:13px;color:#c7d2fe;font-weight:600;word-break:break-all;}
        .fp-resend{text-align:center;font-size:13.5px;color:#6b7280;margin-top:22px;}
        .fp-resend button{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13.5px;color:#818cf8;font-weight:600;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 8px;}
        .fp-resend button:disabled{color:#4b5563;cursor:default;}
        .fp-hint-box{background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;padding:16px;margin-top:20px;font-size:13px;color:#9ca3af;line-height:1.6;}
        .fp-secondary-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:none;border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:12px 24px;min-height:44px;font-family:'DM Sans',sans-serif;font-size:14px;color:#a5b4fc;cursor:pointer;transition:all 0.2s;margin-top:8px;}
        .fp-secondary-btn:hover, .fp-secondary-btn:focus-visible{background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.6);outline:none;}
      `}</style>

      <div className="fp-root">
        <div className="fp-blob fp-blob-1" aria-hidden="true" />
        <div className="fp-blob fp-blob-2" aria-hidden="true" />
        <main className="fp-card">
          <button
            className="fp-back"
            onClick={() => navigate("/")}
            aria-label="Return to Sign In page"
          >
            <ArrowLeftIcon size={16} aria-hidden="true" /> Back to sign in
          </button>

          {/* ── Step 1: Enter email ── */}
          {step === "email" && (
            <section aria-labelledby="fp-heading">
              <div className="fp-icon-wrap" aria-hidden="true">
                <MailIcon size={24} color="#818cf8" />
              </div>
              <h1 id="fp-heading" className="fp-title">Forgot password?</h1>
              <p className="fp-sub">
                Enter your account email and we'll send you a secure reset link — valid
                for 10 minutes.
              </p>

              <AlertBanner
                kind={alertKind}
                message={alertMessage}
                onGoogleSignIn={handleGoogleSignIn}
              />

              <form onSubmit={handleRequest} noValidate>
                <div className="fp-field">
                  <label htmlFor={emailInputId}>Email address</label>
                  <div className="fp-input-wrap">
                    <MailIcon className="fp-input-icon" aria-hidden="true" />
                    <input
                      id={emailInputId}
                      className={`fp-input ${
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
                      <span className="fp-valid-badge" aria-label="Valid email format">
                        <CheckIcon size={16} />
                      </span>
                    )}
                  </div>

                  {/* Inline typo correction suggestion */}
                  {suggestedEmail && (
                    <div id={typoDescId} className="fp-typo-box" role="status">
                      <SparklesIcon size={14} color="#818cf8" aria-hidden="true" />
                      <span>
                        Did you mean{" "}
                        <button
                          type="button"
                          className="fp-typo-btn"
                          onClick={handleApplySuggestion}
                          aria-label={`Replace email with suggestion ${suggestedEmail}`}
                        >
                          {suggestedEmail}
                        </button>
                        ?
                      </span>
                    </div>
                  )}

                  {/* Inline validation error message */}
                  {emailTouched && !isEmailValid && email.length > 0 && (
                    <div id={errorDescId} className="fp-error-text" role="alert">
                      Please enter a valid email address (e.g. name@domain.com).
                    </div>
                  )}
                </div>

                <button
                  className="fp-btn"
                  type="submit"
                  disabled={loading || (emailTouched && !isEmailValid)}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <div className="fp-spinner" aria-hidden="true" />
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
              <div className="fp-icon-wrap green" aria-hidden="true">
                <CheckCircleIcon size={26} color="#22c55e" />
              </div>
              <h1 id="sent-heading" className="fp-title">Check your inbox</h1>
              <p className="fp-sub">
                A password reset link has been dispatched to{" "}
                <span className="fp-email-chip">{email}</span>.
              </p>

              <AlertBanner
                kind={alertKind}
                message={alertMessage}
                onGoogleSignIn={handleGoogleSignIn}
              />

              <div className="fp-hint-box" role="note">
                <p style={{ margin: "0 0 10px 0" }}>
                  📧 <strong>Next step:</strong> Click the link in the email to set a new password.
                </p>
                <p style={{ margin: 0 }}>
                  It expires in <strong style={{ color: "#f9fafb" }}>10 minutes</strong> and
                  can only be used <strong style={{ color: "#f9fafb" }}>once</strong>. If you
                  don't see it, be sure to check your spam/junk folder.
                </p>
              </div>

              <div className="fp-resend">
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
                  <RefreshCwIcon size={14} className={loading ? "fp-spin" : ""} aria-hidden="true" />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend link"}
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button
                  type="button"
                  className="fp-secondary-btn"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeftIcon size={16} aria-hidden="true" /> Back to Sign In
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
};

export default ForgotPassword;
