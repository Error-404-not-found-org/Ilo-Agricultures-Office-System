import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Images,
  MapPin,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import UserAvatar from "../../components/ui/UserAvatar";
import { getTechnicianStatus } from "../../constants/technicianWorkflow";
import {
  getRequestAssigneeId,
  getRequestStatusPresentation,
} from "../../utils/requestBoardViews";

const normalizedStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-");

const uniquePhotoCount = (request) => {
  const urls = Array.isArray(request.attachments?.urls)
    ? request.attachments.urls
    : [];
  const normalizedUrls = new Set(
    urls
      .filter((url) => typeof url === "string")
      .map((url) => url.trim())
      .filter(Boolean),
  );
  return Math.max(Number(request.attachments?.count || 0), normalizedUrls.size);
};

export default function RequestQueueCard({
  request,
  currentUserId,
  isUpdating,
  canClaim,
  canCancel,
  onOpen,
  onCancel,
}) {
  const assigneeId = getRequestAssigneeId(request);
  const isMine =
    assigneeId &&
    currentUserId &&
    String(assigneeId) === String(currentUserId);
  const isAvailable =
    normalizedStatus(request.status) === "pending" && !assigneeId;
  const isAI =
    request.workflowType === "AI" ||
    request.type === "insemination" ||
    request.serviceType === "ai";
  const isUrgentHealth =
    request.type === "health" && request.urgency === "urgent";
  const photoCount = uniquePhotoCount(request);
  const status =
    getRequestStatusPresentation(request) ||
    getTechnicianStatus(request.status);
  const ownership = isMine
    ? { label: "Claimed by You", badgeClass: "badge-success badge-soft" }
    : status;
  const animalLabel =
    request.animalName && request.animalName !== request.animalTag
      ? `${request.animalName} · Tag ${request.animalTag}`
      : `Tag ${request.animalTag || "Not recorded"}`;
  const animalContext = [request.species, request.breed]
    .filter((value) => value && value !== "Not recorded")
    .join(" · ");
  const hasSchedule =
    request.date &&
    !["Not scheduled", "Date unavailable"].includes(request.date);

  const handlePrimaryAction = () => {
    onOpen(request);
  };

  const primaryLabel =
    isAvailable && canClaim ? "Review Request" : "View Request";

  return (
    <article className="card card-border bg-base-100">
      <div className="card-body gap-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`badge badge-sm badge-soft ${isAI ? "badge-info" : "badge-error"}`}
            >
              {isAI ? "AI Request" : "Health Request"}
            </span>
            <span className={`badge badge-sm ${ownership.badgeClass}`}>
              {ownership.label}
            </span>
            {isUrgentHealth ? (
              <span className="badge badge-sm badge-error gap-1">
                <TriangleAlert size={12} aria-hidden="true" />
                Urgent
              </span>
            ) : null}
          </div>
          {photoCount > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-base-content/65"
              aria-label={`${photoCount} Farmer request photo${photoCount === 1 ? "" : "s"}`}
            >
              <Images size={15} aria-hidden="true" />
              {photoCount}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <UserAvatar
            name={request.farmer}
            imageUrl={request.farmerImageUrl}
            size={44}
            sizeClass="h-11 w-11"
            className="shrink-0"
          />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-base-content">
              {request.farmer}
            </h3>
            <p className="mt-0.5 truncate text-sm text-base-content/65">
              {animalLabel}
            </p>
          </div>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {animalContext ? (
            <div>
              <dt className="text-xs text-base-content/55">Animal</dt>
              <dd className="font-medium text-base-content/80">
                {animalContext}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-base-content/55">Location</dt>
            <dd className="flex items-start gap-1.5 font-medium text-base-content/80">
              <MapPin
                size={14}
                className="mt-0.5 shrink-0 text-base-content/55"
                aria-hidden="true"
              />
              <span>{request.location}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-base-content/55">Submitted</dt>
            <dd className="flex items-start gap-1.5 font-medium text-base-content/80">
              <Clock3
                size={14}
                className="mt-0.5 shrink-0 text-base-content/55"
                aria-hidden="true"
              />
              <span>{request.formattedSentAt || "Date unavailable"}</span>
            </dd>
          </div>
          {hasSchedule ? (
            <div>
              <dt className="text-xs text-base-content/55">Visit</dt>
              <dd className="flex items-start gap-1.5 font-medium text-base-content/80">
                <CalendarDays
                  size={14}
                  className="mt-0.5 shrink-0 text-base-content/55"
                  aria-hidden="true"
                />
                <span>{request.date}</span>
              </dd>
            </div>
          ) : null}
        </dl>

        {request.taskDetails ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-base-content/65">
            {request.taskDetails}
          </p>
        ) : null}

        <div className="card-actions items-center justify-between border-t border-base-300 pt-3">
          {canCancel && isMine ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error"
              disabled={isUpdating}
              onClick={() => onCancel(request)}
            >
              <XCircle size={15} aria-hidden="true" />
              Cancel request
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className={`btn btn-sm ${isAvailable && canClaim ? "btn-primary" : ""}`}
            disabled={isUpdating}
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
