import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertCircle, ClipboardList, RefreshCw } from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import axiosInstance from "../../lib/axios";

const missing = "Not recorded";

function formatDate(value, empty = missing) {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function animalCell(record) {
  const animal = record.animalId || record.animal || {};
  const id = animal._id || animal.id;
  const label = animal.earTag || animal.name || record.animalTag || missing;
  return (
    <div>
      {id ? (
        <Link
          to={`/admin/livestock/${id}`}
          className="link link-hover font-semibold"
          aria-label={`Open livestock profile for animal ${label}`}
        >
          {label}
        </Link>
      ) : (
        <span className="font-semibold">{label}</span>
      )}
      <div className="text-xs text-base-content/80">
        {[animal.species, animal.breed].filter(Boolean).join(" / ") ||
          "Species and breed not recorded"}
      </div>
    </div>
  );
}

const configs = {
  work: {
    title: "Municipal Workload Oversight",
    subtitle: "Review active field assignments without performing Technician clinical work",
    notice:
      "This Admin view is read-only. Clinical recording and task completion remain Technician responsibilities.",
    endpoint: "/technician/work-queue",
    queryKey: "work-queue-oversight",
    tableLabel: "Municipal technician workload oversight",
    empty: "No field assignments are currently available for oversight.",
    error: "Municipal workload could not be loaded.",
    headers: ["Service", "Farmer and animal", "Assigned technician", "Schedule", "Status", "Oversight"],
    getRecords: (data) => (Array.isArray(data.data) ? data.data : []),
    rowKey: (record) => record.taskId || record.id,
    cells: (record) => {
      const requestId = record.workflowId || record.id;
      const assignee =
        record.raw?.approvedBy?.name ||
        record.raw?.handledBy?.name ||
        record.raw?.assignedTechnicianId?.name ||
        record.raw?.technicianId?.name ||
        "Unassigned";
      return [
        <div key="service">
          <div className="font-semibold">
            {record.serviceType || record.workflowType || missing}
          </div>
          <div className="text-xs text-base-content/80">
            {record.workflowType || "Workflow not recorded"}
          </div>
        </div>,
        <div key="client">
          <div className="font-semibold">
            {record.farmer?.name || record.farmerName || missing}
          </div>
          <div className="text-xs text-base-content/80">
            {record.animal?.earTag ||
              record.animal?.name ||
              record.animalTag ||
              "Animal not recorded"}
          </div>
        </div>,
        assignee,
        <div key="schedule">
          <div>{formatDate(record.schedule?.date || record.displayDate, "Not scheduled")}</div>
          <div className="text-xs text-base-content/80">
            {record.schedule?.visitPeriod || "Visit period not recorded"}
          </div>
        </div>,
        <span key="status" className="badge badge-outline">
          {record.displayStatus || record.status || missing}
        </span>,
        requestId ? (
          <Link
            key="oversight"
            to={`/admin/requests?requestId=${encodeURIComponent(requestId)}&status=all`}
            className="btn btn-sm"
          >
            Open monitoring
          </Link>
        ) : (
          <span key="oversight" className="text-sm text-base-content/80">
            Not available
          </span>
        ),
      ];
    },
  },
  pregnancy: {
    title: "Pregnancy Check Oversight",
    subtitle: "Review municipal pregnancy records entered through Technician workflows",
    notice:
      "This Admin register is read-only. Pregnancy diagnosis must be recorded by a Technician through the clinical workflow.",
    endpoint: "/admin/pregnancy-checks",
    queryKey: "pregnancy-checks-oversight",
    tableLabel: "Municipal pregnancy check oversight",
    empty: "No pregnancy checks have been recorded.",
    error: "Pregnancy records could not be loaded.",
    headers: ["Diagnosis date", "Animal", "Farmer", "Result", "Expected calving", "Cycle status"],
    getRecords: (data) =>
      Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.pregnancyChecks)
          ? data.pregnancyChecks
          : [],
    rowKey: (record) => record._id,
    cells: (record) => [
      formatDate(
        record.pregnancyDiagnosis?.date ||
          record.diagnosisDate ||
          record.createdAt,
      ),
      animalCell(record),
      record.farmerId?.name || missing,
      <span key="result" className="badge badge-outline">
        {record.pregnancyDiagnosis?.result || record.result || missing}
      </span>,
      formatDate(record.targetCalvingDate),
      record.cycleStatus || missing,
    ],
  },
  calvings: {
    title: "Calving and Newborn Oversight",
    subtitle: "Review municipal calving records entered through Technician workflows",
    notice:
      "This Admin register is read-only. Calving and newborn clinical details must be recorded by a Technician.",
    endpoint: "/admin/calvings",
    queryKey: "calvings-oversight",
    tableLabel: "Municipal calving and newborn oversight",
    empty: "No calving records have been recorded.",
    error: "Calving records could not be loaded.",
    headers: ["Calving date", "Dam", "Farmer", "Outcome", "Calves", "Calving ease"],
    getRecords: (data) =>
      Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.calvings)
          ? data.calvings
          : [],
    rowKey: (record) => record._id,
    cells: (record) => {
      const calfCount =
        record.numberOfCalves ??
        (Array.isArray(record.calves) ? record.calves.length : null);
      return [
        formatDate(record.date || record.calvingDate),
        animalCell(record),
        record.farmerId?.name || missing,
        <span key="outcome" className="badge badge-outline">
          {record.outcome || missing}
        </span>,
        calfCount ?? missing,
        record.calvingEase || missing,
      ];
    },
  },
};

