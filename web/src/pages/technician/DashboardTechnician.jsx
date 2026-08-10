import React, { useState, useEffect } from "react";
import {
  Syringe,
  Stethoscope,
  UserPlus,
  Tractor,
  HeartPulse,
  Baby,
  ArrowRight,
  Clock,
  CalendarCheck,
  CheckCircle,
  AlertTriangle,
  MapPin,
  CalendarDays,
  ClipboardList,
  PawPrint,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import { ui } from "../../components/ui/uiClasses";
import {
  getDashboardAgendaPresentation,
  summarizeDashboardWork,
} from "../../utils/dashboardWorkflow";

// Import dedicated quick action modals
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import RecordCalvingModal from "../../components/dialogs/RecordCalvingModal";

function QuickAction({
  icon: IconComponent,
  label,
  bgClass,
  textClass,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="group flex min-w-0 flex-col items-center rounded-box text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
    >
      <span
        className={`flex size-16 items-center justify-center rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${bgClass} ${textClass}`}
      >
        <IconComponent size={28} className="stroke-2" aria-hidden="true" />
      </span>
      <span className="mt-3 block max-w-30 px-1 text-xs font-bold leading-tight text-base-content/85 transition-colors group-hover:text-primary">
        {label}
      </span>
    </button>
  );
}

export default function Dashboard() {
  const searchQuery = "";

  // Query logged-in user profile to check for incomplete details
  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
  });

  const isProfileIncomplete =
    dbUser && (!dbUser.phoneNumber || !dbUser.address?.barangay);

  // Backend States
  const [dashboardData, setDashboardData] = useState({
    stats: { todayActivities: 0, completedToday: 0 },
    pendingRequests: [],
    agendaItems: [],
    animalRegistry: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardLoadState, setDashboardLoadState] = useState({
    dashboardData: {
      ok: true,
      label: "Dashboard schedule and requests",
      error: null,
    },
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
    const [dashRes] = await Promise.allSettled([
      axiosInstance.get("/technician/dashboard-data?fullAgenda=true"),
    ]);

    if (dashRes.status === "fulfilled" && dashRes.value.data) {
      setDashboardData(dashRes.value.data);
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
  const pendingRequests = React.useMemo(
    () => dashboardData?.pendingRequests || [],
    [dashboardData?.pendingRequests],
  );
  const farmerRequests = React.useMemo(
    () =>
      pendingRequests.map((request, index) => {
        const requestType = String(request.type || request.taskType || "")
          .trim()
          .toLowerCase();
        const urgency = String(
          request.urgency || request.raw?.urgency || "",
        ).toLowerCase();
        const isHealthRequest = requestType === "health";
        const hasSentTime =
          request.sentTime && request.sentTime !== "Not Set";

        return {
          id:
            request.id ||
            request._id ||
            `${requestType || "request"}-${index}`,
          farmerName:
            request.farmerName || request.farmer || "Unknown Farmer",
          serviceType:
            request.serviceType ||
            request.requestType ||
            request.raw?.requestType ||
            (isHealthRequest
              ? "Health Assistance"
              : "Artificial Insemination"),
          animalTag:
            request.animalTag ||
            request.raw?.animalId?.earTag ||
            request.raw?.animalId?.animalId ||
            null,
          timeAgo: hasSentTime
            ? `Sent ${request.sentTime}`
            : "Recently submitted",
          priority:
            request.overdue ||
            request.urgent ||
            ["high", "emergency", "critical"].includes(urgency)
              ? "high"
              : request.isReadyToday || urgency === "medium"
                ? "medium"
                : "new",
          icon: isHealthRequest ? (
            <Stethoscope size={18} aria-hidden="true" />
          ) : (
            <Syringe size={18} aria-hidden="true" />
          ),
        };
      }),
    [pendingRequests],
  );
  const agendaItems = React.useMemo(
    () => dashboardData?.agendaItems || [],
    [dashboardData?.agendaItems],
  );

  const workSummary = React.useMemo(
    () => summarizeDashboardWork(pendingRequests, agendaItems),
    [agendaItems, pendingRequests],
  );

  // Render agenda lists using live backend deployments matrix
  const mappedVisits = React.useMemo(() => {
    if (!agendaItems || agendaItems.length === 0) return [];
    return agendaItems.map((item, index) => {
      const presentation = getDashboardAgendaPresentation(item);
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
        location:
          item.farmLocationLabel || item.location || "Location not recorded",
        time: item.time || "Time not set",
        status: presentation.statusLabel,
        statusClass: presentation.statusClass,
        serviceType: presentation.serviceLabel,
        sourceLabel: presentation.sourceLabel,
        nextActionLabel: presentation.nextActionLabel,
        isDueToday: presentation.isDueToday,
        isOverdue: presentation.isOverdue,
        animalTag: item.animalTag || "Animal not specified",
      };
    });
  }, [agendaItems]);

  const filteredVisits = mappedVisits.filter(
    (v) =>
      v.isDueToday &&
      (v.farmer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.animalTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.serviceType.toLowerCase().includes(searchQuery.toLowerCase())),
  );
  const failedDashboardSources = Object.values(dashboardLoadState).filter(
    (source) => !source.ok,
  );
  const dashboardValue = (sourceKey, value) =>
    dashboardLoadState[sourceKey]?.ok === false || value == null
      ? "Unavailable"
      : value;
  const currentHour = new Date().getHours();
  const timeBasedGreeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className={`${ui.page} min-w-0 overflow-x-hidden`}>
      <Topbar
        title={`${timeBasedGreeting}, ${dbUser?.firstName || dbUser?.name?.split(" ")[0] || "Technician"}! 👋`}
        subtitle="Here's what's happening on your farms today."
      />

      <main className={`${ui.main} min-w-0 w-full max-w-full`}>
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
                  Your phone number or assigned barangay location is missing.
                  Please complete your profile so local farmers can contact you
                  directly during critical emergency dispatches.
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
                  Loaded widgets remain visible. Failed widgets are marked
                  unavailable.
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

        {/* 3 SaaS Dashboard Metric Cards */}
        <div className="grid min-w-0 grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
          {/* 1. Due Today */}
          <div className="card bg-base-100 border border-base-300 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-row items-center gap-4">
            <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <CalendarCheck size={20} />
            </div>
            <div className="min-w-0">
              <span className="block text-2xl font-black text-base-content leading-none">
                {isLoading ? (
                  <span className="loading loading-dots loading-xs" />
                ) : (
                  dashboardValue("dashboardData", workSummary.dueTodayCount)
                )}
              </span>
              <span className="block text-xs font-bold text-base-content/85 mt-1.5">
                Due Today
              </span>
              <span className="block text-[10px] text-base-content/60 font-semibold mt-0.5">
                Scheduled for today
              </span>
            </div>
          </div>

          {/* 2. Needs Attention */}
          <div className="card bg-base-100 border border-base-300 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-row items-center gap-4">
            <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <span className="block text-2xl font-black text-base-content leading-none">
                {isLoading ? (
                  <span className="loading loading-dots loading-xs" />
                ) : (
                  dashboardValue("dashboardData", workSummary.activeWorkCount)
                )}
              </span>
              <span className="block text-xs font-bold text-base-content/85 mt-1.5">
                Needs Attention
              </span>
              <span className="block text-[10px] text-warning font-semibold mt-0.5">
                Requires your action
              </span>
            </div>
          </div>

          {/* 3. Completed Today */}
          <div className="card bg-base-100 border border-base-300 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-row items-center gap-4">
            <div className="size-11 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
              <CheckCircle size={20} />
            </div>
            <div className="min-w-0">
              <span className="block text-2xl font-black text-base-content leading-none">
                {isLoading ? (
                  <span className="loading loading-dots loading-xs" />
                ) : (
                  dashboardValue("dashboardData", stats?.completedToday)
                )}
              </span>
              <span className="block text-xs font-bold text-base-content/85 mt-1.5">
                Completed
              </span>
              <span className="block text-[10px] text-base-content/40 font-semibold mt-0.5">
                Completed today
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <section className="card bg-base-100 border border-base-300 shadow-sm mb-6">
          <div className="card-body p-6">
            <div className="mb-6">
              <h2 className="card-title text-l font-bold tracking-tight">
                Quick Actions
              </h2>
              <p className="mt-0.5 text-xs text-base-content/60 font-semibold">
                Access the primary livestock workflows instantly
              </p>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-6 py-2 sm:grid-cols-3 xl:grid-cols-6">
              <QuickAction
                icon={Syringe}
                label="Record AI Service"
                bgClass="bg-emerald-500/10 dark:bg-emerald-500/15"
                textClass="text-emerald-600 dark:text-emerald-400"
                onClick={handleRecordAI}
              />
              <QuickAction
                icon={Stethoscope}
                label="Record Health Assistance"
                bgClass="bg-orange-500/10 dark:bg-orange-500/15"
                textClass="text-orange-600 dark:text-orange-400"
                onClick={handleHealthLog}
              />
              <QuickAction
                icon={UserPlus}
                label="Register Farmer"
                bgClass="bg-blue-500/10 dark:bg-blue-500/15"
                textClass="text-blue-600 dark:text-blue-400"
                onClick={handleAddClient}
              />
              <QuickAction
                icon={PawPrint}
                label="Register Animal"
                bgClass="bg-purple-500/10 dark:bg-purple-500/15"
                textClass="text-purple-600 dark:text-purple-400"
                onClick={handleAddAnimal}
              />
              <QuickAction
                icon={HeartPulse}
                label="Pregnancy Check"
                bgClass="bg-pink-500/10 dark:bg-pink-500/15"
                textClass="text-pink-600 dark:text-pink-400"
                onClick={handlePregnancyCheck}
              />
              <QuickAction
                icon={Baby}
                label="Record Calving"
                bgClass="bg-cyan-500/10 dark:bg-cyan-500/15"
                textClass="text-cyan-600 dark:text-cyan-400"
                onClick={handleCalfDrop}
              />
            </div>
          </div>
        </section>

        {/* Main Grid: Today's Schedule + Work Queue Overview */}
        <section className="grid gap-6 xl:grid-cols-2 pb-20">
          {/* Today's Work */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-6">
              <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-4 mb-5">
                <div>
                  <h2 className="card-title text-base font-black tracking-tight">
                    Today's Work
                  </h2>
                  <p className="mt-0.5 text-xs text-base-content/55 font-semibold">
                    Today's services and lifecycle follow-ups
                  </p>
                </div>
                <Link
                  to="/technician/schedule"
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
                >
                  <CalendarDays size={14} />
                  Open Calendar
                </Link>
              </div>

              {/* Timeline Container */}
              <div className="relative pl-4 border-l border-base-300/80 ml-2 space-y-6">
                {isLoading ? (
                  [...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-start gap-4 animate-pulse"
                    >
                      <div className="absolute -left-5.5 top-1.5 size-2.5 rounded-full bg-base-300 border-4 border-base-100" />
                      <div className="w-16 skeleton h-3 mt-1 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-4 w-1/3" />
                        <div className="skeleton h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                ) : filteredVisits.length === 0 ? (
                  <div className="rounded-box border border-dashed border-base-300 py-10 text-center -ml-4">
                    <CalendarCheck
                      className="mx-auto mb-2 text-base-content/30"
                      size={24}
                    />
                    <p className="text-sm font-semibold">
                      No work scheduled for today
                    </p>
                    <p className="mt-1 text-xs text-base-content/50">
                      Scheduled work will appear in your timeline.
                    </p>
                  </div>
                ) : (
                  filteredVisits.slice(0, 3).map((v) => {
                    const dotClass =
                      v.statusClass === "badge-error"
                        ? "bg-error"
                        : v.statusClass === "badge-warning"
                          ? "bg-warning"
                          : v.statusClass === "badge-success"
                            ? "bg-success"
                            : v.statusClass === "badge-info"
                              ? "bg-info"
                              : "bg-primary";

                    return (
                      <div
                        key={v.id}
                        className="relative flex flex-col sm:flex-row items-start gap-4"
                      >
                        {/* Timeline Bullet Point */}
                        <div
                          className={`absolute -left-5.5 top-1.5 size-3 rounded-full ${dotClass} border-4 border-base-100 ring-4 ring-base-100`}
                        />

                        {/* Details Card */}
                        <div className="flex-1 flex items-center justify-between gap-4 p-3.5 bg-base-200/50 hover:bg-base-200 border border-base-300/60 rounded-2xl transition-all w-full">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Animal Avatar Initials */}
                            <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 font-black text-sm">
                              {v.initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-base-content leading-none">
                                {v.serviceType}
                              </h4>
                              <p className="text-[11px] text-base-content/75 font-semibold mt-1.5 truncate">
                                {v.farmer} · {v.animalTag}
                              </p>
                              <p className="text-[10px] text-base-content/40 font-bold mt-1 flex items-center gap-1">
                                <MapPin
                                  size={11}
                                  className="text-primary shrink-0"
                                />
                                {v.location}
                              </p>
                              <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-base-content/70">
                                {v.sourceLabel}
                                <span aria-hidden="true"> · </span>
                                <span className="sr-only">. Next action: </span>
                                {v.nextActionLabel}
                              </p>
                            </div>
                          </div>

                          {/* Right side status badge */}
                          <span
                            className={`badge badge-sm badge-soft shrink-0 text-[9px] font-black uppercase tracking-wider ${v.statusClass}`}
                          >
                            {v.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {!isLoading && filteredVisits.length > 0 && (
                <div className="border-t border-base-300 mt-5 pt-4 text-center">
                  <Link
                    to="/technician/schedule"
                    className="text-xs font-bold text-primary inline-flex items-center gap-1.5 hover:underline"
                  >
                    View full schedule <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Farmer Requests */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-6 flex flex-col h-full">
              <div className="flex items-center justify-between gap-3 border-b border-base-300 pb-4 mb-4">
                <div>
                  <h2 className="card-title text-base font-black tracking-tight">
                    Farmer Requests
                  </h2>
                  <p className="mt-0.5 text-xs text-base-content/55 font-semibold">
                    Real-time farmer service requests
                  </p>
                </div>
                <Link
                  to="/technician/requests"
                  className="text-[10px] font-black uppercase tracking-wider text-primary hover:underline"
                >
                  View all
                </Link>
              </div>

              {/* Requests List */}
              <div className="flex-1 flex flex-col">
                {isLoading ? (
                  [...Array(4)].map((_, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 py-3 border-b border-base-300/50 last:border-0 animate-pulse"
                    >
                      <div className="skeleton size-10 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-1/3" />
                        <div className="skeleton h-2 w-1/2" />
                      </div>
                      <div className="skeleton h-6 w-16 rounded-full" />
                    </div>
                  ))
                ) : farmerRequests.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-8">
                    <ClipboardList
                      className="mx-auto mb-2 text-base-content/30"
                      size={32}
                    />
                    <p className="text-sm font-semibold">No pending requests</p>
                    <p className="mt-1 text-xs text-base-content/50">
                      All farmer requests have been addressed.
                    </p>
                  </div>
                ) : (
                  farmerRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 py-3 border-b border-base-300/50 last:border-0"
                    >
                      <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {request.icon || <Tractor size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-base-content truncate">
                          {request.farmerName}
                        </p>
                        <p className="text-[10px] text-base-content/60 font-semibold truncate">
                          {request.serviceType} · {request.animalTag || "N/A"}
                        </p>
                        <p className="text-[9px] text-base-content/40 font-bold mt-0.5">
                          {request.timeAgo}
                        </p>
                      </div>
                      <span
                        className={`badge badge-sm badge-soft text-[9px] font-black uppercase tracking-wider ${
                          request.priority === "high"
                            ? "badge-error"
                            : request.priority === "medium"
                              ? "badge-warning"
                              : "badge-info"
                        }`}
                      >
                        {request.priority || "New"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Action Footer */}
              {!isLoading && farmerRequests.length > 0 && (
                <div className="border-t border-base-300 mt-4 pt-4">
                  <Link
                    to="/technician/requests"
                    className="w-full btn btn-primary btn-sm font-black uppercase tracking-wider text-[10px]"
                  >
                    View All Requests
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom spacing to ensure comfortable scrolling on all devices */}
        <div className="h-12" />
      </main>

      {/* Dedicated Quick Action Modals */}
      <AIServiceModal
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
