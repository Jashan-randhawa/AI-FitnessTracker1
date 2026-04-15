import axios from "axios";

const rawStrapiApiUrl = import.meta.env.VITE_STRAPI_API_URL;

if (import.meta.env.PROD && !rawStrapiApiUrl) {
  throw new Error("Missing required VITE_STRAPI_API_URL for production build/runtime.");
}

const STRAPI_API_BASE_URL = (rawStrapiApiUrl ?? "http://localhost:1337").replace(/\/$/, "");

const api = axios.create({
  baseURL: STRAPI_API_BASE_URL,
});

export default api;
