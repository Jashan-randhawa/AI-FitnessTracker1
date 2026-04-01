import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useappcontext } from "../Context/AppContext";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { googleLogin } = useappcontext();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Strapi v4 sends access_token; older versions may send id_token
    const accessToken = params.get("access_token") || params.get("id_token");

    if (import.meta.env.DEV) {
      console.log("Token found:", accessToken ? accessToken.substring(0, 20) + "..." : "NONE");
    }

    if (!accessToken) {
      setError("No access token received from Google. Please try again.");
      return;
    }

    googleLogin(accessToken)
      .then(() => navigate("/"))
      .catch(() => setError("Google login failed. Please check your Strapi Google provider settings."));
  }, []);

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
