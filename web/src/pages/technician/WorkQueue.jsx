import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Search,
  Clock,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  PawPrint,
  UserRound,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import { ui } from "../../components/ui/uiClasses";
import Topbar from "../../components/layout/Topbar";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import WalkInHealthModal from "../../components/dialogs/WalkInHealthModal";
import RecordCalvingModal from "../../components/dialogs/RecordCalvingModal";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import Modal from "../../components/ui/Modal";
import {
  getTaskReadiness,
} from "../../constants/technicianWorkflow";
import {
  getTaskPrimaryActionLabel,
} from "../../utils/taskNavigation";

// Helper to convert strings to Title Case
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const isMongoId = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const getStatusBadgeClass = (status, overdue) => {
  if (overdue) {
    return "badge-error border-error/20 bg-error/10 text-error";
  }
  const s = String(status || "")
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
  switch (s) {
    case "scheduled":
      return "badge-info border-info/20 bg-info/10 text-info";
    case "in-progress":
      return "badge-primary border-primary/20 bg-primary/10 text-primary";
    case "pending":
    case "triaged":
    case "unassigned":
      return "badge-warning border-warning/20 bg-warning/10 text-warning";
    case "approved":
    case "assigned":
      return "badge-accent border-accent/20 bg-accent/10 text-accent";
    case "completed":
    case "done":
    case "resolved":
      return "badge-success border-success/20 bg-success/10 text-success";
    case "declined":
    case "cancelled":
    case "rejected":
      return "badge-error border-error/20 bg-error/10 text-error";
    default:
      return "badge-neutral border-base-300 bg-base-200 text-base-content/70";
  }
};

