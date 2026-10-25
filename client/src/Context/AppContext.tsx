import { createContext, useContext, useEffect, useState, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import axios from "axios";
import { initialState, type AppContextType, type ActivityEntry, type Credentials, type FoodEntry, type User } from "../assets/types";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import toast from "react-hot-toast";
import { invalidateSummaries, clearSummaries } from "../data/summaryStore";
import { startLiveUpdates } from "../data/liveStream";

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
  const [isUserFetched, setIsUserFetched] = useState(() => !localStorage.getItem("token"));
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
      localStorage.setItem("token", data.jwt);
      setUser({ ...data.user, token: data.jwt });
      if (data?.user?.age && data?.user?.weight && data?.user?.goal) setOnboardingCompleted(true);
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(msg || "Signup failed. Please try again.");
      throw error;
    }
  };

  const login = async (credentials: Credentials) => {
    try {
      localStorage.removeItem("token");
      setAllFoodLogs([]);
      setAllActivityLogs([]);
      setAllWaterLogs([]);
      setUser(null);

      const { data } = await api.post("/api/auth/local", { identifier: credentials.email, password: credentials.password });
      localStorage.setItem("token", data.jwt);

      const [foodRes, activityRes, waterRes] = await Promise.all([
        api.get("/api/foodlogs", { headers: { Authorization: `Bearer ${data.jwt}` } }),
        api.get("/api/activitylogs", { headers: { Authorization: `Bearer ${data.jwt}` } }),
        api.get("/api/waterlogs", { headers: { Authorization: `Bearer ${data.jwt}` } }),
      ]);

      setUser({ ...data.user, token: data.jwt });
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
      localStorage.removeItem("token");
      setAllFoodLogs([]);
      setAllActivityLogs([]);
      setAllWaterLogs([]);
      setUser(null);

      const { data } = await api.post("/api/auth/google/callback", {
        access_token: googleAccessToken,
      });
      const jwtToken = data.jwt;

      localStorage.setItem("token", jwtToken);
      setUser({ ...data.user, token: jwtToken });

      if (data.user?.age && data.user?.weight && data.user?.goal) setOnboardingCompleted(true);

      const [foodRes, activityRes, waterRes] = await Promise.allSettled([
        api.get("/api/foodlogs", { headers: { Authorization: `Bearer ${jwtToken}` } }),
        api.get("/api/activitylogs", { headers: { Authorization: `Bearer ${jwtToken}` } }),
        api.get("/api/waterlogs", { headers: { Authorization: `Bearer ${jwtToken}` } }),
      ]);

      if (foodRes.status === "fulfilled") setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(foodRes.value.data));
      if (activityRes.status === "fulfilled") setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(activityRes.value.data));
      if (waterRes.status === "fulfilled") setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(waterRes.value.data));
    } catch (error: unknown) {
      localStorage.removeItem("token");
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      toast.error(msg || "Google login failed. Please try again.");
      throw error;
    }
  }, [setAllActivityLogs, setAllFoodLogs, setAllWaterLogs]);

  const fetchUser = useCallback(async (token: string, retries = 2): Promise<void> => {
    let attempt = retries;
    while (attempt >= 0) {
      try {
        const { data } = await api.get("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
        setUser({ ...data, token });
        if (data?.age && data?.weight && data?.goal) setOnboardingCompleted(true);
        setIsUserFetched(true);
        return;
      } catch (error: unknown) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        // If token is genuinely invalid, expired, or revoked (401/403), scrub token and show login
        if (status === 401 || status === 403) {
          localStorage.removeItem("token");
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

  const fetchFoodLogs = useCallback(async (token: string) => {
    try {
      const { data } = await api.get("/api/foodlogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllFoodLogs]);

  const fetchActivityLogs = useCallback(async (token: string) => {
    try {
      const { data } = await api.get("/api/activitylogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllActivityLogs]);

  const fetchWaterLogs = useCallback(async (token: string) => {
    try {
      const { data } = await api.get("/api/waterlogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  }, [setAllWaterLogs]);

  const logout = () => {
    localStorage.removeItem("token");
    clearSummaries();
    setUser(null);
    setAllFoodLogs([]);
    setAllActivityLogs([]);
    setAllWaterLogs([]);
    setOnboardingCompleted(false);
    navigate("/");
  };

  const setSessionToken = (jwt: string, updatedUser?: Partial<NonNullable<User>>) => {
    localStorage.setItem("token", jwt);
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
  useEffect(() => {
    if (!liveToken) return;
    return startLiveUpdates((evt) => {
      invalidateSummaries();
      if (evt?.kind === "weight") {
        window.dispatchEvent(new CustomEvent("fittrack:weight-change", { detail: evt }));
        const token = localStorage.getItem("token");
        if (token) fetchUser(token);
      }
    });
  }, [liveToken, fetchUser]);

  useEffect(() => {
    let ignore = false;
    const loadSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetchUser(token);
      if (!ignore) {
        fetchFoodLogs(token);
        fetchActivityLogs(token);
        fetchWaterLogs(token);
      }
    };
    loadSession();
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