function OversightRegister({ type }) {
  const config = configs[type];
  const [page, setPage] = useState(1);
  const limit = 15;
  const { data = {}, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", config.queryKey, page],
    queryFn: async () => {
      const response = await axiosInstance.get(config.endpoint, {
        params: { page, limit },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const records = config.getRecords(data);
  const pagination = data.pagination || {};
  const totalPages = Math.max(
    1,
    Number(pagination.totalPages || data.totalPages) || 1,
  );
  const total = pagination.total ?? data.total ?? records.length;

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <Topbar title={config.title} subtitle={config.subtitle} />
      <main className="flex-1 space-y-4 p-4 sm:p-6">
        <div role="alert" className="alert alert-info alert-soft">
          <ClipboardList size={18} />
          <span>{config.notice}</span>
        </div>

        <section className="overflow-hidden rounded-box border border-base-300 bg-base-100">
          {isError ? (
            <div role="alert" className="alert alert-error m-4 w-auto">
              <AlertCircle size={18} />
              <span>{config.error}</span>
              <button type="button" className="btn btn-sm" onClick={() => refetch()}>
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table" aria-label={config.tableLabel}>
                <thead>
                  <tr className="select-none border-b border-base-300 bg-base-200 text-[11px] font-bold uppercase tracking-wider text-base-content/80">
                    {config.headers.map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300 text-xs">
                  {isLoading ? (
                    Array.from({ length: 5 }, (_, index) => (
                      <tr key={index}>
                        <td colSpan={config.headers.length}>
                          <div className="skeleton h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={config.headers.length}
                        className="py-12 text-center text-base-content/80 font-medium"
                      >
                        {config.empty}
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={config.rowKey(record)} className="hover:bg-base-300/60 transition-colors cursor-pointer">
                        {config.cells(record).map((cell, index) => (
                          <td key={config.headers[index]}>{cell}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-base-300 px-4 py-3">
            <span className="text-sm font-medium text-base-content/80">{total} record(s)</span>
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="btn btn-sm join-item pointer-events-none">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm join-item"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export function AdminWorkQueue() {
  return <OversightRegister type="work" />;
}

export function AdminPregnancyOversight() {
  return <OversightRegister type="pregnancy" />;
}

export function AdminCalvings() {
  return <OversightRegister type="calvings" />;
}
