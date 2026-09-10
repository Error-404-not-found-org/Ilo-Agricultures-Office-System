import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Archive,
  Beef,
  CalendarClock,
  CheckCircle2,
  CircleX,
  Database,
  FilePenLine,
  History,
  RefreshCcw,
  ShieldAlert,
  UserRoundCheck,
  UserPlus,
  Users,
  Syringe,
  Stethoscope,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import { ui } from "../../components/ui/uiClasses";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const sourceResult = (label, result, fallback) => {
  if (result.status !== "fulfilled") {
    return {
      ok: false,
      label,
      data: fallback,
    };
  }

  return {
    ok: true,
    label,
    data: result.value?.data ?? fallback,
  };
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.users)) return value.users;
  if (Array.isArray(value?.logs)) return value.logs;
  if (Array.isArray(value?.barangays)) return value.barangays;
  return [];
};

const numberValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "Unavailable";
};

const formatLabel = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatDashboardDate = () =>
  new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

const formatRelativeTime = (value) => {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";

  const difference = date.getTime() - Date.now();
  const absoluteDifference = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absoluteDifference < 60_000) return "Just now";
  if (absoluteDifference < 3_600_000) {
    return formatter.format(Math.round(difference / 60_000), "minute");
  }
  if (absoluteDifference < 86_400_000) {
    return formatter.format(Math.round(difference / 3_600_000), "hour");
  }
  if (absoluteDifference < 604_800_000) {
    return formatter.format(Math.round(difference / 86_400_000), "day");
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getAuditSubject = (log) =>
  log?.details?.targetName ||
  log?.details?.subject ||
  log?.entityName ||
  log?.entityType ||
  "System";

const formatActivityTitle = (value, fallback = "Administrative activity") => {
  if (!value) return fallback;

  const normalized = String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\bai\b/g, "AI")
    .replace(/\bapi\b/g, "API");

  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : fallback;
};

const getActivityPresentation = (action) => {
  const normalizedAction = String(action || "").toLowerCase();

  if (/cancel|delete|remove|failed|reject/.test(normalizedAction)) {
    return {
      icon: CircleX,
      tone: "border-error/20 bg-error/10 text-error",
    };
  }
  if (/archive/.test(normalizedAction)) {
    return {
      icon: Archive,
      tone: "border-warning/20 bg-warning/10 text-warning",
    };
  }
  if (/\bai\b|artificial insemination|vaccination/.test(normalizedAction)) {
    return {
      icon: Syringe,
      tone: "border-info/20 bg-info/10 text-info",
    };
  }
  if (/consultation|treatment|checkup/.test(normalizedAction)) {
    return {
      icon: Stethoscope,
      tone: "border-info/20 bg-info/10 text-info",
    };
  }
  if (/schedule|appointment|follow_up|reschedule/.test(normalizedAction)) {
    return {
      icon: CalendarClock,
      tone: "border-warning/20 bg-warning/10 text-warning",
    };
  }
  if (
    /create technician|add technician|new technician/.test(normalizedAction)
  ) {
    return {
      icon: UserPlus,
      tone: "border-success/20 bg-success/10 text-success",
    };
  }
  if (
    /assign|reassign|role|user|technician|invite|suspend|reactivate/.test(
      normalizedAction,
    )
  ) {
    return {
      icon: UserRoundCheck,
      tone: "border-info/20 bg-info/10 text-info",
    };
  }
  if (/update|edit|correct|sync|reset|change/.test(normalizedAction)) {
    return {
      icon: FilePenLine,
      tone: "border-info/20 bg-info/10 text-info",
    };
  }
  if (/backup|system|database/.test(normalizedAction)) {
    return {
      icon: Database,
      tone: "border-base-300 bg-base-200 text-base-content/75",
    };
  }
  if (
    /create|record|complete|approve|verify|resolve|provide|accept/.test(
      normalizedAction,
    )
  ) {
    return {
      icon: CheckCircle2,
      tone: "border-success/20 bg-success/10 text-success",
    };
  }

  return {
    icon: History,
    tone: "border-base-300 bg-base-200 text-base-content/75",
  };
};

