import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.11:3000/api";

let getTokenRef: (() => Promise<string | null>) | null = null;

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000, // 15s — more resilient on mobile
});

// Permanent request interceptor — always uses the latest token provider
api.interceptors.request.use(async (config) => {
  if (getTokenRef) {
    try {
      const token = await getTokenRef();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("[API Interceptor Error] Failed to get token:", error);
    }
  }
  return config;
});

// Response interceptor for logging errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const method = error.config?.method?.toUpperCase() || "UNKNOWN";
    const url = error.config?.url || "UNKNOWN";

    if (error.response) {
      console.warn(`[API Error] ${error.response.status} ${method} ${url}`);
    } else if (error.request) {
      console.error(`[Network Error] No response for ${method} ${url}. Backend: ${API_URL}`);
    } else {
      console.error(`[API Setup Error] ${error.message} for ${method} ${url}`);
    }
    return Promise.reject(error);
  }
);

export const useApi = () => {
  const { getToken } = useAuth();

  // Set synchronously on every render so it is ALWAYS available
  // before the first request interceptor runs — eliminates the race condition
  // that caused "Network Error" on app open.
  getTokenRef = getToken;

  return api;
};
