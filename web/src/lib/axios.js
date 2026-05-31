import axios from "axios";
import { toast } from "sonner";

const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

// Session-expired handler — injected by the app at startup
let _signOutCallback = null;
let _sessionExpiredFired = false;

export function injectSignOut(signOutFn) {
    _signOutCallback = signOutFn;
    _sessionExpiredFired = false; // Reset on every new session
}

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            error.response?.status === 401 &&
            !_sessionExpiredFired &&
            _signOutCallback
        ) {
            _sessionExpiredFired = true;
            toast.error("⏱️ Session expired. Please sign in again.", {
                duration: 4000,
                id: "session-expired",
            });
            setTimeout(() => {
                _signOutCallback();
            }, 1500);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;