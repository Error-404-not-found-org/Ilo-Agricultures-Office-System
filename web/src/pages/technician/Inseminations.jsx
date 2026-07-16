import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  HeartPulse,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  Syringe,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Modal from "../../components/ui/Modal";
import Topbar from "../../components/ui/Topbar";

const ITEMS_PER_PAGE = 8;

const formatDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const outcomeClass = (value) => {
  const normalized = String(value || "pending").toLowerCase();
  if (normalized === "pregnant") return "badge-success";
  if (normalized.startsWith("failed")) return "badge-error";
  return "badge-warning";
};

const statusClass = (value) => {
  const normalized = String(value || "pending").toLowerCase();
  if (["done", "completed", "resolved"].includes(normalized)) return "badge-success";
  if (["cancelled", "canceled", "declined", "rejected"].includes(normalized)) return "badge-ghost";
  if (["scheduled", "approved"].includes(normalized)) return "badge-info";
  return "badge-warning";
};

const friendlyStatus = (value) =>
  String(value || "Pending")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatSire = (breed, code) => {
  if (breed === "Not recorded" && code === "Not recorded") return "Not recorded";
  return `${breed} · ${code}`;
};

function MetricCard({ icon, value, label, note }) {
  return (
    <div className="stats border border-base-300 bg-base-100 shadow-sm">
      <div className="stat py-4">
        <div className="stat-figure text-primary">{icon}</div>
        <div className="stat-title text-xs font-semibold">{label}</div>
        <div className="stat-value text-2xl text-base-content">{value}</div>
        <div className="stat-desc text-base-content/55">{note}</div>
      </div>
    </div>
  );
}

