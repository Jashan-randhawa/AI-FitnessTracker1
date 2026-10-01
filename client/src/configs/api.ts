import axios from "axios";

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

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  timeout: 15000,
});

export default api;
