import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
type Step = "email" | "sent";

const ForgotPassword = () => {
  const navigate = useNavigate();

  const [step,           setStep]           = useState<Step>("email");
  const [loading,        setLoading]        = useState(false);
  const [email,          setEmail]          = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ── Submit email ───────────────────────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/api/password-reset/request", { email: email.trim() });
    } catch {
      // Swallow — we always show the same message to avoid email enumeration
    } finally {
      setLoading(false);
    }

    // Always move to the "sent" step with a generic success message
    toast.success("If that email is registered, a link has been sent.");
    setResendCooldown(60);
    setStep("sent");
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);

    try {
      await api.post("/api/password-reset/request", { email: email.trim() });
    } catch {
      // Same generic handling
    } finally {
      setLoading(false);
    }

    toast.success("Another link has been sent (if the email is registered).");
    setResendCooldown(60);
  };

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .fp-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #0a0a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .fp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.13;
          animation: fp-drift 14s ease-in-out infinite alternate;
        }
        .fp-blob-1 { width:450px;height:450px;background:#6366f1;top:-120px;left:-80px; }
        .fp-blob-2 { width:350px;height:350px;background:#06b6d4;bottom:-80px;right:-60px;animation-delay:-7s; }
        @keyframes fp-drift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(25px,35px) scale(1.07); }
        }
        .fp-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 40px 36px;
          backdrop-filter: blur(12px);
        }
        .fp-back {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: #6b7280;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          padding: 0;
          margin-bottom: 28px;
          transition: color 0.2s;
        }
        .fp-back:hover { color: #d1d5db; }
        .fp-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .fp-icon-wrap.green {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.2);
        }
        .fp-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .fp-sub {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .fp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .fp-field label {
          font-size: 11px;
          font-weight: 500;
          color: #6b7280;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .fp-input-wrap { position: relative; }
        .fp-input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #374151;
          width: 16px;
          height: 16px;
          pointer-events: none;
        }
        .fp-input {
          width: 100%;
          padding: 13px 13px 13px 40px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #f9fafb;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
          box-sizing: border-box;
        }
        .fp-input::placeholder { color: #374151; }
        .fp-input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.05);
        }
        .fp-btn {
          width: 100%;
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
        }
        .fp-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }
        .fp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .fp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: fp-spin 0.7s linear infinite;
        }
        @keyframes fp-spin { to { transform: rotate(360deg); } }
        .fp-email-chip {
          display: inline-block;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(99,102,241,0.2);
          border-radius: 6px;
          padding: 2px 10px;
          font-size: 13px;
          color: #a5b4fc;
          font-weight: 500;
          word-break: break-all;
        }
        .fp-resend {
          text-align: center;
          font-size: 13px;
          color: #4b5563;
          margin-top: 20px;
        }
        .fp-resend button {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          color: #818cf8;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .fp-resend button:disabled { color: #374151; cursor: default; }
        .fp-hint-box {
          background: rgba(99,102,241,0.06);
          border: 1px solid rgba(99,102,241,0.15);
          border-radius: 10px;
          padding: 16px;
          margin-top: 20px;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.6;
        }
        .fp-secondary-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 10px;
          padding: 12px 24px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #818cf8;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 4px;
        }
        .fp-secondary-btn:hover {
          background: rgba(99,102,241,0.08);
          border-color: rgba(99,102,241,0.5);
        }
      `}</style>

      <div className="fp-root">
        <div className="fp-blob fp-blob-1" />
        <div className="fp-blob fp-blob-2" />
        <div className="fp-card">
          <button className="fp-back" onClick={() => navigate("/")}>
            <ArrowLeftIcon size={14} /> Back to sign in
          </button>

          {/* ── Step 1: Enter email ── */}
          {step === "email" && (
            <>
              <div className="fp-icon-wrap">
                <MailIcon size={22} color="#818cf8" />
              </div>
              <h2 className="fp-title">Forgot password?</h2>
              <p className="fp-sub">
                Enter your email and we'll send you a secure reset link — valid
                for 10 minutes.
              </p>

              <form onSubmit={handleRequest}>
                <div className="fp-field">
                  <label>Email address</label>
                  <div className="fp-input-wrap">
                    <MailIcon className="fp-input-icon" />
                    <input
                      className="fp-input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      disabled={loading}
                    />
                  </div>
                </div>
                <button className="fp-btn" type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <div className="fp-spinner" />
                      Sending…
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Link sent ── */}
          {step === "sent" && (
            <>
              <div className="fp-icon-wrap green">
                <CheckCircleIcon size={22} color="#22c55e" />
              </div>
              <h2 className="fp-title">Check your inbox</h2>
              <p className="fp-sub">
                If <span className="fp-email-chip">{email}</span> is registered,
                you'll receive a password reset link shortly.
              </p>

              <div className="fp-hint-box">
                📧 &nbsp;Click the link in the email to set a new password.
                The link expires in <strong style={{ color: "#f9fafb" }}>10 minutes</strong> and
                can only be used <strong style={{ color: "#f9fafb" }}>once</strong>.
                <br /><br />
                Don't see it? Check your spam folder.
              </div>

              <div className="fp-resend">
                Didn't receive it?&nbsp;
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                >
                  <RefreshCwIcon size={12} />
                  {resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend link"}
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button
                  className="fp-secondary-btn"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeftIcon size={14} /> Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
