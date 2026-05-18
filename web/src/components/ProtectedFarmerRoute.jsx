import React from "react";
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import LoadingView from "./LoadingView";

const ProtectedFarmerRoute = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <LoadingView message="Verifying Identity..." />;
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  const role = user.publicMetadata?.role;

  if (role !== "farmer") {
    // If they are admin or tech, let them see it too if they want, 
    // but usually farmers have their own limited view.
    // For now, let's keep it strictly for farmers or admins.
    if (role !== "admin") {
        return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedFarmerRoute;
