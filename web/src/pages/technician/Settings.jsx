import { Navigate } from "react-router-dom";

// Keep bookmarked Settings links working after consolidation.
export default function TechSettings() {
  return <Navigate to="/technician/profile" replace />;
}
