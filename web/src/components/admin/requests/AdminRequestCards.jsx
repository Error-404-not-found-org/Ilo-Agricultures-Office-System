import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  MapPin,
  PawPrint,
  RefreshCw,
  UserRound,
} from "lucide-react";
import {
  getRequestStatusPresentation,
} from "../../../utils/requestBoardViews";
import { getTechnicianStatus } from "../../../constants/technicianWorkflow";

function getAssignedTechnicianName(request) {
  const raw = request.raw || request;
  const assignee =
    raw.approvedBy ||
    raw.handledBy ||
    raw.assignedTechnicianId ||
    raw.technicianId ||
    null;

  if (assignee && typeof assignee === "object") {
    return assignee.name || assignee.fullName || "Assigned Technician";
  }

  return (
    request.assignedTechnicianName ||
    raw.technicianName ||
    (assignee ? "Assigned Technician" : "Unassigned")
  );
}

function getAttentionLabel(request) {
  const visitDate = request.visitDate ? new Date(request.visitDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    ["in-progress", "approved"].includes(request.status) &&
    visitDate &&
    !Number.isNaN(visitDate.getTime()) &&
    visitDate < today;

  if (isOverdue) return "Scheduled date has passed";
  if (["approved", "assigned"].includes(request.status)) {
    return "Schedule needs review";
  }
  return null;
}

function RequestCard({ request, onViewRequest }) {
  const statusPresentation =
    getRequestStatusPresentation(request, { isAdmin: true }) ||
    getTechnicianStatus(request.status);
  const attentionLabel = getAttentionLabel(request);
  const technicianName = getAssignedTechnicianName(request);
  const animalLabel =
    request.animalName ||
    request.animalTag ||
    request.raw?.animalId?.earTag ||
    "Animal not recorded";
  const scheduleLabel =
    request.date ||
    [request.formattedDateOnly, request.formattedTimeOnly]
      .filter(Boolean)
      .join(" · ") ||
    "Not scheduled";

  return (
    <article
      className="card card-border bg-base-100"
      aria-labelledby={`request-${request.id}`}
    >
      <div className="card-body gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="badge badge-neutral badge-soft badge-sm mb-2">
              {request.serviceBadge || request.workflowType || "Request"}
            </span>
            <h3
              id={`request-${request.id}`}
              className="card-title text-base leading-snug"
            >
              {request.serviceLabel || "Service Request"}
            </h3>
          </div>
          <span
            className={`badge badge-sm shrink-0 font-semibold ${statusPresentation.badgeClass}`}
          >
            {statusPresentation.label}
          </span>
        </div>

        <dl className="grid gap-3 border-y border-base-300 py-4 sm:grid-cols-2">
          <div className="flex min-w-0 gap-2.5">
            <UserRound
              size={17}
              className="mt-0.5 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-base-content/55">Farmer</dt>
              <dd className="truncate text-sm font-semibold">
                {request.farmer || "Farmer unavailable"}
              </dd>
            </div>
          </div>

          <div className="flex min-w-0 gap-2.5">
            <PawPrint
              size={17}
              className="mt-0.5 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-base-content/55">Animal</dt>
              <dd className="truncate text-sm font-semibold">
                {animalLabel}
                {request.animalTag && animalLabel !== request.animalTag
                  ? ` · Tag ${request.animalTag}`
                  : ""}
              </dd>
            </div>
          </div>

          <div className="flex min-w-0 gap-2.5">
            <BriefcaseBusiness
              size={17}
              className="mt-0.5 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-base-content/55">
                Assigned Technician
              </dt>
              <dd className="truncate text-sm font-semibold">{technicianName}</dd>
            </div>
          </div>

          <div className="flex min-w-0 gap-2.5">
            <CalendarDays
              size={17}
              className="mt-0.5 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-base-content/55">Schedule</dt>
              <dd className="text-sm font-semibold">{scheduleLabel}</dd>
            </div>
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-base-content/60">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={14} aria-hidden="true" />
            {request.location || "Location unavailable"}
          </span>
          {request.formattedSentAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} aria-hidden="true" />
              Sent {request.formattedSentAt}
            </span>
          ) : null}
        </div>

        {attentionLabel ? (
          <div role="status" className="alert alert-warning alert-soft py-2 text-sm">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{attentionLabel}</span>
          </div>
        ) : null}

        <div className="card-actions mt-auto justify-end">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onViewRequest(request)}
          >
            View Request
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminRequestCards({
  requests,
  isLoading,
  isError,
  error,
  onRetry,
  onViewRequest,
  emptyMessage,
}) {
  if (isLoading) {
    return (
      <div
        className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2"
        aria-label="Loading Admin requests"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="card card-border bg-base-100">
            <div className="card-body gap-4 p-5">
              <div className="skeleton h-6 w-2/3" />
              <div className="skeleton h-28 w-full" />
              <div className="skeleton ml-auto h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div role="alert" className="alert alert-error max-w-md">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Requests are unavailable</h3>
            <p className="text-sm">
              {error?.response?.data?.message ||
                "Refresh the request board to try again."}
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!requests.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <AlertCircle
            size={30}
            className="mx-auto text-base-content/30"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-semibold">No matching requests</h3>
          <p className="mt-1 text-sm text-base-content/60">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2"
      aria-label="Admin request oversight"
    >
      {requests.map((request) => (
        <RequestCard
          key={request.id}
          request={request}
          onViewRequest={onViewRequest}
        />
      ))}
    </div>
  );
}
