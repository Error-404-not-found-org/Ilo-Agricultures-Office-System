import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  Search,
  Download,
  Stethoscope,
  AlertTriangle,
  ShieldCheck,
  Filter,
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

export default function HealthLog() {
  const toast = useToast();

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
  const { data: rawCases = [], isLoading, refetch } = useQuery({
    queryKey: ["technician", "health-requests-list"],
    queryFn: async () => {
      const res = await axiosInstance.get("/health-request");
      return res.data || [];
    }
  });

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

    // Apply text search queries
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.farmer.toLowerCase().includes(q) ||
        c.tag.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.symptoms.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }

    // Apply urgency level filters
    if (urgencyFilter) {
      result = result.filter((c) => c.urgency === urgencyFilter);
    }

    // Apply status filters
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Sort chronologically by rawDate
    return result.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
  }, [rawCases, searchQuery, urgencyFilter, statusFilter]);

  // ---- PAGINATION COMPUTATION ----
  const totalItems = filteredCases.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = filteredCases.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

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
        } catch (err) {
          toast.error("Failed to remove incident entry.");
        }
      }
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredCases.length === 0) {
      toast.error("No entries available to export.");
      return;
    }
    const headers = ["Incident Case #", "Logged Date", "Animal Tag", "Farmer Client", "Symptom Presentation", "Assigned Diagnosis", "Treatment Plan", "Urgency", "Status"];
    const rows = filteredCases.map(c => [
      c.id,
      c.date,
      c.farmer,
      c.tag,
      c.symptoms,
      c.diagnosis,
      c.treatment,
      c.urgency.toUpperCase(),
      c.status.toUpperCase()
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BreedSmart_Health_Diagnostics_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Health & Diagnostics Ledger"
        subtitle="Triage dashboard tracking livestock symptoms, medication regimes, and clinical response dispatches"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Metric Grid Display */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
              <Stethoscope size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : metrics.total}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total Diagnostic Incidents
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-rose-600 bg-rose-50 dark:bg-rose-950/20">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : metrics.highUrgency}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Active High-Priority Dispatches
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : metrics.closed}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Cases Evaluated and Closed
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Datatable */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Actions Row */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="relative w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search tag, diagnostic notes, farmer..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-[#00643b] dark:focus:ring-emerald-500 outline-none transition-all duration-200"
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
                className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] text-white border-none text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer"
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                onClick={() => window.print()}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 text-xs font-bold gap-1.5 rounded-xl px-4 text-slate-500 dark:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <Printer size={13} /> Print
              </button>
              <span className="text-xs text-slate-400 font-semibold border-l border-slate-200 dark:border-slate-800 pl-2.5 whitespace-nowrap">
                {isLoading ? "Fetching data..." : `${totalItems} incident${totalItems !== 1 ? "s" : ""} matched`}
              </span>
            </div>
          </div>

          {/* Filter Ribbon */}
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <SlidersHorizontal size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
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
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
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
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedCases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={12}
                      className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium"
                    >
                      No matching historical diagnostic records found.
                    </td>
                  </tr>
                ) : (
                  paginatedCases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedCase(c)}
                    >
                      <td className="p-3.5 pl-5 font-bold text-slate-400 truncate max-w-[80px]">
                        #{c.id.slice(-6)}
                      </td>
                      <td className="p-3.5 font-medium whitespace-nowrap">
                        {c.date}
                      </td>
                      <td className="p-3.5 font-extrabold text-[#00643b] dark:text-[#10b981]">
                        {c.tag}
                      </td>
                      <td className="p-3.5 font-bold">{c.farmer}</td>
                      <td className="p-3.5 max-w-[180px] truncate font-medium text-slate-500">
                        {c.symptoms}
                      </td>
                      <td className="p-3.5 font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                        {c.diagnosis}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                            c.urgency === "high"
                              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400"
                              : c.urgency === "medium"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
                                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                          }`}
                        >
                          {c.urgency}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${
                            c.status === "resolved" || c.status === "done"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : c.status === "in-progress"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400"
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
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-800 hover:text-[#00643b] dark:hover:border-emerald-600 flex items-center gap-1 transition-all bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 cursor-pointer"
                          >
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            onClick={() => handleDeleteCase(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
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
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              health dispatches
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
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
                        ? "bg-[#00643b] text-white shadow-xs"
                        : "border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
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
                className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
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
            className="card w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
              <h3 className="text-xs font-black uppercase text-slate-400">
                Clinical Incident profile
              </h3>
              <button
                onClick={() => setSelectedCase(null)}
                className="btn btn-xs btn-ghost btn-circle text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-900 text-xs">
              {[
                { k: "Incident Case #", v: selectedCase.id },
                { k: "Dispatch Date", v: selectedCase.date },
                {
                  k: "Animal Unit Tag",
                  v: selectedCase.tag,
                  s: "text-[#00643b] font-black",
                },
                { k: "Livestock Owner", v: selectedCase.farmer },
                {
                  k: "Symptom Presentation",
                  v: selectedCase.symptoms,
                  s: "text-slate-500 font-medium",
                },
                {
                  k: "Primary Medical Verdict",
                  v: selectedCase.diagnosis,
                  s: "text-amber-700 dark:text-amber-400 font-bold",
                },
                {
                  k: "Treatment Regimen Plan",
                  v: selectedCase.treatment,
                  s: "text-[#00643b] dark:text-emerald-400 font-bold",
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
                  s: "italic text-slate-500",
                },
              ].map((row, index) => (
                <div key={index} className="flex justify-between py-2.5 gap-4">
                  <span className="text-slate-400 font-semibold shrink-0">
                    {row.k}
                  </span>
                  <span
                    className={`text-right text-slate-800 dark:text-slate-200 ${row.s || ""}`}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <Info size={14} className="text-[#00643b] shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Clinical records managed under safety guidelines.
              </p>
            </div>

            <button
              onClick={() => setSelectedCase(null)}
              className="btn btn-sm w-full border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold mt-2"
            >
              Dismiss Diagnosis Panel
            </button>
          </div>
        </div>
      )}

      {/* ===== CUSTOM MODERN CONFIRMATION DIALOG ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in animate-duration-200">
          <div className="card w-full max-w-sm bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-extrabold text-[10px] tracking-widest uppercase">
              <span>{confirmModal.title || "Confirm Deletion"}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-bold leading-relaxed pr-2">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
                className="btn btn-sm btn-outline border-slate-200 dark:border-slate-800 rounded-xl px-4 text-xs font-bold cursor-pointer text-slate-500 dark:text-slate-400"
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
