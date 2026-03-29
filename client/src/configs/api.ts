import axios from "axios";

const api = axios.create({
    baseURL: (import.meta.env.VITE_STRAPI_API_URL as string)?.replace(/\/$/, ''),
});

export default api;
