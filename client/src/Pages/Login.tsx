import { EyeIcon, EyeOffIcon, UserIcon, MailIcon, LockIcon } from "lucide-react";
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
      {/*
        Styled per the Luffu reference (editorial restraint, warm parchment
        ground, near-black ink, one dark-teal accent). ABC Arizona Flare/Sans
        are proprietary, so Playfair Display substitutes for Flare and Inter
        for Sans — both hold the tight negative-tracking, single-weight
        character the source system calls for.

        No photography pipeline exists in this project, so the "full-bleed
        lifestyle photography" hero is approximated with a warm golden-hour
        gradient wash rather than a stock/licensed photo — same mood
        (late-afternoon light through a window), no image dependency.
      */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400&family=Inter:wght@400;500;600&display=swap');

        .luffu-root {
          font-family: 'Inter', sans-serif;
          letter-spacing: -0.01em;
          min-height: 100vh;
          display: flex;
          background: #f5f5ee;
        }

        /* Left panel — warm-light hero standing in for full-bleed photography */
        .luffu-hero {
          display: none;
          position: relative;
          flex: 1.1;
          overflow: hidden;
          background:
            radial-gradient(110% 85% at 12% 8%, rgba(255,224,163,0.95) 0%, transparent 52%),
            radial-gradient(130% 95% at 90% 100%, rgba(89,126,121,0.45) 0%, transparent 62%),
            linear-gradient(160deg, #f3e4bf 0%, #dcb97e 40%, #7d9088 100%);
        }
        @media (min-width: 960px) { .luffu-hero { display: flex; flex-direction: column; } }

        .luffu-hero-nav {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 32px 40px 0;
        }
        .luffu-hero-nav span {
          font-size: 14px;
          color: rgba(20,24,26,0.7);
          letter-spacing: -0.02em;
        }

        .luffu-hero-copy {
          position: relative;
          z-index: 2;
          padding: 0 48px;
          margin-top: 64px;
          max-width: 420px;
        }
        .luffu-hero-headline {
          font-family: 'Playfair Display', serif;
          font-weight: 400;
          font-size: clamp(32px, 3.4vw, 44px);
          line-height: 1.08;
          letter-spacing: -0.02em;
          color: #14181a;
          margin: 0 0 16px;
        }
        .luffu-hero-sub {
          font-size: 16px;
          line-height: 1.5;
          letter-spacing: -0.01em;
          color: #424e52;
          max-width: 340px;
        }

        .luffu-wordmark {
          position: relative;
          z-index: 1;
          margin-top: auto;
          padding: 0 24px 8px;
          font-family: 'Playfair Display', serif;
          font-weight: 400;
          font-size: clamp(72px, 11vw, 132px);
          line-height: 0.86;
          letter-spacing: -0.05em;
          background: linear-gradient(120deg, rgba(20,24,26,0.22) 0%, rgba(20,24,26,0.1) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          user-select: none;
          white-space: nowrap;
        }

        /* Right panel — form on parchment */
        .luffu-panel {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 32px;
        }
        @media (min-width: 960px) { .luffu-panel { padding: 0 64px; } }

        .luffu-tabs {
          display: flex;
          gap: 28px;
          margin-bottom: 40px;
          border-bottom: 1px solid #d7d7cb;
        }
        .luffu-tab {
          background: none;
          border: none;
          padding: 0 0 12px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          letter-spacing: -0.01em;
          color: #8f948c;
          cursor: pointer;
          position: relative;
        }
        .luffu-tab.active {
          color: #14181a;
        }
        .luffu-tab.active::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: -1px;
          height: 2px;
          background: #192830;
        }

        .luffu-title {
          font-family: 'Playfair Display', serif;
          font-weight: 400;
          font-size: 32px;
          letter-spacing: -0.02em;
          color: #14181a;
          margin: 0 0 8px;
        }
        .luffu-subtitle {
          font-size: 14px;
          color: #535557;
          letter-spacing: -0.01em;
          margin-bottom: 28px;
        }

        .luffu-error {
          background: #f7ece9;
          border: 1px solid #e2ab9c;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #833a29;
        }

        .luffu-fields { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
        .luffu-field { display: flex; flex-direction: column; gap: 6px; }
        .luffu-field label {
          font-size: 12px;
          color: #535557;
          letter-spacing: -0.01em;
        }
        .luffu-input-wrap { position: relative; }
        .luffu-input-icon {
          position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
          color: #8f948c; width: 16px; height: 16px; pointer-events: none;
        }
        .luffu-field input {
          width: 100%;
          padding: 12px 14px 12px 40px;
          background: #ffffff;
          border: 1px solid #d7d7cb;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          letter-spacing: -0.01em;
          color: #14181a;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .luffu-field input:focus { border-color: #192830; }
        .luffu-field input::placeholder { color: #b4b6a9; }

        .luffu-eye-btn {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #8f948c;
          display: flex; align-items: center;
        }

        .luffu-forgot { text-align: right; margin-bottom: 20px; }
        .luffu-forgot button {
          background: none; border: none; cursor: pointer;
          font-size: 13px; color: #535557; letter-spacing: -0.01em;
        }
        .luffu-forgot button:hover { color: #14181a; }

        .luffu-submit {
          width: 100%;
          padding: 13px 20px;
          background: #192830;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s;
        }
        .luffu-submit:hover:not(:disabled) { background: #142027; }
        .luffu-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .luffu-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: luffu-spin 0.7s linear infinite;
        }
        @keyframes luffu-spin { to { transform: rotate(360deg); } }

        .luffu-divider {
          display: flex; align-items: center; gap: 12px; margin: 24px 0;
        }
        .luffu-divider-line { flex: 1; height: 1px; background: #e4e7da; }
        .luffu-divider span { font-size: 11px; color: #8f948c; letter-spacing: -0.01em; }

        .luffu-google {
          width: 100%;
          padding: 12px;
          background: #ffffff;
          border: 1px solid #192830;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #14181a;
          cursor: pointer;
          transition: background 0.15s;
        }
        .luffu-google:hover { background: #f5f5ee; }

        .luffu-footer {
          text-align: center;
          margin-top: 28px;
          font-size: 13px;
          color: #535557;
          letter-spacing: -0.01em;
        }
        .luffu-footer button {
          background: none; border: none; cursor: pointer;
          font-size: 13px; color: #192830; font-weight: 500;
        }
        .luffu-footer button:hover { text-decoration: underline; }
      `}</style>

      <div className="luffu-root">
        {/* Left hero panel — warm-light wash standing in for full-bleed photography */}
        <div className="luffu-hero">
          <div className="luffu-hero-nav">
            <span>AI Fitness Tracker</span>
          </div>
          <div className="luffu-hero-copy">
            <h1 className="luffu-hero-headline">
              Small steps, taken daily, build real strength.
            </h1>
            <p className="luffu-hero-sub">
              Track workouts, meals, and progress in one calm place — built to
              fit into your day, not take it over.
            </p>
          </div>
          <div className="luffu-wordmark">Fittrack</div>
        </div>

        {/* Right form panel */}
        <div className="luffu-panel">
          <div className="luffu-tabs">
            <button
              className={`luffu-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setState('login'); setErrors({}); }}
            >
              Sign In
            </button>
            <button
              className={`luffu-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setState('sign up'); setErrors({}); }}
            >
              Sign Up
            </button>
          </div>

          <h2 className="luffu-title">{isLogin ? 'Welcome back' : 'Create account'}</h2>
          <p className="luffu-subtitle">
            {isLogin
              ? 'Sign in to continue your fitness journey.'
              : 'Start your fitness journey today.'}
          </p>

          {errors.general && (
            <div className="luffu-error">{errors.general}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="luffu-fields">
              {!isLogin && (
                <div className="luffu-field">
                  <label htmlFor="username">Username</label>
                  <div className="luffu-input-wrap">
                    <UserIcon className="luffu-input-icon" />
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

              <div className="luffu-field">
                <label htmlFor="email">Email</label>
                <div className="luffu-input-wrap">
                  <MailIcon className="luffu-input-icon" />
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

              <div className="luffu-field">
                <label htmlFor="password">Password</label>
                <div className="luffu-input-wrap">
                  <LockIcon className="luffu-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a strong password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="luffu-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {isLogin && (
              <div className="luffu-forgot">
                <button type="button" onClick={() => navigate("/forgot-password")}>Forgot password?</button>
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className="luffu-submit">
              {isSubmitting ? (
                <><div className="luffu-spinner" /><span>Processing...</span></>
              ) : (
                <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              )}
            </button>

            <div className="luffu-divider">
              <div className="luffu-divider-line" />
              <span>OR</span>
              <div className="luffu-divider-line" />
            </div>

            <button type="button" className="luffu-google" onClick={handleGoogleLogin}>
              <svg width="16" height="16" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="luffu-footer">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setState(isLogin ? 'sign up' : 'login'); setErrors({}); }}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
