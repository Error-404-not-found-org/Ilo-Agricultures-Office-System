import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

// Utilities
import PageMeta from "./components/PageMeta";
import { ToastProvider } from "./contexts/ToastContext";
import { SidebarProvider } from "./contexts/SidebarContext";

// Components
import Layout from "./components/ui/Layout";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedTechnicianRoute from "./components/ProtectedTechnicianRoute";
import ProtectedFarmerRoute from "./components/ProtectedFarmerRoute";

// Public Pages
import Landing from "./pages/Landing";
import DownloadApp from "./pages/DownloadApp";
import FarmerDashboard from "./pages/FarmerDashboard";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Technicians from "./pages/admin/Technicians";
import TechnicianProfile from "./pages/admin/TechnicianProfile";
import Livestock from "./pages/admin/Livestock";
import LivestockProfile from "./pages/admin/LivestockProfile";
import Inseminations from "./pages/admin/Inseminations";
import Users from "./pages/admin/Users";
import AdminSettings from "./pages/admin/Settings";
import Reports from "./pages/admin/Reports";

// Technician Pages
import TechnicianDashboard from "./pages/technician/DashboardTechnician";
import FarmersDirectory from "./pages/technician/FarmersDirectory";
import FarmerProfile from "./pages/technician/FarmerProfile";
import TechnicianAnimals from "./pages/technician/Animals";
import TechnicianInseminations from "./pages/technician/Inseminations";
import TechnicianHealth from "./pages/technician/Health";
import TechnicianHealthMap from "./pages/technician/HealthMap";
import WalkInInsemination from "./pages/technician/WalkInInsemination";
import TechMyProfile from "./pages/technician/Profile";
import TechnicianAnalytics from "./pages/technician/Analytics";
import TechnicianReports from "./pages/technician/Reports";
import TechnicianSchedule from "./pages/technician/Schedule";
import TechnicianRequests from "./pages/technician/Requests";
import BreedingLedger from "./pages/technician/BreedingLedger";
import FieldNotes from "./pages/technician/FieldNotes";
import TechSettings from "./pages/technician/Settings";
import Moowie from "./pages/technician/Moowie";

function App() {
  return (
    <ToastProvider>
      <SidebarProvider>
        <PageMeta />
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<Landing />} />
          <Route path="/download-app" element={<DownloadApp />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
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
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="technicians" element={<Technicians />} />
            <Route path="technicians/:id" element={<TechnicianProfile />} />
            <Route path="livestock" element={<Livestock />} />
            <Route path="livestock/:id" element={<LivestockProfile />} />
            <Route path="inseminations" element={<Inseminations />} />
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="reports" element={<Reports />} />
            <Route path="requests" element={<TechnicianRequests />} />
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
            <Route path="health-map" element={<TechnicianHealthMap />} />
            <Route path="ledger" element={<BreedingLedger />} />
            <Route path="walk-in" element={<WalkInInsemination />} />
            <Route path="profile" element={<TechMyProfile />} />
            <Route path="analytics" element={<TechnicianAnalytics />} />
            <Route path="reports" element={<TechnicianReports />} />
            <Route path="schedule" element={<TechnicianSchedule />} />
            <Route path="requests" element={<TechnicianRequests />} />
            <Route path="field-notes" element={<FieldNotes />} />
            <Route path="moowie" element={<Moowie />} />
            <Route path="settings" element={<TechSettings />} />
          </Route>

          {/* Protected Farmer Routes */}
          <Route
            path="/farmer"
            element={
              <>
                <SignedIn>
                  <ProtectedFarmerRoute>
                    <Layout />
                  </ProtectedFarmerRoute>
                </SignedIn>
                <SignedOut>
                  <Navigate to="/" replace />
                </SignedOut>
              </>
            }
          >
            <Route path="dashboard" element={<FarmerDashboard />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarProvider>
    </ToastProvider>
  );
}

export default App;
