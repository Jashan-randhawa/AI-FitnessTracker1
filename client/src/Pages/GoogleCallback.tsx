import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useappcontext } from "../Context/AppContext";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { googleLogin } = useappcontext();
  const [error, setError] = useState("");

  useEffect(() => {
    // Extract token from URL fragment (#access_token=) first to avoid query param exposure
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);

    const accessToken = hashParams.get("access_token") || queryParams.get("access_token") || queryParams.get("id_token");

    // Immediately scrub sensitive tokens from the URL bar
    if (window.location.hash || window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    if (!accessToken) {
      queueMicrotask(() => {
        setError("No access token received from Google. Please try again.");
      });
      return;
    }

    googleLogin(accessToken)
      .then(() => navigate("/"))
      .catch((err: any) => {
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
      });
  }, [googleLogin, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            Back to Login
          </button>
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
