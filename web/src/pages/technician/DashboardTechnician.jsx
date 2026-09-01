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
      <div className={`stat-figure ml-3 flex size-10 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon size={19} aria-hidden="true" />
      </div>
      <div className="stat-title mt-1 text-sm font-semibold text-base-content/90">
        {label}
      </div>
      <div className="stat-value text-3xl font-extrabold leading-none text-base-content">
        {isLoading ? (
          <span className="skeleton mt-1 block h-8 w-20" aria-label={`Loading ${label}`} />
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

function QuickAction({ icon: Icon, label, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="btn h-auto min-h-20 justify-start gap-3 border-base-300 bg-base-100 px-4 py-3 text-left shadow-none hover:border-primary/35 hover:bg-primary/5"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-base-content">{label}</span>
        <span className="mt-0.5 block whitespace-normal text-xs font-normal text-base-content/55">
          {description}
        </span>
      </span>
    </button>
  );
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
            Current Work Overview
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewStat
              icon={CalendarCheck}
              label="Due"
              value={metricValue(scheduleOverview.dueCount)}
              description="Due or overdue date-bound work"
              toneClass="bg-primary/10 text-primary"
              borderClass="border-l-primary"
              isLoading={dashboardQuery.isLoading}
            />
            <OverviewStat
              icon={HeartPulse}
              label="Urgent Health"
              value={metricValue(stats.urgentHealth)}
              description="Farmer Health reports marked urgent"
              toneClass="bg-error/10 text-error"
              borderClass="border-l-error"
              isLoading={dashboardQuery.isLoading}
            />
            <OverviewStat
              icon={CheckCircle}
              label="Completed Today"
              value={metricValue(stats.completedToday)}
              description="Work you completed today"
              toneClass="bg-success/10 text-success"
              borderClass="border-l-success"
              isLoading={dashboardQuery.isLoading}
            />
          </div>
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-0 p-0">
              <div className="flex items-start justify-between gap-4 border-b border-base-300 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="card-title text-lg">Today&apos;s Work</h2>
                  <p className="mt-1 text-sm text-base-content/55">
                    A short preview from your date-bound Schedule.
                  </p>
                </div>
                <Link
                  to="/technician/schedule"
                  className="btn btn-ghost btn-sm shrink-0 text-primary"
                >
                  View Schedule
                  <CalendarDays size={16} aria-hidden="true" />
                </Link>
              </div>

              {dashboardQuery.isLoading ? (
                <div className="space-y-3 p-5 sm:p-6" aria-label="Loading today's work">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="skeleton h-18 w-full" />
                  ))}
                </div>
              ) : todayWork.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CalendarCheck
                    className="mx-auto text-base-content/30"
                    size={30}
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 font-bold">No work due today</h3>
                  <p className="mt-1 text-sm text-base-content/55">
                    Future and overdue work remain available in Schedule.
                  </p>
                </div>
              ) : (
                <ul className="list px-2 py-2 sm:px-3">
                  {todayWork.map((item) => {
                    const target = item.navigationTarget;
                    return (
                      <li
                        key={String(item.taskId || item.workflowId || item.id)}
                        className="list-row items-center gap-3"
                      >
                        <div className="list-col-grow min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="badge badge-primary badge-soft badge-sm font-bold">
                              {getDashboardScheduleSlot(item)}
                            </span>
                            <h3 className="font-bold">{item.scheduleLabel}</h3>
                          </div>
                          <p className="mt-1 truncate text-sm text-base-content/65">
                            {item.farmer || item.farmerName || "Farmer not recorded"}
                            {item.animalTag ? ` · ${item.animalTag}` : ""}
                          </p>
                          {(item.farmLocationLabel || item.location) && (
                            <p className="mt-1 flex items-center gap-1 truncate text-xs text-base-content/50">
                              <MapPin size={12} aria-hidden="true" />
                              {item.farmLocationLabel || item.location}
                            </p>
                          )}
                        </div>
                        {target && (
                          <Link
                            to={`${target.path}${target.search || ""}`}
                            className="btn btn-ghost btn-sm shrink-0"
                            aria-label={`${target.label}: ${item.scheduleLabel}`}
                          >
                            {target.label}
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                  label="Record AI Service"
                  description="Record AI now or add a past record"
                  onClick={() => setIsAIModalOpen(true)}
                />
                <QuickAction
                  icon={Stethoscope}
                  label="Record Health Assistance"
                  description="Direct or walk-in assistance"
                  onClick={() => setIsHealthModalOpen(true)}
                />
                <QuickAction
                  icon={UserPlus}
                  label="Register Farmer"
                  description="Add an assisted Farmer profile"
                  onClick={() => setIsFarmerModalOpen(true)}
                />
                <QuickAction
                  icon={PawPrint}
                  label="Register Animal"
                  description="Add livestock to a Farmer"
                  onClick={() => setIsAnimalModalOpen(true)}
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
