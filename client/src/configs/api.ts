import axios from "axios";

const STRAPI_API_BASE_URL = (import.meta.env.VITE_STRAPI_API_URL as string | undefined)?.replace(/\/$/, "");

const api = axios.create({
  baseURL: STRAPI_API_BASE_URL || "",
});

export default api;
