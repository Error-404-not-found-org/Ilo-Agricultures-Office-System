import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle,
  HeartPulse,
  MapPin,
  PawPrint,
  Sparkles,
  Stethoscope,
  Syringe,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import { ui } from "../../components/ui/uiClasses";
import {
  getDashboardGreeting,
  getDashboardScheduleOverview,
  getDashboardScheduleSlot,
} from "../../utils/dashboardWorkflow";

import AIServiceModal from "../../components/dialogs/AIServiceModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import RegisterFarmerModal from "../../components/dialogs/RegisterFarmerModal";
import RegisterLivestockModal from "../../components/dialogs/RegisterLivestockModal";

function OverviewStat({
  icon: Icon,
  label,
  value,
  description,
  toneClass,
  borderClass,
  isLoading,
}) {
  return (
    <article
      className={`stat min-h-28 rounded-box border border-base-300 border-l-4 ${borderClass} bg-base-100 p-4 shadow-sm`}
    >
      <div
        className={`stat-figure ml-3 flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
      >
        <Icon size={19} aria-hidden="true" />
      </div>
      <div className="stat-title mt-1 text-sm font-semibold text-base-content/90">
        {label}
      </div>
      <div className="stat-value text-3xl font-extrabold leading-none text-base-content">
        {isLoading ? (
          <span
            className="skeleton mt-1 block h-8 w-20"
            aria-label={`Loading ${label}`}
          />
        ) : (
          value
        )}
      </div>
      <div className="stat-desc mt-1 text-xs text-base-content/75">
        {description}
      </div>
    </article>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  iconClass = "bg-primary/10 text-primary",
  style,
}) {
  const hasCustomColor = Boolean(style?.color);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="btn h-auto min-h-20 justify-start gap-3 border-base-300 bg-base-100 px-4 py-3 text-left shadow-none hover:border-primary/35 hover:bg-primary/5"
    >
      <span
        style={
          hasCustomColor
            ? { color: style.color, backgroundColor: `${style.color}18` }
            : undefined
        }
        className={`flex size-10 shrink-0 items-center justify-center rounded-box ${hasCustomColor ? "" : iconClass}`}
      >
        <Icon
          size={20}
          aria-hidden="true"
          style={hasCustomColor ? { color: style.color } : undefined}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-base-content">
          {label}
        </span>
        <span className="mt-0.5 block whitespace-normal text-xs font-normal text-base-content/55">
          {description}
        </span>
      </span>
    </button>
  );
}

function getShiftBadgeStyle(slotText) {
  const slot = String(slotText || "").toLowerCase();
  if (slot.includes("morning")) {
    return "bg-amber-500 text-white border-amber-500 dark:bg-amber-400 dark:border-amber-400 font-bold";
  }
  if (slot.includes("afternoon")) {
    return "bg-sky-600 text-white border-sky-600 dark:bg-sky-500 dark:border-sky-500 font-bold";
  }
  if (slot.includes("evening")) {
    return "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500 font-bold";
  }
  return "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600 font-bold";
}
function getWorkTypeStyle(item = {}) {
  const kind = String(
    item.type || item.workflowType || item.taskType || "",
  ).toLowerCase();
  const label = String(item.scheduleLabel || "").toLowerCase();

  if (kind.includes("ai") || kind.includes("insem") || label.includes("ai")) {
    return {
      icon: Syringe,
      badgeText: "Insemination",
      iconClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      badgeClass:
        "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500 font-bold",
    };
  }
  if (
    kind.includes("pd") ||
    kind.includes("preg") ||
    label.includes("pregnancy")
  ) {
    return {
      icon: CheckCircle,
      badgeText: "Pregnancy Check",
      iconClass:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      badgeClass:
        "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:border-purple-500 font-bold",
    };
  }
  if (
    kind.includes("calv") ||
    kind.includes("cd") ||
    label.includes("calving")
  ) {
    return {
      icon: Sparkles,
      badgeText: "Calving Due",
      iconClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      badgeClass:
        "bg-amber-500 text-white border-amber-500 dark:bg-amber-400 dark:border-amber-400 font-bold",
    };
  }
  if (kind.includes("health") || label.includes("health")) {
    return {
      icon: Stethoscope,
      badgeText: "Health Visit",
      iconClass:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      badgeClass:
        "bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:border-rose-500 font-bold",
    };
  }
  return {
    icon: CalendarCheck,
    badgeText: "Task",
    iconClass: "bg-primary/10 text-primary border border-primary/20",
    badgeClass:
      "bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600 font-bold",
  };
}

export default function Dashboard() {
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isFarmerModalOpen, setIsFarmerModalOpen] = useState(false);
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/profile");
      return response.data || {};
    },
  });

  const dashboardQuery = useQuery({
    queryKey: ["technician", "dashboard", "current"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/technician/dashboard-data?fullAgenda=true",
      );
      return response.data || {};
    },
    refetchInterval: 30_000,
  });

  const dashboardData = dashboardQuery.data || {};
  const stats = dashboardData.stats || {};
  const agendaItems = useMemo(
    () => dashboardData.agendaItems || [],
    [dashboardData.agendaItems],
  );
  const scheduleOverview = useMemo(
    () => getDashboardScheduleOverview(agendaItems),
    [agendaItems],
  );
  const todayWork = scheduleOverview.todayWork.slice(0, 4);
  const dueAndOverdue =
    stats.dueToday != null && stats.overdue != null
      ? Number(stats.dueToday) + Number(stats.overdue)
      : null;
  const hasDashboardData = !dashboardQuery.isError;
  const metricValue = (value) =>
    hasDashboardData && value != null ? value : "Unavailable";
  const isProfileIncomplete =
    dbUser && (!dbUser.phoneNumber || !dbUser.address?.barangay);

  const refreshDashboard = () => dashboardQuery.refetch();
  const firstName =
    dbUser?.firstName || dbUser?.name?.split(" ")[0] || "Technician";

  return (
    <div className={`${ui.page} min-w-0 overflow-x-hidden`}>
      <Topbar
        title={`${getDashboardGreeting()}, ${firstName}`}
        subtitle="Your current work, schedule, and field shortcuts."
      />

      <main className={`${ui.main} w-full min-w-0 max-w-full`}>
        {isProfileIncomplete && (
          <div className="alert alert-warning mb-5 items-start">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold">Complete your profile</h2>
              <p className="text-sm">
                Add your phone number and assigned barangay so Farmers can reach
                you for field work.
              </p>
            </div>
            <Link to="/technician/profile" className="btn btn-sm">
              Update Profile
            </Link>
          </div>
        )}

        {dashboardQuery.isError && (
          <div className="alert alert-error mb-5 items-start">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold">Dashboard unavailable</h2>
              <p className="text-sm">
                {dashboardQuery.error?.response?.data?.message ||
                  dashboardQuery.error?.message ||
                  "Current work could not be loaded."}
              </p>
            </div>
            <button
              type="button"
              onClick={refreshDashboard}
              className="btn btn-sm"
            >
              Retry
            </button>
          </div>
        )}

        <section aria-labelledby="overview-heading" className="space-y-3">
          <h2
            id="overview-heading"
            className="text-lg font-bold text-base-content"
          >
            Insemination & Breeding Overview
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewStat
              icon={Syringe}
              label="Inseminated Today"
              value={metricValue(
                stats.aiCompletedToday ?? stats.completedToday ?? 0,
              )}
              description="Inseminations completed today"
              toneClass="bg-primary/10 text-primary"
              borderClass="border-l-primary"
              isLoading={dashboardQuery.isLoading}
            />
            <OverviewStat
              icon={CalendarCheck}
              label="Monthly Inseminations"
              value={metricValue(stats.totalInsemMonth ?? 0)}
              description="Total inseminated this month"
              toneClass="bg-info/10 text-info"
              borderClass="border-l-info"
              isLoading={dashboardQuery.isLoading}
            />
            <OverviewStat
              icon={CheckCircle}
              label="Success Rate"
              value={metricValue(stats.successRate ?? "0%")}
              description="Insemination Success rate in the last 90 days"
              toneClass="bg-success/10 text-success"
              borderClass="border-l-success"
              isLoading={dashboardQuery.isLoading}
            />
          </div>
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-0 p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <h2 className="card-title text-lg font-bold text-base-content">
                    Today&apos;s Work
                  </h2>
                  <span className="badge badge-primary badge-soft badge-sm font-bold">
                    {todayWork.length}{" "}
                    {todayWork.length === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <Link
                  to="/technician/schedule"
                  className="btn btn-ghost btn-sm shrink-0 text-primary hover:bg-primary/10 gap-1.5"
                >
                  View Schedule
                  <CalendarDays size={16} aria-hidden="true" />
                </Link>
              </div>

              {dashboardQuery.isLoading ? (
                <div
                  className="space-y-3 p-5 sm:p-6"
                  aria-label="Loading today's work"
                >
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="skeleton h-20 w-full rounded-2xl"
                    />
                  ))}
                </div>
              ) : todayWork.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success ring-8 ring-success/5">
                    <CalendarCheck size={28} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-base-content">
                    No work due today
                  </h3>
                  <p className="mt-1 max-w-sm text-sm text-base-content/60">
                    Future and overdue work remain available in Schedule.
                  </p>
                  <div className="mt-5">
                    <Link
                      to="/technician/schedule"
                      className="btn btn-sm btn-outline btn-primary gap-1.5"
                    >
                      <CalendarDays size={14} aria-hidden="true" />
                      View Full Schedule
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 sm:p-5">
                  {todayWork.map((item) => {
                    const target = item.navigationTarget;
                    const workStyle = getWorkTypeStyle(item);
                    const WorkIcon = workStyle.icon;
                    const slotText = getDashboardScheduleSlot(item);
                    const tagLabel = item.animalTag
                      ? String(item.animalTag).replace(/^#/, "")
                      : null;
                    const shiftBadgeClass = getShiftBadgeStyle(slotText);

                    return (
                      <article
                        key={String(item.taskId || item.workflowId || item.id)}
                        className="group flex flex-col gap-4 rounded-xl border-2 border-primary/10 bg-base-200 p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-5"
                      >
                        {/* Left: Icon and main info */}
                        <div className="flex items-start gap-3.5 min-w-0 sm:flex-1">
                          {/* Icon container */}
                          <div
                            className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${workStyle.iconClass}`}
                            aria-hidden="true"
                          >
                            <WorkIcon size={22} />
                          </div>

                          {/* Text content */}
                          <div className="min-w-0 flex-1">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                              <span
                                className={`badge badge-soft badge-sm font-bold ${shiftBadgeClass}`}
                              >
                                {slotText}
                              </span>
                              <span
                                className={`badge badge-soft badge-sm ${workStyle.badgeClass}`}
                              >
                                {workStyle.badgeText}
                              </span>
                              {tagLabel && (
                                <span className="badge badge-sm font-mono font-bold bg-base-200 text-base-content/80 border border-base-300">
                                  #{tagLabel}
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h3 className="text-sm sm:text-base font-bold text-base-content truncate group-hover:text-primary transition-colors">
                              {item.scheduleLabel}
                            </h3>

                            {/* Farmer and location */}
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-base-content/65">
                              <span className="font-medium text-base-content/85 truncate">
                                {item.farmer ||
                                  item.farmerName ||
                                  "Farmer not recorded"}
                              </span>
                              {(item.farmLocationLabel || item.location) && (
                                <span className="flex items-center gap-1 text-base-content/50 truncate">
                                  <MapPin
                                    size={12}
                                    className="shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    {item.farmLocationLabel || item.location}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Action button */}
                        {target && (
                          <div className="shrink-0 self-end sm:self-center">
                            <Link
                              to={`${target.path}${target.search || ""}`}
                              className="btn btn-sm btn-outline btn-primary gap-1.5 font-semibold group/btn hover:btn-primary transition-all"
                              aria-label={`${target.label}: ${item.scheduleLabel}`}
                            >
                              <span>{target.label}</span>
                              <ArrowRight
                                size={14}
                                className="transition-transform group-hover/btn:translate-x-0.5"
                                aria-hidden="true"
                              />
                            </Link>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body p-5 sm:p-6">
              <div>
                <h2 className="card-title text-lg">Quick Actions</h2>
                <p className="mt-1 text-sm text-base-content/55">
                  Record direct field work or register a new Farmer or animal.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <QuickAction
                  icon={Syringe}
                  label="Record InseminationService"
                  description="Record Insemination or add a past record"
                  onClick={() => setIsAIModalOpen(true)}
                  iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
                <QuickAction
                  icon={Stethoscope}
                  label="Record Health Assistance"
                  description="Direct or walk-in assistance"
                  onClick={() => setIsHealthModalOpen(true)}
                  iconClass="bg-warning/10 text-warning"
                />
                <QuickAction
                  icon={UserPlus}
                  label="Register Farmer"
                  description="Add an assisted Farmer profile"
                  onClick={() => setIsFarmerModalOpen(true)}
                  iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                />
                <QuickAction
                  icon={PawPrint}
                  label="Register Animal"
                  description="Add livestock to a Farmer"
                  onClick={() => setIsAnimalModalOpen(true)}
                  iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      <AIServiceModal
        existingOnly
        isOpen={isAIModalOpen}
        onClose={() => {
          setIsAIModalOpen(false);
          refreshDashboard();
        }}
      />
      <WalkInHealthModal
        existingOnly
        isOpen={isHealthModalOpen}
        onClose={() => {
          setIsHealthModalOpen(false);
          refreshDashboard();
        }}
      />
      <RegisterFarmerModal
        isOpen={isFarmerModalOpen}
        onClose={() => {
          setIsFarmerModalOpen(false);
          refreshDashboard();
        }}
      />
      <RegisterLivestockModal
        isOpen={isAnimalModalOpen}
        onClose={() => {
          setIsAnimalModalOpen(false);
          refreshDashboard();
        }}
      />
    </div>
  );
}
