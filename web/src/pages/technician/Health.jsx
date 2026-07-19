import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { validateTaskContextForAction, sanitizeReturnTo } from "../../utils/taskNavigation";
import TaskContextCard from "../../components/technician/TaskContextCard";
import TaskContextErrorView from "../../components/technician/TaskContextErrorView";
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
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";
import { downloadCsv, ensureExportableRows } from "../../lib/reportExport";

export default function HealthLog() {
  const toast = useToast();
  const location = useLocation();

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
  const { data: healthPage = {}, isLoading, refetch } = useQuery({
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
      total: rawCases.length,
      highUrgency: rawCases.filter((c) => c.urgency === "high").length,
      closed: rawCases.filter((c) => c.status === "resolved" || c.status === "done").length,
    };
  }, [rawCases]);

  // ---- MEMOIZED DATA PROCESSING (Filtering) ----
  const filteredCases = useMemo(() => {
    let result = rawCases.map((item) => {
      const visitDate = item.scheduledDate || item.preferredDate || item.createdAt;
      return {
        id: item._id,
        date: new Date(visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        rawDate: visitDate,
        tag: item.animalId?.earTag || "N/A",
        farmer: item.farmerId?.name || "N/A",
        barangay: item.farmerId?.address?.barangay || "Oton",
        symptoms: item.symptoms || "Consultation Request",
        urgency: item.urgency || "low",
        diagnosis: item.diagnosis || "Pending Diagnosis",
        treatment: item.treatment || "None",
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
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3.5 pl-5">Case #</th>
                  <th className="p-3.5">Logged Date</th>
                  <th className="p-3.5">Animal Tag</th>
                  <th className="p-3.5">Farmer Client</th>
                  <th className="p-3.5">Clinical Symptoms</th>
                  <th className="p-3.5">Assigned Diagnosis</th>
                  <th className="p-3.5 text-center">Urgency</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={9}>
                        <div className="grid grid-cols-[.8fr_1fr_.8fr_1.2fr_1.5fr_1.5fr_.8fr_.8fr_.8fr] gap-5 py-1">
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                          <span className="skeleton h-4" />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : paginatedCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="text-center p-12 text-base-content/40 font-medium"
                    >
                      No matching historical diagnostic records found.
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-base-200 transition-colors cursor-pointer"
                      onClick={() => setSelectedCase(c)}
                    >
                      <td className="p-3.5 pl-5 font-bold text-base-content/40 truncate max-w-[80px]">
                        #{c.id.slice(-6)}
                      </td>
                      <td className="p-3.5 font-medium whitespace-nowrap">
                        {c.date}
                      </td>
                      <td className="p-3.5 font-extrabold text-primary">
                        {c.tag}
                      </td>
                      <td className="p-3.5 font-bold">{c.farmer}</td>
                      <td className="p-3.5 max-w-[180px] truncate font-medium text-base-content/70">
                        {c.symptoms}
                      </td>
                      <td className="p-3.5 font-bold text-base-content/85 truncate max-w-[150px]">
                        {c.diagnosis}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                            c.urgency === "high"
                              ? "bg-red-500/10 text-rose-600 border-red-200/50"
                              : c.urgency === "medium"
                                ? "bg-amber-500/10 text-amber-600 border-amber-200/50"
                                : "bg-blue-500/10 text-blue-600 border-blue-200/50"
                          }`}
                        >
                          {c.urgency}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                            c.status === "resolved" || c.status === "done"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : c.status === "in-progress"
                                ? "bg-blue-500/10 text-blue-600 border-blue-200/50"
                                : "bg-amber-500/10 text-amber-600 border-amber-200/50"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td
                        className="p-3.5 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedCase(c)}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-base-300 hover:border-primary hover:text-primary flex items-center gap-1 transition-all bg-base-100 text-base-content/70 cursor-pointer"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            onClick={() => handleDeleteCase(c)}
                            disabled={isTaskPreview}
                            className="p-1.5 text-base-content/40 hover:text-rose-600 transition-colors rounded-lg hover:bg-base-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Delete Incident"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-base-300 px-1.5 disabled:opacity-40"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
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
