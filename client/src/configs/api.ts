import axios from "axios";
import toast from "react-hot-toast";
import { getAuthToken } from "./authToken";

// Support both modern VITE_API_URL and legacy VITE_STRAPI_API_URL for seamless zero-crash deployment
const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_STRAPI_API_URL;

if (import.meta.env.PROD && !rawApiUrl) {
  console.warn(
    "[FitTrack] Warning: Neither VITE_API_URL nor VITE_STRAPI_API_URL is configured. Falling back to default origin."
  );
}

export const API_BASE_URL = (rawApiUrl || "").replace(/\/$/, "");

// Cold-start tolerant timeout: free Render instances take up to 45-60s to spin down and awake
const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 45000,
});

// Automatically attach Bearer token from localStorage to every outgoing request
api.interceptors.request.use((config) => {
  // The server buckets day totals in this timezone, so every request declares it.
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (config.headers && typeof config.headers.set === "function") {
        config.headers.set("X-Timezone", tz);
      } else {
        config.headers = config.headers || {};
        config.headers["X-Timezone"] = tz;
      }
    }
  } catch {
    // Older runtimes without Intl timezone support fall back to the server's default.
  }
  const token = getAuthToken();
  if (token) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-retry transient network errors or gateway timeouts once during backend wake-up
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Phase 5: Friendly cooldown toast on HTTP 429 AI rate limit
    if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retryAfterSeconds || 60;
      const minutes = Math.ceil(retryAfter / 60);
      toast.error(
        `AI Rate limit reached: please cooldown for ${minutes} minute${minutes > 1 ? "s" : ""} ⏳`,
        { id: "ai-rate-limit" }
      );
    }

    const config = error.config;
    if (
      config &&
      !config._retry &&
      (error.code === "ECONNABORTED" ||
        error.message?.includes("Network Error") ||
        error.response?.status === 502 ||
        error.response?.status === 503 ||
        error.response?.status === 504)
    ) {
      config._retry = true;
      // Brief 1.5s pause before retry to let Render finish waking up
      await new Promise((res) => setTimeout(res, 1500));
      return api(config);
    }
    return Promise.reject(error);
  }
);

export default api;
