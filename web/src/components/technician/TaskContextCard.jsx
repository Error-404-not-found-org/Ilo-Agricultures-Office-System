import {
  Info,
  Calendar,
  Beef,
  UserRound,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
const sanitizeDisplayVal = (value) => {
  if (!value) return "";
  return String(value)
    .replace(/^seed[-_]/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};
const formatTaskTypeLabel = (type) => {
  const normalizedType = String(type || "").toUpperCase();
  if (normalizedType === "AI") return "Artificial Insemination";
  if (normalizedType === "PD") return "Pregnancy Diagnosis";
  if (["CD", "CALVING"].includes(normalizedType)) {
    return "Calving Assistance";
  }
  if (
    ["HEALTH", "TREATMENT", "VACCINATION", "DEWORMING"].includes(
      normalizedType,
    )
  ) {
    return "Health Assistance";
  }
  return sanitizeDisplayVal(type);
};
const formatStageLabel = (stage) => {
  if (!stage) return "N/A";
  return String(stage)
    .replace(/^seed[-_]/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};
export default function TaskContextCard({
  taskContext,
  mode = "preview",
}) {
  if (!taskContext) return null;
  const typeLabel = formatTaskTypeLabel(taskContext.taskType);
  const stageLabel = formatStageLabel(taskContext.workflowStage);
  const farmerName = sanitizeDisplayVal(
    taskContext.farmerName || "Not Recorded",
  );
  const animalReference = sanitizeDisplayVal(
    taskContext.animalReference || "Not Recorded",
  );
  const dueDate = taskContext.dueDate
    ? new Date(taskContext.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No due date";
  const isActiveWorkflow = mode === "active";
  return (
    <div
      className="alert flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-slate-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-slate-100 md:flex-row md:items-center"
      role="note"
      aria-label="Task context description"
    >
      <div className="flex w-full items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
          <Sparkles size={16} aria-hidden="true" />
        </div>
        <div className="w-full space-y-3">
          <div>
            <h2 className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <span>Task Context</span>
              <span className="badge badge-success badge-sm py-1 text-[9px] font-extrabold uppercase tracking-widest">
                {typeLabel}
              </span>
            </h2>
            <p className="mt-1 text-[10px] font-semibold text-slate-400">
              Workflow Stage: {stageLabel}
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-3 border-t border-emerald-100 pt-3 text-xs dark:border-emerald-900/40 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <UserRound
                size={14}
                className="shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div>
                <dt className="sr-only">Farmer</dt>
                <dd className="truncate font-bold text-slate-700 dark:text-slate-200">
                  {farmerName}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Beef
                size={14}
                className="shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div>
                <dt className="sr-only">Animal</dt>
                <dd className="truncate font-bold text-slate-700 dark:text-slate-200">
                  {animalReference}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar
                size={14}
                className="shrink-0 text-slate-400"
                aria-hidden="true"
              />
              <div>
                <dt className="sr-only">Due Date</dt>
                <dd className="font-bold text-slate-700 dark:text-slate-200">
                  {dueDate}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
      {isActiveWorkflow ? (
        <div className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 md:w-auto">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>AI Task Workflow</span>
        </div>
      ) : (
        <div className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 md:w-auto">
          <Info size={14} aria-hidden="true" />
          <span>Preview Mode - Submission Disabled</span>
        </div>
      )}
    </div>
  );
}
