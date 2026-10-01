import { useEffect, useState, useId } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircleIcon, XCircleIcon, MailIcon } from "lucide-react";
import api from "../configs/api";
import toast, { Toaster } from "react-hot-toast";
import AuthCardLayout from "../components/auth/AuthCardLayout";
import { useappcontext } from "../Context/AppContext";
import "../styles/authFlow.css";

type VerifyState = "verifying" | "success" | "error" | "request";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useappcontext();
  const emailInputId = useId();

  const tokenParam = searchParams.get("token") || searchParams.get("code") || "";
  const [state, setState] = useState<VerifyState>(tokenParam ? "verifying" : "request");
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!tokenParam) {
      setState("request");
      return;
    }

    let isMounted = true;
    const confirmToken = async () => {
      try {
        const { data } = await api.post("/api/email-verification/confirm", {
          token: tokenParam,
        });

        if (isMounted) {
          setState("success");
          toast.success(data.message || "Email verified successfully!");
          if (user) {
            setUser({ ...user, emailVerified: true });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setState("error");
          setErrorMessage(
            err.response?.data?.message ||
              err.response?.data?.error?.message ||
              "This verification link is invalid or has expired."
          );
        }
      }
    };

    confirmToken();
    return () => {
      isMounted = false;
    };
  }, [tokenParam, user, setUser]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setResending(true);
    try {
      const { data } = await api.post("/api/email-verification/request", {
        email: email.trim().toLowerCase(),
      });
      toast.success(data.message || "Verification email sent! Check your inbox.");
      setCooldown(60);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Failed to send verification email. Try again later."
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Toaster />
      <AuthCardLayout
        backTo="/"
        backLabel="Back to sign in"
        heroHeadline="Confirm your email to unlock all features."
        heroSub="A verified email secures your account recovery and keeps your fitness progress protected."
      >
        {/* State 1: Verifying */}
        {state === "verifying" && (
          <section className="text-center py-6">
            <div className="auth-spinner" style={{ width: 36, height: 36, margin: "0 auto 16px" }} />
            <h1 className="auth-title">Verifying your email…</h1>
            <p className="auth-sub">Please hold on while we confirm your verification link.</p>
          </section>
        )}

        {/* State 2: Success */}
        {state === "success" && (
          <section className="text-center py-4">
            <div className="auth-icon-wrap green" style={{ margin: "0 auto 16px" }}>
              <CheckCircleIcon size={24} color="#059669" />
            </div>
            <h1 className="auth-title">Email Verified!</h1>
            <p className="auth-sub" style={{ marginBottom: 24 }}>
              Your email address has been confirmed. You now have full access to your account.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="auth-btn"
            >
              Continue to App
            </button>
          </section>
        )}

        {/* State 3: Error */}
        {state === "error" && (
          <section className="text-center py-4">
            <div className="auth-icon-wrap" style={{ margin: "0 auto 16px", backgroundColor: "#fef2f2" }}>
              <XCircleIcon size={24} color="#dc2626" />
            </div>
            <h1 className="auth-title">Verification Failed</h1>
            <p className="auth-sub" style={{ color: "#991b1b", marginBottom: 20 }}>
              {errorMessage}
            </p>

            <div style={{ textAlign: "left", marginTop: 24, borderTop: "1px solid #e4e7da", paddingTop: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#192830", marginBottom: 8 }}>
                Request a new verification email
              </h2>
              <form onSubmit={handleRequestVerification}>
                <div className="auth-field" style={{ marginBottom: 12 }}>
                  <label htmlFor={emailInputId}>Account email</label>
                  <div className="auth-input-wrap">
                    <MailIcon className="auth-input-icon" />
                    <input
                      id={emailInputId}
                      className="auth-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={resending || cooldown > 0}
                  className="auth-btn"
                >
                  {resending
                    ? "Sending…"
                    : cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : "Resend Verification Link"}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* State 4: Request Verification Form */}
        {state === "request" && (
          <section>
            <div className="auth-icon-wrap" style={{ margin: "0 0 16px" }}>
              <MailIcon size={20} color="#192830" />
            </div>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-sub" style={{ marginBottom: 20 }}>
              Enter your account email to receive a new verification link.
            </p>

            <form onSubmit={handleRequestVerification}>
              <div className="auth-field" style={{ marginBottom: 16 }}>
                <label htmlFor={emailInputId}>Email address</label>
                <div className="auth-input-wrap">
                  <MailIcon className="auth-input-icon" />
                  <input
                    id={emailInputId}
                    className="auth-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resending || cooldown > 0}
                className="auth-btn"
              >
                {resending
                  ? "Sending…"
                  : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Send Verification Link"}
              </button>
            </form>
          </section>
        )}
      </AuthCardLayout>
    </>
  );
};

export default VerifyEmail;
