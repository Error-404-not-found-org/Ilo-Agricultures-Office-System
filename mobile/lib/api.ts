import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.breedsmartoton.site/api";

let getTokenRef: ((options?: any) => Promise<string | null>) | null = null;

export interface ApiErrorDetails {
  status?: number;
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  details?: unknown;
}

export const getApiErrorDetails = (error: any): ApiErrorDetails => {
  const status = error?.response?.status;
  const responseData = error?.response?.data;
  const retryAfterHeader = error?.response?.headers?.["retry-after"];
  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);

  if (!error?.response) {
    return {
      code: "NETWORK_ERROR",
      message: "Unable to reach the server. Check your connection and try again.",
      retryable: true,
    };
  }

  return {
    status,
    code:
      responseData?.code ||
      (status === 429 ? "RATE_LIMITED" : `HTTP_${status || "ERROR"}`),
    message:
      responseData?.message ||
      (status === 429
        ? "Too many attempts. Please wait and try again."
        : "The request could not be completed."),
    retryable:
      responseData?.retryable === true || status === 429 || status >= 500,
    ...(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? { retryAfterSeconds }
      : {}),
    details: responseData?.details,
  };
};

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
    error.apiError = getApiErrorDetails(error);

    if (error.response) {
      console.warn(
        `[API Error] ${error.response.status} ${error.apiError.code} ${method} ${url}`,
      );
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
