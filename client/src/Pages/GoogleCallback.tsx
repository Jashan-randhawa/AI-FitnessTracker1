import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useappcontext } from "../Context/AppContext";

const API_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_STRAPI_API_URL || "").replace(/\/$/, "");

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { googleLogin } = useappcontext();
  const [error, setError] = useState("");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Extract token or error from URL fragment or query parameter
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const errorParam = queryParams.get("error") || hashParams.get("error");
    const accessToken = hashParams.get("access_token") || queryParams.get("access_token") || queryParams.get("id_token");

    // Scrub sensitive tokens / parameters from URL bar after reading
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Handle known OAuth error query codes redirected from server or Google
    if (errorParam) {
      if (errorParam === "access_denied") {
        setError("Google sign-in was cancelled. Please try again.");
      } else if (errorParam === "google_state_invalid") {
        setError("Invalid OAuth session or security state expired. Please try signing in again.");
      } else if (errorParam === "oauth_failed") {
        setError("Failed to exchange authentication code with Google. Please try again.");
      } else {
        setError(`Google sign-in failed (${errorParam}). Please try again.`);
      }
      return;
    }

    if (!accessToken) {
      setError("No access token received from Google. Please try again.");
      return;
    }

    googleLogin(accessToken)
      .then(() => navigate("/", { replace: true }))
      .catch((err: unknown) => {
        if (axios.isAxiosError(err)) {
          const code = err.response?.data?.code || err.response?.data?.error?.code;
          const msg = err.response?.data?.message || err.response?.data?.error?.message;
          if (code === "google_account_mismatch") {
            setError(
              "This email address is already connected to a different Google account. Please sign in with that Google account or reset your password."
            );
          } else if (code === "google_email_unverified") {
            setError("Your Google email is not verified. Please verify your email with Google first.");
          } else if (code === "account_blocked") {
            setError("Your account has been suspended by an administrator.");
          } else {
            setError(msg || "Google login failed. Please check your Google account and try again.");
          }
        } else {
          setError("Google login failed. Please check your Google account and try again.");
        }
      });
  }, [googleLogin, navigate]);

  const handleRetry = () => {
    window.location.href = `${API_URL}/api/connect/google`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-red-500 mb-6 text-sm sm:text-base leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleRetry}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition cursor-pointer shadow-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/", { replace: true })}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Signing you in with Google...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
