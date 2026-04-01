import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LockIcon, EyeIcon, EyeOffIcon,
  ArrowLeftIcon, ShieldCheckIcon,
  CheckCircleIcon, AlertCircleIcon,
} from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Password strength helpers
// ─────────────────────────────────────────────────────────────────────────────
const getStrength = (pw: string) => {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#6366f1"];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
type PageState = "validating" | "ready" | "invalid" | "saving" | "done";

const ResetPassword = () => {
  const navigate             = useNavigate();
  const [searchParams]       = useSearchParams();
  const code                 = searchParams.get("code") ?? "";

  const [pageState,        setPageState]        = useState<PageState>("validating");
  const [invalidReason,    setInvalidReason]    = useState("");
  const [password,         setPassword]         = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [showPw,           setShowPw]           = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);

  // ── On mount: validate the ?code= token before showing the form ────────────
  useEffect(() => {
    if (!code) {
      setInvalidReason("No reset code found in this link. Please request a new one.");
      setPageState("invalid");
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

  // ── Submit new password ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (getStrength(password) < 2) {
      toast.error("Please choose a stronger password.");
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
      // If token expired during submission, mark the page invalid
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

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .rp-root {
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
          padding: 40px 36px;
          backdrop-filter: blur(12px);
        }
        .rp-back {
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
        .rp-back:hover { color: #d1d5db; }
        .rp-icon-wrap {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: rgba(99,102,241,0.12);
          border: 1px solid rgba(99,102,241,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .rp-icon-wrap.green {
          background: rgba(34,197,94,0.1);
          border-color: rgba(34,197,94,0.2);
        }
        .rp-icon-wrap.red {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.2);
        }
        .rp-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .rp-sub {
          font-size: 13px;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .rp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .rp-field label {
          font-size: 11px;
          font-weight: 500;
          color: #6b7280;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .rp-input-wrap { position: relative; }
        .rp-input-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #374151;
          width: 16px;
          height: 16px;
          pointer-events: none;
        }
        .rp-input {
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
        .rp-input::placeholder { color: #374151; }
        .rp-input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.05);
        }
        .rp-eye {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #4b5563;
          display: flex;
          padding: 0;
        }
        .rp-eye:hover { color: #9ca3af; }
        .strength-row { display: flex; gap: 4px; margin-top: 8px; margin-bottom: 4px; }
        .strength-seg {
          flex: 1;
          height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
          transition: background 0.3s;
        }
        .strength-label { font-size: 11px; text-align: right; margin-bottom: 12px; }
        .rp-btn {
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
        .rp-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(99,102,241,0.5);
          transform: translateY(-1px);
        }
        .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
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
          margin-top: 12px;
        }
        .rp-secondary-btn:hover {
          background: rgba(99,102,241,0.08);
          border-color: rgba(99,102,241,0.5);
        }
        .rp-pulse { animation: rp-pulse-anim 1.4s ease-in-out infinite; }
        @keyframes rp-pulse-anim {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div className="rp-root">
        <div className="rp-blob rp-blob-1" />
        <div className="rp-blob rp-blob-2" />
        <div className="rp-card">
          <button className="rp-back" onClick={() => navigate("/")}>
            <ArrowLeftIcon size={14} /> Back to sign in
          </button>

          {/* ── Validating ── */}
          {pageState === "validating" && (
            <>
              <div className="rp-icon-wrap">
                <ShieldCheckIcon size={22} color="#818cf8" className="rp-pulse" />
              </div>
              <h2 className="rp-title">Checking your link…</h2>
              <p className="rp-sub">Please wait while we verify your reset link.</p>
            </>
          )}

          {/* ── Invalid / expired ── */}
          {pageState === "invalid" && (
            <>
              <div className="rp-icon-wrap red">
                <AlertCircleIcon size={22} color="#f87171" />
              </div>
              <h2 className="rp-title">Link unavailable</h2>
              <p className="rp-sub">{invalidReason}</p>
              <button
                className="rp-btn"
                onClick={() => navigate("/forgot-password")}
              >
                Request a new link
              </button>
            </>
          )}

          {/* ── Password form ── */}
          {(pageState === "ready" || pageState === "saving") && (
            <>
              <div className="rp-icon-wrap">
                <ShieldCheckIcon size={22} color="#818cf8" />
              </div>
              <h2 className="rp-title">Set new password</h2>
              <p className="rp-sub">
                Link verified. Choose a strong new password — it must be at
                least 8 characters.
              </p>
              <form onSubmit={handleSubmit}>
                {/* New password */}
                <div className="rp-field">
                  <label>New password</label>
                  <div className="rp-input-wrap">
                    <LockIcon className="rp-input-icon" />
                    <input
                      className="rp-input"
                      type={showPw ? "text" : "password"}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      disabled={pageState === "saving"}
                    />
                    <button
                      type="button"
                      className="rp-eye"
                      onClick={() => setShowPw(!showPw)}
                    >
                      {showPw ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </button>
                  </div>
                  {password && (
                    <>
                      <div className="strength-row">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="strength-seg"
                            style={{
                              background:
                                i < strength
                                  ? strengthColor[strength]
                                  : undefined,
                            }}
                          />
                        ))}
                      </div>
                      <div
                        className="strength-label"
                        style={{ color: strengthColor[strength] }}
                      >
                        {strengthLabel[strength]}
                      </div>
                    </>
                  )}
                </div>

                {/* Confirm password */}
                <div className="rp-field">
                  <label>Confirm password</label>
                  <div className="rp-input-wrap">
                    <LockIcon className="rp-input-icon" />
                    <input
                      className="rp-input"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={pageState === "saving"}
                      style={{
                        borderColor:
                          confirmPassword && confirmPassword !== password
                            ? "rgba(239,68,68,0.4)"
                            : undefined,
                      }}
                    />
                    <button
                      type="button"
                      className="rp-eye"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? (
                        <EyeOffIcon size={16} />
                      ) : (
                        <EyeIcon size={16} />
                      )}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <span style={{ fontSize: 11, color: "#f87171" }}>
                      Passwords do not match
                    </span>
                  )}
                </div>

                <button
                  className="rp-btn"
                  type="submit"
                  disabled={
                    pageState === "saving" ||
                    strength < 2 ||
                    !password ||
                    password !== confirmPassword
                  }
                >
                  {pageState === "saving" ? (
                    <>
                      <div className="rp-spinner" />
                      Saving…
                    </>
                  ) : (
                    "Set New Password"
                  )}
                </button>
              </form>
            </>
          )}

          {/* ── Done ── */}
          {pageState === "done" && (
            <div style={{ textAlign: "center" }}>
              <div
                className="rp-icon-wrap green"
                style={{ margin: "0 auto 20px" }}
              >
                <CheckCircleIcon size={28} color="#22c55e" />
              </div>
              <h2 className="rp-title">Password updated!</h2>
              <p className="rp-sub">
                Your password has been securely changed.
                <br />
                Sign in with your new credentials.
              </p>
              <button
                className="rp-secondary-btn"
                onClick={() => navigate("/")}
              >
                <ArrowLeftIcon size={14} /> Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
