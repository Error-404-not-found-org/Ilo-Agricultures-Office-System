import {
  CalendarClock,
  LockKeyhole,
  PawPrint,
} from "lucide-react";
import UserAvatar from "../../components/ui/UserAvatar";
import {
  getTaskReadiness,
  getTaskOperationalStatus,
  getTaskType,
  getWorkflowStageLabel,
} from "../../constants/technicianWorkflow";
import { getTaskPrimaryActionLabel } from "../../utils/taskNavigation";

const formatDue = (value) => {
  if (!value) return "No visit date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No visit date";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function TechnicianTaskCard({ task, onAction, isFocused = false }) {
  const animal = task.animalIds?.[0] || {};
  const farmer = task.farmerId || {};
  const type = getTaskType(task.taskType);
  const status = getTaskOperationalStatus(task);
  const readiness = getTaskReadiness(task);
  const isReady = readiness.ready;
  const animalReference = animal.earTag || animal.animalId || "Not recorded";
  const title =
    (typeof task.notes === "string" ? task.notes.trim() : "") ||
    getWorkflowStageLabel(task);

  return (
    <article
      className={`flex flex-col rounded-box border bg-base-100 p-5 transition-colors ${
        isFocused
          ? "border-primary bg-primary/5"
          : "border-base-300 hover:border-primary/35"
      }`}
      aria-label={`${type.label} for ${farmer.name || "farmer"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className={`badge badge-sm ${type.badgeClass}`}>
            {type.label}
          </span>
          <span className={`badge badge-sm ${status.badgeClass}`}>
            {status.label}
          </span>
        </div>
        {isFocused && (
          <span className="badge badge-primary badge-soft badge-sm">
            Selected
          </span>
        )}
      </div>

      <div className="mt-4">
        <h2 className="text-base font-bold text-base-content">{title}</h2>
        {title !== getWorkflowStageLabel(task) && (
          <p className="mt-1 text-sm text-base-content/60">
            {getWorkflowStageLabel(task)}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-field bg-base-200 p-3">
        <UserAvatar name={farmer.name} imageUrl={farmer.imageUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {farmer.name || "Farmer not recorded"}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-base-content/65">
            <PawPrint size={14} aria-hidden="true" />
            <span className="truncate">Animal {animalReference}</span>
          </div>
        </div>
      </div>

      <div
        className={`mt-4 flex items-center gap-2 text-sm ${
          status.isOverdue ? "font-semibold text-error" : "text-base-content/70"
        }`}
      >
        <CalendarClock size={16} aria-hidden="true" />
        <span>{formatDue(task.dueDate)}</span>
      </div>

      {readiness.reason && (
        <div
          className={`alert mt-4 py-2 text-sm ${
            isReady ? "alert-info alert-soft" : "alert-warning alert-soft"
          }`}
          role="status"
        >
          {!isReady && <LockKeyhole size={17} aria-hidden="true" />}
          <span>{readiness.reason}</span>
        </div>
      )}

      <div className="mt-auto flex justify-end pt-5">
        <button
          type="button"
          className="btn btn-primary min-h-11 w-full sm:w-auto"
          onClick={() => onAction?.(task)}
          disabled={!isReady}
          aria-describedby={!isReady ? `task-lock-${task._id}` : undefined}
        >
          {getTaskPrimaryActionLabel(task)}
        </button>
        {!isReady && (
          <span id={`task-lock-${task._id}`} className="sr-only">
            {readiness.reason}
          </span>
        )}
      </div>
    </article>
  );
}
