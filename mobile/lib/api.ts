import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useEffect, useRef } from "react";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.32:3000/api";
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

export const useApi = () => {
  const { getToken } = useAuth();
  const interceptorRef = useRef<number | null>(null);

  // Set up interceptor synchronously (not inside useEffect)
  // so it's registered before any query fires
  if (interceptorRef.current !== null) {
    api.interceptors.request.eject(interceptorRef.current);
  }

  interceptorRef.current = api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  useEffect(() => {
    // Cleanup on unmount only
    return () => {
      if (interceptorRef.current !== null) {
        api.interceptors.request.eject(interceptorRef.current);
        interceptorRef.current = null;
      }
    };
  }, []);

  return api;
};
