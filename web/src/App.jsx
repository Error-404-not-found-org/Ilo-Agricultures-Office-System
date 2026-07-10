import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, useClerk, useAuth } from "@clerk/clerk-react";

// Utilities
import PageMeta from "./components/PageMeta";
import { ToastProvider } from "./contexts/ToastContext";
import { SidebarProvider } from "./contexts/SidebarContext";

// Components
import Layout from "./components/ui/Layout";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedTechnicianRoute from "./components/ProtectedTechnicianRoute";
// Public Pages
import Landing from "./pages/Landing";
import DownloadApp from "./pages/DownloadApp";

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const Technicians = lazy(() => import("./pages/admin/Technicians"));
const TechnicianProfile = lazy(() => import("./pages/admin/TechnicianProfile"));
const Livestock = lazy(() => import("./pages/admin/Livestock"));
const LivestockProfile = lazy(() => import("./pages/admin/LivestockProfile"));
const Inseminations = lazy(() => import("./pages/admin/Inseminations"));
const Users = lazy(() => import("./pages/admin/Users"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const AdminMonitoring = lazy(() => import("./pages/admin/Monitoring"));
const BarangayInsights = lazy(() => import("./pages/admin/BarangayInsights"));
const SupportTickets = lazy(() => import("./pages/admin/SupportTickets"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const ArchivedRecords = lazy(() => import("./pages/admin/ArchivedRecords"));

// Technician Pages
const TechnicianDashboard = lazy(() => import("./pages/technician/DashboardTechnician"));
const FarmersDirectory = lazy(() => import("./pages/technician/FarmersDirectory"));
const FarmerProfile = lazy(() => import("./pages/technician/FarmerProfile"));
const TechnicianAnimals = lazy(() => import("./pages/technician/Animals"));
const TechnicianInseminations = lazy(() => import("./pages/technician/Inseminations"));
const TechnicianHealth = lazy(() => import("./pages/technician/Health"));
const TechnicianHealthMap = lazy(() => import("./pages/technician/HealthMap"));
const WalkInInsemination = lazy(() => import("./pages/technician/WalkInInsemination"));
const TechMyProfile = lazy(() => import("./pages/technician/Profile"));
const TechnicianAnalytics = lazy(() => import("./pages/technician/Analytics"));
const TechnicianReports = lazy(() => import("./pages/technician/Reports"));
const TechnicianSchedule = lazy(() => import("./pages/technician/Schedule"));
const TechnicianRequests = lazy(() => import("./pages/technician/Requests"));
const BreedingLedger = lazy(() => import("./pages/technician/BreedingLedger"));
const FieldNotes = lazy(() => import("./pages/technician/FieldNotes"));
const TechSettings = lazy(() => import("./pages/technician/Settings"));
const Moowie = lazy(() => import("./pages/technician/Moowie"));
const Newborns = lazy(() => import("./pages/technician/Newborns"));

const LoadingView = () => (
  <div className="grow flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
    <span className="loading loading-infinity loading-lg text-[#00643b] scale-150"></span>
    <p className="text-[#00643b] dark:text-emerald-400 font-bold tracking-widest animate-pulse uppercase text-[10px] mt-4">
      Loading BreedSmart Telemetry...
    </p>
  </div>
);

function App() {
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      localStorage.removeItem("breedsmart_last_activity");
      localStorage.removeItem("breedsmart_session_start");
      return;
    }

    const now = Date.now();

    // Set initial activity and session timestamps
    if (!localStorage.getItem("breedsmart_session_start")) {
      localStorage.setItem("breedsmart_session_start", String(now));
    }
    if (!localStorage.getItem("breedsmart_last_activity")) {
      localStorage.setItem("breedsmart_last_activity", String(now));
    }

    const updateActivity = () => {
      localStorage.setItem("breedsmart_last_activity", String(Date.now()));
    };

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, updateActivity));

    // Check session status every 30 seconds
    const interval = setInterval(() => {
      const lastActivity = localStorage.getItem("breedsmart_last_activity");
      const sessionStart = localStorage.getItem("breedsmart_session_start");
      const currentTime = Date.now();

      const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000; // 24 Hours inactivity limit
      const ABSOLUTE_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 Days absolute limit

      if (lastActivity) {
        const inactiveElapsed = currentTime - Number(lastActivity);
        if (inactiveElapsed > INACTIVITY_TIMEOUT) {
          localStorage.removeItem("breedsmart_last_activity");
          localStorage.removeItem("breedsmart_session_start");
          signOut();
          return;
        }
      }

      if (sessionStart) {
        const absoluteElapsed = currentTime - Number(sessionStart);
        if (absoluteElapsed > ABSOLUTE_TIMEOUT) {
          localStorage.removeItem("breedsmart_last_activity");
          localStorage.removeItem("breedsmart_session_start");
          signOut();
        }
      }
    }, 30000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, updateActivity));
      clearInterval(interval);
    };
  }, [isSignedIn, signOut]);

  return (
    <ToastProvider>
      <SidebarProvider>
        <PageMeta />
        <Suspense fallback={<LoadingView />}>
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
              <Route path="monitoring" element={<AdminMonitoring />} />
              <Route path="barangays" element={<BarangayInsights />} />
              <Route path="support-tickets" element={<SupportTickets />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="archived" element={<ArchivedRecords />} />
              <Route path="requests" element={<TechnicianRequests />} />
              <Route path="newborns" element={<Newborns />} />
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
              <Route path="newborns" element={<Newborns />} />
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

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SidebarProvider>
    </ToastProvider>
  );
}

export default App;
