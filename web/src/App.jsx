import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

// Utilities
import PageMeta from "./components/PageMeta";
import { ToastProvider } from "./contexts/ToastContext";

// Components
import Layout from "./components/Layout";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedTechnicianRoute from "./components/ProtectedTechnicianRoute";

// Pages
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Technicians from "./pages/Technicians";
import TechnicianProfile from "./pages/TechnicianProfile";
import Livestock from "./pages/Livestock";
import LivestockProfile from "./pages/LivestockProfile";
import Inseminations from "./pages/Inseminations";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
// Technician Pages
import TechnicianDashboard from "./pages/technician/Dashboard";
import FarmersDirectory from "./pages/technician/FarmersDirectory";
import FarmerProfile from "./pages/technician/FarmerProfile";
import TechnicianAnimals from "./pages/technician/Animals";
import TechnicianInseminations from "./pages/technician/Inseminations";
import TechnicianHealth from "./pages/technician/Health";
import WalkInInsemination from "./pages/technician/WalkInInsemination";
import TechMyProfile from "./pages/technician/Profile";
import RouteOptimizer from "./pages/technician/RouteOptimizer";

function App() {
  return (
    <ToastProvider>
      <PageMeta />
      <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<Landing />} />

      {/* Protected Admin Routes */}
      <Route
        element={
          <>
            <SignedIn>
              <ProtectedAdminRoute>
                <Layout />
              </ProtectedAdminRoute>
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="technicians" element={<Technicians />} />
        <Route path="technicians/:id" element={<TechnicianProfile />} />
        <Route path="livestock" element={<Livestock />} />
        <Route path="livestock/:id" element={<LivestockProfile />} />
        <Route path="inseminations" element={<Inseminations />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Protected Technician Routes */}
      <Route
        path="/technician"
        element={
          <>
            <SignedIn>
              <ProtectedTechnicianRoute>
                <Layout />
              </ProtectedTechnicianRoute>
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      >
        <Route path="dashboard" element={<TechnicianDashboard />} />
        <Route path="farmers" element={<FarmersDirectory />} />
        <Route path="farmers/:id" element={<FarmerProfile />} />
        <Route path="animals" element={<TechnicianAnimals />} />
        <Route path="animals/:id" element={<LivestockProfile />} />
        <Route path="inseminations" element={<TechnicianInseminations />} />
        <Route path="health" element={<TechnicianHealth />} />
        <Route path="walk-in" element={<WalkInInsemination />} />
        <Route path="profile" element={<TechMyProfile />} />
        <Route path="route" element={<RouteOptimizer />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ToastProvider>
  );
}

export default App;
