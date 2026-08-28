import { AlertCircle, AlertTriangle, User } from "lucide-react";

const selectClass =
  "select select-bordered h-11 w-full bg-base-100 text-sm font-medium text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const textareaClass =
  "textarea textarea-bordered min-h-20 w-full resize-none bg-base-100 text-sm font-medium leading-relaxed text-base-content placeholder:text-base-content/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const labelClass = "text-xs font-semibold text-base-content/70";
const headingClass = "text-xs font-bold text-base-content/75";
const sectionClass =
  "min-w-0 space-y-3 rounded-xl border border-base-300 bg-base-200/20 p-4 sm:p-5 lg:col-span-2";

export default function AdminRequestActions({
  showAssignment,
  canReassign,
  requestKey,
  assignedTechnicianId,
  technicians,
  technicianSelectRef,
  cancellationRequested,
  cancellationReason,
  responseNote,
  onResponseNoteChange,
  isSubmitting,
  onCancellationResponse,
}) {
  return (
    <>
      {showAssignment && (
        <section className={sectionClass}>
          <div className="flex items-center gap-2">
            <User size={14} className="text-primary" aria-hidden="true" />
            <h4 className={headingClass}>Technician assignment</h4>
          </div>
          {canReassign ? (
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="assigned-technician">
                Reassign to
              </label>
              <select
                id="assigned-technician"
                key={`${requestKey}-${assignedTechnicianId}`}
                ref={technicianSelectRef}
                defaultValue={assignedTechnicianId || ""}
                className={selectClass}
              >
                <option value="">Select technician</option>
                {technicians.map((technician) => (
                  <option key={technician._id} value={technician._id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div role="alert" className="alert alert-info alert-soft">
              <AlertCircle size={18} aria-hidden="true" />
              <span>
                Unassigned requests must use the normal Technician dispatch flow.
              </span>
            </div>
          )}
        </section>
      )}

      {cancellationRequested && (
        <section className={sectionClass}>
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={14}
              className="text-warning"
              aria-hidden="true"
            />
            <h4 className={headingClass}>Cancellation review</h4>
          </div>
          <p className="text-sm text-base-content/75">
            Reason: {cancellationReason || "No reason provided."}
          </p>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="cancellation-response-note">
              Response note <span className="font-normal">(optional)</span>
            </label>
            <textarea
              id="cancellation-response-note"
              value={responseNote}
              onChange={(event) => onResponseNoteChange(event.target.value)}
              placeholder="Add an administrative response note"
              className={textareaClass}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-warning flex-1"
              disabled={isSubmitting}
              onClick={() => onCancellationResponse(true)}
            >
              Approve cancellation
            </button>
            <button
              type="button"
              className="btn flex-1"
              disabled={isSubmitting}
              onClick={() => onCancellationResponse(false)}
            >
              Decline cancellation
            </button>
          </div>
        </section>
      )}
    </>
  );
}
