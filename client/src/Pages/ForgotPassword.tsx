import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MailIcon, LockIcon, EyeIcon, EyeOffIcon,
  ArrowLeftIcon, ShieldCheckIcon, CheckCircleIcon,
  KeyRoundIcon, RefreshCwIcon,
} from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";

type Step = "email" | "otp" | "password" | "done";

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

// ── OTP input ──────────────────────────────────────────────────────────────
const OTPInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, "").split("").slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) { next[i] = ""; onChange(next.join("")); }
      else if (i > 0) { next[i - 1] = ""; onChange(next.join("")); refs.current[i - 1]?.focus(); }
    }
  };

  const handleChange = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "").slice(0, 6 - i);
    if (!cleaned) return;
    const next = [...digits];
    for (let j = 0; j < cleaned.length && i + j < 6; j++) next[i + j] = cleaned[j];
    onChange(next.join(""));
    refs.current[Math.min(i + cleaned.length, 5)]?.focus();
  };

  return (
    <div style={{ display:"flex", gap:10, justifyContent:"center", margin:"24px 0" }}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { refs.current[i] = el; }} className="otp-box"
          type="text" inputMode="numeric" maxLength={6} value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onFocus={e => e.target.select()}
          autoFocus={i === 0} />
      ))}
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────
const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step,            setStep]            = useState<Step>("email");
  const [loading,         setLoading]         = useState(false);
  const [email,           setEmail]           = useState("");
  const [otp,             setOtp]             = useState("");
  const [otpError,        setOtpError]        = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw,          setShowPw]          = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [resendCooldown,  setResendCooldown]  = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/password-reset/request", { email });
      toast.success("Check your email for a 6-digit code.");
      setResendCooldown(60);
      setStep("otp");
    } catch (err: any) {
      if (err.response?.status === 429) {
        toast.error(err.response.data?.error?.message || "Too many requests.");
      } else {
        // Don't reveal email existence
        toast.success("If that email is registered, a code has been sent.");
        setResendCooldown(60);
        setStep("otp");
      }
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setOtp(""); setOtpError("");
    try {
      await api.post("/api/password-reset/request", { email });
      toast.success("New code sent!");
      setResendCooldown(60);
    } catch (err: any) {
      if (err.response?.status === 429)
        toast.error(err.response.data?.error?.message || "Too many requests.");
      else { toast.success("New code sent!"); setResendCooldown(60); }
    } finally { setLoading(false); }
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    if (otp.replace(/\D/g, "").length !== 6) {
      setOtpError("Please enter the full 6-digit code."); return;
    }
    setStep("password");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("Passwords do not match."); return; }
    if (getStrength(password) < 2)    { toast.error("Password is too weak.");   return; }
    setLoading(true);
    try {
      await api.post("/api/password-reset/reset", { email, otp: otp.trim(), newPassword: password });
      setStep("done");
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Invalid or expired code.";
      toast.error(msg);
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("attempts")) {
        setOtp(""); setStep("otp");
      }
    } finally { setLoading(false); }
  };

  const strength   = getStrength(password);
  const stepIndex  = ({ email:0, otp:1, password:2, done:3 } as const)[step];

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .fp-root{font-family:'DM Sans',sans-serif;min-height:100vh;background:#0a0a0f;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;}
        .fp-blob{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.13;animation:fp-drift 14s ease-in-out infinite alternate;}
        .fp-blob-1{width:450px;height:450px;background:#6366f1;top:-120px;left:-80px;}
        .fp-blob-2{width:350px;height:350px;background:#06b6d4;bottom:-80px;right:-60px;animation-delay:-7s;}
        @keyframes fp-drift{from{transform:translate(0,0) scale(1);}to{transform:translate(25px,35px) scale(1.07);}}
        .fp-card{position:relative;z-index:1;width:100%;max-width:440px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:40px 36px;backdrop-filter:blur(12px);}
        .fp-back{display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:#6b7280;font-size:13px;font-family:'DM Sans',sans-serif;padding:0;margin-bottom:28px;transition:color 0.2s;}
        .fp-back:hover{color:#d1d5db;}
        .fp-steps{display:flex;align-items:center;gap:6px;margin-bottom:32px;}
        .fp-step-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.1);transition:all 0.3s;}
        .fp-step-dot.active{background:#6366f1;width:24px;border-radius:4px;}
        .fp-step-dot.done{background:#22c55e;}
        .fp-step-line{flex:1;height:1px;background:rgba(255,255,255,0.06);}
        .fp-icon-wrap{width:52px;height:52px;border-radius:14px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;margin-bottom:20px;}
        .fp-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:6px;}
        .fp-sub{font-size:13px;color:#6b7280;line-height:1.6;margin-bottom:20px;}
        .fp-field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
        .fp-field label{font-size:11px;font-weight:500;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase;}
        .fp-input-wrap{position:relative;}
        .fp-input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#374151;width:16px;height:16px;pointer-events:none;}
        .fp-input{width:100%;padding:13px 13px 13px 40px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#f9fafb;outline:none;transition:border-color 0.2s,background 0.2s;box-sizing:border-box;}
        .fp-input::placeholder{color:#374151;}
        .fp-input:focus{border-color:rgba(99,102,241,0.5);background:rgba(99,102,241,0.05);}
        .fp-eye{position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#4b5563;display:flex;padding:0;}
        .fp-eye:hover{color:#9ca3af;}
        .otp-box{width:48px;height:56px;text-align:center;font-size:22px;font-weight:700;font-family:'Syne',sans-serif;color:#a5b4fc;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.25);border-radius:10px;outline:none;transition:border-color 0.2s,background 0.2s;caret-color:transparent;}
        .otp-box:focus{border-color:#6366f1;background:rgba(99,102,241,0.12);}
        .otp-error{font-size:12px;color:#f87171;text-align:center;margin-top:-12px;margin-bottom:8px;}
        .fp-resend{text-align:center;font-size:13px;color:#4b5563;margin-top:16px;}
        .fp-resend button{background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;color:#818cf8;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
        .fp-resend button:disabled{color:#374151;cursor:default;}
        .strength-row{display:flex;gap:4px;margin-top:8px;margin-bottom:4px;}
        .strength-seg{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,0.08);transition:background 0.3s;}
        .strength-label{font-size:11px;text-align:right;margin-bottom:12px;}
        .fp-btn{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;border-radius:10px;font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#fff;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,0.35);transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;}
        .fp-btn:hover:not(:disabled){box-shadow:0 6px 28px rgba(99,102,241,0.5);transform:translateY(-1px);}
        .fp-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none!important;}
        .fp-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:fp-spin 0.7s linear infinite;}
        @keyframes fp-spin{to{transform:rotate(360deg);}}
        .fp-done{text-align:center;}
        .fp-done-icon{width:64px;height:64px;border-radius:50%;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;}
        .fp-done-title{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;color:#fff;margin-bottom:8px;}
        .fp-done-sub{font-size:14px;color:#6b7280;margin-bottom:28px;}
        .fp-done-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:12px 24px;font-family:'DM Sans',sans-serif;font-size:14px;color:#818cf8;cursor:pointer;transition:all 0.2s;}
        .fp-done-btn:hover{background:rgba(99,102,241,0.08);border-color:rgba(99,102,241,0.5);}
        .fp-email-chip{display:inline-block;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:6px;padding:2px 10px;font-size:13px;color:#a5b4fc;font-weight:500;word-break:break-all;}
      `}</style>

      <div className="fp-root">
        <div className="fp-blob fp-blob-1" />
        <div className="fp-blob fp-blob-2" />
        <div className="fp-card">

          {step === "done" ? (
            <div className="fp-done">
              <div className="fp-done-icon"><CheckCircleIcon size={28} color="#22c55e" /></div>
              <h2 className="fp-done-title">Password updated!</h2>
              <p className="fp-done-sub">Your password has been securely changed.<br />Sign in with your new credentials.</p>
              <button className="fp-done-btn" onClick={() => navigate("/")}><ArrowLeftIcon size={14} /> Back to Sign In</button>
            </div>
          ) : (
            <>
              <button className="fp-back" onClick={() => navigate("/")}><ArrowLeftIcon size={14} /> Back to sign in</button>

              <div className="fp-steps">
                {[0,1,2].map((i) => (
                  <>{i > 0 && <div key={`l${i}`} className="fp-step-line" />}
                  <div key={`d${i}`} className={`fp-step-dot ${stepIndex===i?"active":stepIndex>i?"done":""}`} /></>
                ))}
              </div>

              {/* Step 1 — Email */}
              {step === "email" && (
                <>
                  <div className="fp-icon-wrap"><MailIcon size={22} color="#818cf8" /></div>
                  <h2 className="fp-title">Forgot password?</h2>
                  <p className="fp-sub">Enter your email and we'll send you a 6-digit verification code.</p>
                  <form onSubmit={handleRequestOTP}>
                    <div className="fp-field">
                      <label>Email address</label>
                      <div className="fp-input-wrap">
                        <MailIcon className="fp-input-icon" />
                        <input className="fp-input" type="email" placeholder="you@example.com"
                          value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                      </div>
                    </div>
                    <button className="fp-btn" type="submit" disabled={loading}>
                      {loading ? <><div className="fp-spinner" />Sending...</> : "Send Code"}
                    </button>
                  </form>
                </>
              )}

              {/* Step 2 — OTP */}
              {step === "otp" && (
                <>
                  <div className="fp-icon-wrap"><KeyRoundIcon size={22} color="#818cf8" /></div>
                  <h2 className="fp-title">Enter your code</h2>
                  <p className="fp-sub">We sent a 6-digit code to <span className="fp-email-chip">{email}</span><br />It expires in 10 minutes.</p>
                  <form onSubmit={handleVerifyOTP}>
                    <OTPInput value={otp} onChange={v => { setOtp(v); setOtpError(""); }} />
                    {otpError && <p className="otp-error">{otpError}</p>}
                    <button className="fp-btn" type="submit" disabled={otp.replace(/\D/g,"").length !== 6}>
                      Verify Code
                    </button>
                  </form>
                  <div className="fp-resend">
                    Didn't get it?{" "}
                    <button onClick={handleResend} disabled={resendCooldown > 0 || loading}>
                      <RefreshCwIcon size={12} />
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </button>
                  </div>
                </>
              )}

              {/* Step 3 — New password */}
              {step === "password" && (
                <>
                  <div className="fp-icon-wrap"><ShieldCheckIcon size={22} color="#818cf8" /></div>
                  <h2 className="fp-title">Set new password</h2>
                  <p className="fp-sub">Code verified. Choose a strong new password.</p>
                  <form onSubmit={handleResetPassword}>
                    <div className="fp-field">
                      <label>New password</label>
                      <div className="fp-input-wrap">
                        <LockIcon className="fp-input-icon" />
                        <input className="fp-input" type={showPw?"text":"password"} placeholder="Min. 8 characters"
                          value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus />
                        <button type="button" className="fp-eye" onClick={() => setShowPw(!showPw)}>
                          {showPw ? <EyeOffIcon size={16}/> : <EyeIcon size={16}/>}
                        </button>
                      </div>
                      {password && (<>
                        <div className="strength-row">
                          {[0,1,2,3].map(i => <div key={i} className="strength-seg" style={{background:i<strength?strengthColor[strength]:undefined}} />)}
                        </div>
                        <div className="strength-label" style={{color:strengthColor[strength]}}>{strengthLabel[strength]}</div>
                      </>)}
                    </div>
                    <div className="fp-field">
                      <label>Confirm password</label>
                      <div className="fp-input-wrap">
                        <LockIcon className="fp-input-icon" />
                        <input className="fp-input" type={showConfirm?"text":"password"} placeholder="Repeat your password"
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                          style={{borderColor:confirmPassword&&confirmPassword!==password?"rgba(239,68,68,0.4)":undefined}} />
                        <button type="button" className="fp-eye" onClick={() => setShowConfirm(!showConfirm)}>
                          {showConfirm ? <EyeOffIcon size={16}/> : <EyeIcon size={16}/>}
                        </button>
                      </div>
                      {confirmPassword && confirmPassword !== password && (
                        <span style={{fontSize:11,color:"#f87171"}}>Passwords do not match</span>
                      )}
                    </div>
                    <button className="fp-btn" type="submit"
                      disabled={loading||strength<2||!password||password!==confirmPassword}>
                      {loading ? <><div className="fp-spinner" />Saving...</> : "Set New Password"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
