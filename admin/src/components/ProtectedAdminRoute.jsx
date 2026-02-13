import { useUser } from "@clerk/clerk-react";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedAdminRoute = ({ children }) => {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
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
