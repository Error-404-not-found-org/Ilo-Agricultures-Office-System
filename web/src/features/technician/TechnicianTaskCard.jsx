import { CalendarClock, LockKeyhole, UserRound, Beef } from "lucide-react";
import {
  getTaskReadiness,
  getTaskOperationalStatus,
  getTaskType,
  getWorkflowStageLabel,
} from "../../constants/technicianWorkflow";
import { getTaskPrimaryActionLabel } from "../../utils/taskNavigation";
import { getTaskWorkflowSummary } from "../../utils/reproductionWorkflow";

const formatDue = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "No due date";

export default function TechnicianTaskCard({ task, onAction, onClaim }) {
  const animal = task.animalIds?.[0] || {};
  const farmer = task.farmerId || {};
  const type = getTaskType(task.taskType);
  const status = getTaskOperationalStatus(task);
  const readiness = getTaskReadiness(task);
  const workflowSummary = getTaskWorkflowSummary(task);
  const isAvailable = !task.technicianId;
  const isComplete = ["completed", "done", "cancelled"].includes(String(task.status || "").toLowerCase());

  return (
    <article className="card border border-base-300 bg-base-100 shadow-xs focus-within:ring-2 focus-within:ring-primary/40">
      <div className="card-body gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className={`badge badge-sm ${type.badgeClass}`}>{type.label}</span>
              <span className={`badge badge-sm ${status.badgeClass}`}>{status.label}</span>
            </div>
            <h2 className="card-title text-base">{getWorkflowStageLabel(task)}</h2>
          </div>
          {!readiness.ready && <LockKeyhole className="shrink-0 text-warning" size={20} aria-hidden="true" />}
        </div>

        <dl className="grid gap-2 text-sm text-base-content/75 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2">
            <Beef size={16} aria-hidden="true" />
            <dt className="sr-only">Animal</dt>
            <dd className="truncate" title={animal.earTag || animal.animalId || "Animal not recorded"}>
              {animal.earTag || animal.animalId || "Animal not recorded"}
              {animal.animalId && animal.earTag && <span className="sr-only">. Full animal identifier: {animal.animalId}</span>}
            </dd>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <UserRound size={16} aria-hidden="true" />
            <dt className="sr-only">Farmer</dt>
            <dd className="truncate">{farmer.name || "Farmer not recorded"}</dd>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <CalendarClock size={16} aria-hidden="true" />
            <dt className="sr-only">Due</dt>
            <dd className={status.isOverdue ? "font-semibold text-error" : ""}>{formatDue(task.dueDate)}</dd>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <dt className="font-semibold text-base-content/60">Source:</dt>
            <dd>{workflowSummary.sourceLabel}</dd>
          </div>
        </dl>

        {readiness.reason && (
          <div className={`alert py-2 text-sm ${readiness.ready ? "alert-info" : "alert-warning"}`} role="status">
            <span>{readiness.reason}</span>
          </div>
        )}

        {!isComplete && (
          <p className="text-sm text-base-content/70">
            <span className="font-semibold text-base-content">Next:</span>{" "}
            {workflowSummary.nextActionLabel}
          </p>
        )}

        <div className="card-actions justify-end">
          {!isComplete && <button
            type="button"
            className="btn btn-primary min-h-11"
            onClick={() => (isAvailable ? onClaim?.(task) : onAction?.(task))}
            disabled={!isAvailable && !readiness.ready}
            aria-describedby={!readiness.ready ? `task-lock-${task._id}` : undefined}
          >
            {isAvailable ? "Claim task" : getTaskPrimaryActionLabel(task)}
          </button>}
          {!readiness.ready && <span id={`task-lock-${task._id}`} className="sr-only">{readiness.reason}</span>}
        </div>
      </div>
    </article>
  );
}