const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatWorkQueueSchedule = (task = {}) => {
  const scheduleObj = task.schedule || task.raw?.schedule || {};
  const dateValue =
    scheduleObj.date ||
    task.scheduledDate ||
    task.displayDate ||
    task.preferredDate ||
    task.dueDate ||
    task.raw?.scheduledDate ||
    task.raw?.dueDate;

  if (!dateValue) return { dateStr: "Not scheduled", periodStr: "" };

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return { dateStr: "Not scheduled", periodStr: "" };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetKey = localDateKey(date);
  let dateStr;
  if (targetKey === localDateKey(today)) {
    dateStr = "Today";
  } else if (targetKey === localDateKey(tomorrow)) {
    dateStr = "Tomorrow";
  } else if (targetKey === localDateKey(yesterday)) {
    dateStr = "Yesterday";
  } else {
    dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const rawPeriod =
    scheduleObj.visitPeriod ||
    task.visitPeriod ||
    task.raw?.visitPeriod ||
    task.raw?.schedule?.visitPeriod ||
    "";

  let periodStr = "";
  if (rawPeriod) {
    const lower = String(rawPeriod).toLowerCase();
    if (lower === "morning" || lower === "am") {
      periodStr = "Morning";
    } else if (lower === "afternoon" || lower === "pm") {
      periodStr = "Afternoon";
    } else {
      periodStr = `${toTitleCase(rawPeriod)}`;
    }
  }

  return { dateStr, periodStr };
};

const formatCanonicalAISchedule = (schedule = {}) => {
  if (!schedule.date) return "Not scheduled";
  const date = new Date(schedule.date);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const dateLabel = date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const periodLabel = schedule.visitPeriod
    ? toTitleCase(schedule.visitPeriod)
    : null;
  return [dateLabel, periodLabel].filter(Boolean).join(" · ");
};

const formatRecordDate = (value) => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

function MetricCard({ icon, value, label, note }) {
  return (
    <div className="stats border border-base-300 bg-base-100 shadow-sm">
      <div className="stat py-4">
        <div className="stat-figure hidden text-primary sm:block">{icon}</div>
        <div className="stat-title text-xs font-semibold">{label}</div>
        <div className="stat-value text-2xl">{value}</div>
        <div className="stat-desc text-base-content/70">{note}</div>
      </div>
    </div>
  );
}

export default function WorkQueue() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("typeFilter") || "all",
  );
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("statusFilter") || "all",
  );
  const [selectedTaskWrapper, setSelectedTaskWrapper] = useState(null);
  const [selectedAIRecord, setSelectedAIRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const query = useQuery({
    queryKey: ["technician", "work-queue", "mine"],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/work-queue");
      return response.data?.data || [];
    },
  });

  const completeMutation = useMutation({
    mutationFn: (taskId) =>
      axiosInstance.put(`/tasks/${encodeURIComponent(taskId)}/complete`, {}),
    onSuccess: () => {
      toast.success("Task completed.");
      queryClient.invalidateQueries({
        queryKey: ["technician", "work-queue", "mine"],
        exact: true,
      });
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Could not complete this task.",
      ),
  });

  const totalCounts = useMemo(
    () =>
      (query.data || []).filter(
        (t) => !["done", "resolved", "Completed"].includes(t.status),
      ).length,
    [query.data],
  );

  const dueTodayCounts = useMemo(() => {
    return (query.data || []).filter((t) => t.isReadyToday || t.overdue).length;
  }, [query.data]);

  const upcomingCounts = useMemo(() => {
    return (query.data || []).filter(
      (t) =>
        !t.isReadyToday && !t.overdue && new Date(t.displayDate) > new Date(),
    ).length;
  }, [query.data]);

  const onHoldCounts = 0; // Not applicable in unified agenda

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data || []).filter((task) => {
      const haystack = [
        task.task,
        task.farmerName,
        task.animalTag,
        task.serviceType,
        task.taskType,
        task.displayStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let matchesStatus = true;
      if (statusFilter === "due_today") {
        matchesStatus = task.isReadyToday || task.overdue;
      } else if (statusFilter === "upcoming") {
        matchesStatus =
          !task.isReadyToday &&
          !task.overdue &&
          new Date(task.displayDate) > new Date();
      } else if (statusFilter === "completed") {
        matchesStatus = ["done", "resolved", "Completed"].includes(task.status);
      } else if (statusFilter === "all") {
        matchesStatus = !["done", "resolved", "Completed"].includes(
          task.status,
        );
      }

      let matchesType = true;
      if (typeFilter !== "all") {
        if (typeFilter === "AI" && task.type !== "insemination")
          matchesType = false;
        if (typeFilter === "Health" && task.type !== "health")
          matchesType = false;
        if (typeFilter === "PD" && task.raw?.taskType !== "PD")
          matchesType = false;
        if (
          typeFilter === "CD" &&
          !["CD", "Calving"].includes(task.raw?.taskType)
        )
          matchesType = false;
        if (typeFilter === "FollowUp" && task.raw?.taskType !== "Follow-up")
          matchesType = false;
      }

      return (!q || haystack.includes(q)) && matchesType && matchesStatus;
    });
  }, [query.data, search, statusFilter, typeFilter]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return tasks.slice(startIndex, startIndex + itemsPerPage);
  }, [tasks, currentPage, itemsPerPage]);

  const handleStartService = async (task) => {
    try {
      if (task.type === "insemination") {
        await axiosInstance.patch(`/technician/inseminations/${task.workflowId}/status`, {
          status: "in-progress",
        });
      } else if (task.type === "health") {
        await axiosInstance.patch(`/health-requests/${task.workflowId}/status`, {
          status: "in-progress",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["technician"] });
      toast.success("Service started");
    } catch {
      toast.error("Failed to start service");
    }
  };

  const openTask = (task) => {
    switch (task.allowedAction) {
      case "RECORD_SERVICE":
        if (task.workflowType === "AI" && !isMongoId(task.workflowId)) {
          toast.error("This AI work item has an invalid workflow identifier.");
          return;
        }
        setSelectedTaskWrapper(task);
        return;
      case "VIEW_RECORD":
        if (task.workflowType === "AI") {
          if (!isMongoId(task.workflowId)) {
            toast.error("This AI record has an invalid workflow identifier.");
            return;
          }
          setSelectedAIRecord(task);
          return;
        }
        toast.info(
          "Viewing this historical record remains available from its existing workflow.",
        );
        return;
      case "COMPLETE_TASK":
        if (
          task.workflowType !== "StandaloneTask" ||
          !isMongoId(task.taskId)
        ) {
          toast.error("This standalone task has an invalid task identifier.");
          return;
        }
        completeMutation.mutate(task.taskId);
        return;
      case "START_SERVICE":
        if (task.workflowType === "AI") {
          toast.error("AI service recording must use Record Insemination.");
          return;
        }
        handleStartService(task);
        return;
      case "SCHEDULE_VISIT":
        toast.info(
          "Please use the existing Schedule workflow for this service.",
        );
        return;
      case "CLAIM":
      case "CLAIM_AND_SCHEDULE":
        toast.info("Please use the Requests page to claim this work.");
        return;
      default:
        toast.error("This work item does not have a supported action.");
    }
  };

  const focusedTaskId = searchParams.get("taskId");

  return (
    <div className={ui.page}>
      <Topbar
        title="Field Assignments"
        subtitle="Complete assigned field tasks and lifecycle follow-ups"
      />

      <main className={ui.main}>
        {/* ================= 1. METRICS ROW ================= */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            icon={<ClipboardCheck size={21} />}
            value={query.isLoading ? "—" : totalCounts}
            label="Total Tasks"
            note="All pending tasks"
          />
          <MetricCard
            icon={<Clock size={21} />}
            value={query.isLoading ? "—" : dueTodayCounts}
            label="Due Today"
            note="Requires attention"
          />
          <MetricCard
            icon={<Calendar size={21} />}
            value={query.isLoading ? "—" : upcomingCounts}
            label="Upcoming"
            note="Scheduled future tasks"
          />
          <MetricCard
            icon={<Pause size={21} />}
            value={query.isLoading ? "—" : onHoldCounts}
            label="On Hold"
            note="Waiting on prerequisites"
          />
        </section>

        {/* ================= 2. MAIN CARD: FILTERS & TABLE ================= */}
        <section className="card card-border bg-base-100 shadow-sm">
          {/* FILTER BAR */}
          <div className="card-body gap-4 p-4 md:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="join w-full sm:w-auto overflow-x-auto">
                {[
                  { id: "all", label: "All" },
                  { id: "due_today", label: "Today" },
                  { id: "upcoming", label: "Upcoming" },
                  { id: "completed", label: "Completed" },
                  { id: "on_hold", label: "On Hold" },
                ].map((status) => (
                  <button
                    type="button"
                    key={status.id}
                    onClick={() => {
                      setStatusFilter(status.id);
                      setCurrentPage(1);
                    }}
                    className={`join-item btn btn-sm px-4 whitespace-nowrap ${statusFilter === status.id ? "btn-neutral" : "bg-base-100 border-base-200 hover:bg-base-200"}`}
                  >
                    {status.label}
                    {status.id === "due_today" && dueTodayCounts > 0 && (
                      <span className="badge badge-sm badge-error badge-outline ml-1">
                        {dueTodayCounts}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select select-sm select-bordered w-full sm:w-36 bg-base-100 border-base-200 font-medium"
                >
                  <option value="all">All Services</option>
                  <option value="AI">AI Service</option>
                  <option value="PD">Pregnancy</option>
                  <option value="Health">Health</option>
                  <option value="CD">Calving</option>
                  <option value="FollowUp">Follow-up</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search farmer, animal..."
                    className="input input-sm input-bordered w-full pl-8 bg-base-100 border-base-200 font-medium"
                  />
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                  />
                </div>
              </div>
            </div>

            {/* TABLE SECTION */}
            {query.isLoading ? (
              <div
                className="overflow-hidden rounded-box border border-base-300"
                aria-label="Loading work queue"
              >
                <table className="table table-pin-rows w-full text-left min-w-250">
                  <thead>
                    <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-3.5 pl-6">Service</th>
                      <th className="p-3.5">Farmer & Animal</th>
                      <th className="p-3.5">Location</th>
                      <th className="p-3.5">Schedule</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 w-40 text-right pr-6">Action</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4].map((row) => (
                      <tr key={row}>
                        <td colSpan={7}>
                          <div className="grid grid-cols-[1fr_1.5fr_1.2fr_1fr_1fr_1fr_.2fr] gap-5 py-2">
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                            <span className="skeleton h-4" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <ClipboardCheck
                  className="mx-auto mb-3 text-base-content/35"
                  size={24}
                />
                <h2 className="font-bold">No tasks found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {search || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters to see more tasks."
                    : "You're all caught up! No tasks assigned to you right now."}
                </p>
                {(search || typeFilter !== "all" || statusFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      setStatusFilter("all");
                      setCurrentPage(1);
                    }}
                    className="btn btn-sm mt-4"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table table-pin-rows w-full text-left min-w-250">
                    <thead>
                      <tr className="bg-base-200 border-b border-base-300 text-base-content/60 text-[11px] font-bold uppercase tracking-wider">
                        <th className="p-3.5 pl-6">Service</th>
                        <th className="p-3.5">Farmer & Animal</th>
                        <th className="p-3.5">Location</th>
                        <th className="p-3.5">Schedule</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 w-40 text-right pr-6">Action</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {paginatedTasks.map((task) => {
                        const complete = [
                          "done",
                          "resolved",
                          "Completed",
                        ].includes(task.status);
                        const priority = task.urgent ? 1 : 0;
                        const readiness = getTaskReadiness(task.raw || task);
                        const actionDisabled =
                          !readiness.ready ||
                          (task.workflowType === "AI" &&
                            (!task.allowedAction || !task.actionLabel));
                        const animalId =
                          task.raw?.animalId?._id ||
                          task.raw?.animalIds?.[0]?._id;
                        const farmerId = task.raw?.farmerId?._id;
                        const menuId = `task-actions-${String(task.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                        const menuAnchor = `--${menuId}`;

                        return (
                          <tr
                            key={task.id}
                            className={`hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85 ${focusedTaskId === task.id ? "bg-primary/5" : ""}`}
                          >
                            {/* 1. SERVICE */}
                            <td className="p-3.5 pl-6 align-top">
                              <div className="flex flex-col gap-1.5 mt-0.5">
                                <span className="font-bold text-xs text-base-content leading-tight">
                                  {task.serviceType ||
                                    task.taskType ||
                                    "Service"}
                                </span>
                                {priority === 1 && (
                                  <span className="badge badge-error badge-xs badge-outline font-bold uppercase text-[9px]">
                                    Emergency
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 2. FARMER & ANIMAL */}
                            <td className="p-3.5 align-top">
                              <div className="flex flex-col gap-1">
                                <div className="font-bold text-sm text-base-content leading-tight">
                                  {toTitleCase(
                                    task.farmerName ||
                                      task.farmer?.name ||
                                      task.raw?.farmerId?.name ||
                                      "Farmer unavailable",
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-semibold text-primary">
                                    Tag #{task.animalTag || task.animal?.earTag || task.animal?.name || "Not recorded"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 3. LOCATION */}
                            <td className="p-3.5 align-top">
                              <div className="flex items-start gap-1.5 text-xs font-medium text-base-content/85 mt-0.5">
                                <MapPin size={14} className="mt-0.5 shrink-0 text-base-content/45" />
                                <span className="break-words">
                                  {task.location || task.farmer?.location || "Location not set"}
                                </span>
                              </div>
                            </td>

                            {/* 3. SCHEDULE */}
                            <td className="p-3.5 align-top">
                              {task.workflowType === "AI" && task.schedule?.date ? (
                                <span className="block font-bold text-xs text-base-content">
                                  {formatCanonicalAISchedule(task.schedule)}
                                </span>
                              ) : (
                                (() => {
                                  const { dateStr, periodStr } =
                                    formatWorkQueueSchedule(task);
                                  return (
                                    <div>
                                      <span
                                        className={`block font-bold text-xs ${task.overdue ? "text-error" : "text-base-content"}`}
                                      >
                                        {dateStr}
                                      </span>
                                      {periodStr && (
                                        <span className="text-[11px] font-semibold text-primary block mt-0.5">
                                          {periodStr}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()
                              )}
                            </td>

                            {/* 4. STATUS */}
                            <td className="p-3.5 align-top">
                              <span
                                className={`badge badge-sm font-bold uppercase tracking-wider text-[9px] px-2.5 py-1 ${getStatusBadgeClass(complete ? "completed" : (task.displayStatus || task.status), task.overdue && !complete)}`}
                              >
                                {complete ? "Completed" : (task.displayStatus || task.status || "Pending")}
                              </span>
                            </td>

                            {/* 5. PRIMARY ACTION */}
                            <td className="p-3.5 align-top pr-6 text-right">
                              {complete && task.allowedAction !== "VIEW_RECORD" ? (
                                <button
                                  type="button"
                                  disabled
                                  className="btn btn-xs px-4 bg-base-200 border border-base-300 text-base-content/40 cursor-not-allowed font-bold select-none"
                                >
                                  Recorded
                                </button>
                              ) : (
                                <div
                                  className={
                                    !readiness.ready
                                      ? "tooltip tooltip-left inline-block"
                                      : "inline-block"
                                  }
                                  data-tip={
                                    !readiness.ready
                                      ? readiness.reason
                                      : undefined
                                  }
                                >
                                  <button
                                    type="button"
                                    disabled={actionDisabled}
                                    onClick={() => openTask(task)}
                                    className={`btn btn-xs px-4 btn-primary`}
                                  >
                                    {task.allowedAction === "RECORD_SERVICE" && task.workflowType === "AI"
                                      ? (task.actionLabel || "Record Insemination")
                                      : task.allowedAction === "COMPLETE_TASK"
                                        ? getTaskPrimaryActionLabel(task)
                                        : (task.actionLabel ||
                                          (task.workflowType === "AI"
                                            ? "Record"
                                            : getTaskPrimaryActionLabel(task)))}
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* 6. ACTIONS MENU */}
                            <td className="p-3.5 text-right align-top w-12 pr-6">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-square"
                                popoverTarget={menuId}
                                style={{ anchorName: menuAnchor }}
                              >
                                <MoreVertical size={16} />
                              </button>

                              <div
                                id={menuId}
                                popover="auto"
                                className="dropdown w-56 rounded-xl border border-base-200 bg-base-100 p-2 shadow-lg z-50 focus:outline-none"
                                style={{
                                  positionAnchor: menuAnchor,
                                  margin: 0,
                                }}
                              >
                                {(animalId || farmerId) && (
                                  <div className="flex flex-col gap-1">
                                    {animalId && (
                                      <button
                                        className="flex items-center gap-3 px-4 py-3 min-h-11 w-full text-left text-sm font-medium rounded-box hover:bg-base-200 transition-colors duration-150 cursor-pointer text-base-content"
                                        onClick={() => {
                                          document
                                            .getElementById(menuId)
                                            .hidePopover();
                                          navigate(
                                            `/technician/animals/${animalId}`,
                                          );
                                        }}
                                      >
                                        <PawPrint
                                          size={18}
                                          className="text-base-content/60"
                                        />{" "}
                                        View Animal Record
                                      </button>
                                    )}
                                    {farmerId && (
                                      <button
                                        className="flex items-center gap-3 px-4 py-3 min-h-11 w-full text-left text-sm font-medium rounded-box hover:bg-base-200 transition-colors duration-150 cursor-pointer text-base-content"
                                        onClick={() => {
                                          document
                                            .getElementById(menuId)
                                            .hidePopover();
                                          navigate(
                                            `/technician/farmers/${farmerId}`,
                                          );
                                        }}
                                      >
                                        <UserRound
                                          size={18}
                                          className="text-base-content/60"
                                        />{" "}
                                        View Farmer Profile
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {tasks.length > itemsPerPage && (
                  <div className="pt-3 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-base-content/60">
                      Showing {(currentPage - 1) * itemsPerPage + 1}–
                      {Math.min(currentPage * itemsPerPage, tasks.length)} of{" "}
                      {tasks.length}
                    </span>
                    <div className="join">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="join-item btn btn-xs btn-outline border-base-300 bg-base-100"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(
                              Math.ceil(tasks.length / itemsPerPage),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          currentPage === Math.ceil(tasks.length / itemsPerPage)
                        }
                        className="join-item btn btn-xs btn-outline border-base-300 bg-base-100"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <PregnancyDiagnosisModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "PD"}
        onClose={() => setSelectedTaskWrapper(null)}
        taskData={selectedTaskWrapper?.raw}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
      <AIServiceModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "AI"}
        context="task"
        onClose={() => setSelectedTaskWrapper(null)}
        taskData={selectedTaskWrapper?.raw}
        workflowId={selectedTaskWrapper?.workflowId || null}
        taskId={selectedTaskWrapper?.taskId || null}
        requestContext={selectedTaskWrapper}
        preSelectedFarmer={
          selectedTaskWrapper?.raw?.farmerId ||
          (selectedTaskWrapper?.farmer
            ? {
                ...selectedTaskWrapper.farmer,
                _id: selectedTaskWrapper.farmer.id,
                phoneNumber: selectedTaskWrapper.farmer.phone,
              }
            : null)
        }
        preSelectedAnimal={
          selectedTaskWrapper?.raw?.animalId ||
          (selectedTaskWrapper?.animal
            ? {
                ...selectedTaskWrapper.animal,
                _id: selectedTaskWrapper.animal.id,
                earTag: selectedTaskWrapper.animal.earTag,
              }
            : null)
        }
        onSuccess={() => setSelectedTaskWrapper(null)}
      />
      <WalkInHealthModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "Health"}
        onClose={() => setSelectedTaskWrapper(null)}
        taskData={selectedTaskWrapper?.raw}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
      <RecordCalvingModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "Calving"}
        onClose={() => setSelectedTaskWrapper(null)}
        taskData={selectedTaskWrapper?.raw}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
      <Modal
        isOpen={Boolean(selectedAIRecord)}
        onClose={() => setSelectedAIRecord(null)}
        title="Insemination record"
        subtitle="Completed AI service summary"
        size="md"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setSelectedAIRecord(null)}
          >
            Close
          </button>
        }
      >
        {selectedAIRecord && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-base-content/55">Farmer</p>
                <p className="font-semibold">{selectedAIRecord.farmer?.name}</p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Animal</p>
                <p className="font-semibold">
                  {selectedAIRecord.animal?.name}
                  {selectedAIRecord.animal?.earTag
                    ? ` · Tag ${selectedAIRecord.animal.earTag}`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Scheduled visit</p>
                <p className="font-semibold">
                  {formatCanonicalAISchedule(selectedAIRecord.schedule)}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Completed</p>
                <p className="font-semibold">
                  {formatRecordDate(selectedAIRecord.completedAt)}
                </p>
              </div>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
              <p className="text-xs text-base-content/55">Recorded service</p>
              <p className="font-semibold">
                {selectedAIRecord.raw?.sireBreed || "Sire breed not recorded"}
                {selectedAIRecord.raw?.sireCode
                  ? ` · ${selectedAIRecord.raw.sireCode}`
                  : ""}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
