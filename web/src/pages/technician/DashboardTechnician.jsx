import React, { useState, useEffect } from "react";
import {
  Syringe,
  Stethoscope,
  UserPlus,
  Tractor,
  HeartPulse,
  Baby,
  Search,
  ArrowRight,
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
import { ui } from "../../components/ui/uiClasses";
import { getStoredTheme, isDarkTheme } from "../../lib/theme";
import { getTechnicianStatus } from "../../constants/technicianWorkflow";

// Import dedicated quick action modals
import WalkInAIModal from "../../components/modals/WalkInAIModal";
import WalkInHealthModal from "../../components/modals/WalkInHealthModal";
import RegisterFarmerModal from "../../components/modals/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/modals/RegisterLivestockModal";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";
import RecordCalvingModal from "../../components/modals/RecordCalvingModal";

function OverviewMetric({ icon, label, value, helper, tone = "text-primary bg-primary/10" }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className={`mb-3 flex size-9 items-center justify-center rounded-box ${tone}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-base-content/50">{helper}</p>
    </div>
  );
}

function QuickAction({ icon, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-28 items-start gap-3 rounded-box border border-base-300 bg-base-100 p-4 text-left transition hover:border-primary/45 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-box bg-base-200 text-primary transition group-hover:bg-primary/10">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-base-content/55">{description}</span>
      </span>
    </button>
  );
}

export default function Dashboard() {
  const [theme, setTheme] = useState(getStoredTheme);

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
  const [dashboardLoadState, setDashboardLoadState] = useState({
    dashboardData: { ok: true, label: "Dashboard schedule and requests", error: null },
    analytics: { ok: true, label: "Technician analytics", error: null },
  });

  // Dedicated Modals Visibility States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [isPregnancyModalOpen, setIsPregnancyModalOpen] = useState(false);
  const [isCalvingModalOpen, setIsCalvingModalOpen] = useState(false);

  // ---- FETCH INTEGRATED TELEMETRY DATA ----
  const fetchDashboardMetrics = async (showInitialLoading = false) => {
    if (showInitialLoading) setIsLoading(true);
    const [dashRes, analyticsRes] = await Promise.allSettled([
      axiosInstance.get("/technician/dashboard-data"),
      axiosInstance.get("/technician/analytics"),
    ]);

    if (dashRes.status === "fulfilled" && dashRes.value.data) {
      setDashboardData(dashRes.value.data);
    }
    if (analyticsRes.status === "fulfilled" && analyticsRes.value.data) {
      setAnalytics(analyticsRes.value.data);
    }

    setDashboardLoadState({
      dashboardData: {
        ok: dashRes.status === "fulfilled",
        label: "Dashboard schedule and requests",
        error:
          dashRes.reason?.response?.data?.message ||
          dashRes.reason?.message ||
          null,
      },
      analytics: {
        ok: analyticsRes.status === "fulfilled",
        label: "Technician analytics",
        error:
          analyticsRes.reason?.response?.data?.message ||
          analyticsRes.reason?.message ||
          null,
      },
    });
    setIsLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchDashboardMetrics(true));
    // Automated 30-second synchronization sequence
    const telemetryInterval = setInterval(
      () => fetchDashboardMetrics(false),
      1000 * 30,
    );
    return () => clearInterval(telemetryInterval);
  }, []);

  // Synchronize local theme state with global theme toggle attributes
  useEffect(() => {
    const syncTheme = () => {
      setTheme(getStoredTheme());
    };
    window.addEventListener("theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
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
  const agendaItems = React.useMemo(
    () => dashboardData?.agendaItems || [],
    [dashboardData?.agendaItems],
  );

  const activePendingCount = pendingRequests.filter(
    (r) => !["done", "resolved", "completed", "rejected", "cancelled"].includes(r.status),
  ).length;
  const inseminationPendingCount = pendingRequests.filter(
    (r) => !["done", "resolved", "completed", "rejected", "cancelled"].includes(r.status) && r.type !== "health",
  ).length;
  const healthPendingCount = pendingRequests.filter(
    (r) => !["done", "resolved", "completed", "rejected", "cancelled"].includes(r.status) && r.type === "health",
  ).length;
  const readyTodayCount = agendaItems.filter((item) => item.isReadyToday).length;

  // Render agenda lists using live backend deployments matrix
  const mappedVisits = React.useMemo(() => {
    if (!agendaItems || agendaItems.length === 0) return [];
    return agendaItems.map((item, index) => {
      const statusConfig = getTechnicianStatus(item.status);
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
        location: item.farmLocationLabel || item.location || "Location not recorded",
        time: item.time || "Time not set",
        status: item.displayStatus || statusConfig.label,
        statusClass: item.isReadyToday ? "badge-warning" : statusConfig.badgeClass,
        serviceType: item.serviceType || item.taskType || "Field visit",
        animalTag: item.animalTag || "Animal not specified",
      };
    });
  }, [agendaItems]);

  const filteredVisits = mappedVisits.filter(
    (v) =>
      v.farmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const failedDashboardSources = Object.values(dashboardLoadState).filter((source) => !source.ok);
  const dashboardValue = (sourceKey, value) =>
    dashboardLoadState[sourceKey]?.ok === false ? "Unavailable" : value;
  const analyticsAvailable = dashboardLoadState.analytics.ok;
  const monthlyTrendRows = analytics.monthlyTrends || [];
  const chartLabels = analyticsAvailable
    ? monthlyTrendRows.length > 0
      ? monthlyTrendRows.map((m) => m.month)
      : ["No records yet"]
    : ["Unavailable"];

  return (
    <div className={ui.page}>
      <Topbar
        title="Overview"
        subtitle="See today’s field work, active requests, and recorded services in one place"
      />

      <main className={ui.main}>
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
        {failedDashboardSources.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 p-4 rounded-2xl flex items-start justify-between shadow-xs mb-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                  Some dashboard data did not load
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mt-1.5 leading-relaxed">
                  Loaded widgets remain visible. Failed widgets show unavailable instead of fake zero counts.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {failedDashboardSources.map((source) => (
                    <span
                      key={source.label}
                      className="rounded-full bg-white/70 dark:bg-slate-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                      title={source.error || "Unable to load"}
                    >
                      {source.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={fetchDashboardMetrics}
              className="btn btn-xs h-9 bg-amber-600 hover:bg-amber-700 text-white border-none rounded-xl text-[10px] font-black uppercase tracking-wider px-4 shrink-0 transition-all flex items-center justify-center"
            >
              Retry
            </button>
          </div>
        )}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.7fr)]">
          <div className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="card-title">Today’s work</h2>
                  <p className="mt-1 text-sm text-base-content/55">Current field workload in Philippine time</p>
                </div>
                <Link to="/technician/schedule" className="btn btn-ghost btn-sm">
                  Open schedule <ArrowRight size={14} />
                </Link>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <OverviewMetric
                  icon={<CalendarCheck size={18} />}
                  label="Scheduled"
                  value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", stats?.todayActivities ?? 0)}
                  helper="AI and health visits today"
                />
                <OverviewMetric
                  icon={<Clock size={18} />}
                  label="Ready"
                  value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", readyTodayCount)}
                  helper="Approved or scheduled for today"
                  tone="bg-warning/10 text-warning"
                />
                <OverviewMetric
                  icon={<CheckCircle size={18} />}
                  label="Completed"
                  value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", stats?.completedToday ?? 0)}
                  helper="Finished today"
                  tone="bg-success/10 text-success"
                />
              </div>
            </div>
          </div>

          <div className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="card-title">Request queue</h2>
                  <p className="mt-1 text-sm text-base-content/55">Cases still needing field action</p>
                </div>
                <span className="badge badge-warning badge-soft">{activePendingCount} active</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-box bg-base-200 p-3">
                  <dt className="text-xs text-base-content/55">AI requests</dt>
                  <dd className="mt-1 text-xl font-bold">{inseminationPendingCount}</dd>
                </div>
                <div className="rounded-box bg-base-200 p-3">
                  <dt className="text-xs text-base-content/55">Health cases</dt>
                  <dd className="mt-1 text-xl font-bold">{healthPendingCount}</dd>
                </div>
              </dl>
              <Link to="/technician/requests" className="btn btn-primary btn-sm mt-2 w-full">
                Review requests <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body p-5">
            <div>
              <h2 className="card-title">Service summary</h2>
              <p className="mt-1 text-sm text-base-content/55">Records created during the current month</p>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewMetric icon={<Syringe size={18} />} label="AI services" value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", stats?.totalInsemMonth ?? 0)} helper="Artificial insemination records" />
              <OverviewMetric icon={<Stethoscope size={18} />} label="Health cases" value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("analytics", analytics?.totalHealth_Month ?? 0)} helper="Health assistance records" tone="bg-info/10 text-info" />
              <OverviewMetric icon={<HeartPulse size={18} />} label="Pregnancy checks" value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", stats?.totalPregnancyCheckupMonth ?? 0)} helper="Recorded diagnoses" tone="bg-secondary/10 text-secondary" />
              <OverviewMetric icon={<Baby size={18} />} label="Calvings" value={isLoading ? <span className="loading loading-dots loading-sm" /> : dashboardValue("dashboardData", stats?.totalCalvingMonth ?? 0)} helper="Recorded birth events" tone="bg-accent/10 text-accent" />
            </div>
          </div>
        </section>

        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body p-5">
            <div>
              <h2 className="card-title">Quick actions</h2>
              <p className="mt-1 text-sm text-base-content/55">Use the same six record workflows available in the Technician mobile app</p>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <QuickAction icon={<Syringe size={18} />} label="Record AI Service" description="Save a completed or in-progress field insemination." onClick={handleRecordAI} />
              <QuickAction icon={<Stethoscope size={18} />} label="Record Health Assistance" description="Document a health visit, treatment, medicine, and follow-up." onClick={handleHealthLog} />
              <QuickAction icon={<UserPlus size={18} />} label="Register Farmer" description="Create a farmer profile with contact and Iloilo location." onClick={handleAddClient} />
              <QuickAction icon={<Tractor size={18} />} label="Register Animal" description="Add an animal and connect it to the correct farmer." onClick={handleAddAnimal} />
              <QuickAction icon={<HeartPulse size={18} />} label="Pregnancy Check" description="Record a diagnosis against an eligible AI attempt." onClick={handlePregnancyCheck} />
              <QuickAction icon={<Baby size={18} />} label="Record Calving" description="Record birth details from a confirmed pregnancy." onClick={handleCalfDrop} />
            </div>
          </div>
        </section>

        {/* Charts Row Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="card-title text-base">
                  AI activity
                </h3>
                <p className="text-sm text-base-content/55">
                  Recorded AI services by month
                </p>
              </div>
            </div>
            <DashboardChart
              type="line"
              labels={chartLabels}
              datasets={[
                {
                  label: "AI service Cycle",
                  data: analyticsAvailable && monthlyTrendRows.length > 0 ? monthlyTrendRows.map((m) => m.ai) : [0],
                  borderColor: "#00643B",
                  backgroundColor: "rgba(0, 100, 59, 0.06)",
                  fill: true,
                },
                {
                  label: "Clinical Ledger",
                  data: analyticsAvailable && monthlyTrendRows.length > 0 ? monthlyTrendRows.map((m) => Math.max(0, Math.round(m.ai * 0.6))) : [0],
                  borderColor: "#10b981",
                  backgroundColor: "rgba(16, 185, 129, 0.03)",
                  fill: true,
                },
              ]}
              height={220}
              darkTheme={isDarkTheme(theme)}
            />
            </div>
          </div>

          <div className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="card-title text-base">
                  Clinical activity
                </h3>
                <p className="text-sm text-base-content/55">
                  Actual health, pregnancy, and calving records
                </p>
              </div>
            </div>
            <DashboardChart
              type="bar"
              labels={chartLabels}
              datasets={[
                {
                  label: "Health",
                  data: analyticsAvailable && monthlyTrendRows.length > 0 ? monthlyTrendRows.map((m) => m.health || 0) : [0],
                  borderColor: "#2563eb",
                  backgroundColor: "rgba(37, 99, 235, 0.72)",
                  borderWidth: 0,
                  fill: false,
                },
                {
                  label: "Pregnancy checks",
                  data: analyticsAvailable && monthlyTrendRows.length > 0 ? monthlyTrendRows.map((m) => m.pregnancy || 0) : [0],
                  borderColor: "#db2777",
                  backgroundColor: "rgba(219, 39, 119, 0.72)",
                  borderWidth: 0,
                  fill: false,
                },
                {
                  label: "Calvings",
                  data: analyticsAvailable && monthlyTrendRows.length > 0 ? monthlyTrendRows.map((m) => m.calving || 0) : [0],
                  borderColor: "#0f766e",
                  backgroundColor: "rgba(15, 118, 110, 0.72)",
                  borderWidth: 0,
                  fill: false,
                },
              ]}
              height={220}
              darkTheme={isDarkTheme(theme)}
            />
            </div>
          </div>
        </div>

        {/* Bottom Panel Grid */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Today's Field Visits List */}
          <div className="card card-border bg-base-100 shadow-sm lg:col-span-2">
            <div className="card-body p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-base-300 pb-4">
              <div>
                <h3 className="card-title text-base">
                  Today’s visits
                </h3>
                <p className="mt-1 text-sm text-base-content/55">
                  Farmer, service, animal, location, and scheduled time
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="input input-sm w-full sm:w-52">
                  <Search size={14} className="text-base-content/45" />
                  <input
                    type="search"
                    placeholder="Search visits..."
                    className="grow text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
                <Link to="/technician/schedule" className="btn btn-ghost btn-sm">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-base-300">
              {isLoading ? (
                [...Array(3)].map((_, idx) => (
                  <div
                    key={idx}
                    className="flex animate-pulse items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3 w-2/3">
                      <div className="skeleton size-9 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <div className="skeleton h-3 w-1/3" />
                        <div className="skeleton h-2 w-1/2" />
                      </div>
                    </div>
                    <div className="skeleton h-4 w-12" />
                  </div>
                ))
              ) : filteredVisits.length === 0 ? (
                <div className="rounded-box border border-dashed border-base-300 py-8 text-center">
                  <CalendarCheck className="mx-auto mb-2 text-base-content/35" size={24} />
                  <p className="text-sm font-semibold">No visits scheduled for today</p>
                  <p className="mt-1 text-xs text-base-content/50">Scheduled and ready visits will appear here.</p>
                </div>
              ) : (
                filteredVisits.map((v) => (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-9 items-center justify-center rounded-full bg-base-200 text-xs font-bold text-primary"
                      >
                        {v.initials}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">
                          {v.farmer}
                        </h4>
                        <p className="mt-0.5 text-xs text-base-content/55">{v.serviceType} · {v.animalTag}</p>
                        <span className="mt-1 flex items-center gap-1 text-xs text-base-content/50"><MapPin size={11} /> {v.location}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        {v.time}
                      </div>
                      <span
                        className={`badge badge-sm badge-soft mt-1 ${v.statusClass}`}
                      >
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </div>

          {/* Alerts & Notifications Box */}
          <div className="card card-border bg-base-100 shadow-sm">
            <div className="card-body p-5">
            <div>
              <div className="mb-4 flex items-start justify-between gap-3 border-b border-base-300 pb-4">
                <div>
                  <h3 className="card-title text-base">
                    Needs attention
                  </h3>
                  <p className="mt-1 text-sm text-base-content/55">
                    Requests and follow-ups that need action
                  </p>
                </div>
                <span className="badge badge-warning badge-soft">
                  {activePendingCount} active
                </span>
              </div>

              <div className="space-y-3">
                {inseminationPendingCount > 0 && (
                  <div className="alert alert-warning alert-soft text-sm">
                    <AlertTriangle
                      className="shrink-0"
                      size={14}
                    />
                    <div>
                      <p className="font-semibold">{inseminationPendingCount} active AI request{inseminationPendingCount === 1 ? "" : "s"}</p>
                      <p className="text-xs opacity-70">Review assignment, schedule, or service progress.</p>
                    </div>
                  </div>
                )}

                {healthPendingCount > 0 && (
                  <div className="alert alert-info alert-soft text-sm">
                    <Clock className="shrink-0" size={14} />
                    <div>
                      <p className="font-semibold">{healthPendingCount} active health case{healthPendingCount === 1 ? "" : "s"}</p>
                      <p className="text-xs opacity-70">Check urgency, schedule, and follow-up needs.</p>
                    </div>
                  </div>
                )}

                {activePendingCount === 0 && (
                  <div className="alert alert-success alert-soft text-sm"><CheckCircle size={16} /><span>No active requests need attention.</span></div>
                )}
              </div>
            </div>

            {/* Monthly Target Progress Calculation */}
            <div className="mt-6 space-y-3 border-t border-base-300 pt-4">
              <div>
                <div className="mb-1 flex justify-between text-xs font-semibold text-base-content/55">
                  <span>Monthly AI target</span>
                  <span className="text-primary">
                    {stats?.totalInsemMonth
                      ? Math.min(
                          100,
                          Math.round((stats.totalInsemMonth / 30) * 100),
                        )
                      : 0}
                    %
                  </span>
                </div>
                <progress
                  className="progress progress-primary h-1.5 w-full"
                  value={
                    stats?.totalInsemMonth
                      ? Math.min(30, stats.totalInsemMonth)
                      : 0
                  }
                  max="30"
                />
              </div>
            </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dedicated Quick Action Modals */}
      <WalkInAIModal
        existingOnly
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          fetchDashboardMetrics();
        }}
      />
      <WalkInHealthModal
        existingOnly
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
