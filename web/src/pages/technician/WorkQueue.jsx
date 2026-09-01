import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  PawPrint,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import { ui } from "../../components/ui/uiClasses";
import Topbar from "../../components/layout/Topbar";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import HealthRequestActionModal from "../../components/dialogs/HealthRequestActionModal";
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
  formatCanonicalVisitSchedule,
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


export default function WorkQueue({ embedded = false }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("typeFilter") || "all",
  );
  const [workStateFilter, setWorkStateFilter] = useState(
    () =>
      searchParams.get("workState") ||
      searchParams.get("workStateFilter") ||
      "active",
  );
  const [selectedTaskWrapper, setSelectedTaskWrapper] = useState(null);
  const [selectedWorkDetails, setSelectedWorkDetails] = useState(null);
  const [breedingFollowUp, setBreedingFollowUp] = useState(null);
  const [followUpDraft, setFollowUpDraft] = useState({
    reportType: "possible_pregnancy",
    notes: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const formatRelativeSchedule = (value) => {
    if (!value) return "No date recorded";
    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime()))
      return "No date recorded";

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

    return datePart;
  };

  const query = useQuery({
    queryKey: [
      "technician",
      "work-queue",
      "mine",
      {
        page: currentPage,
        limit: itemsPerPage,
        workState: workStateFilter,
        type: typeFilter,
        search: search.trim(),
      },
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/work-queue", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          workState: workStateFilter,
          type: typeFilter,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });
      return response.data || {};
    },
  });

  const completeMutation = useMutation({
    mutationFn: (taskId) =>
      axiosInstance.put(`/tasks/${encodeURIComponent(taskId)}/complete`, {}),
    onSuccess: () => {
      toast.success("Task completed.");
      queryClient.invalidateQueries({
        queryKey: ["technician", "work-queue", "mine"],
      });
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Could not complete this task.",
      ),
  });

  const breedingFollowUpMutation = useMutation({
    mutationFn: ({ workflowId, reportType, notes }) =>
      axiosInstance.post(
        `/ai-request/${encodeURIComponent(workflowId)}/technician-observation`,
        { reportType, notes },
      ),
    onSuccess: () => {
      toast.success("Breeding follow-up recorded.");
      setBreedingFollowUp(null);
      setFollowUpDraft({ reportType: "possible_pregnancy", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["technician"] });
    },
    onError: (error) =>
      toast.error(
        error.response?.data?.message || "Could not record the breeding follow-up.",
      ),
  });

  const tasks = Array.isArray(query.data?.data) ? query.data.data : [];
  const pagination = {
    page: Number(query.data?.pagination?.page) || currentPage,
    limit: Number(query.data?.pagination?.limit) || itemsPerPage,
    total: Number(query.data?.pagination?.total) || 0,
    totalPages: Math.max(Number(query.data?.pagination?.totalPages) || 1, 1),
  };
  const authoritativeWorkCount = Number(query.data?.counts?.all) || 0;
  const workStateLabel =
    workStateFilter === "completed" ? "Completed owned work" : "Active owned work";
  const pageStart = tasks.length
    ? (pagination.page - 1) * pagination.limit + 1
    : 0;
  const pageEnd = tasks.length ? pageStart + tasks.length - 1 : 0;

  const handleStartService = async (task) => {
    try {
      if (task.type === "insemination") {
        await axiosInstance.patch(`/technician/inseminations/${task.workflowId}/status`, {
          status: "in-progress",
        });
      } else if (task.type === "health") {
        await axiosInstance.patch(`/health-request/${task.workflowId}/status`, {
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
        if (task.workflowType === "Health" && !isMongoId(task.workflowId)) {
          toast.error(
            "This Health work item has an invalid request identifier.",
          );
          return;
        }
        setSelectedTaskWrapper(task);
        return;
      case "VIEW_RECORD":
      case "VIEW_RESPONSE":
      case "VIEW_DETAILS":
        setSelectedWorkDetails(task);
        return;
      case "RECORD_BREEDING_OBSERVATION": {
        const inseminationId = task.context?.inseminationId;
        if (!isMongoId(inseminationId)) {
          toast.error("This breeding follow-up has an invalid AI record identifier.");
          return;
        }
        setFollowUpDraft({ reportType: "possible_pregnancy", notes: "" });
        setBreedingFollowUp(task);
        return;
      }
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
        if (task.workflowType === "Health") {
          if (!isMongoId(task.workflowId)) {
            toast.error(
              "This Health work item has an invalid request identifier.",
            );
            return;
          }
          setSelectedTaskWrapper(task);
          return;
        }
        if (["PD", "Calving"].includes(task.workflowType)) {
          setSelectedTaskWrapper(task);
          return;
        }
        if (task.workflowType === "AI") {
          toast.error("AI service recording must use Record Insemination.");
          return;
        }
        handleStartService(task);
        return;
      case "SCHEDULE_VISIT":
        if (!isMongoId(task.workflowId)) {
          toast.error("This AI work item has an invalid workflow identifier.");
          return;
        }
        navigate(`/technician/requests?requestId=${encodeURIComponent(task.workflowId)}`);
        return;
      case "CLAIM":
      case "CLAIM_AND_SCHEDULE":
        toast.error("This work is not assigned to you. Claim it from Available Requests.");
        return;
      default:
        toast.error("This work item does not have a supported action.");
    }
  };

  const focusedTaskId = searchParams.get("taskId");
  const focusedWorkflowId = searchParams.get("requestId");
  const ContentContainer = embedded ? "div" : "main";

  const selectWorkState = (workState) => {
    setWorkStateFilter(workState);
    setCurrentPage(1);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("section", "myWork");
      next.set("workState", workState);
      next.delete("workStateFilter");
      return next;
    });
  };

  return (
    <div className={embedded ? "contents" : ui.page}>
      {!embedded && (
        <Topbar
          title="My Work"
          subtitle="Manage your assigned services and follow-up tasks"
        />
      )}

      <ContentContainer className={embedded ? "" : ui.main}>
        {/* ================= MAIN CARD: FILTERS & TABLE ================= */}
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
                    onClick={() => selectWorkState(status.id)}
                    className={`join-item btn btn-sm px-4 whitespace-nowrap ${workStateFilter === status.id ? "btn-neutral" : "bg-base-100 border-base-200 hover:bg-base-200"}`}
                  >
                    {status.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  aria-label="Service type"
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
                    aria-label="Search My Work"
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

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/65">
              <span>
                {workStateLabel}: {query.isLoading ? "—" : authoritativeWorkCount}
              </span>
              <span>
                {query.isLoading ? "Loading matching work…" : `${pagination.total} matching item${pagination.total === 1 ? "" : "s"}`}
              </span>
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
            ) : query.isError ? (
              <div className="rounded-box border border-error/30 bg-error/5 px-5 py-10 text-center">
                <h2 className="font-bold text-error">Could not load My Work</h2>
                <p className="mt-1 text-sm text-base-content/65">
                  {query.error?.response?.data?.message ||
                    "Check your connection and try again."}
                </p>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="btn btn-sm btn-outline mt-4"
                >
                  Retry
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded-box border border-dashed border-base-300 px-5 py-12 text-center">
                <ClipboardCheck
                  className="mx-auto mb-3 text-base-content/35"
                  size={24}
                />
                <h2 className="font-bold">No tasks found</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {search || typeFilter !== "all" || workStateFilter !== "active"
                    ? "Try adjusting your filters to see more tasks."
                    : "You're all caught up! No tasks assigned to you right now."}
                </p>
                {(search || typeFilter !== "all" || workStateFilter !== "active") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                      selectWorkState("active");
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
                      {tasks.map((task) => {
                        const workflowStatus = normalizeWorkflowStatus(task);
                        const statusPresentation = getWorkflowStatusPresentation(workflowStatus);
                        const serviceType = normalizeServiceType(task);
                        const servicePresentation = getServicePresentation(serviceType);
                        const priority = task.urgent ? 1 : 0;
                        const animalReference =
                          task.animal?.earTag || "Not recorded";
                        const readiness = getTaskReadiness(task.raw || task);
                        const actionDisabled =
                          !readiness.ready ||
                          !task.allowedAction ||
                          (task.workflowType === "AI" && !task.actionLabel);
                        const animalId = task.animal?.id || null;
                        const farmerId = task.farmer?.id || null;
                        const timing = task.timing || {
                          kind: ["AI", "Health"].includes(task.workflowType)
                            ? "scheduled_visit"
                            : "due",
                          date: task.schedule?.date || task.displayDate || null,
                          visitPeriod: task.schedule?.visitPeriod || null,
                        };
                        const timingLabel =
                          timing.kind === "scheduled_visit"
                            ? formatCanonicalVisitSchedule({
                                date: timing.date,
                                visitPeriod: timing.visitPeriod,
                              })
                            : timing.kind === "completed"
                              ? `Completed ${formatRecordDate(timing.date)}`
                              : `Due ${formatRelativeSchedule(timing.date)}`;
                        const primaryActionLabel =
                          ["VIEW_RECORD", "VIEW_RESPONSE", "VIEW_DETAILS"].includes(
                            task.allowedAction,
                          ) ||
                          ["AI", "BreedingFollowUp"].includes(task.workflowType)
                            ? task.actionLabel
                            : getTaskPrimaryActionLabel(task);
                        const menuId = `task-actions-${String(task.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
                        const menuAnchor = `--${menuId}`;

                        return (
                          <tr
                            key={task.id}
                            className={`hover:bg-base-200/50 transition-colors text-xs font-semibold text-base-content/85 ${
                              focusedTaskId === task.id ||
                              focusedTaskId === task.taskId ||
                              focusedWorkflowId === task.workflowId
                                ? "bg-primary/5"
                                : ""
                            }`}
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
                                    {task.animal?.species || "Livestock"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* 3. CANONICAL TIMING */}
                            <td className="p-3.5 align-top">
                              <span
                                className={`block font-bold text-xs ${workflowStatus === "overdue" ? "text-error" : "text-base-content"}`}
                              >
                                {timingLabel}
                              </span>
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
                              <div
                                className={
                                  !readiness.ready
                                    ? "tooltip tooltip-left inline-block"
                                    : "inline-block"
                                }
                                data-tip={!readiness.ready ? readiness.reason : undefined}
                              >
                                <button
                                  type="button"
                                  disabled={actionDisabled}
                                  onClick={() => openTask(task)}
                                  className="btn btn-xs px-4 btn-primary"
                                >
                                  {primaryActionLabel}
                                </button>
                              </div>
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
                {pagination.total > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                    <span className="text-[11px] font-medium text-base-content/60">
                      Showing {pageStart}–{pageEnd} of {pagination.total}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-base-content/60">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <div className="join">
                        <button
                          type="button"
                          aria-label="Previous page"
                          onClick={() =>
                            setCurrentPage((page) => Math.max(1, page - 1))
                          }
                          disabled={pagination.page <= 1}
                          className="join-item btn btn-xs btn-outline border-base-300 bg-base-100"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label="Next page"
                          onClick={() =>
                            setCurrentPage((page) =>
                              Math.min(pagination.totalPages, page + 1),
                            )
                          }
                          disabled={pagination.page >= pagination.totalPages}
                          className="join-item btn btn-xs btn-outline border-base-300 bg-base-100"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </ContentContainer>

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
      <HealthRequestActionModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "Health"}
        onClose={() => setSelectedTaskWrapper(null)}
        task={
          selectedTaskWrapper?.workflowType === "Health"
            ? {
                ...selectedTaskWrapper,
                id: selectedTaskWrapper.workflowId,
              }
            : null
        }
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
      <RecordCalvingModal
        isOpen={Boolean(selectedTaskWrapper) && selectedTaskWrapper?.workflowType === "Calving"}
        onClose={() => setSelectedTaskWrapper(null)}
        pregnancyData={
          selectedTaskWrapper?.workflowType === "Calving" &&
          selectedTaskWrapper?.context?.pregnancyId
            ? {
                _id: selectedTaskWrapper.context.pregnancyId,
                animalId: selectedTaskWrapper.animal?.id || null,
              }
            : null
        }
        preSelectedFarmer={selectedTaskWrapper?.farmer?.id || null}
        preSelectedAnimal={selectedTaskWrapper?.animal?.id || null}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["technician"] })}
      />
      <Modal
        isOpen={Boolean(selectedWorkDetails)}
        onClose={() => setSelectedWorkDetails(null)}
        title={selectedWorkDetails?.title || selectedWorkDetails?.serviceType || "Work details"}
        subtitle="Recorded workflow summary"
        size="md"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setSelectedWorkDetails(null)}
          >
            Close
          </button>
        }
      >
        {selectedWorkDetails && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-base-content/55">Farmer</p>
                <p className="font-semibold">{selectedWorkDetails.farmer?.name || "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Animal</p>
                <p className="font-semibold">
                  {selectedWorkDetails.animal?.name || "Not recorded"}
                  {selectedWorkDetails.animal?.earTag
                    ? ` · Tag ${selectedWorkDetails.animal.earTag}`
                    : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Status</p>
                <p className="font-semibold">
                  {getWorkflowStatusPresentation(
                    normalizeWorkflowStatus(selectedWorkDetails),
                  ).label}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">
                  {selectedWorkDetails.timing?.kind === "due" ? "Due" : "Completed"}
                </p>
                <p className="font-semibold">
                  {formatRecordDate(
                    selectedWorkDetails.timing?.date || selectedWorkDetails.completedAt,
                  )}
                </p>
              </div>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
              <p className="text-xs text-base-content/55">Service information</p>
              <p className="font-semibold">{selectedWorkDetails.summary || "No additional service details recorded."}</p>
              {selectedWorkDetails.context?.sireBreed && (
                <p className="mt-1 text-base-content/70">
                  Sire: {selectedWorkDetails.context.sireBreed}
                  {selectedWorkDetails.context.sireCode
                    ? ` · ${selectedWorkDetails.context.sireCode}`
                    : ""}
                </p>
              )}
              {selectedWorkDetails.context?.handlingMethod && (
                <p className="mt-1 text-base-content/70">
                  Handling: {String(selectedWorkDetails.context.handlingMethod).replaceAll("_", " ")}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(breedingFollowUp)}
        onClose={() => setBreedingFollowUp(null)}
        title="Record breeding follow-up"
        subtitle="Record the technician's current observation for this AI attempt."
        size="md"
        actions={
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBreedingFollowUp(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={breedingFollowUpMutation.isPending}
              onClick={() =>
                breedingFollowUpMutation.mutate({
                  workflowId: breedingFollowUp.context?.inseminationId,
                  ...followUpDraft,
                })
              }
            >
              {breedingFollowUpMutation.isPending ? "Saving…" : "Record follow-up"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="form-control">
            <span className="label-text font-semibold">Observation</span>
            <select
              className="select select-bordered mt-1"
              value={followUpDraft.reportType}
              onChange={(event) =>
                setFollowUpDraft((current) => ({ ...current, reportType: event.target.value }))
              }
            >
              <option value="possible_pregnancy">Possible pregnancy</option>
              <option value="return_to_heat">Return to heat</option>
              <option value="unsure">Unsure</option>
              <option value="unable_to_contact">Unable to contact</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text font-semibold">Notes</span>
            <textarea
              className="textarea textarea-bordered mt-1 min-h-28"
              value={followUpDraft.notes}
              onChange={(event) =>
                setFollowUpDraft((current) => ({ ...current, notes: event.target.value }))
              }
              placeholder="What did you observe?"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