export default function Dashboard() {
  const toast = useToast();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin", "dashboard-overview"],
    queryFn: async () => {
      const [stats, workloadSummary, technicians, auditLogs] =
        await Promise.allSettled([
          axiosInstance.get("/admin/stats"),
          axiosInstance.get("/admin/technician-workload-summary"),
          axiosInstance.get("/user?role=technician"),
          axiosInstance.get("/audit-logs", { params: { limit: 5 } }),
        ]);

      const sources = {
        stats: sourceResult("Overview", stats, {}),
        workloadSummary: sourceResult(
          "Technician workload",
          workloadSummary,
          {},
        ),
        technicians: sourceResult("Technician directory", technicians, []),
        auditLogs: sourceResult("Recent audit activity", auditLogs, {}),
      };

      return {
        sources,
        stats: sources.stats.data || {},
        workloadSummary: asArray(sources.workloadSummary.data?.technicians),
        technicians: asArray(sources.technicians.data),
        auditLogs: asArray(sources.auditLogs.data),
      };
    },
    refetchInterval: 1000 * 45,
  });

  const sources = data?.sources || EMPTY_OBJECT;
  const stats = data?.stats || EMPTY_OBJECT;
  const workloadSummary = data?.workloadSummary || EMPTY_ARRAY;
  const technicians = data?.technicians || EMPTY_ARRAY;
  const auditLogs = data?.auditLogs || EMPTY_ARRAY;
  const isSourceOk = useCallback(
    (key) => sources?.[key]?.ok !== false,
    [sources],
  );
  const failedSources = Object.values(sources).filter(
    (source) => source && !source.ok,
  );

  const workloadRows = useMemo(() => {
    const workloadByTechnicianId = new Map(
      workloadSummary.map((item) => [String(item?.technicianId || ""), item]),
    );

    const rows = technicians.length
      ? technicians.map((technician) => {
          const workload = workloadByTechnicianId.get(
            String(technician?._id || ""),
          );
          const status = String(technician?.status || "active").toLowerCase();
          const dispatchProfile = technician?.dispatchProfile || {};

          let operationalState = "Active";
          if (status === "inactive") {
            operationalState = "Inactive";
          } else if (dispatchProfile.availabilityStatus) {
            operationalState = formatLabel(
              dispatchProfile.availabilityStatus,
              "Status not recorded",
            );
          } else if (dispatchProfile.acceptsNewRequests === true) {
            operationalState = "Accepting requests";
          } else if (dispatchProfile.acceptsNewRequests === false) {
            operationalState = "Not receiving requests";
          }

          return {
            id: technician?._id || technician?.name,
            name: technician?.name || "Technician not recorded",
            imageUrl: technician?.imageUrl || technician?.profileImage || null,
            operationalState,
            activeRequests: isSourceOk("workloadSummary")
              ? Number(workload?.activeWorkloadTotal || 0)
              : null,
          };
        })
      : workloadSummary.map((item) => ({
          id: item?.technicianId,
          name: item?.name || "Technician not recorded",
          imageUrl: null,
          operationalState: "Status not available",
          activeRequests: Number(item?.activeWorkloadTotal || 0),
        }));

    return rows
      .sort(
        (first, second) =>
          Number(second.activeRequests || 0) -
          Number(first.activeRequests || 0),
      )
      .slice(0, 5);
  }, [isSourceOk, technicians, workloadSummary]);

  const metrics = [
    {
      label: "Total Farmers",
      value: isSourceOk("stats") ? stats.farmers : "Unavailable",
      description: "Registered Farmer profiles",
      icon: Users,
      colorClass: "border-l-primary",
    },
    {
      label: "Total Technicians",
      value: isSourceOk("stats") ? stats.technicians : "Unavailable",
      description: "Registered Technician profiles",
      icon: UserRoundCheck,
      colorClass: "border-l-error",
    },
    {
      label: "Total Animals",
      value: isSourceOk("stats") ? stats.animals : "Unavailable",
      description: "Active livestock records",
      icon: Beef,
      colorClass: "border-l-accent",
    },
  ];

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success("Dashboard data is up to date.");
    } catch {
      toast.error(
        "Dashboard data could not be refreshed. Check your connection and try again.",
      );
    }
  };

  return (
    <div className={ui.page}>
      <Topbar title="Admin Portal" subtitle={formatDashboardDate()}>
        <button
          type="button"
          onClick={handleRefresh}
          className="btn btn-sm hover:border-primary/30 hover:text-primary focus-visible:outline-primary"
          disabled={isFetching}
          aria-label={
            isFetching ? "Refreshing dashboard data" : "Refresh dashboard data"
          }
        >
          <RefreshCcw
            size={14}
            className={isFetching ? "animate-spin" : ""}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isFetching ? "Refreshing" : "Refresh"}
          </span>
        </button>
      </Topbar>

      <main className="flex-1 space-y-5 p-4 md:p-6">
        {isError && (
          <ErrorPanel
            title="Dashboard unavailable"
            message="We could not load operational data. Check your connection and try again."
            onRetry={handleRefresh}
          />
        )}

        {!isError && failedSources.length > 0 && (
          <PartialDataPanel sources={failedSources} onRetry={handleRefresh} />
        )}

        <section aria-labelledby="overview-heading" className="space-y-3">
          <h2
            id="overview-heading"
            className="text-lg font-bold text-base-content"
          >
            Overview
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <OperationalMetric
                key={metric.label}
                {...metric}
                loading={isLoading}
              />
            ))}
          </div>
        </section>

        <section
          aria-label="Dashboard details"
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          <Panel
            id="technician-workload"
            title="Technician Workload"
            description="Technician status and active work"
            actionLabel="View Workload"
            to="/admin/work-queue"
          >
            {!isSourceOk("workloadSummary") && !isSourceOk("technicians") ? (
              <SectionError
                message="We could not load Technician workload."
                onRetry={handleRefresh}
              />
            ) : (
              <TechnicianWorkloadList rows={workloadRows} loading={isLoading} />
            )}
          </Panel>

          <Panel
            id="recent-audit-activity"
            title="Recent Audit Activity"
            description="Latest administrative and workflow changes"
            actionLabel="View Audit Logs"
            to="/admin/audit-logs"
          >
            {!isSourceOk("auditLogs") ? (
              <SectionError
                message="We could not load recent audit activity."
                onRetry={handleRefresh}
              />
            ) : (
              <AuditPreview logs={auditLogs} loading={isLoading} />
            )}
          </Panel>
        </section>
      </main>
    </div>
  );
}

