import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/ui/Topbar";
import TechnicianTaskCard from "../../components/technician/TechnicianTaskCard";
import PregnancyDiagnosisModal from "../../components/modals/PregnancyDiagnosisModal";
import {
  getTaskReadiness,
  getTaskOperationalStatus,
  getTaskType,
  getWorkflowStageLabel,
} from "../../constants/technicianWorkflow";
import { getTaskPrimaryActionLabel } from "../../utils/taskNavigation";

const formatDue = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "No due date";

const QueueSkeleton = () => (
  <div className="space-y-3" aria-label="Loading work queue">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="flex h-14 items-center gap-4 border-b border-base-300 px-4">
        <div className="skeleton h-4 w-28" /><div className="skeleton h-4 w-20" /><div className="skeleton h-4 flex-1" />
      </div>
    ))}
  </div>
);

export default function WorkQueue() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scope, setScope] = useState("mine");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);

  const query = useQuery({
    queryKey: ["technician", "work-queue", scope],
    queryFn: async () => {
      const response = await axiosInstance.get("/tasks", {
        params: { scope, status: scope === "mine" ? "all" : undefined, limit: 100 },
      });
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
    },
  });

  const claimMutation = useMutation({
    mutationFn: (task) => axiosInstance.put(`/tasks/${task._id}/claim`),
    onSuccess: () => {
      toast.success("Task added to your work queue.");
      queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Could not claim this task."),
  });

  const completeMutation = useMutation({
    mutationFn: (task) => axiosInstance.put(`/tasks/${task._id}/complete`, {}),
    onSuccess: () => {
      toast.success("Task completed.");
      queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] });
    },
    onError: (error) => toast.error(error.response?.data?.message || "Could not complete this task."),
  });

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data || []).filter((task) => {
      const animal = task.animalIds?.[0] || {};
      const haystack = [task.notes, task.farmerId?.name, animal.earTag, animal.animalId, getTaskType(task.taskType).label, getWorkflowStageLabel(task)]
        .filter(Boolean).join(" ").toLowerCase();
      const normalizedStatus = getTaskOperationalStatus(task).label.toLowerCase().replace(" ", "_");
      return (!q || haystack.includes(q)) && (typeFilter === "all" || task.taskType === typeFilter) && (statusFilter === "all" || normalizedStatus === statusFilter);
    });
  }, [query.data, search, statusFilter, typeFilter]);

  const openTask = (task) => {
    const readiness = getTaskReadiness(task);
    if (!readiness.ready) return;
    if (task.taskType === "PD") setSelectedTask(task);
    else if (task.taskType === "AI") navigate(`/technician/walk-in?taskId=${encodeURIComponent(task._id)}`);
    else if (["Health", "Treatment", "Vaccination", "Deworming"].includes(task.taskType)) navigate(`/technician/health?taskId=${encodeURIComponent(task._id)}`);
    else if (["CD", "Calving"].includes(task.taskType)) navigate(`/technician/newborns?taskId=${encodeURIComponent(task._id)}`);
    else completeMutation.mutate(task);
  };

  const focusedTaskId = searchParams.get("taskId");

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-base-200 text-base-content">
      <Topbar title="Work Queue" subtitle="Complete assigned field tasks and lifecycle follow-ups" />
      <main className="space-y-5 p-4 sm:p-6">
        <div className="alert border border-base-300 bg-base-100 text-sm" role="note">
          <ClipboardCheck className="text-primary" size={20} aria-hidden="true" />
          <span><strong>Work Queue</strong> contains operational tasks. New service requests are reviewed and scheduled from the Request Board.</span>
        </div>

        <section className="rounded-2xl border border-base-300 bg-base-100 shadow-xs" aria-labelledby="work-queue-heading">
          <div className="border-b border-base-300 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div><h1 id="work-queue-heading" className="text-lg font-bold">Technician tasks</h1><p className="text-sm text-base-content/65">{tasks.length} task{tasks.length === 1 ? "" : "s"} shown</p></div>
              <div className="tabs tabs-box" role="tablist" aria-label="Queue scope">
                <button className={`tab min-h-11 ${scope === "mine" ? "tab-active" : ""}`} onClick={() => setScope("mine")}>My queue</button>
                <button className={`tab min-h-11 ${scope === "available" ? "tab-active" : ""}`} onClick={() => setScope("available")}>Available tasks</button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
              <label className="input input-bordered flex min-h-11 items-center gap-2"><Search size={17} aria-hidden="true" /><span className="sr-only">Search tasks</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search farmer, animal, or task" className="grow" /></label>
              <select className="select select-bordered min-h-11" aria-label="Filter by task type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All task types</option><option value="AI">AI service</option><option value="PD">Pregnancy</option><option value="Health">Health assistance</option><option value="CD">Calving</option><option value="FollowUp">Follow-up</option><option value="GeneralVisit">General visit</option></select>
              <select className="select select-bordered min-h-11" aria-label="Filter by task status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select>
              <button className="btn btn-ghost min-h-11" onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}>Clear filters</button>
            </div>
          </div>

          {query.isLoading ? <QueueSkeleton /> : query.isError ? (
            <div className="p-8 text-center"><h2 className="font-bold">Couldn’t load the work queue</h2><p className="mt-1 text-sm text-base-content/65">Check your connection and try again.</p><button className="btn btn-primary mt-4 min-h-11" onClick={() => query.refetch()}><RefreshCw size={16} /> Retry</button></div>
          ) : tasks.length === 0 ? (
            <div className="p-10 text-center"><h2 className="font-bold">{search || typeFilter !== "all" || statusFilter !== "all" ? "No tasks match these filters" : "No tasks in this queue"}</h2><p className="mt-1 text-sm text-base-content/65">{search || typeFilter !== "all" || statusFilter !== "all" ? "Try changing the task type, status, or search term." : "Tasks assigned to you or requiring action will appear here."}</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="table table-pin-rows" aria-label="Technician work queue">
                  <thead><tr><th>Task</th><th>Animal</th><th>Farmer</th><th>Due</th><th>Workflow stage</th><th>Status</th><th>Readiness</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{tasks.map((task) => { const animal = task.animalIds?.[0] || {}; const status = getTaskOperationalStatus(task); const readiness = getTaskReadiness(task); const type = getTaskType(task.taskType); const available = !task.technicianId; const complete = ["completed", "done", "cancelled"].includes(String(task.status || "").toLowerCase()); return <tr key={task._id} className={focusedTaskId === task._id ? "bg-primary/10" : "hover"}><td><span className={`badge badge-sm ${type.badgeClass}`}>{type.label}</span></td><td><span className="font-medium" title={animal.earTag || animal.animalId}>{animal.earTag || animal.animalId || "Not recorded"}</span></td><td>{task.farmerId?.name || "Not recorded"}</td><td className={status.isOverdue ? "font-semibold text-error" : ""}>{formatDue(task.dueDate)}</td><td>{getWorkflowStageLabel(task)}</td><td><span className={`badge badge-sm ${status.badgeClass}`}>{status.label}</span></td><td><span className={`badge badge-sm ${readiness.ready ? "badge-success" : "badge-warning"}`} title={readiness.reason}>{readiness.label}</span></td><td>{!complete && <button className="btn btn-primary btn-sm min-h-11 whitespace-nowrap" disabled={!available && !readiness.ready} onClick={() => available ? claimMutation.mutate(task) : openTask(task)} aria-label={`${available ? "Claim" : getTaskPrimaryActionLabel(task)} for ${animal.earTag || animal.animalId || "animal"}`}>{available ? "Claim" : getTaskPrimaryActionLabel(task)}</button>}</td></tr>; })}</tbody>
                </table>
              </div>
              <div className="grid gap-3 p-4 lg:hidden">{tasks.map((task) => <TechnicianTaskCard key={task._id} task={task} onAction={openTask} onClaim={(item) => claimMutation.mutate(item)} />)}</div>
            </>
          )}
        </section>
      </main>
      <PregnancyDiagnosisModal isOpen={Boolean(selectedTask)} onClose={() => setSelectedTask(null)} taskData={selectedTask ? { ...selectedTask, raw: selectedTask } : null} taskId={selectedTask?._id} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician", "work-queue"] })} />
    </div>
  );
}
