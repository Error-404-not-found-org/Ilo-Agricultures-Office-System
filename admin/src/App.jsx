import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

// Components
import Layout from "./components/Layout";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

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

function App() {
  return (
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

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
