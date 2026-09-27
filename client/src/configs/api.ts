import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && !rawApiUrl) {
  throw new Error("Missing required VITE_API_URL for production build/runtime.");
}

export const API_BASE_URL = (rawApiUrl ?? "http://localhost:1337").replace(/\/$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
});

export default api;
