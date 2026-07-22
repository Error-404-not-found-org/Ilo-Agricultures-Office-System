import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  RefreshCw,
  Search,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  Activity,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Beef,
  UserRound,
  Pause,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import TechnicianTaskCard from "../../features/technician/TechnicianTaskCard";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import {
  getTaskReadiness,
  getTaskOperationalStatus,
  getTaskType,
  getWorkflowStageLabel,
} from "../../constants/technicianWorkflow";
import {
  getTaskPrimaryActionLabel,
  normalizeTaskContext,
  getTaskActionTarget,
  buildTaskNavigationState,
} from "../../utils/taskNavigation";
import {
  isActiveTask,
  isOnHoldTask,
  isTaskCompletedThisWeek,
  isTaskDueToday,
  isTaskScheduledThisWeek,
  isTaskUpcoming,
  isTerminalTask,
} from "../../utils/workQueue";
import { getTaskWorkflowSummary } from "../../utils/reproductionWorkflow";

// Helper to convert strings to Title Case
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getVisitTypeMeta = (taskType) => {
  const t = String(taskType).toUpperCase();
  if (t === "AI") {
    return {
      label: "AI Service",
      icon: "💉",
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    };
  }
  if (t === "PD") {
    return {
      label: "Pregnancy Diagnosis",
      icon: "🧬",
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    };
  }
  if (t === "HEALTH") {
    return {
      label: "Health Assistance",
      icon: "🩺",
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    };
  }
  if (t === "CD") {
    return {
      label: "Calving Assistance",
      icon: "🐄",
      color: "text-pink-500 bg-pink-500/10 border-pink-500/20",
    };
  }
  if (t === "FOLLOWUP") {
    return {
      label: "Follow-up Visit",
      icon: "📋",
      color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    };
  }
  if (t === "GENERALVISIT" || t === "GENERAL_VISIT") {
    return {
      label: "General Check-up",
      icon: "🩺",
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    };
  }
  return {
    label: taskType || "Task",
    icon: "📋",
    color: "text-base-content/70 bg-base-200 border-base-300",
  };
};

const QueueSkeleton = () => (
  <div className="space-y-3 p-6" aria-label="Loading work queue">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="flex h-14 items-center gap-4 border-b border-base-300 px-4"
      >
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-4 flex-1" />
      </div>
    ))}
  </div>
);

