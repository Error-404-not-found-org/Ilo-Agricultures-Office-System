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
  const animalLabel = `Tag ${request.animalTag || "Not recorded"}`;
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
    <article className="card bg-base-100 border border-base-300 shadow-sm transition-all hover:shadow-md overflow-hidden">
      <div className="card-body p-3.5 sm:p-4">
        {/* Top Header: Farmer Info and Badges */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              name={request.farmer}
              imageUrl={request.farmerImageUrl}
              size={36}
              sizeClass="h-9 w-9 sm:h-10 sm:w-10"
              className="shrink-0"
            />
            <div className="min-w-0">
              <h3 className="truncate text-[15px] sm:text-base font-bold text-base-content leading-tight">
                {request.farmer}
              </h3>
              <p className="truncate text-xs sm:text-[13px] font-medium text-base-content/65 mt-0.5">
                {animalLabel}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={`badge badge-sm badge-soft font-semibold ${isAI ? "badge-info" : "badge-error"}`}
            >
              {isAI ? "AI Request" : "Health Request"}
            </span>
            <span className={`badge badge-sm font-medium ${ownership.badgeClass}`}>
              {ownership.label}
            </span>
          </div>
        </div>

        {/* Badges Row (Urgent / Photos) */}
        {(isUrgentHealth || photoCount > 0) && (
          <div className="flex items-center gap-2 mb-1">
            {isUrgentHealth && (
              <span className="badge badge-sm badge-error font-semibold gap-1">
                <TriangleAlert size={12} aria-hidden="true" />
                Urgent
              </span>
            )}
            {photoCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold text-base-content/60"
                aria-label={`${photoCount} Farmer request photo${photoCount === 1 ? "" : "s"}`}
              >
                <Images size={14} aria-hidden="true" />
                {photoCount} photo{photoCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {/* Request Context Info */}
        <div className="bg-base-200/50 rounded-xl p-3 space-y-2 mt-1.5">
          {animalContext && (
            <div className="flex items-start gap-2 text-[13px]">
              <span className="font-medium text-base-content/55 w-16 shrink-0 text-[10px] uppercase tracking-wider mt-0.5">Animal</span>
              <span className="font-semibold text-base-content/80 line-clamp-1">{animalContext}</span>
            </div>
          )}
          <div className="flex items-start gap-2 text-[13px]">
             <span className="font-medium text-base-content/55 w-16 shrink-0 text-[10px] uppercase tracking-wider mt-0.5">Location</span>
             <div className="flex items-start gap-1 font-semibold text-base-content/80 flex-1">
               <MapPin size={14} className="shrink-0 text-primary mt-0.5" aria-hidden="true" />
               <span className="line-clamp-1">{request.location}</span>
             </div>
          </div>
          <div className="flex items-start gap-2 text-[13px]">
             <span className="font-medium text-base-content/55 w-16 shrink-0 text-[10px] uppercase tracking-wider mt-0.5">Submitted</span>
             <div className="flex items-center gap-1 font-semibold text-base-content/80 flex-1">
               <Clock3 size={14} className="shrink-0 text-primary" aria-hidden="true" />
               <span>{request.formattedSentAt || "Date unavailable"}</span>
             </div>
          </div>
          {hasSchedule && (
            <div className="flex items-start gap-2 text-[13px]">
               <span className="font-medium text-base-content/55 w-16 shrink-0 text-[10px] uppercase tracking-wider mt-0.5">Visit</span>
               <div className="flex items-center gap-1 font-semibold text-primary flex-1">
                 <CalendarDays size={14} className="shrink-0" aria-hidden="true" />
                 <span>{request.date}</span>
               </div>
            </div>
          )}
        </div>

        {/* Task Details / Remarks */}
        {request.taskDetails && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-base-content/70 mt-0.5 italic border-l-2 border-base-300 pl-2.5">
            "{request.taskDetails}"
          </p>
        )}

        {/* Card Actions */}
        <div className="card-actions items-center justify-between border-t border-base-200 mt-1.5 pt-3">
          {canCancel && isMine ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm text-error hover:bg-error/10"
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
            className={`btn btn-sm px-5 ${isAvailable && canClaim ? "btn-primary shadow-sm shadow-primary/20" : ""}`}
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
