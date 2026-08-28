import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import {
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
import Topbar from "../../components/layout/Topbar";
import TableNameLink from "../../components/ui/TableNameLink";

export default function Inseminations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [estrusFilter, setEstrusFilter] = useState("");
  const [pResultFilter, setPResultFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const itemsPerPage = 10;

  // ---- DYNAMIC DATA PIPELINE ----
  const { data: inseminationPage = {}, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "inseminations-list-all", currentPage, searchQuery, estrusFilter, pResultFilter],
    queryFn: async () => {
      const res = await axiosInstance.get("/admin/inseminations", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery || undefined,
          estrus: estrusFilter || undefined,
          outcome: pResultFilter || undefined,
        },
      });
      return res.data || {};
    },
    keepPreviousData: true,
  });
  const inseminations = useMemo(() => inseminationPage.inseminations || inseminationPage.data || [], [inseminationPage]);

  // ---- DYNAMIC DATA PROCESSING AND MAPPING ----
  const processedLogs = useMemo(() => {
    return inseminations.map(ins => {
      const visitDate = ins.scheduledDate || ins.preferredDate || ins.createdAt;
      return {
        id: ins._id,
        date: new Date(visitDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        rawDate: visitDate,
        animalId: ins.animalId?._id || ins.animalId?.id || null,
        tag: ins.animalId?.earTag || "Not recorded",
        farmer: ins.farmerId?.name || "Not recorded",
        sireBreed: ins.sireBreed || "Not recorded",
        sireCode: ins.sireCode || "Not recorded",
        estrus: ins.estrus || "Not recorded",
        pdResult: ins.outcome || "Pending",
        tech: ins.technicianId?.name || ins.approvedBy?.name || "Technician not recorded",
        attempt: ins.attemptNumber ?? "Not recorded",
        comment: ins.comment || "",
        technicianNote: ins.technicianNote || ""
      };
    });
  }, [inseminations]);

  // ---- FILTER ENGINE ----
  const filteredLogs = useMemo(() => {
    return processedLogs;
  }, [processedLogs]);

  // ---- PAGINATION COMPUTATION ----
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs;
  const totalPages = inseminationPage.totalPages || inseminationPage.pagination?.totalPages || Math.ceil((inseminationPage.total || inseminationPage.pagination?.total || filteredLogs.length) / itemsPerPage) || 1;
  const totalRecords = inseminationPage.total || inseminationPage.pagination?.total || filteredLogs.length;

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
      headers.join(",") +
      "\n" +
      rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `BreedSmart_Municipal_Inseminations_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
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
          className="btn btn-primary btn-sm gap-1.5 px-4 text-xs font-bold"
        >
          <Download size={13} /> Export CSV
        </button>
      </Topbar>

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-base-100 border-0 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <Syringe size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : totalRecords}</div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Total AI Cycles Run
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-success shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-success bg-success/10">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => l.pdResult === "Pregnant").length}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Pregnant on This Page
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-info shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-info bg-info/10">
              <HeartPulse size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : processedLogs.filter((l) => l.pdResult === "Pending" || l.pdResult === "pending").length}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Pending on This Page
              </div>
            </div>
          </div>
        </div>

        {/* Filter Ribbon and Table */}
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-5 shadow-xs flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap mb-4 bg-base-200 p-2.5 rounded-xl border border-base-300/60">
            <div className="flex items-center gap-1.5 text-xs text-base-content/80 font-bold uppercase tracking-wide px-1">
              <Filter size={13} />
              <span>Filters:</span>
            </div>
            <select
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200! border-base-300 focus:bg-base-100! focus:border-primary text-base-content/75 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-200"
              aria-label="Filter inseminations by estrus type"
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
              className="select select-bordered select-sm text-xs rounded-xl bg-base-200! border-base-300 focus:bg-base-100! focus:border-primary text-base-content/75 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all duration-200"
              aria-label="Filter inseminations by pregnancy result"
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

            <span className="ml-auto whitespace-nowrap px-1 text-xs font-semibold text-base-content/80">
              {isLoading ? "Fetching entries..." : `${filteredLogs.length} cycle${filteredLogs.length !== 1 ? "s" : ""} matched`}
            </span>
          </div>

          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="table w-full border-collapse" aria-label="Municipal insemination records">
              <thead>
                <tr className="select-none border-b border-base-300 bg-base-200 text-[11px] font-bold uppercase tracking-wider text-base-content/80">
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
              <tbody className="divide-y divide-base-300 text-xs">
                {isLoading ? (
                  [...Array(6)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : isError ? (
                  <tr>
                    <td colSpan={8} className="p-6">
                      <div role="alert" className="alert alert-error">
                        <span>Insemination records could not be loaded.</span>
                        <button type="button" className="btn btn-sm" onClick={() => refetch()}>Retry</button>
                      </div>
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center font-medium text-base-content/80">
                      No matching insemination cycles found.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((l) => (
                    <tr key={l.id} className="hover:bg-base-content/5 transition-colors cursor-pointer" onClick={() => setSelectedLog(l)}>
                      <td className="p-3.5 pl-5 font-bold text-base-content/80">
                        #{l.id.slice(-6)}
                      </td>
                      <td className="p-3.5 font-medium">{l.date}</td>
                      <td className="p-3.5">
                        {l.animalId ? (
                          <TableNameLink
                            to={`/admin/livestock/${l.animalId}`}
                            ariaLabel={`Open livestock profile for animal ${l.tag}`}
                          >
                            {l.tag}
                          </TableNameLink>
                        ) : (
                          <span className="font-extrabold text-base-content">{l.tag}</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold">{l.farmer}</td>
                      <td className="p-3.5 font-medium">
                        {l.sireBreed}{" "}
                        <span className="font-mono text-[11px] text-base-content/80">
                          ({l.sireCode})
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="badge badge-outline text-[10px] font-semibold text-base-content/90">
                          {l.estrus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`badge badge-sm badge-soft text-[10px] font-bold uppercase tracking-wider ${
                            l.pdResult === "Pregnant"
                              ? "badge-success"
                              : l.pdResult === "Pending" || l.pdResult === "pending"
                                ? "badge-info"
                                : "badge-error"
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
                          type="button"
                          onClick={() => setSelectedLog(l)}
                          className="btn btn-outline btn-xs text-[11px] font-extrabold"
                          aria-label={`View insemination record ${l.id.slice(-6)}`}
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
            <div className="mt-3 flex items-center justify-between border-t border-base-300 pt-4">
              <span className="text-[11px] font-medium text-base-content/80">
                Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} cycles
              </span>
              <div className="join" aria-label="Insemination records pagination">
                <button
                  type="button"
                  aria-label="Previous insemination page"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-sm join-item"
                >
                  <ChevronLeft size={12} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                  <button
                    type="button"
                    key={pageNumber}
                    aria-label={`Go to insemination page ${pageNumber}`}
                    aria-current={currentPage === pageNumber ? "page" : undefined}
                    disabled={isLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`btn btn-sm join-item text-[11px] font-bold ${
                      currentPage === pageNumber
                        ? "btn-primary"
                        : ""
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Next insemination page"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isLoading}
                  className="btn btn-sm join-item"
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
            className="card w-full max-w-md bg-base-100 border border-base-300 p-6 rounded-2xl shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-base-300 pb-2">
              <h3 className="text-sm font-black uppercase text-base-content/50">
                Breeding Record Inspection
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-xs btn-ghost btn-circle text-base-content/50 hover:text-error"
              >
                <X size={16} />
              </button>
            </div>
            <div className="divide-y divide-base-300 text-xs">
              {[
                { k: "Log Code Reference", v: selectedLog.id },
                { k: "Date Administered", v: selectedLog.date },
                {
                  k: "Animal Ear Tag",
                  v: selectedLog.tag,
                  s: "text-primary font-black",
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
                { k: "Farmer Notes", v: selectedLog.comment || "None", s: "italic text-base-content/80" },
                { k: "Technician Observations", v: selectedLog.technicianNote || "None", s: "italic text-primary" },
              ].map((row, index) => (
                <div key={index} className="flex justify-between py-2.5">
                  <span className="text-base-content/80 font-semibold text-left">{row.k}</span>
                  <span
                    className={`font-bold text-base-content text-right ${row.s || ""}`}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-base-200 p-3 rounded-xl border border-base-300/80">
              <Info size={14} className="text-primary shrink-0" />
              <p className="text-[10px] text-base-content/80 font-bold uppercase tracking-wider">
                Historical breeding records immutable unless authorized.
              </p>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="btn btn-sm w-full border-base-300 rounded-xl text-xs font-bold mt-2 cursor-pointer"
            >
              Close Inspection Panel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
