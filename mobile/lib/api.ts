import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useMemo } from "react";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.178.119.138:3000/api";



const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

export const useApi = () => {
  const { getToken } = useAuth();

  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(async (config) => {
      const token = await getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    const responseInterceptor = api.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        if (error.response) {
          console.warn(`[API Error] ${error.response.status} ${error.config.method?.toUpperCase()} ${error.config.url}`);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [getToken]);

  return api;
};
