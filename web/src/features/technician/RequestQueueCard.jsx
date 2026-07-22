import { Check, ChevronRight, Clock, Lock, MapPin, X } from "lucide-react";
import { getTechnicianStatus } from "../../constants/technicianWorkflow";

export default function RequestQueueCard({
  request,
  currentUserId,
  isUpdating,
  onOpen,
  onClaim,
  onDecline,
}) {
  const assignedId =
    request.raw?.approvedBy?._id ||
    request.raw?.approvedBy ||
    request.raw?.handledBy?._id ||
    request.raw?.handledBy ||
    request.raw?.technicianId?._id ||
    request.raw?.technicianId ||
    null;
  const assignedName =
    request.raw?.approvedBy?.name ||
    request.raw?.handledBy?.name ||
    request.raw?.technicianId?.name ||
    "another technician";
  const isAssignedToMe =
    assignedId && currentUserId && String(assignedId) === String(currentUserId);
  const isAssignedToOther =
    assignedId && currentUserId && String(assignedId) !== String(currentUserId);
  const status = getTechnicianStatus(request.status);
  const isUnassignedPending = request.status === "pending" && !assignedId;
  const isClaimedVerification =
    request.status === "pending" &&
    request.type === "breeding_verification" &&
    isAssignedToMe;

  return (
    <article className="card card-border bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge badge-sm ${request.badgeClass}`}>
                {request.serviceBadge}
              </span>
              <span className={`badge badge-sm badge-soft ${status.badgeClass}`}>
                {status.label}
              </span>
            </div>
            <h3 className="mt-2 font-semibold text-base-content">
              {request.serviceLabel}
            </h3>
            <p className="mt-1 text-sm text-base-content/65">{request.task}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-base-content/45">
            #{String(request.id).slice(0, 6).toUpperCase()}
          </span>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-base-content/50">Farmer</dt>
            <dd className="font-semibold text-base-content">{request.farmer}</dd>
          </div>
          <div>
            <dt className="text-xs text-base-content/50">Location</dt>
            <dd className="flex items-start gap-1 font-medium text-base-content/75">
              <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
              {request.location}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-base-content/50">Requested or scheduled</dt>
            <dd className="flex items-center gap-1 font-medium text-base-content/75">
              <Clock size={14} className="text-primary" /> {request.date}
            </dd>
          </div>
        </dl>

        {isAssignedToOther && (
          <div className="alert alert-warning py-2 text-sm">
            <Lock size={15} />
            <span>Assigned to {assignedName}. You can open it in read-only mode.</span>
          </div>
        )}

        <div className="card-actions justify-end border-t border-base-300 pt-3">
          {isUnassignedPending && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                disabled={isUpdating}
                onClick={() => onDecline(request)}
              >
                <X size={14} /> Decline for me
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isUpdating}
                onClick={() => onClaim(request)}
              >
                <Check size={14} /> Claim
              </button>
            </>
          )}
          {!isUnassignedPending && (
            <button
              type="button"
              className={`btn btn-sm ${isClaimedVerification ? "btn-primary" : ""}`}
              onClick={() => onOpen(request)}
            >
              {isClaimedVerification ? "Verify observation" : "Open details"}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
