import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Search,
  Clock,
  Calendar,
  CheckCircle,
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
import {
  MY_WORK_FILTERS,
  getServicePresentation,
  normalizeServiceType,
  normalizeWorkflowStatus,
  getWorkflowStatusPresentation,
} from "../../utils/requestWorkPresentation";

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
  const [workStateFilter, setWorkStateFilter] = useState(
    () => searchParams.get("workStateFilter") || "active",
  );
  const [selectedTaskWrapper, setSelectedTaskWrapper] = useState(null);
  const [selectedAIRecord, setSelectedAIRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const formatRelativeSchedule = (value) => {
    if (!value) return { date: "No date", time: "—" };
    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime()))
      return { date: "No date", time: "—" };

    const today = new Date();

    // Calculate difference in days (midnight to midnight)
    const tDate = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const currDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const diffTime = tDate - currDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    let datePart;
    if (diffDays === 0) {
      datePart = "Today";
    } else if (diffDays === 1) {
      datePart = "Tomorrow";
    } else if (diffDays === -1) {
      datePart = "Yesterday";
    } else if (diffDays > 1 && diffDays <= 7) {
      datePart = `In ${diffDays} days`;
    } else {
      datePart = targetDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    const timePart = targetDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

    return { date: datePart, time: timePart };
  };

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
      const isCompleted = ["done", "resolved", "completed"].includes(String(task.status).toLowerCase());
      if (workStateFilter === "active") {
        matchesStatus = !isCompleted;
      } else if (workStateFilter === "completed") {
        matchesStatus = isCompleted;
      }

      let matchesType = true;
      if (typeFilter !== "all") {
        matchesType = normalizeServiceType(task) === typeFilter;
      }

      return (!q || haystack.includes(q)) && matchesType && matchesStatus;
    });
  }, [query.data, search, workStateFilter, typeFilter]);

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
        title="Work Queue"
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
                  { id: "active", label: "Active" },
                  { id: "completed", label: "Completed" },
                ].map((status) => (
                  <button
                    type="button"
                    key={status.id}
                    onClick={() => {
                      setWorkStateFilter(status.id);
                      setCurrentPage(1);
                    }}
                    className={`join-item btn btn-sm px-4 whitespace-nowrap ${workStateFilter === status.id ? "btn-neutral" : "bg-base-100 border-base-200 hover:bg-base-200"}`}
                  >
                    {status.label}
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
                  {MY_WORK_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.value === "all" ? "All Services" : filter.label}
                    </option>
                  ))}
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
                      <th className="p-3.5">Schedule</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 w-40 text-right pr-6">Action</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4].map((row) => (
                      <tr key={row}>
                        <td colSpan={6}>
                          <div className="grid grid-cols-[1fr_1.5fr_1fr_1fr_1fr_.2fr] gap-5 py-2">
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
                  {search || typeFilter !== "all" || workStateFilter !== "all"
                    ? "Try adjusting your filters to see more tasks."
                    : "You're all caught up! No tasks assigned to you right now."}
                </p>
                {(search || typeFilter !== "all" || workStateFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      setWorkStateFilter("all");
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
                        <th className="p-3.5">Schedule</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 w-40 text-right pr-6">Action</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-300">
                      {paginatedTasks.map((task) => {
                        const workflowStatus = normalizeWorkflowStatus(task);
                        const statusPresentation = getWorkflowStatusPresentation(workflowStatus);
                        const serviceType = normalizeServiceType(task);
                        const servicePresentation = getServicePresentation(serviceType);
                        const complete = workflowStatus === "completed";
                        const canViewCompletedAI =
                          task.workflowType === "AI" &&
                          task.allowedAction === "VIEW_RECORD";
                        const priority = task.urgent ? 1 : 0;
                        const animalReference =
                          task.animalTag || "Not recorded";
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
                                  {servicePresentation.label}
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
                              <div className="flex flex-col gap-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-sm text-base-content leading-tight">
                                    {toTitleCase(task.farmerName)}
                                  </span>
                                  <span className="font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold tracking-tight">
                                    #
                                    {animalReference.length > 12
                                      ? animalReference.slice(0, 12) + "..."
                                      : animalReference}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-0.5">
                                  <span className="text-base-content/50 truncate max-w-30">
                                    {task.location || "Location not set"}
                                  </span>
                                  <span className="text-base-content/30">
                                    •
                                  </span>
                                  <span className="text-base-content/40 truncate max-w-24">
                                    {task.raw?.animalId?.species ||
                                      task.raw?.animalIds?.[0]?.species ||
                                      "Livestock"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 3. SCHEDULE */}
                            <td className="p-3.5 align-top">
                              {task.workflowType === "AI" ? (
                                <span
                                  className={`block font-bold text-xs ${workflowStatus === "overdue" ? "text-error" : "text-base-content"}`}
                                >
                                  {formatCanonicalAISchedule(task.schedule)}
                                </span>
                              ) : (
                                (() => {
                                const sched = formatRelativeSchedule(
                                  task.displayDate,
                                );
                                return (
                                  <div>
                                    <span
                                      className={`block font-bold text-xs ${workflowStatus === "overdue" ? "text-error" : "text-base-content"}`}
                                    >
                                      {sched.date}
                                    </span>
                                    <span className="text-[11px] text-base-content/60 block mt-0.5 font-medium">
                                      {sched.time}
                                    </span>
                                  </div>
                                );
                                })()
                              )}
                            </td>

                            {/* 4. STATUS */}
                            <td className="p-3.5 align-top">
                              <span
                                className={`badge badge-sm font-bold uppercase tracking-wider text-[9px] border ${statusPresentation.badgeClass}`}
                              >
                                {statusPresentation.label}
                              </span>
                            </td>

                            {/* 5. PRIMARY ACTION */}
                            <td className="p-3.5 align-top pr-6 text-right">
                              {complete && !canViewCompletedAI ? (
                                <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1 mt-1">
                                  <CheckCircle size={13} /> Completed
                                </span>
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
                                    {task.workflowType === "AI"
                                      ? task.actionLabel
                                      : getTaskPrimaryActionLabel(task)}
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
