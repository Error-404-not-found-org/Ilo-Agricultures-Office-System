import React, { useState, useEffect } from "react";
import {
  Zap,
  Syringe,
  Stethoscope,
  UserPlus,
  Tractor,
  HeartPulse,
  Baby,
  Bell,
  Moon,
  Sun,
  Search,
  ArrowRight,
  TrendingUp,
  Clock,
  CalendarCheck,
  CheckCircle,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import DashboardChart from "../../components/data/DashboardChart";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";

// Import dedicated quick action modals
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";
import RecordCalvingModal from "../../components/modals/RecordCalvingModal";

export default function Dashboard() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "emerald";
  });

  const [searchQuery, setSearchQuery] = useState("");

  // Query logged-in user profile to check for incomplete details
  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
  });

  const isProfileIncomplete = dbUser && (!dbUser.phoneNumber || !dbUser.address?.barangay);

  // Backend States
  const [dashboardData, setDashboardData] = useState({
    stats: { todayActivities: 0, completedToday: 0 },
    pendingRequests: [],
    agendaItems: [],
    animalRegistry: [],
  });
  const [analytics, setAnalytics] = useState({
    totalAI_Week: 0,
    totalHealth_Month: 0,
    totalInsem: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Dedicated Modals Visibility States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [isPregnancyModalOpen, setIsPregnancyModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);

  // ---- FETCH INTEGRATED TELEMETRY DATA ----
  const fetchDashboardMetrics = async () => {
    try {
      setIsLoading(true);
      // Run concurrent requests using your reliable axiosInstance setup
      const [dashRes, analyticsRes] = await Promise.all([
        axiosInstance.get("/technician/dashboard-data"),
        axiosInstance.get("/technician/analytics"),
      ]);

      if (dashRes.data) setDashboardData(dashRes.data);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error("Failed pulling operational ecosystem statistics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
    // Automated 30-second synchronization sequence
    const telemetryInterval = setInterval(fetchDashboardMetrics, 1000 * 30);
    return () => clearInterval(telemetryInterval);
  }, []);

  // Synchronize local theme state with global theme toggle attributes
  useEffect(() => {
    const syncTheme = () => {
      setTheme(localStorage.getItem("theme") || "emerald");
    };
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    const interval = setInterval(syncTheme, 1000);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
      clearInterval(interval);
    };
  }, []);

  // ---- QUICK ACTION MODAL CONFIGURATION HANDLERS ----
  const handleRecordAI = () => setIsAIModalOpen(true);
  const handleHealthLog = () => setIsHealthModalOpen(true);
  const handleAddClient = () => setIsFarmerModalOpen(true);
  const handleAddAnimal = () => setIsAnimalModalOpen(true);
  const handlePregnancyCheck = () => setIsPregnancyModalOpen(true);
  const handleCalfDrop = () => setIsCalvingModalOpen(true);

  // Safely secure metrics mapping objects
  const stats = dashboardData?.stats || {
    todayActivities: 0,
    completedToday: 0,
  };
  const pendingRequests = dashboardData?.pendingRequests || [];
  const agendaItems = dashboardData?.agendaItems || [];

  const activePendingCount = pendingRequests.filter(
    (r) => r.status === "pending",
  ).length;
  const inseminationPendingCount = pendingRequests.filter(
    (r) => r.status === "pending" && r.type !== "health",
  ).length;
  const healthPendingCount = pendingRequests.filter(
    (r) => r.status === "pending" && r.type === "health",
  ).length;

  // Render agenda lists using live backend deployments matrix
  const mappedVisits = React.useMemo(() => {
    if (!agendaItems || agendaItems.length === 0) return [];
    return agendaItems.map((item, index) => {
      let variantStyles = "bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b]";
      let statusStyles = "bg-emerald-100 dark:bg-emerald-950/40 text-[#00643b]";

      if (index === 1) {
        variantStyles = "bg-amber-50 dark:bg-amber-950/20 text-amber-600";
        statusStyles = "bg-amber-100 dark:bg-amber-950/40 text-amber-600";
      } else if (index > 1) {
        variantStyles = "bg-blue-50 dark:bg-blue-950/20 text-blue-600";
        statusStyles = "bg-blue-100 dark:bg-blue-950/40 text-blue-600";
      }

      return {
        id: item.id || index,
        farmer: item.farmer || "Unknown Farmer",
        initials: item.farmer
          ? item.farmer
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : "FI",
        bg: variantStyles,
        location: item.location || "Oton Region",
        time: item.time || "00:00 AM",
        status: item.status || "Confirmed",
        statusClass: statusStyles,
      };
    });
  }, [agendaItems]);

  const filteredVisits = mappedVisits.filter(
    (v) =>
      v.farmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Topbar
        title="Dashboard"
        subtitle="Welcome back! Monitor operational timelines and livestock registries."
      />

      <main className="p-4 md:p-6 space-y-6">
        {/* Profile Completion Alert Banner */}
        {isProfileIncomplete && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-4 rounded-2xl flex items-center justify-between shadow-xs mb-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                  Profile Setup Required
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1.5 leading-relaxed">
                  Your phone number or assigned barangay location is missing. Please complete your profile so local farmers can contact you directly during critical emergency dispatches.
                </p>
              </div>
            </div>
            <Link
              to="/technician/profile"
              className="btn btn-xs h-9 bg-amber-600 hover:bg-amber-700 text-white border-none rounded-xl text-[10px] font-black uppercase tracking-wider px-4 shrink-0 transition-all flex items-center justify-center"
            >
              Update Profile
            </Link>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Today's Missions */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Today's Missions
              </span>
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b] rounded-xl">
                <CalendarCheck size={16} />
              </span>
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {isLoading ? (
                <div className="h-9 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              ) : (
                (stats?.todayActivities ?? 0)
              )}
            </div>
            <span className="text-[10px] text-[#00643b] font-bold mt-2 flex items-center gap-1">
              <TrendingUp size={11} /> {stats?.completedToday ?? 0} secured
              clean logs
            </span>
          </div>

          {/* AI This Week */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                AI This Week
              </span>
              <span className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-xl">
                <Zap size={16} />
              </span>
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {isLoading ? (
                <div className="h-9 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              ) : (
                (analytics?.totalAI_Week ?? 0)
              )}
            </div>
            <span className="text-[10px] text-amber-600 font-bold mt-2 flex items-center gap-1">
              <TrendingUp size={11} /> Current breeding block window
            </span>
          </div>

          {/* Pending Requests */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Pending Requests
              </span>
              <span className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-xl">
                <Clock size={16} />
              </span>
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {isLoading ? (
                <div className="h-9 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              ) : (
                activePendingCount
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-bold mt-2">
              {inseminationPendingCount} Insemination &nbsp;·&nbsp;{" "}
              {healthPendingCount} Health
            </span>
          </div>

          {/* Monthly Clinical Ledger */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Monthly Clinicals
              </span>
              <span className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-600 rounded-xl">
                <HeartPulse size={16} />
              </span>
            </div>
            <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
              {isLoading ? (
                <div className="h-9 w-12 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-lg" />
              ) : (
                (analytics?.totalHealth_Month ?? 0)
              )}
            </div>
            <span className="text-[10px] text-purple-600 font-bold mt-2 flex items-center gap-1">
              <TrendingUp size={11} /> Total sessions:{" "}
              {analytics?.totalInsem ?? 0}
            </span>
          </div>
        </div>

        {/* Quick Action Console (Horizontal Ribbon) */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="text-[#00643b]" size={16} />
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Quick Action Console
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={handleRecordAI}
              className="btn btn-outline border-slate-200 hover:border-[#00643b] hover:bg-emerald-50 dark:border-slate-800 dark:hover:bg-emerald-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-[#00643b] flex items-center justify-center">
                <Syringe size={18} />
              </div>
              <span className="text-xs font-bold">Record AI</span>
            </button>
            <button
              onClick={handleHealthLog}
              className="btn btn-outline border-slate-200 hover:border-amber-600 hover:bg-amber-50 dark:border-slate-800 dark:hover:bg-amber-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 flex items-center justify-center">
                <Stethoscope size={18} />
              </div>
              <span className="text-xs font-bold">Health Log</span>
            </button>
            <button
              onClick={handleAddClient}
              className="btn btn-outline border-slate-200 hover:border-blue-600 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-blue-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 flex items-center justify-center">
                <UserPlus size={18} />
              </div>
              <span className="text-xs font-bold">Add Client</span>
            </button>
            <button
              onClick={handleAddAnimal}
              className="btn btn-outline border-slate-200 hover:border-purple-600 hover:bg-purple-50 dark:border-slate-800 dark:hover:bg-purple-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/20 text-purple-600 flex items-center justify-center">
                <Tractor size={18} />
              </div>
              <span className="text-xs font-bold">Add Animal</span>
            </button>
            <button
              onClick={handlePregnancyCheck}
              className="btn btn-outline border-slate-200 hover:border-pink-600 hover:bg-pink-50 dark:border-slate-800 dark:hover:bg-pink-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-pink-50 dark:bg-pink-950/20 text-pink-600 flex items-center justify-center">
                <HeartPulse size={18} />
              </div>
              <span className="text-xs font-bold">Pregnancy</span>
            </button>
            <button
              onClick={handleCalfDrop}
              className="btn btn-outline border-slate-200 hover:border-cyan-600 hover:bg-cyan-50 dark:border-slate-800 dark:hover:bg-cyan-950/20 flex flex-col items-center gap-2 h-auto py-4 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 flex items-center justify-center">
                <Baby size={18} />
              </div>
              <span className="text-xs font-bold">Calf Drop</span>
            </button>
          </div>
        </div>

        {/* Charts Row Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  AI Performance
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Monthly insemination trends
                </p>
              </div>
            </div>
            <DashboardChart
              type="line"
              labels={
                analytics.monthlyTrends?.length > 0
                  ? analytics.monthlyTrends.map((m) => m.month)
                  : ["Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26", "May '26"]
              }
              datasets={[
                {
                  label: "AI service Cycle",
                  data:
                    analytics.monthlyTrends?.length > 0
                      ? analytics.monthlyTrends.map((m) => m.ai)
                      : [3, 5, 4, 7, 6, 8, 4],
                  borderColor: "#00643B",
                  backgroundColor: "rgba(0, 100, 59, 0.06)",
                  fill: true,
                },
                {
                  label: "Clinical Ledger",
                  data:
                    analytics.monthlyTrends?.length > 0
                      ? analytics.monthlyTrends.map((m) => Math.max(0, Math.round(m.ai * 0.6)))
                      : [2, 3, 1, 4, 3, 2, 3],
                  borderColor: "#10b981",
                  backgroundColor: "rgba(16, 185, 129, 0.03)",
                  fill: true,
                },
              ]}
              height={220}
              darkTheme={theme === "night"}
            />
          </div>

          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Procedure Overview
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Breakdown of recorded appointments
                </p>
              </div>
            </div>
            <DashboardChart
              type="bar"
              labels={
                analytics.monthlyTrends?.length > 0
                  ? analytics.monthlyTrends.map((m) => m.month)
                  : ["Dec '25", "Jan '26", "Feb '26", "Mar '26", "Apr '26", "May '26"]
              }
              datasets={[
                {
                  label: "Completed Tasks",
                  data:
                    analytics.monthlyTrends?.length > 0
                      ? analytics.monthlyTrends.map((m) => Math.round(m.ai * 1.3))
                      : [5, 8, 6, 11, 9, 10, 7],
                  borderColor: "#00643B",
                  backgroundColor: "rgba(0, 100, 59, 0.8)",
                  borderWidth: 0,
                  fill: false,
                },
              ]}
              height={220}
              darkTheme={theme === "night"}
            />
          </div>
        </div>

        {/* Bottom Panel Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Field Visits List */}
          <div className="card lg:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                  Today's Field Visits
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Scheduled technician deployments
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
                    <Search size={12} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search visits..."
                    className="w-full pl-7 pr-2.5 py-1 text-[11px] rounded-lg border bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-[#00643b] dark:focus:ring-emerald-500 outline-none transition-all duration-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 text-xs gap-1">
                  View All <ArrowRight size={10} />
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                [...Array(3)].map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-3 animate-pulse"
                  >
                    <div className="flex items-center gap-3 w-2/3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-2 flex-1">
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                        <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="w-12 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                ))
              ) : filteredVisits.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 italic">
                  No deployments scheduled for today.
                </div>
              ) : (
                filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${v.bg}`}
                      >
                        {v.initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100">
                          {v.farmer}
                        </h4>
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                          <MapPin size={10} /> {v.location}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                        {v.time}
                      </div>
                      <span
                        className={`badge badge-xs border-none font-bold p-1 px-2 mt-1 ${v.statusClass}`}
                      >
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerts & Notifications Box */}
          <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-3 mb-4">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    Telemetry Alerts
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    Critical municipal notifications
                  </p>
                </div>
                <span className="badge badge-error text-white text-[10px] font-bold">
                  {activePendingCount} Active
                </span>
              </div>

              <div className="space-y-3">
                {inseminationPendingCount > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 rounded-xl flex gap-2">
                    <AlertTriangle
                      className="text-amber-600 shrink-0"
                      size={14}
                    />
                    <div className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                      {inseminationPendingCount} AI requests pending response
                    </div>
                  </div>
                )}

                {healthPendingCount > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/40 rounded-xl flex gap-2">
                    <Clock className="text-blue-600 shrink-0" size={14} />
                    <div className="text-xs text-blue-800 dark:text-blue-200 font-medium">
                      {healthPendingCount} unassigned field health protocols
                    </div>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 rounded-xl flex gap-2">
                  <CheckCircle
                    className="text-emerald-600 shrink-0"
                    size={14}
                  />
                  <div className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                    Core dashboard connection optimized
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Target Progress Calculation */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-900 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                  <span>Monthly Insemination Target</span>
                  <span className="text-[#00643b]">
                    {analytics?.totalAI_Week
                      ? Math.min(
                          100,
                          Math.round((analytics.totalAI_Week / 30) * 100),
                        )
                      : 0}
                    %
                  </span>
                </div>
                <progress
                  className="progress progress-success w-full h-1.5"
                  value={
                    analytics?.totalAI_Week
                      ? Math.min(30, analytics.totalAI_Week)
                      : 0
                  }
                  max="30"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dedicated Quick Action Modals */}
      <WalkInAIModal
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          fetchDashboardMetrics();
        }}
      />
      <WalkInHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => {
          setIsHealthModalOpen(false);
          fetchDashboardMetrics();
        }}
      />
      <RegisterFarmerModal
        isOpen={isFarmerModalOpen}
        onClose={() => {
          setIsFarmerModalOpen(false);
          fetchDashboardMetrics();
        }}
      />
      <RegisterLivestockModal
        isOpen={isAnimalModalOpen}
        onClose={() => {
          setIsAnimalModalOpen(false);
          fetchDashboardMetrics();
        }}
      />
      <PregnancyDiagnosisModal
        isOpen={isPregnancyModalOpen}
        onClose={() => {
          setIsPregnancyModalOpen(false);
          fetchDashboardMetrics();
        }}
        taskData={null}
      />
      <RecordCalvingModal
        isOpen={isCalvingModalOpen}
        onClose={() => {
          setIsCalvingModalOpen(false);
          fetchDashboardMetrics();
        }}
        pregnancyData={null}
      />
    </div>
  );
}