function RecordCard({ record, onOpen }) {
  const sireLabel = formatSire(record.sireBreed, record.sireCode);

  return (
    <article className="card card-sm card-border bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="card-title text-base">Animal {record.tag}</h3>
              <span className={`badge badge-sm badge-soft ${outcomeClass(record.outcome)}`}>
                {record.outcome}
              </span>
            </div>
            <p className="mt-1 text-sm text-base-content/65">{record.farmer}</p>
          </div>
          <span className="badge badge-outline badge-sm shrink-0">Attempt {record.attempt}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-base-content/55">AI performed</dt>
            <dd className="font-semibold">{record.date}</dd>
          </div>
          <div>
            <dt className="text-xs text-base-content/55">Request status</dt>
            <dd><span className={`badge badge-xs badge-soft ${statusClass(record.status)}`}>{friendlyStatus(record.status)}</span></dd>
          </div>
          <div>
            <dt className="text-xs text-base-content/55">Sire</dt>
            <dd className="font-semibold">{sireLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-base-content/55">Estrus</dt>
            <dd className="font-semibold">{record.estrus}</dd>
          </div>
        </dl>

        {record.previousAttempt && (
          <div className="rounded-box bg-base-200 px-3 py-2 text-xs text-base-content/70">
            Linked to attempt {record.previousAttempt.attemptNumber || record.attempt - 1} from {formatDate(record.previousAttempt.inseminationDate)} · {record.previousAttempt.outcome || "Pending"}
          </div>
        )}

        <div className="card-actions justify-end border-t border-base-300 pt-3">
          <button type="button" className="btn btn-sm w-full sm:w-auto" onClick={() => onOpen(record)}>
            <Eye size={15} /> View record
          </button>
        </div>
      </div>
    </article>
  );
}

export default function InseminationLog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [estrusFilter, setEstrusFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const {
    data: inseminationPage = {},
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["technician", "inseminations-list", currentPage, searchQuery, estrusFilter, outcomeFilter],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/inseminations", {
        params: {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          estrus: estrusFilter || undefined,
          outcome: outcomeFilter || undefined,
        },
      });
      return response.data || {};
    },
    keepPreviousData: true,
  });

  const records = useMemo(() => {
    const source = inseminationPage.inseminations || inseminationPage.data || [];
    return source.map((item) => {
      const performedDate = item.inseminationDate || item.scheduledDate || item.preferredDate || item.createdAt;
      return {
        id: item._id,
        date: formatDate(performedDate),
        rawDate: performedDate,
        tag: item.animalId?.earTag || item.animalId?.animalId || "Unassigned tag",
        animal: item.animalId,
        farmer: item.farmerId?.name || "Farmer not available",
        farmerPhone: item.farmerId?.phoneNumber || "Not provided",
        sireBreed: item.sireBreed || "Not recorded",
        sireCode: item.sireCode || "Not recorded",
        estrus: item.estrus || "Not recorded",
        outcome: item.outcome || "Pending",
        status: item.status || "pending",
        technician: item.technicianId?.name || item.approvedBy?.name || "Not assigned",
        attempt: item.attemptNumber || 1,
        previousAttempt: item.previousAttemptId || null,
        verificationStatus: item.outcomeVerificationStatus || "pending",
        comment: item.comment || "",
        technicianNote: item.technicianNote || "",
      };
    });
  }, [inseminationPage]);

  const pagination = inseminationPage.pagination || {};
  const totalItems = pagination.total ?? records.length;
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);
  const summary = inseminationPage.summary || {};
  const hasFilters = Boolean(searchQuery || estrusFilter || outcomeFilter);

  const clearFilters = () => {
    setSearchQuery("");
    setEstrusFilter("");
    setOutcomeFilter("");
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headers = ["Record ID", "AI Date", "Animal Tag", "Farmer", "Sire Breed", "Sire Code", "Estrus", "Attempt", "Outcome", "Status"];
    const rows = records.map((record) => [
      record.id,
      record.date,
      record.tag,
      record.farmer,
      record.sireBreed,
      record.sireCode,
      record.estrus,
      record.attempt,
      record.outcome,
      record.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `BreedSmart_AI_Records_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-base-200 text-base-content">
      <Topbar
        title="AI Service Records"
        subtitle="Search insemination attempts, pregnancy outcomes, and linked re-insemination history"
      />

      <main className="flex-1 space-y-5 p-4 md:p-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard icon={<Syringe size={21} />} value={isLoading ? "—" : summary.totalCycles ?? totalItems} label="AI attempts recorded" note="All service history" />
          <MetricCard icon={<Sparkles size={21} />} value={isLoading ? "—" : summary.confirmedPregnant ?? 0} label="Confirmed pregnant" note="Verified outcomes" />
          <MetricCard icon={<HeartPulse size={21} />} value={isLoading ? "—" : summary.pendingChecks ?? 0} label="Awaiting outcome" note="Needs follow-up" />
        </section>

        <section className="card card-border bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="input w-full xl:max-w-md">
                <Search size={16} className="text-base-content/45" />
                <input
                  type="search"
                  value={searchQuery}
                  placeholder="Search animal tag, farmer, sire breed, or sire code"
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Search AI service records"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 xl:justify-end">
                <span className="text-sm text-base-content/60">
                  {isFetching && !isLoading ? "Updating…" : `${totalItems} record${totalItems === 1 ? "" : "s"}`}
                </span>
                <button type="button" className="btn btn-sm" onClick={handleExportCSV} disabled={isLoading || records.length === 0}>
                  <Download size={15} /> Export this page
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-3 md:flex-row md:flex-wrap md:items-center">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-base-content/55">
                <Filter size={14} /> Filters
              </span>
              <select
                className="select w-full md:w-auto"
                value={estrusFilter}
                onChange={(event) => { setEstrusFilter(event.target.value); setCurrentPage(1); }}
                aria-label="Filter by estrus type"
              >
                <option value="">All estrus types</option>
                <option value="Natural">Natural</option>
                <option value="Synchronized">Synchronized</option>
                <option value="Induced">Induced</option>
              </select>
              <select
                className="select w-full md:w-auto"
                value={outcomeFilter}
                onChange={(event) => { setOutcomeFilter(event.target.value); setCurrentPage(1); }}
                aria-label="Filter by pregnancy outcome"
              >
                <option value="">All pregnancy outcomes</option>
                <option value="Pending">Awaiting outcome</option>
                <option value="Pregnant">Pregnant</option>
                <option value="Failed (Re-heat)">Failed — returned to heat</option>
                <option value="Failed (Negative PD)">Failed — negative diagnosis</option>
                <option value="Failed (Aborted)">Failed — aborted</option>
              </select>
              {hasFilters && (
                <button type="button" className="btn btn-ghost btn-sm md:ml-auto" onClick={clearFilters}>
                  <X size={14} /> Clear filters
                </button>
              )}
            </div>

            {isError ? (
              <div role="alert" className="alert alert-error">
                <Info size={18} />
                <span>AI service records could not be loaded.</span>
                <button type="button" className="btn btn-sm" onClick={() => refetch()}><RefreshCw size={14} /> Retry</button>
              </div>
            ) : isLoading ? (
              <>
                <div className="grid gap-3 lg:hidden">
                  {[0, 1, 2].map((item) => <div key={item} className="skeleton h-52 w-full" />)}
                </div>
                <div className="hidden overflow-hidden rounded-box border border-base-300 lg:block" aria-label="Loading AI service records">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>AI date</th>
                        <th>Animal / farmer</th>
                        <th>Sire</th>
                        <th>Attempt</th>
                        <th>Outcome</th>
                        <th>Status</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <tr key={row}>
                          <td colSpan={7}>
                            <div className="grid grid-cols-[1fr_1.5fr_1.5fr_.8fr_1fr_1fr_.8fr] gap-5 py-1">
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : records.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <Syringe className="mx-auto mb-3 text-base-content/35" size={30} />
                <h2 className="font-bold">No AI service records found</h2>
                <p className="mt-1 text-sm text-base-content/60">{hasFilters ? "Try clearing or changing the filters." : "Completed and requested AI attempts will appear here."}</p>
                {hasFilters && <button type="button" className="btn btn-sm mt-4" onClick={clearFilters}>Clear filters</button>}
              </div>
            ) : (
              <>
                <div className="grid gap-3 lg:hidden">
                  {records.map((record) => <RecordCard key={record.id} record={record} onOpen={setSelectedLog} />)}
                </div>

                <div className="hidden overflow-x-auto rounded-box border border-base-300 lg:block">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>AI date</th>
                        <th>Animal / farmer</th>
                        <th>Sire</th>
                        <th>Attempt</th>
                        <th>Outcome</th>
                        <th>Status</th>
                        <th><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id} className="hover:bg-base-200">
                          <td className="whitespace-nowrap font-semibold">{record.date}</td>
                          <td>
                            <div className="font-bold">{record.tag}</div>
                            <div className="text-xs text-base-content/55">{record.farmer}</div>
                          </td>
                          <td>
                            <div className="font-semibold">{record.sireBreed}</div>
                            <div className="text-xs text-base-content/55">{record.sireCode}</div>
                          </td>
                          <td>
                            <span className="badge badge-outline badge-sm">#{record.attempt}</span>
                            {record.previousAttempt && <div className="mt-1 text-xs text-base-content/50">Linked history</div>}
                          </td>
                          <td><span className={`badge badge-sm badge-soft ${outcomeClass(record.outcome)}`}>{record.outcome}</span></td>
                          <td><span className={`badge badge-sm badge-soft ${statusClass(record.status)}`}>{friendlyStatus(record.status)}</span></td>
                          <td className="text-right">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedLog(record)}>
                              <Eye size={15} /> View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!isError && totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-base-content/55">Showing {startIndex}–{endIndex} of {totalItems}</span>
                <div className="join self-end sm:self-auto" aria-label="AI records pagination">
                  <button type="button" className="btn btn-sm join-item" aria-label="Previous page" disabled={currentPage === 1 || isFetching} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                    <ChevronLeft size={16} />
                  </button>
                  <button type="button" className="btn btn-sm join-item pointer-events-none" aria-current="page">Page {currentPage} of {totalPages}</button>
                  <button type="button" className="btn btn-sm join-item" aria-label="Next page" disabled={currentPage === totalPages || isFetching} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `AI attempt #${selectedLog.attempt} · ${selectedLog.tag}` : "AI service record"}
        size="lg"
        actions={<button type="button" className="btn btn-sm" onClick={() => setSelectedLog(null)}>Close record</button>}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className={`badge badge-soft ${outcomeClass(selectedLog.outcome)}`}>{selectedLog.outcome}</span>
              <span className={`badge badge-soft ${statusClass(selectedLog.status)}`}>{friendlyStatus(selectedLog.status)}</span>
              <span className="badge badge-outline">Verification: {friendlyStatus(selectedLog.verificationStatus)}</span>
            </div>

            <dl className="grid gap-3 rounded-box border border-base-300 bg-base-200 p-4 sm:grid-cols-2">
              {[
                ["AI performed", selectedLog.date],
                ["Farmer", selectedLog.farmer],
                ["Farmer phone", selectedLog.farmerPhone],
                ["Animal", selectedLog.tag],
                ["Sire genetics", formatSire(selectedLog.sireBreed, selectedLog.sireCode)],
                ["Estrus method", selectedLog.estrus],
                ["Attending technician", selectedLog.technician],
                ["Record ID", selectedLog.id],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-base-content/55">{label}</dt>
                  <dd className="wrap-break-word font-semibold text-base-content">{value}</dd>
                </div>
              ))}
            </dl>

            {selectedLog.previousAttempt && (
              <section className="rounded-box border border-info/25 bg-info/10 p-4">
                <h4 className="font-bold text-base-content">Linked previous attempt</h4>
                <p className="mt-1 text-sm text-base-content/70">
                  Attempt #{selectedLog.previousAttempt.attemptNumber || selectedLog.attempt - 1} was performed on {formatDate(selectedLog.previousAttempt.inseminationDate)}. Its verified outcome is {selectedLog.previousAttempt.outcome || "not recorded"}.
                </p>
              </section>
            )}

            <section className="space-y-2">
              <h4 className="font-bold text-base-content">Field notes</h4>
              <p className="rounded-box bg-base-200 p-3 text-sm">Farmer: {selectedLog.comment || "No farmer note recorded."}</p>
              <p className="rounded-box bg-base-200 p-3 text-sm">Technician: {selectedLog.technicianNote || "No technician observation recorded."}</p>
            </section>

            <div role="note" className="alert">
              <Info size={17} />
              <span>AI history is preserved so later pregnancy checks and re-insemination attempts remain traceable.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
