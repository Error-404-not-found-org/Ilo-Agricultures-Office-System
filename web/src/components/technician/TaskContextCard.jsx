import { Info, Calendar, Beef, UserRound, Sparkles } from "lucide-react";

// Format helper to clean test seeds (e.g., seed-john -> John)
const sanitizeDisplayVal = (val) => {
  if (!val) return "";
  return String(val)
    .replace(/^seed[-_]/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatTaskTypeLabel = (type) => {
  const t = String(type || "").toUpperCase();
  if (t === "AI") return "Artificial Insemination";
  if (t === "PD") return "Pregnancy Diagnosis";
  if (["CD", "CALVING"].includes(t)) return "Calving Assistance";
  if (["HEALTH", "TREATMENT", "VACCINATION", "DEWORMING"].includes(t)) return "Health Assistance";
  return sanitizeDisplayVal(type);
};

const formatStageLabel = (stage) => {
  if (!stage) return "N/A";
  return String(stage)
    .replace(/^seed[-_]/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function TaskContextCard({ taskContext }) {
  if (!taskContext) return null;

  const typeLabel = formatTaskTypeLabel(taskContext.taskType);
  const stageLabel = formatStageLabel(taskContext.workflowStage);
  const farmerName = sanitizeDisplayVal(taskContext.farmerName || "Not Recorded");
  const animalRef = sanitizeDisplayVal(taskContext.animalReference || "Not Recorded");
  
  const dueDateStr = taskContext.dueDate
    ? new Date(taskContext.dueDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No due date";

  return (
    <div className="alert bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 text-slate-800 dark:text-slate-100 shadow-sm" role="note" aria-label="Task context description">
      <div className="flex items-start gap-3 w-full">
        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
          <Sparkles size={16} aria-hidden="true" />
        </div>
        <div className="space-y-3 w-full">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex flex-wrap items-center gap-2">
              <span>Task Context</span>
              <span className="badge badge-sm badge-success py-1 font-extrabold uppercase text-[9px] tracking-widest">
                {typeLabel}
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold">
              Workflow Stage: {stageLabel}
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 text-xs">
            <div className="flex items-center gap-2">
              <UserRound size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="sr-only">Farmer</dt>
                <dd className="font-bold text-slate-700 dark:text-slate-200 truncate">{farmerName}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Beef size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="sr-only">Animal</dt>
                <dd className="font-bold text-slate-700 dark:text-slate-200 truncate">{animalRef}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              <div>
                <dt className="sr-only">Due Date</dt>
                <dd className="font-bold text-slate-700 dark:text-slate-200">{dueDateStr}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider w-full md:w-auto justify-center">
        <Info size={14} className="shrink-0 animate-pulse" aria-hidden="true" />
        <span>Preview Mode - Submission Disabled</span>
      </div>
    </div>
  );
}
