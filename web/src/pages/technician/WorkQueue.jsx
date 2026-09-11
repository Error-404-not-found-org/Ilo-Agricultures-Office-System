import { useState, useEffect, useRef } from "react";
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
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
  PhoneOff,
  MessageSquare,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import { ui } from "../../components/ui/uiClasses";
import Topbar from "../../components/layout/Topbar";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import HealthRequestActionModal from "../../components/dialogs/HealthRequestActionModal";
import RecordCalvingModal from "../../components/dialogs/RecordCalvingModal";
import PregnancyDiagnosisModal from "../../components/dialogs/PregnancyDiagnosisModal";
import PregnancyLossReviewModal from "../../components/dialogs/PregnancyLossReviewModal";
import Modal from "../../components/ui/Modal";
import { getTaskReadiness } from "../../constants/technicianWorkflow";
import { getTaskPrimaryActionLabel } from "../../utils/taskNavigation";
import {
  MY_WORK_FILTERS,
  getServicePresentation,
  formatCanonicalVisitSchedule,
  normalizeServiceType,
  normalizeWorkflowStatus,
  getWorkflowStatusPresentation,
} from "../../utils/requestWorkPresentation";
import { isFutureSchedule } from "../../utils/technicianSchedulePresentation";
import ImagePreviewModal from "../../components/ui/ImagePreviewModal";
import { imagePreviewUrl } from "../../components/ui/imagePreviewUrl";
import {
  normalizeFarmerObservation,
  getBreedingObservationLabel,
  getBreedingObservationSignLabel,
  formatTaskSummary,
  formatSubmittedAt,
} from "../../utils/breedingObservation";

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
    month: "short",
    day: "numeric",
  });
};

const formatInseminationDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  const dateStr = date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "numeric",
  });
  return `${dateStr} at ${timeStr}`;
};

const getOfficialRecordIdentity = (task) => {
  const animalId = task?.animal?.id;
  if (!isMongoId(animalId)) return null;

  if (task.workflowType === "AI" && isMongoId(task.workflowId)) {
    return {
      animalId,
      recordKind: "insemination",
      recordId: task.workflowId,
    };
  }

  if (task.workflowType === "Health" && isMongoId(task.medicalRecordId)) {
    return {
      animalId,
      recordKind: "medical_record",
      recordId: task.medicalRecordId,
    };
  }

  if (task.workflowType === "PD" && isMongoId(task.context?.pregnancyId)) {
    return {
      animalId,
      recordKind: "pregnancy",
      recordId: task.context.pregnancyId,
    };
  }

  if (
    task.workflowType === "Calving" &&
    isMongoId(task.context?.calvingId)
  ) {
    return {
      animalId,
      recordKind: "calving",
      recordId: task.context.calvingId,
    };
  }

  return null;
};

