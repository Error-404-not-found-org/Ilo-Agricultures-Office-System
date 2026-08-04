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
  MoreVertical,
  X,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Modal from "../../components/ui/Modal";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TableNameLink from "../../components/ui/TableNameLink";

const ITEMS_PER_PAGE = 8;

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
  if (["done", "completed", "approved", "resolved", "yes", "inseminated"].includes(normalized)) return "badge-success";
  if (["no", "failed", "rejected", "declined"].includes(normalized)) return "badge-error";
  if (["cancelled", "canceled"].includes(normalized)) return "badge-ghost";
  return "badge-warning";
};

const friendlyStatus = (value) => {
  const normalized = String(value || "pending").toLowerCase();
  if (["done", "completed", "approved", "resolved", "yes", "inseminated"].includes(normalized)) return "Yes";
  if (["no", "failed", "rejected", "declined"].includes(normalized)) return "No";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelled";
  if (["pending", "scheduled"].includes(normalized)) return "Pending";
  return String(value || "Pending")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

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
            <dt className="text-xs text-base-content/55">Inseminated</dt>
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
        animalId: item.animalId?._id || item.animalId?.id || null,
        farmerId: item.farmerId?._id || item.farmerId?.id || null,
        farmer: item.farmerId?.name || "Farmer not available",
        farmerImageUrl: item.farmerId?.imageUrl || null,
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
    const headers = ["Record ID", "AI Date", "Animal Tag", "Farmer", "Sire Breed", "Sire Code", "Estrus", "Attempt", "Outcome", "Inseminated"];
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
                        <th>Inseminated</th>
                        <th className="text-right">Actions</th>
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
                  <table className="table table-pin-rows w-full text-left min-w-[1000px]">
                    <thead>
                      <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-6">Animal</th>
                        <th className="p-3.5">Visit</th>
                        <th className="p-3.5">Schedule</th>
                        <th className="p-3.5">Outcome</th>
                        <th className="p-3.5">Inseminated</th>
                        <th className="p-3.5 pr-6 text-right w-[100px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {records.map((record) => {
                        const sched = formatRelativeSchedule(record.date);
                        return (
                          <tr key={record.id} className="hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85">

                            {/* 1. ANIMAL */}
                            <td className="p-3.5 pl-6">
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  name={record.farmer}
                                  imageUrl={record.farmerImageUrl}
                                  size={36}
                                  sizeClass="h-9 w-9"
                                />
                                <div>
                                  {record.animalId ? (
                                    <TableNameLink
                                      to={`/technician/animals/${record.animalId}`}
                                      ariaLabel={`Open livestock profile for animal ${record.tag}`}
                                    >
                                      {record.tag}
                                    </TableNameLink>
                                  ) : (
                                    <span className="block text-sm font-extrabold leading-tight text-base-content">
                                      {record.tag}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                    {record.farmer}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 2. VISIT (Attempt + Sire details) */}
                            <td className="p-3.5">
                              <span className="font-extrabold text-xs text-base-content block leading-tight">
                                Attempt #{record.attempt}
                              </span>
                              <span className="text-[10px] text-base-content/55 block mt-0.5 max-w-[150px] truncate">
                                {record.sireBreed} · {record.sireCode}
                              </span>
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

                            {/* 4. OUTCOME */}
                            <td className="p-3.5">
                              <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${outcomeClass(record.outcome)}`}>
                                {record.outcome}
                              </span>
                            </td>

                            {/* 5. STATUS */}
                            <td className="p-3.5">
                              <span className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${statusClass(record.status)}`}>
                                {friendlyStatus(record.status)}
                              </span>
                            </td>

                            {/* 6. ACTIONS */}
                            <td className="p-3.5 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <button
                                  type="button"
                                  popoverTarget={`insemination-actions-${record.id}`}
                                  style={{ anchorName: `--insemination-actions-${record.id}` }}
                                  className="btn btn-ghost btn-circle btn-xs hover:bg-base-200"
                                  aria-label={`Actions for record ${record.id}`}
                                  aria-haspopup="menu"
                                >
                                  <MoreVertical size={16} className="text-base-content/60" />
                                </button>
                                <ul
                                  id={`insemination-actions-${record.id}`}
                                  popover="auto"
                                  role="menu"
                                  aria-label={`Actions for record ${record.id}`}
                                  style={{ positionAnchor: `--insemination-actions-${record.id}` }}
                                  className="dropdown dropdown-end menu menu-sm w-44 rounded-box border border-base-300 bg-base-100 p-2 text-base-content shadow-xl"
                                >
                                  <li role="none">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={(event) => {
                                        event.currentTarget.closest("[popover]")?.hidePopover?.();
                                        setSelectedLog(record);
                                      }}
                                      className="text-xs font-extrabold"
                                    >
                                      <Eye size={13} className="mr-1" /> View Details
                                    </button>
                                  </li>
                                </ul>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
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
        size="4xl"
        actions={<button type="button" className="btn btn-md btn-primary text-white font-bold rounded-2xl px-6" onClick={() => setSelectedLog(null)}>Close record</button>}
      >
        {selectedLog && (
          <div className="space-y-5 p-1 sm:p-2">
            <div className="flex flex-wrap gap-2.5">
              <span className={`badge badge-lg font-bold ${outcomeClass(selectedLog.outcome)}`}>Outcome: {selectedLog.outcome}</span>
              <span className={`badge badge-lg font-bold ${statusClass(selectedLog.status)}`}>Inseminated: {friendlyStatus(selectedLog.status)}</span>
              <span className="badge badge-lg badge-outline font-semibold">Verification: {friendlyStatus(selectedLog.verificationStatus)}</span>
            </div>

            {/* Expanded Single Container Box with 2 Columns */}
            <div className="rounded-3xl border border-base-300 bg-base-200/50 p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Column 1: Animal & Farmer Details */}
                <div className="space-y-4.5 pr-0 md:pr-6 md:border-r md:border-base-300">
                  <div className="flex items-center gap-3 pb-3 border-b border-base-300/70">
                    <UserAvatar name={selectedLog.farmer} imageUrl={selectedLog.farmerImageUrl} size={36} sizeClass="h-9 w-9" />
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-base-content/70">
                        Animal & Farmer Data
                      </h4>
                      <p className="text-xs text-base-content/50 font-medium">Livestock unit & owner details</p>
                    </div>
                  </div>
                  
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Animal Unit Tag</dt>
                    <dd className="text-base sm:text-lg font-black text-primary mt-1">{selectedLog.tag}</dd>
                  </div>

                  <div>
                    <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Livestock Owner</dt>
                    <dd className="text-base font-bold text-base-content mt-1">{selectedLog.farmer}</dd>
                  </div>

                  <div>
                    <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Farmer Phone</dt>
                    <dd className="text-sm sm:text-base font-semibold text-base-content/85 mt-1">{selectedLog.farmerPhone}</dd>
                  </div>
                </div>

                {/* Column 2: Other Details (Service & Technical) */}
                <div className="space-y-4.5 pt-5 md:pt-0 border-t md:border-t-0 border-base-300">
                  <div className="flex items-center gap-3 pb-3 border-b border-base-300/70">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Syringe size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-base-content/70">
                        Service & Technical Details
                      </h4>
                      <p className="text-xs text-base-content/50 font-medium">Genetics, date & technician info</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">AI Performed Date</dt>
                      <dd className="text-sm font-bold text-base-content mt-1">{selectedLog.date}</dd>
                    </div>

                    <div>
                      <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Estrus Method</dt>
                      <dd className="text-sm font-bold text-base-content mt-1">{selectedLog.estrus}</dd>
                    </div>
                  </div>

                  <div>
                    <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Sire Genetics</dt>
                    <dd className="text-sm sm:text-base font-bold text-base-content mt-1">{formatSire(selectedLog.sireBreed, selectedLog.sireCode)}</dd>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Attending Technician</dt>
                      <dd className="text-sm font-semibold text-base-content/85 mt-1">{selectedLog.technician}</dd>
                    </div>

                    <div>
                      <dt className="text-xs font-black uppercase tracking-wider text-base-content/50">Record ID</dt>
                      <dd className="text-xs font-mono font-semibold text-base-content/65 truncate mt-1" title={selectedLog.id}>{selectedLog.id}</dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {selectedLog.previousAttempt && (
              <section className="rounded-2xl border border-info/25 bg-info/10 p-4.5">
                <h4 className="font-bold text-base-content text-sm">Linked previous attempt</h4>
                <p className="mt-1 text-xs sm:text-sm text-base-content/75 leading-relaxed">
                  Attempt #{selectedLog.previousAttempt.attemptNumber || selectedLog.attempt - 1} was performed on {formatDate(selectedLog.previousAttempt.inseminationDate)}. Its verified outcome is {selectedLog.previousAttempt.outcome || "not recorded"}.
                </p>
              </section>
            )}

            <section className="space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-base-content/60">Field Notes</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-base-200 p-4 leading-relaxed border border-base-300/50">
                  <span className="font-extrabold block text-xs uppercase tracking-wider text-base-content/50 mb-1">Farmer Note</span>
                  <p className="text-xs sm:text-sm text-base-content/80 font-medium">{selectedLog.comment || "No farmer note recorded."}</p>
                </div>
                <div className="rounded-2xl bg-base-200 p-4 leading-relaxed border border-base-300/50">
                  <span className="font-extrabold block text-xs uppercase tracking-wider text-base-content/50 mb-1">Technician Observation</span>
                  <p className="text-xs sm:text-sm text-base-content/80 font-medium">{selectedLog.technicianNote || "No technician observation recorded."}</p>
                </div>
              </div>
            </section>

            <div role="note" className="alert text-xs sm:text-sm rounded-2xl p-4">
              <Info size={18} className="text-primary shrink-0" />
              <span>AI history is preserved so later pregnancy checks and re-insemination attempts remain traceable.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
