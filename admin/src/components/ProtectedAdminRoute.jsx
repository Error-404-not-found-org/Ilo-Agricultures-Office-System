import { useUser, useAuth } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import axiosInstance from "../lib/axios";

const ProtectedAdminRoute = ({ children }) => {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [isInterceptorSetup, setIsInterceptorSetup] = useState(false);

  useEffect(() => {
    const interceptor = axiosInstance.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (error) {
        console.error("Error fetching token for axios:", error);
      }
      return config;
    });

    setIsInterceptorSetup(true);

    return () => {
      axiosInstance.interceptors.request.eject(interceptor);
    };
  }, [getToken]);

  if (!isLoaded || !isInterceptorSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  // Check if role is admin.
  // We sync role to publicMetadata from the backend.
  const role = user?.publicMetadata?.role;

  if (role !== "admin") {
    // Redirect non-admins to home
    return <Navigate to="/" replace />;
  }

  return children || <Outlet />;
};

export default ProtectedAdminRoute;
