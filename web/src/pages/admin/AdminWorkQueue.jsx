import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Baby,
  ClipboardList,
  HeartPulse,
  RefreshCw,
  Syringe,

} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import axiosInstance from "../../lib/axios";

const workloadMetrics = [
  { key: "ai", label: "AI", icon: Syringe },
  { key: "health", label: "Health", icon: HeartPulse },
  { key: "pregnancy", label: "Pregnancy", icon: Activity },
  { key: "calving", label: "Calving", icon: Baby },
  { key: "tasks", label: "Other", icon: ClipboardList },
];

const countValue = (value) => Number(value || 0);

function WorkloadCard({ technician }) {
  const technicianId = String(technician.technicianId || "");
  const technicianName = technician.name || "Technician not recorded";

  return (
    <article
      className="card bg-base-100 border border-base-300 shadow-md transition-shadow hover:shadow-lg"
      aria-labelledby={`workload-${technicianId}`}
    >
      <div className="card-body gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col items-start">
            <UserAvatar 
              name={technicianName} 
              imageUrl={technician.photoUrl || technician.imageUrl} 
              sizeClass="h-12 w-12" 
              className="mb-3" 
            />
            <h2
              id={`workload-${technicianId}`}
              className="card-title truncate text-lg font-bold"
            >
              {technicianName}
            </h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-base-content/50">Technician</p>
          </div>
          <div className="text-right">
            <span className="block text-3xl font-extrabold tabular-nums text-primary">
              {countValue(technician.activeWorkloadTotal)}
            </span>
            <span className="text-xs font-semibold text-base-content/60">
              Active Work
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {workloadMetrics.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-md bg-base-200/60 border border-base-300/40 px-2.5 py-1.5 flex items-center justify-between">
              <dt className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-base-content/60">
                <Icon size={11} aria-hidden="true" className="text-primary/70" />
                <span className="truncate">{label}</span>
              </dt>
              <dd className="text-sm font-black tabular-nums text-base-content">
                {countValue(technician.counts?.[key])}
              </dd>
            </div>
          ))}
        </dl>

        <div className="card-actions justify-end border-t border-base-300 pt-4">
          <Link
            to={`/admin/users/${encodeURIComponent(technicianId)}`}
            className="btn btn-sm"
            aria-label={`View Technician profile for ${technicianName}`}
          >
            View Technician
          </Link>
        </div>
      </div>
    </article>
  );
}

function WorkloadSkeleton() {
  return (
    <div className="card card-border bg-base-100">
      <div className="card-body gap-4 p-5">
        <div className="skeleton h-12 w-2/3" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {workloadMetrics.map(({ key }) => (
            <div key={key} className="skeleton h-16" />
          ))}
        </div>
        <div className="skeleton ml-auto h-8 w-32" />
      </div>
    </div>
  );
}

export default function AdminWorkQueue() {
  const { data = {}, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "technician-workload-summary"],
    queryFn: async () => {
      const response = await axiosInstance.get(
        "/admin/technician-workload-summary",
      );
      return response.data || {};
    },
  });

  const technicians = Array.isArray(data.technicians) ? data.technicians : [];

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <Topbar
        title="Technician Workload"
        subtitle="Review active work assigned to each municipal Technician"
      />

      <main className="flex-1 space-y-5 p-4 sm:p-6">
        <section
          className="mx-auto w-full max-w-7xl"
          aria-labelledby="active-work-heading"
        >
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 id="active-work-heading" className="text-xl font-bold">
                Active Work
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-base-content/65">
                Canonical assigned AI, Health, due reproductive work, and other
                active tasks.
              </p>
            </div>
            {!isLoading && !isError && (
              <p className="text-sm font-medium text-base-content/60">
                {technicians.length} Technician
                {technicians.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {isError ? (
            <div role="alert" className="alert alert-error alert-soft">
              <AlertCircle size={18} aria-hidden="true" />
              <span>Technician workload could not be loaded.</span>
              <button type="button" className="btn btn-sm" onClick={() => refetch()}>
                <RefreshCw size={14} aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <WorkloadSkeleton key={index} />
              ))}
            </div>
          ) : technicians.length === 0 ? (
            <div className="rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center">
              <ClipboardList
                size={30}
                className="mx-auto text-base-content/35"
                aria-hidden="true"
              />
              <h2 className="mt-3 font-semibold">No Technician workload</h2>
              <p className="mt-1 text-sm text-base-content/60">
                Active assigned work will appear here.
              </p>
            </div>
          ) : (
            <div
              className="grid gap-4 lg:grid-cols-2"
              aria-label="Technician workload overview"
            >
              {technicians.map((technician) => (
                <WorkloadCard
                  key={technician.technicianId}
                  technician={technician}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
