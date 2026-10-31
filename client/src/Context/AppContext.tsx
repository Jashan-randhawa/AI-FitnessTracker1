import { createContext, useContext, useEffect, useState, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import axios from "axios";
import { initialState, type AppContextType, type ActivityEntry, type Credentials, type FoodEntry, type User } from "../assets/types";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import toast from "react-hot-toast";
import { invalidateSummaries, clearSummaries } from "../data/summaryStore";
import { startLiveUpdates } from "../data/liveStream";
import { getAuthToken, getRefreshToken, setAuthToken, clearAuthToken } from "../configs/authToken";
import {
  purgeOfflineQueue,
  startOfflineSync,
  stopOfflineSync,
  onReconcile,
} from "../offline";

export type WaterEntry = { id: string; amount: number; date: string };

const Appcontext = createContext<AppContextType>(initialState);

const normalizeCollectionResponse = <T extends Record<string, unknown>>(payload: unknown): T[] => {
  const p = payload as { data?: unknown } | unknown[];
  const list = Array.isArray(p)
    ? p
    : Array.isArray((p as { data?: unknown[] })?.data)
    ? (p as { data: unknown[] }).data
    : Array.isArray((p as { data?: { data?: unknown[] } })?.data?.data)
    ? (p as { data: { data: unknown[] } }).data.data
    : [];

  return list.map((item: unknown) => {
    const obj = item as { id?: string; attributes?: Record<string, unknown> };
    if (obj && typeof obj === "object" && obj.attributes && typeof obj.attributes === "object") {
      return { id: obj.id ?? (obj.attributes.id as string | undefined), ...obj.attributes } as unknown as T;
    }
    return item as T;
  });
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(null);
  const [isUserFetched, setIsUserFetched] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [allFoodLogs, setAllFoodLogsRaw] = useState<FoodEntry[]>([]);
  const [allActivityLogs, setAllActivityLogsRaw] = useState<ActivityEntry[]>([]);
  const [allWaterLogs, setAllWaterLogsRaw] = useState<WaterEntry[]>([]);

  // Every list change also marks the cached day/range summaries stale, so any
  // page showing totals refreshes without its own refetch logic.
  const withInvalidate = <T,>(setter: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> =>
    (action) => {
      setter(action);
      invalidateSummaries();
    };
  const setAllFoodLogs = useMemo(() => withInvalidate(setAllFoodLogsRaw), []);
  const setAllActivityLogs = useMemo(() => withInvalidate(setAllActivityLogsRaw), []);
  const setAllWaterLogs = useMemo(() => withInvalidate(setAllWaterLogsRaw), []);

  const signup = async (credentials: Credentials) => {
    try {
      const { data } = await api.post("/api/auth/local/register", credentials);
      const token = data.accessToken || data.jwt;
      setAuthToken(token, data.refreshToken);
      setUser({ ...data.user, token });
      if (data?.user?.age && data?.user?.weight && data?.user?.goal) setOnboardingCompleted(true);
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(msg || "Signup failed. Please try again.");
      throw error;
    }
  };

  const login = async (credentials: Credentials) => {
    try {
      clearAuthToken();
      setAllFoodLogs([]);
      setAllActivityLogs([]);
      setAllWaterLogs([]);
      setUser(null);

      const { data } = await api.post("/api/auth/local", { identifier: credentials.email, password: credentials.password });
      const token = data.accessToken || data.jwt;
      setAuthToken(token, data.refreshToken);

      const [foodRes, activityRes, waterRes] = await Promise.all([
        api.get("/api/foodlogs"),
        api.get("/api/activitylogs"),
        api.get("/api/waterlogs"),
      ]);

      setUser({ ...data.user, token });
      setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(foodRes.data));
      setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(activityRes.data));
      setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(waterRes.data));

      if (data?.user?.age && data?.user?.weight && data?.user?.goal) setOnboardingCompleted(true);
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(msg || "Login failed. Please try again.");
      throw error;
    }
  };

  const googleLogin = useCallback(async (googleAccessToken: string) => {
    try {
      clearAuthToken();
      setAllFoodLogs([]);
      setAllActivityLogs([]);
      setAllWaterLogs([]);
      setUser(null);

      const { data } = await api.post("/api/auth/google/callback", {
        access_token: googleAccessToken,
      });
      const jwtToken = data.accessToken || data.jwt;

      setAuthToken(jwtToken, data.refreshToken);
      setUser({ ...data.user, token: jwtToken });

      if (data.user?.age && data.user?.weight && data.user?.goal) setOnboardingCompleted(true);

      const [foodRes, activityRes, waterRes] = await Promise.allSettled([
        api.get("/api/foodlogs"),
        api.get("/api/activitylogs"),
        api.get("/api/waterlogs"),
      ]);

      if (foodRes.status === "fulfilled") setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(foodRes.value.data));
      if (activityRes.status === "fulfilled") setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(activityRes.value.data));
      if (waterRes.status === "fulfilled") setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(waterRes.value.data));
    } catch (error: unknown) {
      clearAuthToken();
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(msg || "Google login failed. Please try again.");
      throw error;
    }
  }, [setAllActivityLogs, setAllFoodLogs, setAllWaterLogs]);

  const fetchUser = useCallback(async (token: string, retries = 2): Promise<void> => {
    let attempt = retries;
    while (attempt >= 0) {
      try {
        const { data } = await api.get("/api/users/me");
        setUser({ ...data, token });
        if (data?.age && data?.weight && data?.goal) setOnboardingCompleted(true);
        setIsUserFetched(true);
        return;
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // If token is genuinely invalid, expired, or revoked (401/403), scrub token and show login
        if (status === 401 || status === 403) {
          clearAuthToken();
          setUser(null);
          setIsUserFetched(true);
          return;
        }

        // If backend is waking up or cold-starting (timeout / 502 / 503 / 504 / network error), retry
        if (attempt > 0) {
          attempt--;
          await new Promise((res) => setTimeout(res, 2000));
          continue;
        }

        // Only alert if exhausted
        const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
        toast.error(msg || "Server is waking up, please wait a moment...");
        setIsUserFetched(true);
        return;
      }
    }
  }, []);

  const fetchFoodLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/foodlogs");
      setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllFoodLogs]);

  const fetchActivityLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/activitylogs");
      setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllActivityLogs]);

  const fetchWaterLogs = useCallback(async () => {
    try {
      const { data } = await api.get("/api/waterlogs");
      setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllWaterLogs]);

  const logout = async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Ignore network errors during logout
    } finally {
      const activeUserId = user?.id;
      if (activeUserId) {
        await purgeOfflineQueue(activeUserId);
      } else {
        await purgeOfflineQueue();
      }
      stopOfflineSync();
      clearAuthToken();
      clearSummaries();
      setUser(null);
      setAllFoodLogs([]);
      setAllActivityLogs([]);
      setAllWaterLogs([]);
      setOnboardingCompleted(false);
      navigate("/");
    }
  };

  const setSessionToken = (jwt: string, updatedUser?: Partial<NonNullable<User>>) => {
    setAuthToken(jwt);
    setUser((prev) => {
      const base = prev || { id: "", username: "", email: "", token: jwt };
      return {
        ...base,
        ...(updatedUser || {}),
        token: jwt,
      };
    });
  };

  // Open the live-update stream for the signed-in user; close it on logout.
  const liveToken = user?.token;
  const currentUserId = user?.id;

  useEffect(() => {
    if (!currentUserId) return;
    startOfflineSync(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    return onReconcile((event) => {
      invalidateSummaries();
      if (event.kind === "weight_log") {
        const token = getAuthToken();
        if (token) fetchUser(token);
      }
    });
  }, [fetchUser]);

  useEffect(() => {
    if (!liveToken) return;
    return startLiveUpdates((evt) => {
      invalidateSummaries();
      if (evt?.kind === "weight") {
        window.dispatchEvent(new CustomEvent("fittrack:weight-change", { detail: evt }));
        const token = getAuthToken();
        if (token) fetchUser(token);
      }
    });
  }, [liveToken, fetchUser]);

  useEffect(() => {
    let ignore = false;
    const restoreSession = async () => {
      try {
        const storedRefreshToken = getRefreshToken();
        const { data } = await api.post<{
          jwt: string;
          accessToken?: string;
          refreshToken?: string;
          user: NonNullable<User>;
        }>("/api/auth/refresh", storedRefreshToken ? { refreshToken: storedRefreshToken } : {});

        if (ignore) return;
        const freshJwt = data.accessToken || data.jwt;
        setAuthToken(freshJwt, data.refreshToken);
        setUser({ ...data.user, token: freshJwt });
        if (data.user?.age && data.user?.weight && data.user?.goal) {
          setOnboardingCompleted(true);
        }

        fetchFoodLogs();
        fetchActivityLogs();
        fetchWaterLogs();
      } catch (err: unknown) {
        if (ignore) return;
        const legacyToken = getAuthToken();
        if (legacyToken) {
          try {
            await fetchUser(legacyToken);
            if (!ignore) {
              fetchFoodLogs();
              fetchActivityLogs();
              fetchWaterLogs();
            }
            return;
          } catch {
            clearAuthToken();
          }
        }
        // Only clear credentials if the refresh was an explicit auth rejection (401/403)
        const isAuthError = axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403);
        if (isAuthError || !getRefreshToken()) {
          clearAuthToken();
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setIsUserFetched(true);
        }
      }
    };
    restoreSession();
    return () => {
      ignore = true;
    };
  }, [fetchUser, fetchFoodLogs, fetchActivityLogs, fetchWaterLogs]);

  const value: AppContextType = {
    user,
    setUser,
    isUserFetched,
    fetchUser,
    signup,
    login,
    googleLogin,
    logout,
    onboardingCompleted,
    setOnboardingCompleted,
    allFoodLogs,
    allActivityLogs,
    allWaterLogs,
    setAllFoodLogs,
    setAllActivityLogs,
    setAllWaterLogs,
    setSessionToken,
  };

  return <Appcontext.Provider value={value}>{children}</Appcontext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => useContext(Appcontext);
// eslint-disable-next-line react-refresh/only-export-components
export const useappcontext = useAppContext;
