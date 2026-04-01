import { EyeIcon, EyeOffIcon, UserIcon, MailIcon, LockIcon, ActivityIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useappcontext } from "../Context/AppContext";
import { Toaster } from "react-hot-toast";

const STRAPI_URL = (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, '');

const Login = () => {
  const [state, setState] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ general?: string }>({});

  const navigate = useNavigate();
  const { user, login, signup } = useappcontext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});
    try {
      if (state === 'login') {
        await login({ email, password });
      } else {
        await signup({ username, email, password });
      }
    } catch (error) {
      setErrors({ general: 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${STRAPI_URL}/api/connect/google`;
  };

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const isLogin = state === 'login';

  return (
    <>
      <Toaster />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        .auth-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          display: flex;
          background: #0a0a0f;
          overflow: hidden;
          position: relative;
        }

        /* Animated background blobs */
        .blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          animation: drift 12s ease-in-out infinite alternate;
        }
        .blob-1 { width: 500px; height: 500px; background: #6366f1; top: -100px; left: -100px; animation-delay: 0s; }
        .blob-2 { width: 400px; height: 400px; background: #06b6d4; bottom: -80px; right: 30%; animation-delay: -4s; }
        .blob-3 { width: 300px; height: 300px; background: #8b5cf6; top: 40%; right: -60px; animation-delay: -8s; }

        @keyframes drift {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(30px, 40px) scale(1.08); }
        }

        /* Left panel — branding */
        .left-panel {
          display: none;
          flex: 1;
          flex-direction: column;
          justify-content: center;
          padding: 60px;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 900px) { .left-panel { display: flex; } }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 100px;
          padding: 8px 16px;
          margin-bottom: 40px;
          width: fit-content;
        }
        .brand-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; animation: pulse-dot 2s infinite; }
        @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        .brand-badge span { font-size: 13px; color: #a5b4fc; font-weight: 500; letter-spacing: 0.05em; }

        .left-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(36px, 4vw, 52px);
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          margin-bottom: 20px;
        }
        .left-headline .accent { color: #818cf8; }

        .left-sub {
          font-size: 16px;
          color: #6b7280;
          line-height: 1.7;
          max-width: 380px;
          margin-bottom: 48px;
        }

        .stats-row {
          display: flex;
          gap: 32px;
        }
        .stat { display: flex; flex-direction: column; gap: 4px; }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #fff; }
        .stat-label { font-size: 12px; color: #4b5563; letter-spacing: 0.05em; text-transform: uppercase; }

        /* Right panel — form */
        .right-panel {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 40px 32px;
          position: relative;
          z-index: 1;
        }
        @media (min-width: 900px) { .right-panel { padding: 60px 48px; border-left: 1px solid rgba(255,255,255,0.05); } }

        /* Mode toggle */
        .mode-toggle {
          display: flex;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 32px;
        }
        .toggle-btn {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 9px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #6b7280;
        }
        .toggle-btn.active-login {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          box-shadow: 0 4px 12px rgba(99,102,241,0.35);
        }
        .toggle-btn.active-signup {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #fff;
          box-shadow: 0 4px 12px rgba(6,182,212,0.35);
        }

        /* Form header */
        .form-header { margin-bottom: 28px; }
        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 6px;
        }
        .form-subtitle { font-size: 14px; color: #6b7280; }
        .form-subtitle .highlight-login { color: #818cf8; }
        .form-subtitle .highlight-signup { color: #22d3ee; }

        /* Input group */
        .input-group { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field label { font-size: 12px; font-weight: 500; color: #9ca3af; letter-spacing: 0.05em; text-transform: uppercase; }
        .input-wrap { position: relative; }
        .input-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #4b5563; width: 16px; height: 16px; pointer-events: none;
        }
        .field input {
          width: 100%;
          padding: 13px 14px 13px 42px;
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
        .field input::placeholder { color: #374151; }
        .field input:focus {
          border-color: rgba(99,102,241,0.5);
          background: rgba(99,102,241,0.05);
        }
        .field.signup-mode input:focus {
          border-color: rgba(6,182,212,0.5);
          background: rgba(6,182,212,0.05);
        }
        .eye-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #4b5563;
          padding: 0; display: flex;
        }
        .eye-btn:hover { color: #9ca3af; }

        /* Forgot password */
        .forgot { text-align: right; margin-top: -8px; margin-bottom: 4px; }
        .forgot button { background: none; border: none; cursor: pointer; font-size: 12px; color: #6366f1; font-family: 'DM Sans', sans-serif; }
        .forgot button:hover { color: #818cf8; }

        /* Error */
        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .error-box p { font-size: 13px; color: #f87171; margin: 0; }

        /* Submit button */
        .submit-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn.login-btn {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4);
        }
        .submit-btn.login-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(99,102,241,0.55);
          transform: translateY(-1px);
        }
        .submit-btn.signup-btn {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #fff;
          box-shadow: 0 4px 20px rgba(6,182,212,0.35);
        }
        .submit-btn.signup-btn:hover:not(:disabled) {
          box-shadow: 0 6px 28px rgba(6,182,212,0.5);
          transform: translateY(-1px);
        }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Divider */
        .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .divider span { font-size: 12px; color: #374151; letter-spacing: 0.08em; }

        /* Google button */
        .google-btn {
          width: 100%;
          padding: 13px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #d1d5db;
          cursor: pointer;
          transition: all 0.2s;
        }
        .google-btn:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.18);
          color: #fff;
        }

        /* Footer link */
        .footer-link { text-align: center; margin-top: 24px; font-size: 13px; color: #4b5563; }
        .footer-link button { background: none; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; }
        .footer-link .link-login { color: #818cf8; }
        .footer-link .link-signup { color: #22d3ee; }
        .footer-link button:hover { text-decoration: underline; }
      `}</style>

      <div className="auth-root">
        {/* Background blobs */}
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        {/* Left branding panel */}
        <div className="left-panel">
          <div className="brand-badge">
            <ActivityIcon size={14} color="#a5b4fc" />
            <span>AI FITNESS TRACKER</span>
            <div className="brand-badge-dot" />
          </div>
          <h1 className="left-headline">
            Train smarter.<br />
            Live <span className="accent">stronger.</span>
          </h1>
          <p className="left-sub">
            Your personal AI-powered fitness companion. Track workouts, log nutrition, and get insights tailored to your goals.
          </p>
          <div className="stats-row">
            <div className="stat"><span className="stat-num">98%</span><span className="stat-label">Goal success</span></div>
            <div className="stat"><span className="stat-num">AI</span><span className="stat-label">Powered</span></div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="right-panel">
          {/* Mode toggle */}
          <div className="mode-toggle">
            <button
              className={`toggle-btn ${isLogin ? 'active-login' : ''}`}
              onClick={() => { setState('login'); setErrors({}); }}
            >
              Sign In
            </button>
            <button
              className={`toggle-btn ${!isLogin ? 'active-signup' : ''}`}
              onClick={() => { setState('sign up'); setErrors({}); }}
            >
              Sign Up
            </button>
          </div>

          {/* Form header */}
          <div className="form-header">
            <h2 className="form-title">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="form-subtitle">
              {isLogin ? (
                <>Sign in to continue your <span className="highlight-login">fitness journey</span></>
              ) : (
                <>Start your <span className="highlight-signup">transformation</span> today</>
              )}
            </p>
          </div>

          {/* Error */}
          {errors.general && (
            <div className="error-box"><p>{errors.general}</p></div>
          )}

          {/* Form fields */}
          <form onSubmit={handleSubmit}>
            <div className="input-group">

              {!isLogin && (
                <div className="field signup-mode">
                  <label htmlFor="username">Username</label>
                  <div className="input-wrap">
                    <UserIcon className="input-icon" />
                    <input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className={`field ${!isLogin ? 'signup-mode' : ''}`}>
                <label htmlFor="email">Email</label>
                <div className="input-wrap">
                  <MailIcon className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className={`field ${!isLogin ? 'signup-mode' : ''}`}>
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <LockIcon className="input-icon" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a strong password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {isLogin && (
              <div className="forgot">
                <button type="button" onClick={() => navigate("/forgot-password")}>Forgot password?</button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`submit-btn ${isLogin ? 'login-btn' : 'signup-btn'}`}
            >
              {isSubmitting ? (
                <><div className="spinner" /><span>Processing...</span></>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>

            {/* Divider */}
            <div className="divider">
              <div className="divider-line" />
              <span>OR</span>
              <div className="divider-line" />
            </div>

            {/* Google button — below form as requested */}
            <button type="button" className="google-btn" onClick={handleGoogleLogin}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="footer-link">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              className={isLogin ? 'link-signup' : 'link-login'}
              onClick={() => { setState(isLogin ? 'sign up' : 'login'); setErrors({}); }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