const Panel = ({ id, title, description, actionLabel, to, children }) => {
  const headingId = `${id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="card overflow-hidden border border-base-300 bg-base-100 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 bg-base-200/35 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-bold text-base-content">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-base-content/80">{description}</p>
          )}
        </div>
        {to && actionLabel && (
          <DashboardActionLink to={to}>{actionLabel}</DashboardActionLink>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
};

const OperationalMetric = ({
  label,
  value,
  description,
  icon: Icon,
  loading,
  colorClass = "border-l-primary",
}) => {
  return (
    <article
      data-testid="operational-metric"
      className={`stat min-h-28 rounded-box border border-base-300 border-l-4 ${colorClass} bg-base-100 p-4 shadow-sm`}
    >
      <div className="stat-figure ml-3 self-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-base-300 bg-base-200 text-base-content/75">
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <div
          className="skeleton stat-value mt-1 h-8 w-20"
          aria-label={`Loading ${label}`}
        />
      ) : (
        <p className="stat-value text-3xl font-extrabold leading-none text-base-content">
          {numberValue(value)}
        </p>
      )}
      <p className="stat-title mt-1 text-sm font-semibold text-base-content/90">
        {label}
      </p>
      <p className="stat-desc mt-1 text-xs text-base-content/75">
        {description}
      </p>
    </article>
  );
};

const TechnicianWorkloadList = ({ rows, loading }) => {
  if (loading) {
    return <SkeletonRows count={4} label="Loading Technician workload" />;
  }
  if (!rows.length) {
    return (
      <EmptyState
        title="No workload information"
        description="Technician workload will appear when active work is assigned or becomes due."
        icon={Users}
      />
    );
  }

  return (
    <ul className="list divide-y divide-base-300">
      {rows.map((row) => (
        <li key={row.id || row.name} className="list-row items-center py-3">
          <div className="relative shrink-0">
            <UserAvatar
              name={row.name}
              imageUrl={row.imageUrl}
              size={40}
              sizeClass="h-10 w-10"
              className="rounded-full"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-base-content">
              {row.name}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-base-content/75">
              {row.operationalState}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-base-content">
              {row.activeRequests === null
                ? "Unavailable"
                : numberValue(row.activeRequests)}
            </p>
            <p className="text-[10px] font-bold text-base-content/75">
              active work
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
};

const AuditPreview = ({ logs, loading }) => {
  if (loading) {
    return <SkeletonRows count={4} label="Loading Recent Activity" />;
  }
  if (!logs.length) {
    return (
      <EmptyState
        title="No recent activity"
        description="Activity will appear after an Admin or workflow change is recorded."
        icon={History}
      />
    );
  }

  return (
    <ul className="list divide-y divide-base-300">
      {logs.slice(0, 5).map((log, index) => {
        const activity = getActivityPresentation(log?.action);
        const ActivityIcon = activity.icon;

        return (
          <li
            key={log?._id || index}
            className="list-row grid-cols-[auto_1fr_auto] items-center px-0 py-3"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${activity.tone}`}
              aria-hidden="true"
            >
              <ActivityIcon size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-base-content">
                {formatActivityTitle(log?.action)}
              </p>
              <p className="mt-0.5 truncate text-xs text-base-content/75">
                {getAuditSubject(log)}
                {log?.actorId?.name ? ` · ${log.actorId.name}` : ""}
              </p>
            </div>
            <time
              dateTime={log?.createdAt || undefined}
              className="text-xs text-base-content/75"
            >
              {formatRelativeTime(log?.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
};

const EmptyState = ({ title, description, icon: Icon, tone = "neutral" }) => {
  const iconToneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    neutral: "bg-base-300/65 text-base-content/75",
  }[tone];

  return (
    <div
      data-empty-state
      className="rounded-box border border-dashed border-base-300 bg-base-200/45 px-4 py-5 text-center sm:py-6"
    >
      {Icon && (
        <span
          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg ${iconToneClass}`}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
      )}
      <p className="mt-2.5 font-semibold text-base-content">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm text-base-content/80">
        {description}
      </p>
    </div>
  );
};

const DashboardActionLink = ({ to, children, ariaLabel }) => (
  <Link
    to={to}
    aria-label={ariaLabel}
    className="group btn btn-ghost btn-sm min-h-10 text-primary hover:bg-primary/10 focus-visible:outline-primary"
  >
    {children}
    <ArrowRight
      size={14}
      aria-hidden="true"
      className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none"
    />
  </Link>
);

const SkeletonRows = ({ count, label }) => (
  <div className="space-y-3" aria-label={label}>
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="skeleton h-14 w-full" />
    ))}
  </div>
);

const SectionError = ({ message, onRetry }) => (
  <div role="alert" className="alert alert-error alert-soft">
    <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
    <span>{message}</span>
    <button type="button" onClick={onRetry} className="btn btn-sm">
      Try again
    </button>
  </div>
);

const ErrorPanel = ({ title, message, onRetry }) => (
  <div
    role="alert"
    className="alert alert-error alert-soft sm:alert-horizontal"
  >
    <ShieldAlert size={20} className="shrink-0" aria-hidden="true" />
    <div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
    </div>
    <button type="button" onClick={onRetry} className="btn btn-sm">
      Try again
    </button>
  </div>
);

const PartialDataPanel = ({ sources, onRetry }) => (
  <div
    role="status"
    className="alert alert-warning alert-soft sm:alert-horizontal"
  >
    <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
    <div>
      <p className="font-semibold">Some dashboard sections are unavailable</p>
      <p className="mt-1 text-sm">
        Available sections are still current and usable.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sources.map((source) => (
          <span key={source.label} className="badge badge-warning badge-soft">
            {source.label}
          </span>
        ))}
      </div>
    </div>
    <button type="button" onClick={onRetry} className="btn btn-sm">
      Try again
    </button>
  </div>
);
