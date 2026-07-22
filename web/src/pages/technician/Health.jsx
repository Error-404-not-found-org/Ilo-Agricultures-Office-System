import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { validateTaskContextForAction, sanitizeReturnTo } from "../../utils/taskNavigation";
import TaskContextCard from "../../features/technician/TaskContextCard";
import TaskContextErrorView from "../../features/technician/TaskContextErrorView";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import {
  Search,
  Download,
  Stethoscope,
  AlertTriangle,
  ShieldCheck,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Trash2,
  Info,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";
import { downloadCsv, ensureExportableRows } from "../../lib/reportExport";

export default function HealthLog() {
  const toast = useToast();
  const location = useLocation();

  const formatRelativeSchedule = (value) => {
    if (!value) return { date: "No date", time: "—" };
    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime())) return { date: "No date", time: "—" };

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const targetDateStr = targetDate.toDateString();
    const todayStr = today.toDateString();
    const tomorrowStr = tomorrow.toDateString();
    const yesterdayStr = yesterday.toDateString();

  let datePart;
    if (targetDateStr === todayStr) {
      datePart = "Today";
    } else if (targetDateStr === tomorrowStr) {
      datePart = "Tomorrow";
    } else if (targetDateStr === yesterdayStr) {
      datePart = "Yesterday";
    } else {
      datePart = targetDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    const timePart = targetDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return { date: datePart, time: timePart };
  };

  const searchParams = new URLSearchParams(location.search);
  const taskIdQuery = searchParams.get("taskId");

  const taskContext = location.state?.taskContext || null;
  const returnTo = sanitizeReturnTo(location.state?.returnTo);

  const isTaskWorkflow = !!taskIdQuery;
  const validation = taskContext ? validateTaskContextForAction(taskContext) : null;
  const isStateMissing = isTaskWorkflow && (!taskContext || (validation && !validation.valid));
  const isTaskPreview = isTaskWorkflow && !isStateMissing;

  // ---- APPLICATION STATES ----
  const [searchQuery, setSearchQuery] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");


  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCase, setSelectedCase] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const itemsPerPage = 8;

  // ---- LIVE DATA PIPELINE ----
  const { data: healthPage = {}, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["technician", "health-requests-list", currentPage, searchQuery, urgencyFilter, statusFilter],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery || undefined,
          urgency: urgencyFilter || undefined,
          status: statusFilter || undefined,
        },
      });
      return res.data || {};
    },
    keepPreviousData: true,
  });
  const rawCases = useMemo(() => healthPage.data || [], [healthPage]);

  // ---- DYNAMIC METRIC RESOLVERS ----
  const metrics = useMemo(() => {
    return {
      total: healthPage.total ?? rawCases.length,
      highUrgency: rawCases.filter((c) => c.urgency === "high").length,
      closed: rawCases.filter((c) => c.status === "resolved" || c.status === "done").length,
    };
  }, [healthPage.total, rawCases]);

  // ---- MEMOIZED DATA PROCESSING (Filtering) ----
  const filteredCases = useMemo(() => {
    let result = rawCases.map((item) => {
      const visitDate = item.scheduledDate || item.preferredDate || item.createdAt;
      return {
        id: item._id,
        animalId: item.animalId?._id || item.animalId?.id || null,
        date: new Date(visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        rawDate: visitDate,
        tag: item.animalId?.earTag || "Not recorded",
        farmer: item.farmerId?.name || "Farmer not recorded",
        farmerImageUrl: item.farmerId?.imageUrl || null,
        barangay: item.farmerId?.address?.barangay || "Not recorded",
        symptoms: item.symptoms || "Not recorded",
        urgency: item.urgency || "not recorded",
        diagnosis: item.diagnosis || "Not recorded",
        treatment: item.treatment || "Not recorded",
        status: item.status || "pending",
        technicianNote: item.technicianNote || ""
      };
    });

    // Sort chronologically by rawDate
    return result.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
  }, [rawCases]);

  // ---- PAGINATION COMPUTATION ----
  const totalItems = healthPage.total || filteredCases.length;
  const totalPages = healthPage.totalPages || Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = filteredCases;

  const clearFilters = () => {
    setSearchQuery("");
    setUrgencyFilter("");
    setStatusFilter("");
    setCurrentPage(1);
  };

  const handleDeleteCase = async (c) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Incident Record",
      message: "Are you sure you want to delete this historical health incident entry? This operation cannot be undone.",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/health-request/${c.id}`);
          toast.success("Health incident record removed successfully.");
          refetch();
        } catch {
          toast.error("Failed to remove incident entry.");
        }
      }
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!ensureExportableRows(filteredCases, toast, "No health assistance entries match the current filters.")) return;
    const headers = ["Incident Case #", "Logged Date", "Animal Tag", "Farmer Client", "Symptom Presentation", "Assigned Diagnosis", "Treatment Plan", "Urgency", "Status"];
    const rows = filteredCases.map(c => [
      c.id,
      c.date,
      c.tag,
      c.farmer,
      c.symptoms,
      c.diagnosis,
      c.treatment,
      c.urgency.toUpperCase(),
      c.status.toUpperCase()
    ]);
    downloadCsv({
      headers,
      rows,
      fileName: `BreedSmart_Health_Assistance_Summary_${new Date().toLocaleDateString()}`,
    });
    toast.success("Health assistance CSV exported.");
  };

  if (isStateMissing) {
    const errorType = (validation && validation.errorType) || "missing_info";
    return <TaskContextErrorView errorType={errorType} returnTo={returnTo} />;
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Health & Diagnostics Ledger"
        subtitle="Triage dashboard tracking livestock symptoms, medication regimes, and clinical response dispatches"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {isTaskPreview && <TaskContextCard taskContext={taskContext} />}

        {/* Metric Grid Display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-amber-600 bg-amber-500/10">
              <Stethoscope size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : metrics.total}</div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Total Diagnostic Incidents
              </div>
            </div>
          </div>
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-rose-600 bg-rose-500/10">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : metrics.highUrgency}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Active High-Priority Dispatches
              </div>
            </div>
          </div>
          <div className="bg-base-100 border border-base-300 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : metrics.closed}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/50 tracking-wider">
                Cases Evaluated and Closed
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Datatable */}
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Actions Row */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="relative w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                aria-label="Search health records"
                placeholder="Search tag, diagnostic notes, farmer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content placeholder-base-content/40 focus:ring-1 focus:ring-primary outline-none transition-all duration-200"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={filteredCases.length === 0}
                className="btn btn-sm btn-primary text-white border-none text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-sm btn-outline border-base-300 text-xs font-bold gap-1.5 rounded-xl px-4 text-base-content/60 hover:bg-base-200 transition-colors cursor-pointer"
              >
                <Printer size={13} /> Print
              </button>
              <span className="text-xs text-base-content/40 font-semibold border-l border-base-300 pl-2.5 whitespace-nowrap">
                {isLoading ? "Fetching data..." : `${totalItems} incident${totalItems !== 1 ? "s" : ""} matched`}
              </span>
            </div>
          </div>

          {/* Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-base-200 border border-base-300 p-2.5 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-base-content/40 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
              aria-label="Filter health records by urgency"
              value={urgencyFilter}
              onChange={(e) => {
                setUrgencyFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Urgency Tiers</option>
              <option value="low">Low (Routine Care/Trimming)</option>
              <option value="medium">Medium (Clinical Isolates)</option>
              <option value="high">
                High (Immediate Vet Dispatch)
              </option>
            </select>

            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200 border-base-300 focus:bg-base-100 focus:border-primary text-base-content outline-none transition-all duration-200"
              aria-label="Filter health records by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="done">Completed</option>
            </select>

            {(urgencyFilter || statusFilter || searchQuery) && (
              <button
                onClick={clearFilters}
                className="btn btn-sm btn-ghost text-xs text-rose-600 font-bold gap-1 rounded-lg cursor-pointer"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full min-w-[860px] border-collapse" aria-label="Technician health records">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-6">Animal</th>
                  <th className="p-3.5">Incident</th>
                  <th className="p-3.5">Schedule</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-6 text-right w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300 text-xs font-semibold text-base-content/85">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={5}>
                        <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_.5fr] gap-5 py-1">
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <div role="alert" className="alert alert-error">
                        <span>{error?.response?.data?.message || "Health records could not be loaded."}</span>
                        <button type="button" className="btn btn-sm" onClick={() => refetch()}>Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center p-12 text-base-content/40 font-medium"
                    >
                      No matching historical diagnostic records found.
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map((c) => {
                    const sched = formatRelativeSchedule(c.rawDate);
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-base-200/50 transition-colors"
                      >
                        {/* 1. ANIMAL */}
                        <td className="p-3.5 pl-6">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              name={c.farmer}
                              imageUrl={c.farmerImageUrl}
                              size={36}
                              sizeClass="h-9 w-9"
                            />
                            <div>
                              {c.animalId ? (
                                <TableNameLink
                                  to={`/technician/animals/${c.animalId}`}
                                  ariaLabel={`Open livestock profile for animal ${c.tag}`}
                                >
                                  #{c.tag || "Unassigned"}
                                </TableNameLink>
                              ) : (
                                <span className="font-extrabold text-sm text-base-content block leading-tight">
                                  #{c.tag || "Unassigned"}
                                </span>
                              )}
                              <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                {c.farmer || "Unknown farmer"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. INCIDENT */}
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-base-content leading-tight">
                                {c.diagnosis || "Undiagnosed"}
                              </span>
                              <span
                                className={`inline-block text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${
                                  c.urgency === "high"
                                    ? "bg-red-500/10 text-rose-600 border-red-200/50"
                                    : c.urgency === "medium"
                                      ? "bg-amber-500/10 text-amber-600 border-amber-200/50"
                                      : "bg-blue-500/10 text-blue-600 border-blue-200/50"
                                }`}
                              >
                                {c.urgency}
                              </span>
                            </div>
                            <span className="text-[10px] text-base-content/55 block leading-tight font-medium max-w-[200px] truncate">
                              Symptoms: {c.symptoms || "None reported"}
                            </span>
                          </div>
                        </td>

                        {/* 3. SCHEDULE */}
                        <td className="p-3.5">
                          <span className="font-bold text-xs text-base-content block leading-tight">
                            {sched.date}
                          </span>
                          <span className="text-[10px] text-base-content/40 block mt-0.5 font-bold">
                            {sched.time}
                          </span>
                        </td>

                        {/* 4. STATUS */}
                        <td className="p-3.5">
                          <span
                            className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${
                              c.status === "resolved" || c.status === "done"
                                ? "badge-success"
                                : c.status === "in-progress"
                                  ? "badge-info"
                                  : "badge-warning"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>

                        {/* 5. ACTIONS */}
                        <td
                          className="p-3.5 pr-6 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div>
                            <button
                              type="button"
                              popoverTarget={`health-actions-${c.id}`}
                              style={{ anchorName: `--health-actions-${c.id}` }}
                              className="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                              aria-label={`Actions for case ${c.id}`}
                              aria-haspopup="menu"
                            >
                              <MoreVertical size={16} className="text-base-content/60" />
                            </button>
                            <ul
                              id={`health-actions-${c.id}`}
                              popover="auto"
                              role="menu"
                              aria-label={`Actions for health case ${c.id}`}
                              style={{ positionAnchor: `--health-actions-${c.id}` }}
                              className="dropdown dropdown-end menu menu-sm w-44 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl"
                            >
                              <li role="none">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(event) => {
                                    event.currentTarget.closest("[popover]")?.hidePopover?.();
                                    setSelectedCase(c);
                                  }}
                                  className="text-xs font-extrabold text-base-content rounded-lg p-2.5"
                                >
                                  <Eye size={13} className="mr-1" /> Inspect Case
                                </button>
                              </li>
                              <li role="none">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={(event) => {
                                    event.currentTarget.closest("[popover]")?.hidePopover?.();
                                    handleDeleteCase(c);
                                  }}
                                  disabled={isTaskPreview}
                                  className="text-xs font-extrabold text-rose-600 hover:bg-rose-50 rounded-lg p-2.5 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                  <Trash2 size={13} className="mr-1" /> Delete Record
                                </button>
                              </li>
                            </ul>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pt-4 border-t border-base-300 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-base-content/40">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              health dispatches
            </span>
            <div className="flex items-center gap-1" aria-label="Health records pagination">
              <button
                type="button"
                aria-label="Previous health records page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    type="button"
                    aria-label={`Go to health records page ${pageNumber}`}
                    aria-current={currentPage === pageNumber ? "page" : undefined}
                    key={pageNumber}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNumber
                        ? "bg-primary text-white shadow-xs"
                        : "border border-base-300 text-base-content/60 hover:bg-base-200"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                type="button"
                aria-label="Next health records page"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isLoading}
                className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Case Assessment Inspection Modal */}
      {selectedCase && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCase(null)}
        >
          <div
            className="card w-full max-w-md bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-3">
              <h3 className="text-xs font-black uppercase text-base-content/40">
                Clinical Incident profile
              </h3>
              <button
                onClick={() => setSelectedCase(null)}
                className="btn btn-xs btn-ghost btn-circle text-base-content/40 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="divide-y divide-base-300 text-xs">
              {[
                { k: "Incident Case #", v: selectedCase.id },
                { k: "Dispatch Date", v: selectedCase.date },
                {
                  k: "Animal Unit Tag",
                  v: selectedCase.tag,
                  s: "text-primary font-black",
                },
                { k: "Livestock Owner", v: selectedCase.farmer },
                {
                  k: "Symptom Presentation",
                  v: selectedCase.symptoms,
                  s: "text-base-content/70 font-medium",
                },
                {
                  k: "Primary Medical Verdict",
                  v: selectedCase.diagnosis,
                  s: "text-amber-700 dark:text-amber-400 font-bold",
                },
                {
                  k: "Treatment Regimen Plan",
                  v: selectedCase.treatment,
                  s: "text-primary font-bold",
                },
                {
                  k: "Urgency Classification",
                  v: selectedCase.urgency,
                  s: "font-extrabold uppercase",
                },
                {
                  k: "Current Incident Status",
                  v: selectedCase.status,
                  s: "font-extrabold uppercase",
                },
                {
                  k: "Technician Field Remarks",
                  v: selectedCase.technicianNote || "None",
                  s: "italic text-base-content/60",
                },
              ].map((row, index) => (
                <div key={index} className="flex justify-between py-2.5 gap-4">
                  <span className="text-base-content/40 font-semibold shrink-0">
                    {row.k}
                  </span>
                  <span
                    className={`text-right text-base-content ${row.s || ""}`}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-base-200 p-3 rounded-xl border border-base-300">
              <Info size={14} className="text-primary shrink-0" />
              <p className="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">
                Clinical records managed under safety guidelines.
              </p>
            </div>

            <button
              onClick={() => setSelectedCase(null)}
              className="btn btn-sm w-full btn-primary border-none text-white rounded-xl text-xs font-bold mt-2"
            >
              Dismiss Diagnosis Panel
            </button>
          </div>
        </div>
      )}

      {/* ===== CUSTOM MODERN CONFIRMATION DIALOG ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="card w-full max-w-sm bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-base-content/40 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Deletion"}</span>
            </div>
            <p className="text-xs text-base-content/70 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-base-300">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className="btn btn-sm btn-outline border-base-300 rounded-xl px-4 text-xs font-bold cursor-pointer text-base-content/60"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
                }}
                className="btn btn-sm text-white border-none rounded-xl px-5 text-xs font-black cursor-pointer bg-rose-600 hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
