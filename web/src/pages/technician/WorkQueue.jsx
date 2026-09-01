import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CalendarDays,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
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
      case "HANDLE_REQUEST":
        if (task.workflowType !== "Health" || !isMongoId(task.workflowId)) {
          toast.error("This Health work item has an invalid request identifier.");
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

            {/* ACTIONABLE WORK LIST */}
            {query.isLoading ? (
              <div className="space-y-3" aria-label="Loading work queue">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="rounded-box border border-base-300 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                      <div className="space-y-2">
                        <span className="skeleton block h-4 w-40" />
                        <span className="skeleton block h-3 w-56" />
                      </div>
                      <div className="space-y-2">
                        <span className="skeleton block h-3 w-36" />
                        <span className="skeleton block h-3 w-28" />
                      </div>
                      <span className="skeleton h-8 w-32" />
                    </div>
                  </div>
                ))}
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
                <div className="space-y-3" aria-label="My Work items">
                  {tasks.map((task) => {
                    const workflowStatus = normalizeWorkflowStatus(task);
                    const statusPresentation =
                      getWorkflowStatusPresentation(workflowStatus);
                    const serviceType = normalizeServiceType(task);
                    const servicePresentation =
                      getServicePresentation(serviceType);
                    const readiness = getTaskReadiness(task.raw || task);
                    const actionDisabled =
                      !readiness.ready ||
                      !task.allowedAction ||
                      (task.workflowType === "AI" && !task.actionLabel);
                    const animalId = task.animal?.id || null;
                    const farmerId = task.farmer?.id || null;
                    const animalReference =
                      task.animal?.earTag || "Not recorded";
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
                      task.actionLabel || getTaskPrimaryActionLabel(task);
                    const isFocused =
                      focusedTaskId === task.id ||
                      focusedTaskId === task.taskId ||
                      focusedWorkflowId === task.workflowId;

                    return (
                      <article
                        key={task.id}
                        className={`rounded-box border bg-base-100 p-4 transition-colors sm:p-5 ${
                          isFocused
                            ? "border-primary/50 bg-primary/5"
                            : "border-base-300 hover:border-base-content/25"
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(13rem,.8fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="badge badge-sm badge-primary badge-soft">
                                {task.title || servicePresentation.label}
                              </span>
                              <span
                                className={`badge badge-sm border ${statusPresentation.badgeClass}`}
                              >
                                {statusPresentation.label}
                              </span>
                              {task.urgent ? (
                                <span className="badge badge-sm badge-error badge-outline">
                                  Urgent
                                </span>
                              ) : null}
                            </div>
                            <h3 className="mt-3 text-base font-bold text-base-content">
                              {toTitleCase(
                                task.farmer?.name ||
                                  task.farmerName ||
                                  "Farmer not recorded",
                              )}
                            </h3>
                            <p className="mt-1 text-sm text-base-content/70">
                              {task.animal?.name || "Animal not recorded"}
                              {animalReference !== "Not recorded"
                                ? ` · Tag ${animalReference}`
                                : ""}
                              {task.animal?.species
                                ? ` · ${task.animal.species}`
                                : ""}
                              {task.animal?.breed
                                ? ` · ${task.animal.breed}`
                                : ""}
                            </p>
                            {task.summary ? (
                              <p className="mt-2 line-clamp-2 text-sm text-base-content/60">
                                {task.summary}
                              </p>
                            ) : null}
                          </div>

                          <dl className="grid gap-2 text-sm">
                            <div>
                              <dt className="text-xs font-semibold text-base-content/50">
                                {timing.kind === "scheduled_visit"
                                  ? "Visit"
                                  : timing.kind === "completed"
                                    ? "Completed"
                                    : "Due"}
                              </dt>
                              <dd
                                className={`mt-0.5 flex items-center gap-2 font-semibold ${
                                  workflowStatus === "overdue"
                                    ? "text-error"
                                    : "text-base-content"
                                }`}
                              >
                                <CalendarDays size={15} aria-hidden="true" />
                                {timingLabel}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-semibold text-base-content/50">
                                Location
                              </dt>
                              <dd className="mt-0.5 flex items-center gap-2 text-base-content/75">
                                <MapPin size={15} aria-hidden="true" />
                                {task.location || "Location not recorded"}
                              </dd>
                            </div>
                          </dl>

                          <div className="flex flex-wrap items-center gap-2 lg:max-w-70 lg:justify-end">
                            {farmerId ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  navigate(`/technician/farmers/${farmerId}`)
                                }
                              >
                                <UserRound size={15} aria-hidden="true" />
                                Farmer
                              </button>
                            ) : null}
                            {animalId ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  navigate(`/technician/animals/${animalId}`)
                                }
                              >
                                <PawPrint size={15} aria-hidden="true" />
                                Animal
                              </button>
                            ) : null}
                            {task.allowedAction ? (
                              <div
                                className={
                                  !readiness.ready ? "tooltip tooltip-left" : ""
                                }
                                data-tip={
                                  !readiness.ready ? readiness.reason : undefined
                                }
                              >
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={actionDisabled}
                                  onClick={() => openTask(task)}
                                >
                                  {primaryActionLabel}
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-base-content/55">
                                Review required
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
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
