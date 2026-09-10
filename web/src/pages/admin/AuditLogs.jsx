import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FileClock, Search } from "lucide-react";
import { useId, useState } from "react";
import Topbar from "../../components/layout/Topbar";
import { ui } from "../../components/ui/uiClasses";
import axiosInstance from "../../lib/axios";
import {
  AUDIT_ENTITY_OPTIONS,
  formatAuditAction,
  formatAuditEntity,
  getAuditDescription,
  getAuditDetailSections,
  resolveAuditActionSearch,
} from "./auditLogPresentation";

const PAGE_SIZE = 10;

const formatAuditDate = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const AuditDetails = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  const disclosureId = useId();
  const sections = getAuditDetailSections(log);

  if (!sections.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        className="btn btn-ghost btn-xs px-0 text-primary hover:bg-transparent"
        aria-expanded={expanded}
        aria-controls={disclosureId}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Hide details" : "View details"}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {expanded && (
        <div
          id={disclosureId}
          className="mt-2 rounded-box border border-base-300 bg-base-200 p-4"
        >
          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.label}
                aria-label={`${section.label} audit values`}
              >
                <h3 className="text-sm font-semibold text-base-content">
                  {section.label}
                </h3>
                <dl className="mt-2 space-y-2">
                  {section.items.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="border-t border-base-300 pt-2 first:border-0 first:pt-0"
                    >
                      <dt className="text-xs font-semibold text-base-content/65">
                        {item.label}
                      </dt>
                      <dd className="mt-1 text-sm text-base-content/80">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AuditLoading = () => (
  <div aria-label="Loading audit logs" className="divide-y divide-base-300">
    {Array.from({ length: 5 }, (_, index) => (
      <div key={index} className="flex gap-3 p-5">
        <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-52" />
          <div className="skeleton h-3 w-72 max-w-full" />
        </div>
      </div>
    ))}
  </div>
);

export default function AuditLogs() {
  const [entityType, setEntityType] = useState("all");
  const [actionSearch, setActionSearch] = useState("");
  const [page, setPage] = useState(1);
  const actionQuery = resolveAuditActionSearch(actionSearch);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin", "audit-logs", entityType, actionSearch, page],
    queryFn: async () => {
      const res = await axiosInstance.get("/audit-logs", {
        params: {
          entityType,
          action: actionQuery,
          page,
          limit: PAGE_SIZE,
        },
      });
      return res.data || {};
    },
  });

  const logs = Array.isArray(data?.data) ? data.data : [];
  const total = Number.isFinite(Number(data?.total)) ? Number(data.total) : 0;
  const responsePage = Number.isFinite(Number(data?.page))
    ? Number(data.page)
    : page;
  const responseTotalPages = Number.isFinite(Number(data?.totalPages))
    ? Number(data.totalPages)
    : 0;
  const displayTotalPages = Math.max(responseTotalPages, 1);
  const responseLimit = Number.isFinite(Number(data?.limit))
    ? Number(data.limit)
    : PAGE_SIZE;
  const rangeStart = total === 0 ? 0 : (responsePage - 1) * responseLimit + 1;
  const rangeEnd = Math.min(responsePage * responseLimit, total);

  const changeEntityType = (event) => {
    setEntityType(event.target.value);
    setPage(1);
  };

  const changeActionSearch = (event) => {
    setActionSearch(event.target.value);
    setPage(1);
  };

  return (
    <div className={ui.page}>
      <Topbar title="Audit Logs" subtitle="Administrative activity history" />

      <main className="flex-1 space-y-5 p-4 pb-10 md:p-6">
        <section
          className={`${ui.panelPadded} flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between`}
        >
          <div>
            <p className="text-sm font-semibold text-base-content/70">
              Audit entries
            </p>
            <p
              className="mt-1 text-2xl font-bold text-base-content"
              aria-label={`${total} total audit entries`}
            >
              {isLoading ? "—" : total.toLocaleString()}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            <label className="flex w-full flex-col sm:w-52">
              <span className="mb-1 text-xs font-semibold text-base-content/70">
                Category
              </span>
              <select
                value={entityType}
                onChange={changeEntityType}
                className={ui.select}
                aria-label="Filter audit logs by category"
              >
                {AUDIT_ENTITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-full flex-col sm:w-72">
              <span className="mb-1 text-xs font-semibold text-base-content/70">
                Activity
              </span>
              <span className="input input-sm flex items-center gap-2 bg-base-100 focus-within:outline-2 focus-within:outline-primary">
                <Search
                  size={15}
                  className="shrink-0 text-base-content/55"
                  aria-hidden="true"
                />
                <input
                  aria-label="Search activity"
                  value={actionSearch}
                  onChange={changeActionSearch}
                  placeholder="Search activity..."
                  className="min-w-0 grow bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/55"
                />
              </span>
            </label>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="alert alert-error alert-soft sm:alert-horizontal"
          >
            <p className="text-sm font-semibold">Failed to load audit logs.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="btn btn-sm"
            >
              Retry
            </button>
          </div>
        )}

        <section className={ui.panel} aria-label="Audit entries">
          {isLoading ? (
            <AuditLoading />
          ) : !error && logs.length === 0 ? (
            <div className="p-10 text-center">
              <FileClock
                size={28}
                className="mx-auto text-base-content/45"
                aria-hidden="true"
              />
              <h2 className="mt-3 text-base font-semibold text-base-content">
                {entityType !== "all" || actionSearch
                  ? "No activity matches these filters"
                  : "No audit activity yet"}
              </h2>
              <p className="mx-auto mt-1 max-w-lg text-sm text-base-content/65">
                {entityType !== "all" || actionSearch
                  ? "Try another category or activity search."
                  : "Administrative and workflow activity will appear here when it is recorded."}
              </p>
            </div>
          ) : !error ? (
            <ul className="list divide-y divide-base-300">
              {logs.map((log) => {
                const description = getAuditDescription(log);
                return (
                  <li
                    key={log._id}
                    className="list-row items-start gap-3 px-5 py-4"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                      aria-hidden="true"
                    >
                      <FileClock size={18} />
                    </span>
                    <article
                      className="min-w-0 list-col-grow"
                      aria-label={formatAuditAction(log.action)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-base-content">
                          {formatAuditAction(log.action)}
                        </h2>
                        <span className="badge badge-ghost badge-sm">
                          {formatAuditEntity(log.entityType)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-base-content/70">
                        <span className="font-medium text-base-content/80">
                          {log.actorId?.name || "System"}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={log.createdAt || undefined}>
                          {formatAuditDate(log.createdAt)}
                        </time>
                      </p>
                      {description && (
                        <p className="mt-2 text-sm text-base-content/75">
                          {description}
                        </p>
                      )}
                      <AuditDetails log={log} />
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

        {!isLoading && !error && (
          <nav
            className="flex flex-col items-center justify-between gap-3 sm:flex-row"
            aria-label="Audit log pagination"
          >
            <p className="text-sm text-base-content/65" aria-live="polite">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <p className="text-sm text-base-content/65">
                Page {responsePage} of {displayTotalPages}
              </p>
              <div className="join">
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  disabled={responsePage <= 1 || isFetching}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  disabled={responsePage >= responseTotalPages || isFetching}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(current + 1, displayTotalPages),
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </nav>
        )}
      </main>
    </div>
  );
}
