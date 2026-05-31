import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/Skeleton";
import {
  Search,
  Download,
  Syringe,
  Sparkles,
  HeartPulse,
  X,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import Topbar from "../../components/ui/Topbar";

export default function Inseminations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [estrusFilter, setEstrusFilter] = useState("");
  const [pResultFilter, setPResultFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const itemsPerPage = 10;

  // ---- DYNAMIC DATA PIPELINE ----
  const { data: inseminations = [], isLoading } = useQuery({
    queryKey: ["admin", "inseminations-list-all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/inseminations?limit=1000");
      return res.data?.inseminations || [];
    }
  });

  // ---- DYNAMIC DATA PROCESSING AND MAPPING ----
  const processedLogs = useMemo(() => {
    return inseminations.map(ins => {
      const visitDate = ins.scheduledDate || ins.preferredDate || ins.createdAt;
      return {
        id: ins._id,
        date: new Date(visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        rawDate: visitDate,
        tag: ins.animalId?.earTag || "N/A",
        farmer: ins.farmerId?.name || "N/A",
        sireBreed: ins.sireBreed || "N/A",
        sireCode: ins.sireCode || "N/A",
        estrus: ins.estrus || "Natural",
        pdResult: ins.outcome || "Pending",
        tech: ins.technicianId?.name || "Juan dela Cruz",
        attempt: ins.attemptNumber || 1,
        comment: ins.comment || "",
        technicianNote: ins.technicianNote || ""
      };
    });
  }, [inseminations]);

  // ---- FILTER ENGINE ----
  const filteredLogs = useMemo(() => {
    return processedLogs.filter((l) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        l.farmer.toLowerCase().includes(q) ||
        l.tag.toLowerCase().includes(q) ||
        l.sireBreed.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q);
      const matchesEstrus = !estrusFilter || l.estrus === estrusFilter;
      const matchesPD = !pResultFilter || l.pdResult === pResultFilter;
      return matchesSearch && matchesEstrus && matchesPD;
    });
  }, [searchQuery, estrusFilter, pResultFilter, processedLogs]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(
    startIndex,
    startIndex + itemsPerPage,
  );
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;

  // ---- REAL EXPORTER TO CSV ----
  const handleExportCSV = () => {
    const headers = [
      "Registry ID",
      "Date Run",
      "Livestock Tag",
      "Farmer Client",
      "Sire Genetics",
      "Sire Code",
      "Estrus Type",
      "Attempt Number",
      "PD Result"
    ];
    
    const rows = filteredLogs.map((l) => [
      l.id,
      l.date,
      l.tag,
      l.farmer,
      l.sireBreed,
      l.sireCode,
      l.estrus,
      l.attempt,
      l.pdResult
    ]);
    
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BreedSmart_Municipal_Inseminations_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Topbar
        title="Municipal Inseminations"
        subtitle="Artificial Insemination registers, bloodlines, and pregnancy diagnosis status tracker"
        searchPlaceholder="Search tag, farmer, sire..."
        searchValue={searchQuery}
        onSearchChange={(e) => {
          setSearchQuery(e.target.value);
          setCurrentPage(1);
        }}
      >
        <button
          onClick={handleExportCSV}
          disabled={isLoading || filteredLogs.length === 0}
          className="btn btn-sm bg-[#00643b] hover:bg-[#004d2e] disabled:opacity-50 text-white border-none text-xs font-bold gap-1.5 rounded-xl px-4 cursor-pointer animate-fade-in"
        >
          <Download size={13} /> Export CSV
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-[#00643b] bg-emerald-50 dark:bg-emerald-950/20">
              <Syringe size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : processedLogs.length}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Total AI Cycles Run
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-purple-600 bg-purple-50 dark:bg-purple-950/20">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => l.pdResult === "Pregnant").length}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Confirmed Conceptions
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl flex items-center gap-3 shadow-xs">
            <div className="p-2.5 rounded-xl shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/20">
              <HeartPulse size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => l.pdResult === "Pending" || l.pdResult === "pending").length}
              </div>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Pending Palpation Checks
              </div>
            </div>
          </div>
        </div>

        {/* Filter Ribbon and Table */}
        <div className="card bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wide px-1">
              <Filter size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
              value={estrusFilter}
              onChange={(e) => {
                setEstrusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Estrus Types</option>
              <option value="Natural">Natural Cycle</option>
              <option value="Synchronized">Synchronized Window</option>
            </select>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-slate-100/80! dark:bg-slate-900/50! border-slate-200 dark:border-slate-800 focus:bg-white! dark:focus:bg-slate-950! focus:border-[#00643b] dark:focus:border-emerald-500 text-slate-700 dark:text-slate-200 outline-none transition-all duration-200"
              value={pResultFilter}
              onChange={(e) => {
                setPResultFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Diagnostics Results</option>
              <option value="Pending">Pending Check</option>
              <option value="Pregnant">Pregnant (Verified)</option>
              <option value="Empty">Open (Failed cycle)</option>
            </select>

            <span className="text-xs text-slate-400 font-semibold ml-auto whitespace-nowrap px-1">
              {isLoading ? "Fetching entries..." : `${filteredLogs.length} cycle${filteredLogs.length !== 1 ? "s" : ""} matched`}
            </span>
          </div>

          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[11px] font-bold uppercase tracking-wider select-none">
                  <th className="p-3.5 pl-5">Registry ID</th>
                  <th className="p-3.5">Date Run</th>
                  <th className="p-3.5">Livestock Tag</th>
                  <th className="p-3.5">Farmer Client</th>
                  <th className="p-3.5">Sire Genetics</th>
                  <th className="p-3.5">Estrus Type</th>
                  <th className="p-3.5 text-center">PD Result</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-12 text-slate-400 dark:text-slate-500 font-medium">
                      No matching insemination cycles found.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedLog(l)}
                    >
                      <td className="p-3.5 pl-5 font-bold text-slate-400">
                        #{l.id.slice(-6)}
                      </td>
                      <td className="p-3.5 font-medium">{l.date}</td>
                      <td className="p-3.5 font-extrabold text-[#00643b] dark:text-[#10b981]">
                        {l.tag}
                      </td>
                      <td className="p-3.5 font-bold">{l.farmer}</td>
                      <td className="p-3.5 font-medium">
                        {l.sireBreed}{" "}
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({l.sireCode})
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="badge badge-outline border-slate-200 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                          {l.estrus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            l.pdResult === "Pregnant"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : l.pdResult === "Pending" || l.pdResult === "pending"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}
                        >
                          {l.pdResult}
                        </span>
                      </td>
                      <td
                        className="p-3.5 pr-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setSelectedLog(l)}
                          className="px-2.5 py-1 text-[11px] font-extrabold rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#00643b] hover:text-[#00643b] flex items-center gap-1 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 transition-all cursor-pointer"
                        >
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between mt-3">
              <span className="text-[11px] font-medium text-slate-400">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} cycles
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
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
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn btn-xs btn-outline border-slate-200 dark:border-slate-800 px-1.5 disabled:opacity-40"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal Component */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="card w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
              <h3 className="text-sm font-black uppercase text-slate-400">
                Breeding Record Inspection
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-xs btn-ghost btn-circle text-slate-400 hover:text-rose-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-900 text-xs">
              {[
                { k: "Log Code Reference", v: selectedLog.id },
                { k: "Date Administered", v: selectedLog.date },
                {
                  k: "Animal Ear Tag",
                  v: selectedLog.tag,
                  s: "text-[#00643b] font-black",
                },
                { k: "Livestock Owner", v: selectedLog.farmer },
                {
                  k: "Sire Genetics Details",
                  v: `${selectedLog.sireBreed} [${selectedLog.sireCode}]`,
                },
                { k: "Cycle Trigger Method", v: selectedLog.estrus },
                { k: "Attempt Number", v: `Attempt #${selectedLog.attempt}` },
                {
                  k: "Pregnancy Diagnosis Result",
                  v: selectedLog.pdResult,
                  s: "font-extrabold uppercase",
                },
                { k: "Attending Professional", v: selectedLog.tech },
                { k: "Farmer Notes", v: selectedLog.comment || "None", s: "italic text-slate-500" },
                { k: "Technician Observations", v: selectedLog.technicianNote || "None", s: "italic text-[#00643b] dark:text-emerald-400" },
              ].map((row, index) => (
                <div key={index} className="flex justify-between py-2.5">
                  <span className="text-slate-400 font-semibold text-left">{row.k}</span>
                  <span
                    className={`font-bold text-slate-800 dark:text-slate-200 text-right ${row.s || ""}`}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
              <Info size={14} className="text-[#00643b] shrink-0" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Historical breeding records immutable unless authorized.
              </p>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="btn btn-sm w-full border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold mt-2 cursor-pointer"
            >
              Close Inspection Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
