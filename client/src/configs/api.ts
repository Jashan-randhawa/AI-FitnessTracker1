import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import toast from "react-hot-toast";
import { getAuthToken, setAuthToken, clearAuthToken } from "./authToken";

const rawApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL = (rawApiUrl || "").replace(/\/$/, "");
export const API_URL = API_BASE_URL;

// Cold-start tolerant timeout: free Render instances take up to 45-60s to spin down and awake
const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 45000,
  withCredentials: true,
});

// Automatically attach Bearer token from memory to every outgoing request
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

// Refresh token mutex & queued requests tracking
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _isRefreshRetry?: boolean;
}

// Auto-retry transient network errors, 429 limits, and 401 token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // HTTP 429: AI rate limit or daily AI budget exceeded
    if (error.response?.status === 429) {
      const errData = error.response.data;
      const isDailyBudget =
        errData?.error?.code === "AI_DAILY_BUDGET_EXCEEDED" ||
        errData?.code === "AI_DAILY_BUDGET_EXCEEDED";

      if (isDailyBudget) {
        const resetAtRaw = errData?.error?.resetAt || errData?.resetAt;
        let formattedTime = "midnight UTC";
        if (resetAtRaw) {
          try {
            const date = new Date(resetAtRaw);
            formattedTime = date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              timeZoneName: "short",
            });
          } catch {
            formattedTime = "midnight UTC";
          }
        }
        toast.error(`Daily AI limit reached: resets at ${formattedTime} ⏳`, {
          id: "ai-daily-budget-limit",
        });
        return Promise.reject(error);
      }

      const retryAfter = error.response.data?.retryAfterSeconds || 60;
      const minutes = Math.ceil(retryAfter / 60);
      toast.error(
        `AI Rate limit reached: please cooldown for ${minutes} minute${minutes > 1 ? "s" : ""} ⏳`,
        { id: "ai-rate-limit" }
      );
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;

    // Handle 401 Unauthorized via single-flight refresh rotation
    if (error.response?.status === 401 && config) {
      const requestUrl = config.url || "";
      const isAuthEndpoint =
        requestUrl.includes("/auth/refresh") ||
        requestUrl.includes("/auth/local") ||
        requestUrl.includes("/auth/logout");

      if (isAuthEndpoint || config._isRefreshRetry) {
        clearAuthToken();
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (
            path !== "/login" &&
            path !== "/" &&
            !path.startsWith("/forgot-password") &&
            !path.startsWith("/reset-password") &&
            !path.startsWith("/verify-email") &&
            !path.startsWith("/google-callback")
          ) {
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }

      config._isRefreshRetry = true;

      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken) {
              if (config.headers && typeof config.headers.set === "function") {
                config.headers.set("Authorization", `Bearer ${newToken}`);
              } else {
                config.headers = config.headers || {};
                config.headers["Authorization"] = `Bearer ${newToken}`;
              }
            }
            return api(config);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      return axios
        .post<{ jwt: string; accessToken?: string }>(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        )
        .then(({ data }) => {
          const newToken = data.accessToken || data.jwt;
          setAuthToken(newToken);
          processQueue(null, newToken);

          if (config.headers && typeof config.headers.set === "function") {
            config.headers.set("Authorization", `Bearer ${newToken}`);
          } else {
            config.headers = config.headers || {};
            config.headers["Authorization"] = `Bearer ${newToken}`;
          }

          return api(config);
        })
        .catch((refreshErr) => {
          processQueue(refreshErr, null);
          clearAuthToken();
          if (typeof window !== "undefined") {
            const path = window.location.pathname;
            if (
              path !== "/login" &&
              path !== "/" &&
              !path.startsWith("/forgot-password") &&
              !path.startsWith("/reset-password") &&
              !path.startsWith("/verify-email") &&
              !path.startsWith("/google-callback")
            ) {
              window.location.href = "/login";
            }
          }
          return Promise.reject(refreshErr);
        })
        .finally(() => {
          isRefreshing = false;
        });
    }

    // Auto-retry transient network errors or gateway timeouts once during backend wake-up
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
