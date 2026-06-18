import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.breedsmartoton.site/api";

let getTokenRef: ((options?: any) => Promise<string | null>) | null = null;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Permanent request interceptor
api.interceptors.request.use(
  async (config) => {
    if (getTokenRef) {
      try {
        const token = await getTokenRef();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.error("[API] Failed to get token", e);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for logging errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const method = error.config?.method?.toUpperCase() || "UNKNOWN";
    const url = error.config?.url || "UNKNOWN";

    if (error.response) {
      console.warn(`[API Error] ${error.response.status} ${method} ${url}`);
    } else if (error.request) {
      console.error(
        `[Network Error] No response for ${method} ${url}. Backend: ${API_URL}`,
      );
    } else {
      console.error(`[API Setup Error] ${error.message} for ${method} ${url}`);
    }
    return Promise.reject(error);
  },
);

export const useApi = () => {
  const { getToken } = useAuth();
  getTokenRef = getToken;
  return api;
};
