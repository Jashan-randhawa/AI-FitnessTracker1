import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { initialState, type ActivityEntry, type Credentials, type FoodEntry, type User } from "../assets/types";
import { useNavigate } from "react-router-dom";
import api from "../configs/api";
import toast from "react-hot-toast";

export type WaterEntry = { id: string; amount: number; date: string };

const Appcontext = createContext(initialState);

const normalizeCollectionResponse = <T extends Record<string, any>>(payload: any): T[] => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
    ? payload.data.data
    : [];

  return list.map((item: any) => {
    if (item && typeof item === "object" && item.attributes && typeof item.attributes === "object") {
      return { id: item.id ?? item.attributes.id, ...item.attributes } as T;
    }
    return item as T;
  });
};

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(null);
  const [isUserFetched, setIsUserFetched] = useState(localStorage.getItem("token") ? false : true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [allFoodLogs, setAllFoodLogs] = useState<FoodEntry[]>([]);
  const [allActivityLogs, setAllActivityLogs] = useState<ActivityEntry[]>([]);
  const [allWaterLogs, setAllWaterLogs] = useState<WaterEntry[]>([]);

  const signup = async (credentials: Credentials) => {
    try {
      const { data } = await api.post("/api/auth/local/register", credentials);
      setUser({ ...data.user, token: data.jwt });
      if (data?.user?.age && data?.user?.weight && data?.user?.goal) setOnboardingCompleted(true);
      localStorage.setItem("token", data.jwt);
      api.defaults.headers.common["Authorization"] = `Bearer ${data.jwt}`;
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Signup failed. Please try again.");
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
      api.defaults.headers.common["Authorization"] = `Bearer ${data.jwt}`;

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
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Login failed. Please try again.");
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
      api.defaults.headers.common["Authorization"] = `Bearer ${jwtToken}`;
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
    } catch (error: any) {
      localStorage.removeItem("token");
      toast.error(error.response?.data?.message || "Google login failed. Please try again.");
      throw error;
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const { data } = await api.get("/api/users/me", { headers: { Authorization: `Bearer ${token}` } });
      setUser({ ...data, token });
      if (data?.age && data?.weight && data?.goal) setOnboardingCompleted(true);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch user.");
    }
    setIsUserFetched(true);
  };

  const fetchFoodLogs = async (token: string) => {
    try {
      const { data } = await api.get("/api/foodlogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllFoodLogs(normalizeCollectionResponse<FoodEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  };

  const fetchActivityLogs = async (token: string) => {
    try {
      const { data } = await api.get("/api/activitylogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllActivityLogs(normalizeCollectionResponse<ActivityEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  };

  const fetchWaterLogs = async (token: string) => {
    try {
      const { data } = await api.get("/api/waterlogs", { headers: { Authorization: `Bearer ${token}` } });
      setAllWaterLogs(normalizeCollectionResponse<WaterEntry>(data));
    } catch {
      // Ignore background fetch failure
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setAllFoodLogs([]);
    setAllActivityLogs([]);
    setAllWaterLogs([]);
    setOnboardingCompleted(false);
    api.defaults.headers.common["Authorization"] = "";
    navigate("/");
  };

  const setSessionToken = (jwt: string, updatedUser?: Partial<User>) => {
    localStorage.setItem("token", jwt);
    api.defaults.headers.common["Authorization"] = `Bearer ${jwt}`;
    setUser((prev: any) => ({
      ...(prev || {}),
      ...(updatedUser || {}),
      token: jwt,
    }));
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      Promise.all([fetchUser(token), fetchFoodLogs(token), fetchActivityLogs(token), fetchWaterLogs(token)]);
    }
  }, []);

  const value = {
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

export const useAppContext = () => useContext(Appcontext);
export const useappcontext = useAppContext;
