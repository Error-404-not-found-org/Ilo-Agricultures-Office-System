import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleX,
  ClipboardList,
  Database,
  FilePenLine,
  History,
  Inbox,
  MapPin,
  RefreshCcw,
  ShieldAlert,
  UserCheck,
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
import { Badge, ui } from "../../components/ui/uiClasses";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const URGENT_VALUES = new Set(["high", "emergency", "urgent", "critical"]);

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

const getQueueRequests = (value) => {
  if (Array.isArray(value?.requests)) return value.requests;
  return asArray(value);
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

const getRequestType = (request) => {
  if (request?.type === "ai" || request?.type === "insemination") return "AI";
  if (request?.type === "health") return "Health";
  return request?.requestType || request?.raw?.requestType || "Service";
};

const toDashboardRequest = (request) => {
  const raw = request?.raw || request || {};
  const assignedTechnician =
    request?.assignedTechnician ||
    raw?.approvedBy?.name ||
    raw?.handledBy?.name ||
    "";

  return {
    id: request?.id || raw?._id,
    rawId: raw?._id || request?.id,
    type:
      request?.type ||
      raw?.type ||
      (raw?.issueDescription || raw?.symptoms ? "health" : "service"),
    requestType: request?.requestType || raw?.requestType,
    status:
      request?.displayStatus || request?.status || raw?.status || "pending",
    urgency: request?.urgency || raw?.urgency || "standard",
    farmer:
      request?.farmer ||
      raw?.farmerId?.name ||
      raw?.farmer?.name ||
      "Farmer not recorded",
    barangay:
      request?.barangay ||
      request?.locationLabel ||
      request?.location ||
      raw?.farmerId?.address?.barangay ||
      raw?.barangay ||
      "Location not recorded",
    assignedTechnician,
    cancellationStatus:
      request?.cancellationStatus || raw?.cancellationStatus || "none",
    createdAt: request?.createdAt || raw?.createdAt,
    raw,
  };
};

const isUrgentRequest = (request) =>
  URGENT_VALUES.has(String(request?.urgency || "").toLowerCase());

const isRequestUnassigned = (request) =>
  !request.assignedTechnician &&
  !request.raw?.approvedBy &&
  !request.raw?.technicianId &&
  !request.raw?.handledBy &&
  !request.raw?.assignedTechnicianId;

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
  if (/create technician|add technician|new technician/.test(normalizedAction)) {
    return {
      icon: UserPlus,
      tone: "border-success/20 bg-success/10 text-success",
    };
  }
  if (
    /assign|reassign|role|user|technician|invite|suspend|reactivate/.test(normalizedAction)
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
      const [monitoring, technicians, technicianRequests, auditLogs] =
        await Promise.allSettled([
          axiosInstance.get("/admin/monitoring"),
          axiosInstance.get("/user?role=technician"),
          axiosInstance.get("/technician/requests", {
            params: { status: "pending", limit: 50 },
          }),
          axiosInstance.get("/audit-logs", { params: { limit: 5 } }),
        ]);

      const sources = {
        monitoring: sourceResult("Technician workload", monitoring, {}),
        technicians: sourceResult("Technician directory", technicians, []),
        technicianRequests: sourceResult(
          "Pending requests",
          technicianRequests,
          {},
        ),
        auditLogs: sourceResult("Recent activity", auditLogs, {}),
      };

      return {
        sources,
        monitoring: sources.monitoring.data,
        technicians: asArray(sources.technicians.data),
        requests: getQueueRequests(sources.technicianRequests.data).map(
          toDashboardRequest,
        ),
        auditLogs: asArray(sources.auditLogs.data),
      };
    },
    refetchInterval: 1000 * 45,
  });

  const sources = data?.sources || EMPTY_OBJECT;
  const monitoring = data?.monitoring || EMPTY_OBJECT;
  const serviceRequests = data?.requests || EMPTY_ARRAY;
  const technicians = data?.technicians || EMPTY_ARRAY;
  const auditLogs = data?.auditLogs || EMPTY_ARRAY;
  const isSourceOk = useCallback(
    (key) => sources?.[key]?.ok !== false,
    [sources],
  );
  const failedSources = Object.values(sources).filter(
    (source) => source && !source.ok,
  );

  const urgentRequests = useMemo(
    () => serviceRequests.filter(isUrgentRequest),
    [serviceRequests],
  );

  const unassignedRequests = useMemo(
    () => serviceRequests.filter(isRequestUnassigned),
    [serviceRequests],
  );

  const cancellationReviews = useMemo(
    () =>
      serviceRequests.filter(
        (request) =>
          String(request.cancellationStatus).toLowerCase() === "requested",
      ),
    [serviceRequests],
  );

  const activeTechnicians = useMemo(
    () =>
      technicians.filter(
        (technician) =>
          String(technician?.status || "active").toLowerCase() !== "inactive",
      ),
    [technicians],
  );

  const unavailableTechnicians = useMemo(
    () =>
      technicians.filter(
        (technician) =>
          String(technician?.status || "active").toLowerCase() === "inactive",
      ),
    [technicians],
  );

  const pendingRequests = useMemo(
    () =>
      [...serviceRequests].sort((first, second) => {
        const urgencyDifference =
          Number(isUrgentRequest(second)) - Number(isUrgentRequest(first));
        if (urgencyDifference) return urgencyDifference;
        return (
          new Date(first.createdAt || 0).getTime() -
          new Date(second.createdAt || 0).getTime()
        );
      }),
    [serviceRequests],
  );

  const workloadRows = useMemo(() => {
    const workloads = Array.isArray(
      monitoring?.moowieInsights?.technicianWorkloads,
    )
      ? monitoring.moowieInsights.technicianWorkloads
      : [];
    const workloadByName = new Map(
      workloads.map((item) => [String(item?.name || "").toLowerCase(), item]),
    );

    const rows = technicians.length
      ? technicians.map((technician) => {
          const workload = workloadByName.get(
            String(technician?.name || "").toLowerCase(),
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
            activeRequests: isSourceOk("monitoring")
              ? Number(workload?.activeRequests || 0)
              : null,
          };
        })
      : workloads.map((item) => ({
          id: item?.name,
          name: item?.name || "Technician not recorded",
          imageUrl: null,
          operationalState: "Status not available",
          activeRequests: Number(item?.activeRequests || 0),
        }));

    return rows
      .sort(
        (first, second) =>
          Number(second.activeRequests || 0) -
          Number(first.activeRequests || 0),
      )
      .slice(0, 5);
  }, [isSourceOk, monitoring, technicians]);

  const needsAttention = useMemo(
    () =>
      [
        isSourceOk("technicianRequests") && {
          title: "request needs assignment",
          pluralTitle: "requests need assignment",
          count: unassignedRequests.length,
          description: "Assign a Technician from the Requests page.",
          to: "/admin/requests?status=pending",
          tone: "warning",
        },
        isSourceOk("technicianRequests") && {
          title: "cancellation needs review",
          pluralTitle: "cancellations need review",
          count: cancellationReviews.length,
          description: "Review Farmer cancellation requests.",
          to: "/admin/requests?status=all",
          tone: "warning",
        },
        isSourceOk("technicianRequests") && {
          title: "urgent case is waiting",
          pluralTitle: "urgent cases are waiting",
          count: urgentRequests.length,
          description: "Review urgent service requests first.",
          to: "/admin/requests?status=pending",
          tone: "error",
        },
        isSourceOk("technicians") && {
          title: "Technician is inactive",
          pluralTitle: "Technicians are inactive",
          count: unavailableTechnicians.length,
          description: "Check staffing and dispatch availability.",
          to: "/admin/technicians",
          tone: "neutral",
        },
      ].filter((item) => item && item.count > 0),
    [
      cancellationReviews.length,
      isSourceOk,
      unavailableTechnicians.length,
      unassignedRequests.length,
      urgentRequests.length,
    ],
  );

  const metrics = [
    {
      label: "Requests Waiting",
      value: isSourceOk("technicianRequests")
        ? serviceRequests.length
        : "Unavailable",
      description: "Awaiting Admin coordination",
      icon: ClipboardList,
      tone: "warning",
    },
    {
      label: "Active Technicians",
      value: isSourceOk("technicians")
        ? activeTechnicians.length
        : "Unavailable",
      description: "Active Technician accounts",
      icon: UserCheck,
      tone: "success",
    },
    {
      label: "Urgent Cases",
      value: isSourceOk("technicianRequests")
        ? urgentRequests.length
        : "Unavailable",
      description: "Require prompt review",
      icon: ShieldAlert,
      tone: "error",
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

        <section
          aria-label="Operational metrics"
          className="grid grid-cols-1 gap-3 lg:grid-cols-3"
        >
          {metrics.map((metric) => (
            <OperationalMetric
              key={metric.label}
              {...metric}
              loading={isLoading}
            />
          ))}
        </section>

        <section
          aria-label="Immediate Admin work"
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          <Panel
            id="needs-attention"
            title="Needs Attention"
            description="Requests and staffing that need Admin review"
          >
            {!isSourceOk("technicianRequests") &&
              !isSourceOk("technicians") && (
                <SectionError
                  message="We could not load the items that need attention."
                  onRetry={handleRefresh}
                />
              )}
            {isLoading ? (
              <SkeletonRows count={3} label="Loading attention items" />
            ) : needsAttention.length ? (
              <AttentionList items={needsAttention} />
            ) : (
              <EmptyState
                title="All caught up"
                description="No requests need assignment, no urgent cases are waiting, and Technician staffing is clear."
                icon={CheckCircle2}
                tone="success"
              />
            )}
          </Panel>

          <Panel
            id="pending-requests"
            title="Pending Requests"
            description="Highest-priority requests awaiting coordination"
            actionLabel="View all Requests"
            to="/admin/requests"
          >
            {!isSourceOk("technicianRequests") ? (
              <SectionError
                message="We could not load pending requests."
                onRetry={handleRefresh}
              />
            ) : (
              <PendingRequestList
                requests={pendingRequests}
                loading={isLoading}
              />
            )}
          </Panel>
        </section>

        <section
          aria-label="Operational overview"
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          <Panel
            id="recent-admin-activity"
            title="Recent Admin Activity"
            description="Latest administrative and workflow changes"
            actionLabel="View Audit Logs"
            to="/admin/audit-logs"
          >
            {!isSourceOk("auditLogs") ? (
              <SectionError
                message="We could not load recent Admin activity."
                onRetry={handleRefresh}
              />
            ) : (
              <AuditPreview logs={auditLogs} loading={isLoading} />
            )}
          </Panel>

          <Panel
            id="technician-workload"
            title="Technician Workload"
            description="Technician status and active assignments"
            actionLabel="View Workload"
            to="/admin/work-queue"
          >
            {!isSourceOk("monitoring") && !isSourceOk("technicians") ? (
              <SectionError
                message="We could not load Technician workload."
                onRetry={handleRefresh}
              />
            ) : (
              <TechnicianWorkloadList rows={workloadRows} loading={isLoading} />
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

const AttentionList = ({ items }) => (
  <ul className="list divide-y divide-base-300">
    {items.map((item) => (
      <li key={item.title} className="list-row items-center px-0 py-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            item.tone === "error"
              ? "bg-error/10 text-error"
              : item.tone === "warning"
                ? "bg-warning/10 text-warning"
                : "bg-base-200 text-base-content/65"
          }`}
        >
          <AlertTriangle size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-base-content">
            {numberValue(item.count)}{" "}
            {item.count === 1 ? item.title : item.pluralTitle}
          </p>
          <p className="mt-0.5 text-sm text-base-content/75">
            {item.description}
          </p>
        </div>
        <DashboardActionLink to={item.to} ariaLabel={`Review: ${item.title}`}>
          Review
        </DashboardActionLink>
      </li>
    ))}
  </ul>
);

const OperationalMetric = ({
  label,
  value,
  description,
  icon: Icon,
  tone,
  loading,
}) => {
  const toneClass = {
    warning: "border-warning/20 bg-warning/10 text-warning",
    success: "border-success/20 bg-success/10 text-success",
    error: "border-error/20 bg-error/10 text-error",
  }[tone];

  const toneBorderClass = {
    warning: "border-warning/35",
    success: "border-success/35",
    error: "border-error/35",
  }[tone];

  return (
    <article
      data-testid="operational-metric"
      data-tone={tone}
      className={`stat min-h-28 rounded-box border-0 border-l-4 bg-base-100 p-4 shadow-sm ${toneBorderClass}`}
    >
      <div className="stat-figure ml-3 self-center">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClass}`}
        >
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

const getRequestPath = (request) => {
  const requestId = request.id || request.rawId || request.raw?._id;
  return requestId
    ? `/admin/requests?requestId=${encodeURIComponent(requestId)}&status=all`
    : "/admin/requests?status=all";
};

const PendingRequestList = ({ requests, loading }) => {
  if (loading) {
    return <SkeletonRows count={5} label="Loading pending requests" />;
  }
  if (!requests.length) {
    return (
      <EmptyState
        title="No pending requests"
        description="No service requests currently need Admin coordination."
        icon={Inbox}
        tone="primary"
      />
    );
  }

  const visibleRequests = requests.slice(0, 5);

  return (
    <>
      <ul className="list divide-y divide-base-300 md:hidden">
        {visibleRequests.map((request, index) => (
          <li
            key={request.id || request.rawId || index}
            className="list-row grid-cols-[1fr_auto] px-0 py-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-base-content">
                  {request.farmer}
                </p>
                <RequestStatus request={request} />
              </div>
              <p className="mt-1 text-sm text-base-content/80">
                {getRequestType(request)}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-sm text-base-content/75">
                <MapPin
                  size={14}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                {request.barangay}
              </p>
            </div>
            <DashboardActionLink to={getRequestPath(request)}>
              Open Request
            </DashboardActionLink>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Farmer</th>
              <th>Service</th>
              <th>Barangay / Location</th>
              <th>Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((request, index) => (
              <tr key={request.id || request.rawId || index}>
                <td className="font-semibold text-base-content">
                  {request.farmer}
                </td>
                <td>{getRequestType(request)}</td>
                <td>
                  <span className="flex items-start gap-1.5">
                    <MapPin
                      size={14}
                      className="mt-0.5 shrink-0 text-base-content/75"
                      aria-hidden="true"
                    />
                    {request.barangay}
                  </span>
                </td>
                <td>
                  <RequestStatus request={request} />
                </td>
                <td className="text-right">
                  <DashboardActionLink to={getRequestPath(request)}>
                    Open Request
                  </DashboardActionLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const RequestStatus = ({ request }) => {
  const urgent = isUrgentRequest(request);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge status={request.status}>
        {formatLabel(request.status, "Pending")}
      </Badge>
      {urgent && <Badge status="urgent">Urgent</Badge>}
    </div>
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
        description="Technician workload will appear after active assignments are recorded."
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
              active assignments
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