export default function WorkQueue() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scope, setScope] = useState(() => searchParams.get("scope") || "mine");
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("typeFilter") || "all",
  );
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("statusFilter") || "all",
  );
  const [selectedTask, setSelectedTask] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const itemsPerPage = 8;
  const [showSidebar, setShowSidebar] = useState(true);

  const formatRelativeSchedule = (value) => {
    if (!value) return { date: "No date", time: "—" };
    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime())) return { date: "No date", time: "—" };

    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const targetDateStr = targetDate.toDateString();
    const todayStr = today.toDateString();
    const tomorrowStr = tomorrow.toDateString();
    const yesterdayStr = yesterday.toDateString();

    let datePart;
    if (targetDateStr === todayStr) {
      datePart = "Today";
    } else if (targetDateStr === tomorrowStr) {
      datePart = "Tomorrow";
    } else if (targetDateStr === yesterdayStr) {
      datePart = "Yesterday";
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
    queryKey: ["technician", "work-queue", scope],
    queryFn: async () => {
      const pageSize = 100;
      const allTasks = [];
      let page = 1;

      while (true) {
        const response = await axiosInstance.get("/tasks", {
          params: {
            scope,
            status: scope === "mine" ? "all" : undefined,
            page,
            limit: pageSize,
          },
        });
        const pageTasks = Array.isArray(response.data)
          ? response.data
          : response.data?.data || [];
        allTasks.push(...pageTasks);

        if (pageTasks.length < pageSize) break;
        page += 1;
      }

      return allTasks;
    },
  });

  const claimMutation = useMutation({
    mutationFn: (task) => axiosInstance.put(`/tasks/${task._id}/claim`),
    onSuccess: () => {
      toast.success("Task added to your work queue.");
      queryClient.invalidateQueries({ queryKey: ["technician"] });
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Could not claim this task.",
      ),
  });

  const completeMutation = useMutation({
    mutationFn: (task) => axiosInstance.put(`/tasks/${task._id}/complete`, {}),
    onSuccess: () => {
      toast.success("Task completed.");
      queryClient.invalidateQueries({ queryKey: ["technician"] });
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Could not complete this task.",
      ),
  });

  const totalCounts = useMemo(
    () => (query.data || []).filter(isActiveTask).length,
    [query.data],
  );

  const dueTodayCounts = useMemo(() => {
    return (query.data || []).filter((task) => isTaskDueToday(task)).length;
  }, [query.data]);

  const upcomingCounts = useMemo(() => {
    return (query.data || []).filter((task) => isTaskUpcoming(task)).length;
  }, [query.data]);

  const completedCounts = useMemo(() => {
    return (query.data || []).filter((task) =>
      isTaskCompletedThisWeek(task),
    ).length;
  }, [query.data]);

  const onHoldCounts = useMemo(() => {
    return (
      (query.data || []).filter((task) => {
        return isOnHoldTask(task);
      }).length || 0
    );
  }, [query.data]);

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data || []).filter((task) => {
      const animal = task.animalIds?.[0] || {};
      const haystack = [
        task.notes,
        task.farmerId?.name,
        animal.earTag,
        animal.animalId,
        getTaskType(task.taskType).label,
        getWorkflowStageLabel(task),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const opStatus = getTaskOperationalStatus(task)
        .label.toLowerCase()
        .replace(" ", "_");

      // Custom scope filtering based on user clicks
      let matchesStatus = true;
      if (statusFilter === "due_today") {
        matchesStatus = isTaskDueToday(task);
      } else if (statusFilter === "upcoming") {
        matchesStatus = isTaskUpcoming(task);
      } else if (statusFilter === "on_hold") {
        matchesStatus = isOnHoldTask(task);
      } else if (statusFilter === "all") {
        matchesStatus = isActiveTask(task);
      } else if (statusFilter !== "all") {
        matchesStatus = opStatus === statusFilter;
      }

      return (
        (!q || haystack.includes(q)) &&
        (typeFilter === "all" || task.taskType === typeFilter) &&
        matchesStatus
      );
    });
  }, [query.data, search, statusFilter, typeFilter]);

  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return tasks.slice(startIndex, startIndex + itemsPerPage);
  }, [tasks, currentPage, itemsPerPage]);

  const openTask = (task) => {
    const readiness = getTaskReadiness(task);
    if (!readiness.ready) return;

    const context = normalizeTaskContext(task);
    const target = getTaskActionTarget(context);

    if (target.type === "modal") {
      if (task.taskType === "PD") setSelectedTask(task);
    } else if (target.type === "route") {
      const returnParams = new URLSearchParams();
      if (scope) returnParams.set("scope", scope);
      if (search) returnParams.set("search", search);
      if (typeFilter) returnParams.set("typeFilter", typeFilter);
      if (statusFilter) returnParams.set("statusFilter", statusFilter);
      if (context.taskId) returnParams.set("taskId", context.taskId);
      const returnToPath = `/technician/work-queue?${returnParams.toString()}`;

      const navState = buildTaskNavigationState(context, returnToPath);
      navigate(`${target.path}?taskId=${encodeURIComponent(context.taskId)}`, {
        state: navState,
      });
    } else {
      completeMutation.mutate(task);
    }
  };

  const focusedTaskId = searchParams.get("taskId");

  // Sidebar dynamic counts mapping
  const categorizedTaskCounts = dueTodayCounts + upcomingCounts + onHoldCounts;
  const otherActiveCounts = Math.max(totalCounts - categorizedTaskCounts, 0);
  const duePercent = totalCounts
    ? Math.round((dueTodayCounts / totalCounts) * 100)
    : 0;
  const upPercent = totalCounts
    ? Math.round((upcomingCounts / totalCounts) * 100)
    : 0;
  const holdPercent = totalCounts
    ? Math.round((onHoldCounts / totalCounts) * 100)
    : 0;
  const otherPercent = Math.max(100 - duePercent - upPercent - holdPercent, 0);

  // Sidebar list of today's schedule timeline
  const todayTimelineTasks = useMemo(() => {
    return (query.data || [])
      .filter((task) => isTaskDueToday(task))
      .slice(0, 4)
      .map((task) => {
        const animal = task.animalIds?.[0] || {};
        const meta = getVisitTypeMeta(task.taskType);
        const timeStr = new Date(task.dueDate).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        return {
          id: task._id,
          time: timeStr,
          title: meta.label,
          animal: `${animal.earTag ? `Tag #${animal.earTag.length > 12 ? animal.earTag.slice(0, 12) + "..." : animal.earTag}` : "Livestock"}`,
          farm:
            task.farmerId?.farmName ||
            task.farmerId?.name ||
            "Farm not recorded",
          bulletColor:
            task.taskType === "AI"
              ? "bg-blue-500"
              : task.taskType === "PD"
                ? "bg-rose-500"
                : "bg-emerald-500",
        };
      });
  }, [query.data]);

  // Sidebar top farms with tasks
  const topFarmsList = useMemo(() => {
    const counts = new Map();
    (query.data || []).filter((task) => isTaskScheduledThisWeek(task)).forEach((t) => {
      if (t.farmerId?.name) {
        const key = t.farmerId._id || t.farmerId.name;
        const current = counts.get(key) || {
          farmer: t.farmerId.name,
          farm: t.farmerId.farmName || "Farm not recorded",
          count: 0,
        };
        counts.set(key, { ...current, count: current.count + 1 });
      }
    });
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [query.data]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-y-auto bg-base-200/50 text-base-content">
      <Topbar
        title="Work Queue"
        subtitle="Complete assigned field tasks and lifecycle follow-ups"
      />

      <main className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-6 w-full">
        {/* ================= 1. DOCK OF STATISTICS CARDS ================= */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Card: Total Tasks */}
          <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 flex flex-row items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-base-content leading-none">
                {query.isLoading ? "..." : totalCounts}
              </p>
              <h4 className="text-xs font-black text-base-content/80 mt-1">
                Total Tasks
              </h4>
              <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">
                All pending tasks
              </p>
            </div>
          </div>

          {/* Card: Due Today */}
          <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 flex flex-row items-center gap-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-base-content leading-none">
                {query.isLoading ? "..." : dueTodayCounts}
              </p>
              <h4 className="text-xs font-black text-base-content/80 mt-1">
                Due Today
              </h4>
              <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">
                Needs attention
              </p>
            </div>
          </div>

          {/* Card: Upcoming */}
          <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 flex flex-row items-center gap-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <Calendar size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-base-content leading-none">
                {query.isLoading ? "..." : upcomingCounts}
              </p>
              <h4 className="text-xs font-black text-base-content/80 mt-1">
                Upcoming
              </h4>
              <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">
                Scheduled
              </p>
            </div>
          </div>

          {/* Card: On Hold */}
          <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 flex flex-row items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
              <Pause size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-base-content leading-none">
                {query.isLoading ? "..." : onHoldCounts}
              </p>
              <h4 className="text-xs font-black text-base-content/80 mt-1">
                On Hold
              </h4>
              <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">
                Paused tasks
              </p>
            </div>
          </div>

          {/* Card: Completed */}
          <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 flex flex-row items-center gap-4 col-span-2 md:col-span-1">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle size={22} />
            </div>
            <div>
              <p className="text-2xl font-black text-base-content leading-none">
                {query.isLoading ? "..." : completedCounts}
              </p>
              <h4 className="text-xs font-black text-base-content/80 mt-1">
                Completed
              </h4>
              <p className="text-[9px] font-bold text-base-content/40 uppercase tracking-wider">
                This week
              </p>
            </div>
          </div>
        </section>

        {/* ================= 2. PRIMARY SPLIT LAYOUT ================= */}
        <div className={`grid grid-cols-1 ${showSidebar ? "lg:grid-cols-[1fr_340px]" : "lg:grid-cols-1"} gap-6 items-start`}>
          {/* LEFT COLUMN: FILTERS, TABLE LIST, PAGINATION */}
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 space-y-4">
              {/* Tab Header Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Geolocation Capsule & Tabs combo */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Scope Switcher: My queue vs Available */}
                  <div
                    id="work-queue-scope"
                    role="tablist"
                    aria-label="Queue scope"
                    className="tabs tabs-box bg-base-200 border border-base-300/40 p-0.5 rounded-full overflow-x-auto max-w-full"
                  >
                    <button
                      role="tab"
                      className={`tab tab-xs sm:tab-sm rounded-full whitespace-nowrap text-xs font-bold transition-all px-4 ${
                        scope === "mine"
                          ? "tab-active bg-emerald-500 text-white shadow-sm"
                          : "text-base-content/55 hover:text-base-content"
                      }`}
                      onClick={() => {
                        setScope("mine");
                        setCurrentPage(1);
                      }}
                    >
                      My Queue
                    </button>
                    <button
                      role="tab"
                      className={`tab tab-xs sm:tab-sm rounded-full whitespace-nowrap text-xs font-bold transition-all px-4 ${
                        scope === "available"
                          ? "tab-active bg-emerald-500 text-white shadow-sm"
                          : "text-base-content/55 hover:text-base-content"
                      }`}
                      onClick={() => {
                        setScope("available");
                        setCurrentPage(1);
                      }}
                    >
                      Available Tasks
                    </button>
                  </div>

                  {/* Divider line */}
                  <div className="w-[1px] h-6 bg-base-300 mx-1" />

                  {/* Status Capsule Filters */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                      { id: "all", label: `All Tasks (${totalCounts})` },
                      {
                        id: "due_today",
                        label: `Due Today (${dueTodayCounts})`,
                      },
                      { id: "upcoming", label: `Upcoming (${upcomingCounts})` },
                      { id: "on_hold", label: `On Hold (${onHoldCounts})` },
                    ].map((status) => (
                      <button
                        key={status.id}
                        onClick={() => {
                          setStatusFilter(status.id);
                          setCurrentPage(1);
                        }}
                        className={`btn btn-xs rounded-full px-3 font-black border transition-all ${
                          statusFilter === status.id
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
                            : "bg-base-200/50 border-base-300/50 text-base-content/65 hover:bg-base-300"
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right side queries information */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  <div className="text-xs font-bold text-base-content/55 whitespace-nowrap flex items-center gap-1.5 mr-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {query.isLoading
                      ? "Locating records..."
                      : `${tasks.length} task${tasks.length !== 1 ? "s" : ""} shown`}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="btn btn-xs btn-outline border-base-300 text-base-content/75 hover:bg-base-200 gap-1 rounded-xl cursor-pointer"
                  >
                    <Activity size={10} />
                    <span>{showSidebar ? "Hide Analytics" : "Show Analytics"}</span>
                  </button>
                </div>
              </div>

              {/* Sub-Filters Dropdown Line */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-base-200">
                {/* Search Text Input */}
                <div className="form-control w-full col-span-2 md:col-span-1">
                  <div className="relative w-full">
                    <label htmlFor="work-queue-search" className="sr-only">
                      Search tasks
                    </label>
                    <input
                      id="work-queue-search"
                      name="work-queue-search"
                      type="text"
                      placeholder="Search farmer, animal, or task"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="input input-bordered input-sm w-full pl-8 font-bold text-xs"
                    />
                    <Search
                      size={12}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30"
                    />
                  </div>
                </div>

                {/* Service Type Selector */}
                <div className="form-control w-full">
                  <label htmlFor="work-queue-task-type" className="sr-only">
                    Filter by task type
                  </label>
                  <select
                    id="work-queue-task-type"
                    name="work-queue-task-type"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="select select-bordered select-sm w-full font-bold text-xs"
                  >
                    <option value="all">All task types</option>
                    <option value="AI">AI service</option>
                    <option value="PD">Pregnancy</option>
                    <option value="Health">Health assistance</option>
                    <option value="CD">Calving</option>
                    <option value="FollowUp">Follow-up</option>
                    <option value="GeneralVisit">General visit</option>
                  </select>
                </div>

                {/* Status Selector */}
                <div className="form-control w-full">
                  <label htmlFor="work-queue-status" className="sr-only">
                    Filter by task status
                  </label>
                  <select
                    id="work-queue-status"
                    name="work-queue-status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="select select-bordered select-sm w-full font-bold text-xs"
                  >
                    <option value="all">All statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                {/* Filters Reset Button */}
                <button
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className="btn btn-sm btn-ghost gap-1.5 font-bold text-xs border border-base-300 hover:bg-base-200 shrink-0 cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            </div>

            {/* Main items display grid/list */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl overflow-hidden">
              {query.isLoading ? (
                <QueueSkeleton />
              ) : query.isError ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                  <AlertCircle size={36} className="text-rose-500/40" />
                  <h2 className="text-sm font-black text-base-content/75 uppercase tracking-widest mt-1">
                    Couldn’t load the work queue
                  </h2>
                  <p className="text-xs font-semibold text-base-content/40 max-w-sm">
                    Check your connection and try again.
                  </p>
                  <button
                    className="btn btn-sm btn-primary rounded-full mt-2"
                    onClick={() => query.refetch()}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                  <ClipboardCheck size={36} className="text-base-content/20" />
                  <h3 className="text-sm font-black text-base-content/75 uppercase tracking-widest mt-1">
                    {search || typeFilter !== "all" || statusFilter !== "all"
                      ? "No tasks match these filters"
                      : "No tasks in this queue"}
                  </h3>
                  <p className="text-xs font-semibold text-base-content/40 max-w-sm">
                    {search || typeFilter !== "all" || statusFilter !== "all"
                      ? "Try changing the task type, status, or search term."
                      : "Tasks assigned to you or requiring action will appear here."}
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="hidden overflow-x-auto lg:block"
                    data-testid="work-queue-table-scroll"
                  >
                    <table
                      className="table table-pin-rows w-full min-w-[820px] text-left"
                      aria-label="Technician work queue"
                    >
                      <thead>
                        <tr className="border-b border-base-300 bg-base-200/40 text-base-content/70 font-bold text-xs uppercase tracking-wider">
                          <th scope="col" className="p-4 pl-6">Animal</th>
                          <th scope="col" className="p-4">Visit</th>
                          <th scope="col" className="p-4">Schedule</th>
                          <th scope="col" className="p-4">Status</th>
                          <th scope="col" className="w-36 p-4 pr-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTasks.map((task) => {
                          const animal = task.animalIds?.[0] || {};
                          const status = getTaskOperationalStatus(task);
                          const readiness = getTaskReadiness(task);
                          const workflowSummary = getTaskWorkflowSummary(task);
                          const typeMeta = getVisitTypeMeta(task.taskType);
                          const available = !task.technicianId;
                          const complete = isTerminalTask(task);

                          const priority = Number(task.priority);
                          const priorityLabel =
                            priority === 1
                              ? "High"
                              : priority === 2
                                ? "Medium"
                                : priority === 3
                                  ? "Low"
                                  : "Not set";
                          const priorityClass =
                            priority === 1
                              ? "badge-error"
                              : priority === 2
                                ? "badge-warning"
                                : priority === 3
                                  ? "badge-ghost"
                                  : "badge-neutral";
                          const animalReference =
                            animal.earTag || animal.animalId || "Not recorded";
                          const actionDisabled = !available && !readiness.ready;
                          const readinessId = `work-queue-readiness-${task._id}`;
                          const animalId = animal._id || animal.id;
                          const farmerId = task.farmerId?._id || task.farmerId?.id;
                          const menuId = `task-actions-${String(task._id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                          const menuAnchor = `--${menuId}`;
                          const closeActionMenu = (event) => {
                            event.currentTarget.closest("[popover]")?.hidePopover?.();
                          };

                          return (
                            <tr
                              key={task._id}
                              className={`border-b border-base-200/50 hover:bg-base-200/25 transition-colors text-xs font-semibold text-base-content/85 ${
                                focusedTaskId === task._id
                                  ? "bg-primary/5 border-l-4 border-l-primary"
                                  : ""
                              }`}
                            >
                              {/* 1. ANIMAL (Icon + Tag ID + Farmer Name) */}
                              <td className="p-4 pl-6">
                                <div className="flex items-center gap-3">
                                  <UserAvatar
                                    name={task.farmerId?.name}
                                    imageUrl={task.farmerId?.imageUrl}
                                  />
                                  <div>
                                    {(() => {
                                      const rawTag =
                                        animal.earTag ||
                                        animal.animalId ||
                                        "Not recorded";
                                      const slicedTag =
                                        rawTag.length > 12
                                          ? rawTag.slice(0, 12) + "..."
                                          : rawTag;
                                      return (
                                        <span
                                          className="font-extrabold text-[11px] text-base-content block leading-tight break-all max-w-[150px]"
                                          title={
                                            animal.name || `Tag #${rawTag}`
                                          }
                                        >
                                          {animal.name || `Tag #${slicedTag}`}
                                        </span>
                                      );
                                    })()}
                                    <span className="text-[10px] text-base-content/50 block mt-0.5 font-bold">
                                      {task.farmerId?.name
                                        ? toTitleCase(task.farmerId.name)
                                        : "Farmer not recorded"}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 2. VISIT (Type + Priority) */}
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs shrink-0 ${typeMeta.color}`}
                                  >
                                    {typeMeta.icon}
                                  </div>
                                  <div>
                                    <span className="font-bold text-base-content/90 text-xs block leading-tight">
                                      {typeMeta.label}
                                    </span>
                                    <span className={`badge badge-xs mt-1 font-black uppercase ${priorityClass}`}>
                                      {priorityLabel}
                                    </span>
                                    <span className="mt-1 block max-w-48 text-[9px] font-bold text-base-content/60">
                                      {getWorkflowStageLabel(task)}
                                    </span>
                                    <span className="mt-0.5 block max-w-48 text-[9px] font-semibold text-base-content/60">
                                      Source: {workflowSummary.sourceLabel}
                                    </span>
                                    <span className="mt-0.5 block max-w-48 text-[9px] font-semibold text-base-content/70">
                                      Next: {workflowSummary.nextActionLabel}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* 3. SCHEDULE */}
                              <td className="p-4">
                                {(() => {
                                  const sched = formatRelativeSchedule(task.dueDate);
                                  return (
                                    <>
                                      <span className="block font-bold text-xs">{sched.date}</span>
                                      <span className="text-[10px] text-base-content/60 block mt-0.5 font-bold">
                                        {sched.time}
                                      </span>
                                    </>
                                  );
                                })()}
                              </td>

                              {/* 4. STATUS */}
                              <td className="p-4">
                                <span
                                  className={`badge badge-sm rounded-full font-bold uppercase tracking-wider text-[9px] ${status.badgeClass}`}
                                >
                                  {status.label}
                                </span>
                              </td>

                              {/* 5. ACTIONS */}
                              <td className="p-4 pr-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span
                                    className={`badge badge-sm whitespace-nowrap ${
                                      complete
                                        ? "badge-success"
                                        : readiness.ready
                                          ? "badge-success badge-soft"
                                          : "badge-warning badge-soft"
                                    }`}
                                  >
                                    {complete ? "Completed" : readiness.label}
                                  </span>

                                  {(!complete || animalId || farmerId) && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm btn-square focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                        aria-label={`More actions for ${animalReference}`}
                                        aria-haspopup="menu"
                                        aria-expanded={openActionMenuId === task._id}
                                        popoverTarget={menuId}
                                        style={{ anchorName: menuAnchor }}
                                      >
                                        <MoreVertical size={18} aria-hidden="true" />
                                      </button>

                                      <ul
                                        id={menuId}
                                        popover="auto"
                                        role="menu"
                                        aria-label={`Actions for ${animalReference}`}
                                        onToggle={(event) =>
                                          setOpenActionMenuId(
                                            event.newState === "open" ? task._id : null,
                                          )
                                        }
                                        style={{ positionAnchor: menuAnchor }}
                                        className="dropdown dropdown-end menu menu-sm w-64 rounded-box border border-base-300 bg-base-100 p-2 text-left text-base-content shadow-md"
                                      >
                                        {!complete && (
                                          <>
                                            <li role="none">
                                              <button
                                                type="button"
                                                role="menuitem"
                                                disabled={actionDisabled}
                                                aria-describedby={
                                                  readiness.reason
                                                    ? readinessId
                                                    : undefined
                                                }
                                                onClick={(event) => {
                                                  closeActionMenu(event);
                                                  if (available) {
                                                    claimMutation.mutate(task);
                                                  } else {
                                                    openTask(task);
                                                  }
                                                }}
                                              >
                                                <ClipboardCheck size={16} aria-hidden="true" />
                                                {available
                                                  ? "Claim Task"
                                                  : getTaskPrimaryActionLabel(task)}
                                              </button>
                                            </li>
                                            {readiness.reason && (
                                              <li role="none">
                                                <p
                                                  id={readinessId}
                                                  className="px-3 py-2 text-xs leading-relaxed text-base-content/70"
                                                >
                                                  {readiness.reason}
                                                </p>
                                              </li>
                                            )}
                                            {(animalId || farmerId) && (
                                              <li role="separator" className="my-1 border-t border-base-300" />
                                            )}
                                          </>
                                        )}
                                        {animalId && (
                                          <li role="none">
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={(event) => {
                                                closeActionMenu(event);
                                                navigate(`/technician/animals/${animalId}`);
                                              }}
                                            >
                                              <Beef size={16} aria-hidden="true" />
                                              Open animal
                                            </button>
                                          </li>
                                        )}
                                        {farmerId && (
                                          <li role="none">
                                            <button
                                              type="button"
                                              role="menuitem"
                                              onClick={(event) => {
                                                closeActionMenu(event);
                                                navigate(`/technician/farmers/${farmerId}`);
                                              }}
                                            >
                                              <UserRound size={16} aria-hidden="true" />
                                              Open farmer
                                            </button>
                                          </li>
                                        )}
                                      </ul>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Responsive mobile grid view */}
                  <div className="grid gap-3 p-4 lg:hidden">
                    {paginatedTasks.map((task) => (
                      <TechnicianTaskCard
                        key={task._id}
                        task={task}
                        onAction={openTask}
                        onClaim={(item) => claimMutation.mutate(item)}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls Toolbar */}
                  {tasks.length > itemsPerPage && (
                    <div className="card bg-base-100 border-t border-base-300/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-none shadow-none">
                      <span className="text-xs font-bold text-base-content/40">
                        Showing {(currentPage - 1) * itemsPerPage + 1}–
                        {Math.min(currentPage * itemsPerPage, tasks.length)} of{" "}
                        {tasks.length} entries
                      </span>

                      <div className="join shadow-sm rounded-xl overflow-hidden border border-base-300">
                        <button
                          type="button"
                          aria-label="Previous work queue page"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                          className="join-item btn btn-sm bg-base-100 text-base-content/75 hover:bg-base-200 border-base-300 disabled:opacity-50 cursor-pointer"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        {Array.from(
                          { length: Math.ceil(tasks.length / itemsPerPage) },
                          (_, i) => i + 1,
                        ).map((pageNumber) => (
                          <button
                            type="button"
                            key={pageNumber}
                            aria-label={`Go to work queue page ${pageNumber}`}
                            aria-current={currentPage === pageNumber ? "page" : undefined}
                            onClick={() => setCurrentPage(pageNumber)}
                            className={`join-item btn btn-sm border-base-300 cursor-pointer ${
                              currentPage === pageNumber
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-base-100 text-base-content hover:bg-base-200"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        ))}

                        <button
                          type="button"
                          aria-label="Next work queue page"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(
                                Math.ceil(tasks.length / itemsPerPage),
                                p + 1,
                              ),
                            )
                          }
                          disabled={
                            currentPage ===
                            Math.ceil(tasks.length / itemsPerPage)
                          }
                          className="join-item btn btn-sm bg-base-100 text-base-content/75 hover:bg-base-200 border-base-300 disabled:opacity-50 cursor-pointer"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: DONUT SUMMARY, TIMELINE, FARMS LIST */}
          {showSidebar && (
            <aside className="space-y-6">
            {/* 1. TASK OVERVIEW DONUT CHART */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black text-base-content uppercase tracking-wider">
                Task Overview
              </h3>

              <div className="flex items-center gap-6 justify-center py-2">
                {/* CSS SVG Donut Chart */}
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg
                    className="w-full h-full transform -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    {/* Background circle */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="currentColor"
                      className="text-base-200"
                      strokeWidth="3"
                    />

                    {/* Segment 1: Due Today (amber) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3.2"
                      strokeDasharray={`${duePercent} ${100 - duePercent}`}
                      strokeDashoffset="0"
                    />

                    {/* Segment 2: Upcoming (blue) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3.2"
                      strokeDasharray={`${upPercent} ${100 - upPercent}`}
                      strokeDashoffset={-duePercent}
                    />

                    {/* Segment 3: On Hold (gray) */}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="3.2"
                      strokeDasharray={`${holdPercent} ${100 - holdPercent}`}
                      strokeDashoffset={-(duePercent + upPercent)}
                    />
                  </svg>

                  {/* Center Text */}
                  <div className="absolute text-center">
                    <span className="text-2xl font-black text-base-content block leading-none">
                      {totalCounts}
                    </span>
                    <span className="text-[8px] font-black uppercase text-base-content/40 tracking-wider mt-1 block">
                      Active Tasks
                    </span>
                  </div>
                </div>

                {/* Legends and percentages */}
                <div className="space-y-2 text-xs font-bold text-base-content/85">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>Due Today</span>
                    <span className="text-base-content/45 font-medium ml-1">
                      {dueTodayCounts} ({duePercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span>Upcoming</span>
                    <span className="text-base-content/45 font-medium ml-1">
                      {upcomingCounts} ({upPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>On Hold</span>
                    <span className="text-base-content/45 font-medium ml-1">
                      {onHoldCounts} ({holdPercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-base-300" />
                    <span>Other active</span>
                    <span className="text-base-content/45 font-medium ml-1">
                      {otherActiveCounts} ({otherPercent}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Alert Banner Box */}
              {dueTodayCounts > 0 && (
                <div className="border border-amber-500/20 bg-amber-500/5 p-3 flex items-center justify-between gap-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <AlertCircle
                      size={16}
                      className="text-amber-500 shrink-0"
                    />
                    <span className="text-[11px] font-bold text-amber-600 leading-tight">
                      You have {dueTodayCounts} task
                      {dueTodayCounts === 1 ? "" : "s"} due today.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setStatusFilter("due_today");
                      setCurrentPage(1);
                    }}
                    className="btn btn-xs btn-outline border-amber-500/30 hover:bg-amber-500 hover:text-white hover:border-amber-500 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shrink-0"
                  >
                    View
                  </button>
                </div>
              )}
            </div>

            {/* 2. UPCOMING TODAY TIMELINE */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-base-content uppercase tracking-wider">
                  Upcoming Today
                </h3>
                <button
                  onClick={() => {
                    setStatusFilter("due_today");
                    setCurrentPage(1);
                  }}
                  className="text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-700 tracking-wider cursor-pointer bg-transparent border-0"
                >
                  View schedule
                </button>
              </div>

              {/* Timeline Container */}
              <div className="space-y-4 pt-2 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-base-200">
                {todayTimelineTasks.length === 0 ? (
                  <p className="text-[10px] font-bold text-base-content/45 uppercase tracking-widest text-center py-6">
                    No active tasks scheduled today
                  </p>
                ) : (
                  todayTimelineTasks.map((t) => (
                    <div
                      key={t.id}
                      className="relative pl-8 flex items-start gap-4"
                    >
                      {/* Bullet point indicator */}
                      <span
                        className={`absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-base-100 shadow-sm shrink-0 z-10 ${t.bulletColor}`}
                      />

                      <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-0.5 shrink-0 w-14">
                        {t.time}
                      </span>

                      <div>
                        <h5 className="text-xs font-extrabold text-base-content leading-tight">
                          {t.title}
                        </h5>
                        <p className="text-[10px] font-bold text-base-content/50 mt-0.5 leading-tight">
                          {t.animal} · {t.farm}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 3. ASSIGNED FARMS (THIS WEEK) */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-base-content uppercase tracking-wider">
                  Assigned Farms
                </h3>
                <span className="text-[9px] font-black uppercase text-base-content/40 tracking-wider select-none">
                  This Week
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {topFarmsList.length === 0 ? (
                  <p className="text-[10px] font-bold text-base-content/45 uppercase tracking-widest text-center py-6">
                    No active farm tasks
                  </p>
                ) : (
                  topFarmsList.map((farm) => (
                    <div
                      key={farm.farmer}
                      className="flex items-center justify-between gap-4 p-2 rounded-xl bg-base-200/40 border border-base-300/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder" aria-hidden="true">
                          <div className="w-8 h-8 rounded-full border border-base-300 bg-base-200 text-base-content/70">
                            <span className="text-[10px] font-black">
                              {farm.farmer
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs font-black text-base-content block leading-tight">
                            {farm.farm}
                          </span>
                          <span className="text-[10px] font-bold text-base-content/45 block mt-0.5">
                            {toTitleCase(farm.farmer)}
                          </span>
                        </div>
                      </div>
                      <span className="badge badge-sm badge-soft font-bold text-[10px] rounded-full shrink-0">
                        {farm.count} Tasks
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            </aside>
          )}
        </div>
      </main>

      <PregnancyDiagnosisModal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        taskData={selectedTask ? { ...selectedTask, raw: selectedTask } : null}
        taskId={selectedTask?._id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
    </div>
  );
}
