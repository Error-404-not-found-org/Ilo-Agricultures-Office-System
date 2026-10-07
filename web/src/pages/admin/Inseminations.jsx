import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import Modal from "../../components/ui/Modal";
import {

  Syringe,
  Sparkles,
  HeartPulse,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import TableNameLink from "../../components/ui/TableNameLink";

function RecordValue({ label, children }) {
  return (
    <div className="rounded-xl border border-base-200 bg-base-100 p-3">
      <dt className="block text-[10px] font-semibold uppercase text-base-content/60">{label}</dt>
      <dd className="mt-0.5 wrap-break-word text-xs font-bold text-base-content">{children}</dd>
    </div>
  );
}

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
  const summary = useMemo(() => inseminationPage.summary || {}, [inseminationPage]);

  // ---- DYNAMIC DATA PROCESSING AND MAPPING ----
  const processedLogs = useMemo(() => {
    return inseminations.map(ins => {
      const visitDate = ins.inseminationDate;
      const parsedDate = visitDate ? new Date(visitDate) : null;
      return {
        id: ins._id,
        date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not recorded",
        rawDate: visitDate,
        animalId: ins.animalId?._id || ins.animalId?.id || null,
        tag: ins.animalId?.earTag || "Not recorded",
        farmer: ins.farmerId?.name || "Not recorded",
        sireBreed: ins.sireBreed || "Not recorded",
        sireCode: ins.sireCode || "Not recorded",
        estrus: ins.estrus || "Not recorded",
        pdResult: ins.outcome || "Not recorded",
        tech: ins.technicianId?.name || ins.approvedBy?.name || (ins.technicianId || ins.approvedBy ? "Name unavailable" : "Technician not recorded"),
        attempt: ins.attemptNumber,
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


  return (
    <div className="flex h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content transition-colors duration-300">
      <Topbar
        title="Insemination Records"
        subtitle="Artificial Insemination registers, bloodlines, and pregnancy diagnosis status tracker"
      />

      <main className="p-6 space-y-5 flex-1 flex flex-col min-h-0">
        {/* Dynamic Metric Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-base-100 border-0 border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-primary bg-primary/10">
              <Syringe size={16} />
            </div>
            <div>
              <div className="text-xl font-black">{isLoading ? "..." : totalRecords}</div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                AI Records
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-success shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-success bg-success/10">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : summary.pregnant ?? "Not available"}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Pregnant Outcomes
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-info shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-info bg-info/10">
              <HeartPulse size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : summary.pending ?? "Not available"}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Pending Outcomes
              </div>
            </div>
          </div>
          <div className="bg-base-100 border-0 border-l-4 border-error shadow-sm hover:shadow-md transition-shadow p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl shrink-0 text-error bg-error/10">
              <X size={16} />
            </div>
            <div>
              <div className="text-xl font-black">
                {isLoading ? "..." : summary.failed ?? "Not available"}
              </div>
              <div className="text-[10px] font-bold uppercase text-base-content/80 tracking-wider">
                Failed Outcomes
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <label className="input input-bordered flex items-center gap-2 w-full sm:max-w-md rounded-xl bg-base-100 shadow-sm transition-colors">
          <Search size={16} className="text-base-content/50" aria-hidden="true" />
          <input
            type="search"
            className="grow"
            placeholder="Search tag, farmer, sire..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Search records"
          />
        </label>

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
              aria-label="Filter inseminations by cycle outcome"
              value={pResultFilter}
              onChange={(e) => {
                setPResultFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All Cycle Outcomes</option>
              <option value="Pending">Pending</option>
              <option value="Pregnant">Pregnant</option>
              <option value="Failed (Re-heat)">Failed (Re-heat)</option>
              <option value="Failed (Aborted)">Failed (Aborted)</option>
              <option value="Failed (Negative PD)">Failed (Negative PD)</option>
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
                  <th className="p-3.5">AI Service Date</th>
                  <th className="p-3.5">Livestock Tag</th>
                  <th className="p-3.5">Farmer Client</th>
                  <th className="p-3.5">Sire Genetics</th>
                  <th className="p-3.5">Estrus Type</th>
                  <th className="p-3.5 text-center">Cycle Outcome</th>
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
                              : l.pdResult === "Pending"
                                ? "badge-info"
                                : l.pdResult.startsWith("Failed")
                                  ? "badge-error"
                                  : "badge-neutral"
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

      {/* Read-only record viewer */}
      {selectedLog && (
        <Modal
          isOpen
          onClose={() => setSelectedLog(null)}
          title="Insemination Record"
          subtitle="Read-only official service record"
          icon={<Syringe size={20} className="text-primary" aria-hidden="true" />}
          size="xl"
          closeOnEscape
          closeOnBackdropClick
          actions={<button type="button" className="btn btn-sm" onClick={() => setSelectedLog(null)}>Close</button>}
        >
          <div className="space-y-5 py-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-primary">Animal Details</h4>
                <p className="wrap-break-word text-sm font-bold text-base-content">{selectedLog.tag}</p>
              </section>
              <section className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-primary">Farmer</h4>
                <p className="wrap-break-word text-sm font-bold text-base-content">{selectedLog.farmer}</p>
              </section>
            </div>

            <section className="space-y-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Official Service Details</h4>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RecordValue label="Service Date">{selectedLog.date}</RecordValue>
                <RecordValue label="Outcome">{selectedLog.pdResult}</RecordValue>
                <RecordValue label="Sire Breed">{selectedLog.sireBreed}</RecordValue>
                <RecordValue label="Sire Code">{selectedLog.sireCode}</RecordValue>
                <RecordValue label="Estrus Type">{selectedLog.estrus}</RecordValue>
                <RecordValue label="Attempt Number">{selectedLog.attempt == null ? "Not recorded" : `Attempt #${selectedLog.attempt}`}</RecordValue>
              </dl>
            </section>

            <section className="space-y-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
              <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary">Technician / Notes</h4>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RecordValue label="Attending Tech">{selectedLog.tech}</RecordValue>
              </dl>
              <div className="space-y-2.5">
                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-base-content/60">Technician Notes</span>
                  <p className="rounded-xl border border-base-200 bg-base-100 p-3 text-xs font-medium leading-relaxed text-base-content">{selectedLog.technicianNote || "No notes provided"}</p>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-base-content/60">Farmer Observations</span>
                  <p className="rounded-xl border border-base-200 bg-base-100 p-3 text-xs font-medium leading-relaxed text-base-content">{selectedLog.comment || "No observations reported"}</p>
                </div>
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