export default function WorkQueue({ embedded = false }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const deepLinkTaskId = searchParams.get("taskId");
  const deepLinkRequestId = searchParams.get("requestId");
  const hasDeepLink = Boolean(deepLinkTaskId || deepLinkRequestId);
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get("typeFilter") || "all",
  );
  const [selectedTaskWrapper, setSelectedTaskWrapper] = useState(null);
  const [selectedWorkDetails, setSelectedWorkDetails] = useState(null);
  const [breedingFollowUp, setBreedingFollowUp] = useState(null);
  const [pregnancyLossReviewTask, setPregnancyLossReviewTask] = useState(null);
  const [breedingFollowUpStep, setBreedingFollowUpStep] = useState("overview");
  const [followUpDraft, setFollowUpDraft] = useState({
    reportType: "possible_pregnancy",
    notes: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
  const [earlyStartConfirmTask, setEarlyStartConfirmTask] = useState(null);
  const [isStartingEarly, setIsStartingEarly] = useState(false);
  const itemsPerPage = 8;

  const handleCloseModal = () => {
    setSelectedTaskWrapper(null);
    setSelectedWorkDetails(null);
    setBreedingFollowUp(null);
    setPregnancyLossReviewTask(null);
    setPreviewImage(null);
    setEarlyStartConfirmTask(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("taskId");
        next.delete("requestId");
        return next;
      },
      { replace: true }
    );
  };
  const formatRelativeSchedule = (value) => {
    if (!value) return "No date recorded";
    const targetDate = new Date(value);
    if (Number.isNaN(targetDate.getTime())) return "No date recorded";

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
      const isSameYear = targetDate.getFullYear() === today.getFullYear();
      datePart = targetDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(isSameYear ? {} : { year: "numeric" }),
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
        workState: "active",
        type: typeFilter,
        search: search.trim(),
      },
    ],
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/work-queue", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          workState: "active",
          type: typeFilter,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });
      return response.data || {};
    },
  });

  const deepLinkQuery = useQuery({
    queryKey: [
      "technician",
      "work-queue",
      "mine",
      "deep-link",
      deepLinkTaskId,
      deepLinkRequestId,
    ],
    enabled: hasDeepLink,
    queryFn: async () => {
      const response = await axiosInstance.get("/technician/work-queue", {
        params: {
          limit: 1,
          workState: "active",
          ...(deepLinkTaskId ? { taskId: deepLinkTaskId } : {}),
          ...(deepLinkRequestId ? { requestId: deepLinkRequestId } : {}),
        },
      });
      return response.data?.data?.[0] || null;
    },
  });

  const breedingFollowUpTaskId =
    breedingFollowUp?.taskId || breedingFollowUp?.id || null;
  const breedingFollowUpDetailsQuery = useQuery({
    queryKey: [
      "technician",
      "tasks",
      "detail",
      breedingFollowUpTaskId || "",
    ],
    enabled:
      Boolean(breedingFollowUp) && isMongoId(breedingFollowUpTaskId),
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/tasks/${encodeURIComponent(breedingFollowUpTaskId)}`,
      );
      return response.data || null;
    },
  });

  const breedingFollowUpDetails = breedingFollowUpDetailsQuery.data;
  const breedingFollowUpInsemination = breedingFollowUpDetails?.insemination;
  const breedingFollowUpFarmer =
    breedingFollowUpDetails?.farmerId || breedingFollowUp?.farmer || null;
  const breedingFollowUpAnimal =
    breedingFollowUpDetails?.animalIds?.[0] ||
    breedingFollowUp?.animal ||
    breedingFollowUpInsemination?.animalId ||
    null;
  const breedingFollowUpInseminationId =
    breedingFollowUpInsemination?._id ||
    breedingFollowUp?.context?.inseminationId ||
    null;
  const breedingFollowUpSire =
    breedingFollowUpInsemination?.sireCode ||
    breedingFollowUpInsemination?.sireBreed ||
    null;
  const breedingFollowUpUnavailableLabel =
    breedingFollowUpDetailsQuery.isLoading ? "Loading…" : "Not available";
  const farmerObservation = normalizeFarmerObservation(
    breedingFollowUpInsemination ||
      breedingFollowUpDetails?.insemination ||
      breedingFollowUpDetails ||
      breedingFollowUp,
  );

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
        error.response?.data?.message ||
          "Could not record the breeding follow-up.",
      ),
  });

  const tasks = (Array.isArray(query.data?.data) ? query.data.data : []).filter(
    (task) =>
      !["completed", "cancelled"].includes(normalizeWorkflowStatus(task)),
  );
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
        await axiosInstance.patch(
          `/technician/inseminations/${task.workflowId}/status`,
          {
            status: "in-progress",
          },
        );
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

  const handleConfirmStartEarly = async () => {
    if (!earlyStartConfirmTask || isStartingEarly) return;
    const task = earlyStartConfirmTask;
    const workflowId = task.workflowId || task.id;
    if (!isMongoId(workflowId)) {
      toast.error("This AI work item has an invalid workflow identifier.");
      return;
    }

    setIsStartingEarly(true);
    try {
      const response = await axiosInstance.patch(
        `/ai-request/${encodeURIComponent(workflowId)}/status`,
        {
          status: "in-progress",
          earlyStartConfirmed: true,
        },
      );

      queryClient.invalidateQueries({ queryKey: ["technician"] });
      setEarlyStartConfirmTask(null);

      const updatedRequest = response.data?.request || response.data || {};
      const updatedStartedAt =
        updatedRequest.serviceStartedAt || new Date().toISOString();
      const inProgressTask = {
        ...task,
        status: "in-progress",
        serviceStartedAt: updatedStartedAt,
        raw: {
          ...(task.raw || {}),
          ...updatedRequest,
          status: "in-progress",
          serviceStartedAt: updatedStartedAt,
        },
      };
      setSelectedTaskWrapper(inProgressTask);
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to start AI service early.";
      toast.error(message);
    } finally {
      setIsStartingEarly(false);
    }
  };

  const openTask = (task) => {
    if (
      task.sourceType === "farmer_pregnancy_loss_report" ||
      task.raw?.sourceType === "farmer_pregnancy_loss_report" ||
      task.workflowType === "PregnancyLossReview" ||
      task.allowedAction === "REVIEW_PREGNANCY_LOSS"
    ) {
      setPregnancyLossReviewTask(task);
      return;
    }

    const scheduledDate =
      task.scheduledDate ||
      task.schedule?.date ||
      task.timing?.date ||
      task.raw?.scheduledDate;
    const visitPeriod =
      task.visitPeriod ||
      task.schedule?.visitPeriod ||
      task.timing?.visitPeriod ||
      task.raw?.visitPeriod;
    const isFuture = isFutureSchedule(scheduledDate, visitPeriod);
    const readiness = getTaskReadiness(task.raw || task);
    const normalizedTaskStatus = String(task.status || "")
      .toLowerCase()
      .replaceAll("_", "-");
    const isTerminal = [
      "completed",
      "done",
      "resolved",
      "cancelled",
      "canceled",
      "rejected",
      "declined",
    ].includes(normalizedTaskStatus);
    const isInProgress =
      !isTerminal &&
      (["in-progress", "inprogress"].includes(normalizedTaskStatus) ||
        Boolean(task.serviceStartedAt || task.raw?.serviceStartedAt));

    const isScheduledAI =
      (task.workflowType === "AI" ||
        task.type === "insemination" ||
        task.type === "ai") &&
      (normalizedTaskStatus === "scheduled" ||
        task.allowedAction === "RECORD_SERVICE");

    if (isScheduledAI && isFuture && !isInProgress) {
      setEarlyStartConfirmTask(task);
      return;
    }

    if (!readiness.ready || (isFuture && !isInProgress)) {
      setSelectedWorkDetails(task);
      return;
    }

    switch (task.allowedAction) {
      case "REVIEW_PREGNANCY_LOSS":
        setPregnancyLossReviewTask(task);
        return;
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
          toast.error(
            "This Health work item has an invalid request identifier.",
          );
          return;
        }
        setSelectedTaskWrapper(task);
        return;
      case "VIEW_RECORD":
      {
        const record = getOfficialRecordIdentity(task);
        if (record) {
          navigate(
            "/technician/records?animalId=" +
              encodeURIComponent(record.animalId) +
              "&recordKind=" +
              encodeURIComponent(record.recordKind) +
              "&recordId=" +
              encodeURIComponent(record.recordId),
          );
          return;
        }
        setSelectedWorkDetails(task);
        return;
      }
      case "VIEW_RESPONSE":
        setSelectedWorkDetails(task);
        return;
      case "VIEW_DETAILS":
      {
        const record = getOfficialRecordIdentity(task);
        if (record) {
          navigate(
            "/technician/records?animalId=" +
              encodeURIComponent(record.animalId) +
              "&recordKind=" +
              encodeURIComponent(record.recordKind) +
              "&recordId=" +
              encodeURIComponent(record.recordId),
          );
          return;
        }
        setSelectedWorkDetails(task);
        return;
      }
      case "RECORD_BREEDING_OBSERVATION": {
        const inseminationId = task.context?.inseminationId;
        if (!isMongoId(inseminationId)) {
          toast.error(
            "This breeding follow-up has an invalid AI record identifier.",
          );
          return;
        }
        setFollowUpDraft({ reportType: "possible_pregnancy", notes: "" });
        setBreedingFollowUpStep("overview");
        setBreedingFollowUp(task);
        return;
      }
      case "COMPLETE_TASK":
        if (task.workflowType !== "StandaloneTask" || !isMongoId(task.taskId)) {
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
        navigate(
          `/technician/requests?requestId=${encodeURIComponent(task.workflowId)}`,
        );
        return;
      case "CLAIM":
      case "CLAIM_AND_SCHEDULE":
        toast.error(
          "This work is not assigned to you. Claim it from Available Requests.",
        );
        return;
      default:
        toast.error("This work item does not have a supported action.");
    }
  };

  const firedDeepLinkIdentifier = useRef(null);
  const currentIdentifier = deepLinkTaskId || deepLinkRequestId;

  useEffect(() => {
    if (!hasDeepLink) {
      firedDeepLinkIdentifier.current = null;
    } else if (deepLinkQuery.isSuccess && firedDeepLinkIdentifier.current !== currentIdentifier) {
      firedDeepLinkIdentifier.current = currentIdentifier;
      const target = deepLinkQuery.data;
      if (target) {
        if (
          !selectedTaskWrapper &&
          !selectedWorkDetails &&
          !breedingFollowUp &&
          !pregnancyLossReviewTask &&
          !earlyStartConfirmTask
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          openTask(target);
        }
      } else {
        toast.error("This work item is unavailable or is not assigned to you.");
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("taskId");
            next.delete("requestId");
            return next;
          },
          { replace: true }
        );
      }
    }
  }, [
    hasDeepLink,
    deepLinkQuery.isSuccess,
    deepLinkQuery.data,
    toast,
    setSearchParams,
    selectedTaskWrapper,
    selectedWorkDetails,
    breedingFollowUp,
    pregnancyLossReviewTask,
    earlyStartConfirmTask,
    currentIdentifier,
  ]);

  const ContentContainer = embedded ? "div" : "main";

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="form-control w-full sm:max-w-sm">
                <span className="label text-sm font-semibold text-base-content/65">
                  Search
                </span>
                <span className="input input-sm input-bordered flex w-full items-center gap-2 bg-base-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                  <Search
                    size={14}
                    className="shrink-0 text-base-content/40"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    aria-label="Search My Work"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search farmer, animal..."
                    className="min-w-0 grow font-medium placeholder:text-base-content/50"
                  />
                </span>
              </label>

              <label className="form-control w-full sm:w-44">
                <span className="label text-sm font-semibold text-base-content/65">
                  Service type
                </span>
                <select
                  aria-label="Service type"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="select select-sm select-bordered w-full bg-base-100 border-base-300 font-medium"
                >
                  {MY_WORK_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.value === "all" ? "All Services" : filter.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* ACTIONABLE WORK LIST */}
            {query.isLoading ? (
              <div className="space-y-3" aria-label="Loading work queue">
                {[0, 1, 2, 3].map((row) => (
                  <div
                    key={row}
                    className="rounded-box border border-base-300 p-4"
                  >
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
                  {search || typeFilter !== "all"
                    ? "Try adjusting your filters to see more tasks."
                    : "You're all caught up! No tasks assigned to you right now."}
                </p>
                {(search || typeFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
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
                    const isHealthFarmVisitScheduled =
                      task.workflowType === "Health" &&
                      (task.status === "scheduled" ||
                        task.allowedAction === "START_SERVICE");
                    const primaryActionLabel = isHealthFarmVisitScheduled
                      ? "Record Health Assistance"
                      : task.actionLabel || getTaskPrimaryActionLabel(task);
                    return (
                      <article
                        key={task.id}
                        className="rounded-box border border-base-300 bg-base-100 p-4 transition-colors hover:border-base-content/25 sm:p-5"
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
                            {/* Farmer name — clickable with avatar */}
                            {farmerId ? (
                              <button
                                type="button"
                                className="group mt-2 flex items-center gap-1.5 text-left"
                                onClick={() =>
                                  navigate(`/technician/farmers/${farmerId}`)
                                }
                              >
                                <div className="relative flex cursor-pointer h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-[9px] font-bold uppercase text-primary">
                                  {task.farmer?.imageUrl && (
                                    <img
                                      src={task.farmer.imageUrl}
                                      alt=""
                                      className="absolute inset-0 z-10 h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = "none";
                                      }}
                                    />
                                  )}
                                  <span className="z-0">
                                    {(
                                      task.farmer?.name ||
                                      task.farmerName ||
                                      "F"
                                    ).charAt(0)}
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold cursor-pointer text-base-content transition-colors group-hover:text-primary">
                                  {toTitleCase(
                                    task.farmer?.name ||
                                      task.farmerName ||
                                      "Farmer not recorded",
                                  )}
                                </h3>
                              </button>
                            ) : (
                              <h3 className="mt-2 text-sm font-bold text-base-content">
                                {toTitleCase(
                                  task.farmer?.name ||
                                    task.farmerName ||
                                    "Farmer not recorded",
                                )}
                              </h3>
                            )}

                            {/* Animal info — clickable with paw icon */}
                            {animalId ? (
                              <button
                                type="button"
                                className="group mt-1 flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-xs text-base-content/60"
                                onClick={() =>
                                  navigate(`/technician/animals/${animalId}`)
                                }
                              >
                                <PawPrint
                                  size={11}
                                  className="shrink-0 text-base-content/40 transition-colors group-hover:text-primary"
                                  aria-hidden="true"
                                />
                                <span className="font-medium text-base-content/75 transition-colors group-hover:text-primary">
                                  Tag {animalReference !== "Not recorded" ? animalReference : "Unknown"}
                                </span>
                              </button>
                            ) : (
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-content/60">
                                <span className="font-medium text-base-content/75">
                                  Tag {animalReference !== "Not recorded" ? animalReference : "Unknown"}
                                </span>
                              </div>
                            )}

                            {task.summary ? (
                              <div className="mt-2 space-y-2">
                                {task.summary.match(/(Contact the.*)/i) ? (
                                  <>
                                    <p className="line-clamp-2 text-xs text-base-content/55">
                                      {formatTaskSummary(
                                        task.summary.split(/(Contact the.*)/i)[0],
                                      )}
                                    </p>
                                    <div className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary">
                                      {task.summary.match(/(Contact the.*)/i)[0]}
                                    </div>
                                  </>
                                ) : (
                                  <p className="line-clamp-2 text-xs text-base-content/55">
                                    {formatTaskSummary(task.summary)}
                                  </p>
                                )}
                              </div>
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

                          <div className="flex flex-wrap items-center gap-2 lg:max-w-72 lg:justify-end">
                            {task.allowedAction ? (
                              <div
                                className={
                                  !readiness.ready ? "tooltip tooltip-left" : ""
                                }
                                data-tip={
                                  !readiness.ready
                                    ? readiness.reason
                                    : undefined
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
        isOpen={
          Boolean(selectedTaskWrapper) &&
          selectedTaskWrapper?.workflowType === "PD"
        }
        onClose={handleCloseModal}
        taskData={selectedTaskWrapper?.raw}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["technician"] })
        }
      />
      <AIServiceModal
        isOpen={
          Boolean(selectedTaskWrapper) &&
          selectedTaskWrapper?.workflowType === "AI"
        }
        context="task"
        onClose={handleCloseModal}
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
        onSuccess={handleCloseModal}
      />
      <HealthRequestActionModal
        isOpen={
          Boolean(selectedTaskWrapper) &&
          selectedTaskWrapper?.workflowType === "Health"
        }
        onClose={handleCloseModal}
        task={
          selectedTaskWrapper?.workflowType === "Health"
            ? {
                ...selectedTaskWrapper,
                id: selectedTaskWrapper.workflowId,
              }
            : null
        }
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["technician"] })
        }
      />
      <RecordCalvingModal
        isOpen={
          Boolean(selectedTaskWrapper) &&
          selectedTaskWrapper?.workflowType === "Calving"
        }
        onClose={handleCloseModal}
        pregnancyData={
          selectedTaskWrapper?.workflowType === "Calving" &&
          selectedTaskWrapper?.context?.pregnancyId
            ? {
                _id: selectedTaskWrapper.context.pregnancyId,
                animalId: selectedTaskWrapper.animal?.id || null,
              }
            : null
        }
        preSelectedFarmer={selectedTaskWrapper?.farmer || null}
        preSelectedAnimal={selectedTaskWrapper?.animal || null}
        taskId={selectedTaskWrapper?.id || selectedTaskWrapper?.taskId}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["technician"] })
        }
      />
      <PregnancyLossReviewModal
        isOpen={Boolean(pregnancyLossReviewTask)}
        onClose={handleCloseModal}
        task={pregnancyLossReviewTask}
        onSuccess={() => {
          handleCloseModal();
          queryClient.invalidateQueries({ queryKey: ["technician"] });
        }}
      />
      {earlyStartConfirmTask && (
        <Modal
          isOpen={Boolean(earlyStartConfirmTask)}
          onClose={() => {
            if (!isStartingEarly) {
              setEarlyStartConfirmTask(null);
            }
          }}
          title="Start service early?"
          subtitle="Confirm early service start"
          size="md"
          icon={<AlertTriangle className="text-warning h-5 w-5" />}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  if (!isStartingEarly) {
                    setEarlyStartConfirmTask(null);
                  }
                }}
                disabled={isStartingEarly}
                className="btn btn-sm btn-ghost text-base-content/70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStartEarly}
                disabled={isStartingEarly}
                className={`btn btn-sm btn-primary font-bold gap-1.5 ${isStartingEarly ? "loading" : ""}`}
              >
                {isStartingEarly ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Start Early
              </button>
            </>
          }
        >
          <div className="space-y-4 py-1">
            <div className="alert alert-warning/15 border-warning/30 text-sm text-base-content/80 flex items-start gap-3 rounded-2xl py-3.5 px-4">
              <Info className="h-5 w-5 shrink-0 text-warning mt-0.5" />
              <p className="leading-relaxed">
                This AI service is scheduled for a future visit. Are you sure you want
                to start the service now?
              </p>
            </div>
          </div>
        </Modal>
      )}
      <Modal
        isOpen={Boolean(selectedWorkDetails)}
        onClose={handleCloseModal}
        title={
          selectedWorkDetails?.title ||
          selectedWorkDetails?.serviceType ||
          "Work details"
        }
        subtitle="Recorded workflow summary"
        size="md"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCloseModal}
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
                <p className="font-semibold">
                  {selectedWorkDetails.farmer?.name || "Not recorded"}
                </p>
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
                  {
                    getWorkflowStatusPresentation(
                      normalizeWorkflowStatus(selectedWorkDetails),
                    ).label
                  }
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">
                  {selectedWorkDetails.timing?.kind === "due"
                    ? "Due"
                    : selectedWorkDetails.timing?.kind === "scheduled_visit"
                      ? "Visit"
                      : "Completed"}
                </p>
                <p className="font-semibold">
                  {formatRecordDate(
                    selectedWorkDetails.timing?.date ||
                      selectedWorkDetails.completedAt,
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-base-content/55">Location</p>
                <p className="font-semibold">
                  {selectedWorkDetails.location || selectedWorkDetails.farmer?.location || "Location not recorded"}
                </p>
              </div>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
              <p className="text-xs text-base-content/55">
                Service information
              </p>
              <p className="font-semibold">
                {formatTaskSummary(selectedWorkDetails.summary) ||
                  "No additional service details recorded."}
              </p>
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
                  Handling:{" "}
                  {String(
                    selectedWorkDetails.context.handlingMethod,
                  ).replaceAll("_", " ")}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(breedingFollowUp)}
        onClose={handleCloseModal}
        title={
          breedingFollowUpStep === "overview"
            ? "Breeding Follow-up"
            : "Record breeding follow-up"
        }
        subtitle={
          breedingFollowUpStep === "overview"
            ? undefined
            : "Record the technician's current observation for this AI attempt."
        }
        size="md"
        actions={
          breedingFollowUpStep === "overview" ? (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setBreedingFollowUp(null);
                  setPreviewImage(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setBreedingFollowUpStep("form")}
              >
                Record Follow-up
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setBreedingFollowUpStep("overview")}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={breedingFollowUpMutation.isPending}
                onClick={() =>
                  breedingFollowUpMutation.mutate({
                    workflowId: breedingFollowUpInseminationId,
                    ...followUpDraft,
                  })
                }
              >
                {breedingFollowUpMutation.isPending
                  ? "Saving…"
                  : "Submit Follow-up"}
              </button>
            </>
          )
        }
      >
        {breedingFollowUpStep === "overview" ? (
          <div className="space-y-4">
            {breedingFollowUpDetailsQuery.isError ? (
              <div className="alert alert-error" role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>Could not load the breeding record details.</span>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => breedingFollowUpDetailsQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {/* Breeding Reference */}
            <div className="rounded-xl border border-base-300 p-4">
              <h3 className="font-bold text-primary mb-3">
                Breeding Reference
              </h3>
              <div>
                <h4 className="text-lg font-bold text-base-content">
                  {breedingFollowUpAnimal?.name ||
                    (breedingFollowUpAnimal?.earTag
                      ? `Tag ${breedingFollowUpAnimal.earTag}`
                      : "Unknown Animal")}
                </h4>
                <p className="text-sm text-base-content/60">
                  {[
                    breedingFollowUpAnimal?.species,
                    breedingFollowUpAnimal?.breed,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No breed info"}
                </p>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60">Date Inseminated</span>
                  <span className="font-medium text-base-content">
                    {breedingFollowUpInsemination?.inseminationDate
                      ? formatInseminationDate(
                          breedingFollowUpInsemination.inseminationDate,
                        )
                      : breedingFollowUpUnavailableLabel}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60">Attempt</span>
                  <span className="font-medium text-base-content">
                    {breedingFollowUpInsemination?.attemptNumber != null
                      ? `#${breedingFollowUpInsemination.attemptNumber}`
                      : breedingFollowUpUnavailableLabel}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-base-content/60">Sire</span>
                  <span className="font-medium text-base-content">
                    {breedingFollowUpSire ||
                      breedingFollowUpUnavailableLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Farmer Update */}
            <div className="rounded-xl border border-base-300 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-primary text-sm uppercase tracking-wide">
                    Farmer Update
                  </h3>
                  {farmerObservation.hasObservation ? (
                    <span className="badge badge-sm badge-info badge-soft font-semibold">
                      Needs review
                    </span>
                  ) : null}
                </div>
                {farmerObservation.hasObservation && farmerObservation.reportedAt ? (
                  <span className="text-xs text-base-content/60">
                    Submitted {formatSubmittedAt(farmerObservation.reportedAt)}
                  </span>
                ) : null}
              </div>

              {breedingFollowUpDetailsQuery.isLoading && !farmerObservation.hasObservation ? (
                <div className="flex items-center justify-center py-6 text-xs text-base-content/50">
                  <span className="loading loading-spinner loading-sm mr-2" />
                  Loading farmer update…
                </div>
              ) : farmerObservation.hasObservation ? (
                <div className="space-y-3">
                  {farmerObservation.reportType ? (
                    <h4 className="text-base font-bold text-base-content">
                      {getBreedingObservationLabel(farmerObservation.reportType)}
                    </h4>
                  ) : null}

                  {farmerObservation.signs.length > 0 ? (
                    <div>
                      <span className="text-xs font-semibold text-base-content/60 block mb-1">
                        Signs observed:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-sm text-base-content">
                        {farmerObservation.signs.map((sign) => (
                          <li key={sign} className="font-medium">
                            {getBreedingObservationSignLabel(sign)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {farmerObservation.notes ? (
                    <div>
                      <span className="text-xs font-semibold text-base-content/60 block mb-1">
                        Notes:
                      </span>
                      <p className="text-xs text-base-content/80 whitespace-pre-wrap bg-base-200/50 rounded-lg p-2.5">
                        {farmerObservation.notes}
                      </p>
                    </div>
                  ) : null}

                  {farmerObservation.evidencePhotos.length > 0 ? (
                    <div>
                      <span className="text-xs font-semibold text-base-content/60 block mb-1.5">
                        Supporting photos:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {farmerObservation.evidencePhotos.map((photo, index) => {
                          const url = imagePreviewUrl(photo);
                          return (
                            <button
                              key={url || index}
                              type="button"
                              className="relative h-16 w-16 overflow-hidden rounded-lg border border-base-300 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                              onClick={() => setPreviewImage(photo)}
                              aria-label={`View supporting photo ${index + 1}`}
                            >
                              <img
                                src={url}
                                alt={`Supporting photo ${index + 1}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-center py-4">
                  <MessageSquare
                    className="mx-auto text-base-content/30 mb-2"
                    size={24}
                  />
                  <h4 className="font-bold text-base-content text-sm">
                    No farmer update received
                  </h4>
                  <p className="text-xs text-base-content/60 mt-1 max-w-70 mx-auto">
                    Contact the farmer to ask whether the animal showed signs of
                    returning to heat.
                  </p>
                </div>
              )}
            </div>

            {/* Farmer Contact */}
            <div className="rounded-xl border border-base-300 p-4">
              <h3 className="font-bold text-primary mb-3">Farmer Contact</h3>
              <div className="flex items-center gap-3">
                {breedingFollowUpFarmer?.imageUrl ? (
                  <div className="avatar">
                    <div className="h-10 w-10 rounded-full">
                      <img
                        src={breedingFollowUpFarmer.imageUrl}
                        alt={`${breedingFollowUpFarmer.name || "Farmer"} profile`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="avatar avatar-placeholder">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary">
                      <span className="text-sm font-semibold">
                        {breedingFollowUpFarmer?.name
                          ? breedingFollowUpFarmer.name.charAt(0).toUpperCase()
                          : "F"}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-base-content text-sm">
                    {breedingFollowUpFarmer?.name ||
                      breedingFollowUp?.farmerName ||
                      "Unknown Farmer"}
                  </h4>
                  <p className="text-xs text-base-content/60">
                    {breedingFollowUpFarmer?.phoneNumber ||
                      breedingFollowUpFarmer?.phone ||
                      "No phone number available"}
                  </p>
                </div>
              </div>
              <a
                href={
                  breedingFollowUpFarmer?.phoneNumber ||
                  breedingFollowUpFarmer?.phone
                    ? `tel:${breedingFollowUpFarmer.phoneNumber || breedingFollowUpFarmer.phone}`
                    : undefined
                }
                className={`btn btn-outline btn-primary w-full mt-4 ${!breedingFollowUpFarmer?.phoneNumber && !breedingFollowUpFarmer?.phone ? "btn-disabled" : ""}`}
              >
                <Phone size={16} />
                Call Farmer
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="form-control">
              <div className="text-sm font-bold text-base-content mb-2">
                Follow-up Outcome
              </div>
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({
                      ...c,
                      reportType: "possible_pregnancy",
                    }))
                  }
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                    followUpDraft.reportType === "possible_pregnancy"
                      ? "border-primary bg-primary/5"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">
                      No heat noticed
                    </h4>
                    <p className="mt-1 text-xs text-base-content/70">
                      No heat signs were reported. Pregnancy still requires
                      professional confirmation.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({
                      ...c,
                      reportType: "return_to_heat",
                    }))
                  }
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                    followUpDraft.reportType === "return_to_heat"
                      ? "border-error bg-error/5"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">
                      Returned to heat
                    </h4>
                    <p className="mt-1 text-xs text-base-content/70">
                      Return-to-heat signs were observed or reported.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({ ...c, reportType: "unsure" }))
                  }
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                    followUpDraft.reportType === "unsure"
                      ? "border-warning bg-warning/5"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">Not sure</h4>
                    <p className="mt-1 text-xs text-base-content/70">
                      Unable to determine whether the animal returned to heat.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({
                      ...c,
                      reportType: "unable_to_contact",
                    }))
                  }
                  className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors ${
                    followUpDraft.reportType === "unable_to_contact"
                      ? "border-base-content/30 bg-base-200"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-300 text-base-content/60">
                    <PhoneOff size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-base-content">
                      Unable to contact farmer
                    </h4>
                    <p className="mt-1 text-xs text-base-content/70">
                      No reproductive observation will be recorded.
                    </p>
                  </div>
                </button>
              </div>
            </label>
          </div>
        )}
      </Modal>

      {previewImage && (
        <ImagePreviewModal
          images={farmerObservation?.evidencePhotos || []}
          selectedImage={previewImage}
          onSelectImage={setPreviewImage}
          onClose={() => setPreviewImage(null)}
          title="Supporting photos"
        />
      )}
    </div>
  );
}
