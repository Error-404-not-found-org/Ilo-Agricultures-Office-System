import { useState, useEffect, useEffectEvent, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CalendarCheck,
  CalendarDays,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  PhoneOff,
  MessageSquare,
  Phone,
  Clock,
  Info,
  Activity,
  HeartPulse,
  Stethoscope,
  Syringe,
  Baby,
  HeartCrack,
  User,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import { ui } from "../../components/ui/uiClasses";
import Topbar from "../../components/layout/Topbar";
import AIServiceModal from "../../components/dialogs/AIServiceModal";
import AIScheduledVisitModal from "../../components/dialogs/AIScheduledVisitModal";
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
  formatHealthRequestType,
} from "../../utils/requestWorkPresentation";
import { isFutureSchedule } from "../../utils/technicianSchedulePresentation";
import {
  getLifecycleTaskPresentation,
  getTaskSupportingText,
} from "../../utils/technicianLifecyclePresentation";
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

  if (task.workflowType === "Calving" && isMongoId(task.context?.calvingId)) {
    return {
      animalId,
      recordKind: "calving",
      recordId: task.context.calvingId,
    };
  }

  return null;
};

const formatFollowUpLocation = (farmer, fallback = "Location not provided") => {
  if (!farmer) return fallback;
  if (typeof farmer === "string") return farmer.trim() || fallback;
  if (farmer.location) return String(farmer.location).trim();
  if (farmer.barangay) {
    return [farmer.barangay, farmer.municipality || farmer.city]
      .filter(Boolean)
      .join(", ");
  }
  if (farmer.address) {
    if (typeof farmer.address === "string")
      return farmer.address.trim() || fallback;
    if (farmer.address.barangay) {
      return [
        farmer.address.barangay,
        farmer.address.municipality || farmer.address.city,
      ]
        .filter(Boolean)
        .join(", ");
    }
  }
  return fallback;
};

const getWorkItemTheme = (task, serviceType, lifecycle) => {
  const isLoss =
    lifecycle?.title === "Pregnancy Loss Review" ||
    task.sourceType === "farmer_pregnancy_loss_report" ||
    task.allowedAction === "REVIEW_PREGNANCY_LOSS";
  if (isLoss) {
    return {
      icon: HeartCrack,
      iconClass:
        "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      badgeClass:
        "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
    };
  }
  const isBreedingFollowUp =
    lifecycle?.title === "Breeding Follow-up" ||
    task.workflowType === "BreedingFollowUp" ||
    task.taskType === "BreedingFollowUp" ||
    task.allowedAction === "RECORD_BREEDING_OBSERVATION";
  if (isBreedingFollowUp) {
    return {
      icon: CalendarCheck,
      iconClass:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      badgeClass:
        "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30",
    };
  }
  if (
    serviceType === "pregnancy" ||
    lifecycle?.title?.toLowerCase().includes("pregnancy")
  ) {
    return {
      icon: HeartPulse,
      iconClass:
        "bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20",
      badgeClass:
        "bg-pink-500/15 text-pink-700 dark:text-pink-300 border border-pink-500/30",
    };
  }
  if (serviceType === "health") {
    return {
      icon: Stethoscope,
      iconClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      badgeClass:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30",
    };
  }
  if (serviceType === "ai") {
    return {
      icon: Syringe,
      iconClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      badgeClass:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    };
  }
  if (serviceType === "calving") {
    return {
      icon: Baby,
      iconClass:
        "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
      badgeClass:
        "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30",
    };
  }
  return {
    icon: CalendarDays,
    iconClass: "bg-primary/10 text-primary border border-primary/20",
    badgeClass:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30",
  };
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
  const [startHealthServiceOnOpen, setStartHealthServiceOnOpen] =
    useState(false);
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
  const [scheduledAIVisit, setScheduledAIVisit] = useState(null);
  const [isStartingAI, setIsStartingAI] = useState(false);
  const itemsPerPage = 8;

  const selectedWorkSupportingText = getTaskSupportingText(
    selectedWorkDetails,
    "No additional service details recorded.",
  );

  const handleCloseModal = () => {
    setSelectedTaskWrapper(null);
    setStartHealthServiceOnOpen(false);
    setSelectedWorkDetails(null);
    setBreedingFollowUp(null);
    setPregnancyLossReviewTask(null);
    setScheduledAIVisit(null);
    setPreviewImage(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("taskId");
        next.delete("requestId");
        return next;
      },
      { replace: true },
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

  const handledHealthLinkQuery = useQuery({
    queryKey: [
      "technician",
      "health-request",
      "handled-deep-link",
      deepLinkRequestId,
    ],
    enabled:
      Boolean(deepLinkRequestId) &&
      deepLinkQuery.isSuccess &&
      !deepLinkQuery.data,
    retry: false,
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/health-request/${encodeURIComponent(deepLinkRequestId)}`,
      );
      return response.data?.data || response.data?.request || response.data;
    },
  });

  const breedingFollowUpTaskId =
    breedingFollowUp?.taskId || breedingFollowUp?.id || null;
  const breedingFollowUpDetailsQuery = useQuery({
    queryKey: ["technician", "tasks", "detail", breedingFollowUpTaskId || ""],
    enabled: Boolean(breedingFollowUp) && isMongoId(breedingFollowUpTaskId),
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

  const breedingFollowUpFarmerName =
    (typeof breedingFollowUpFarmer?.name === "string" &&
      breedingFollowUpFarmer.name.trim()) ||
    (typeof breedingFollowUpFarmer?.fullName === "string" &&
      breedingFollowUpFarmer.fullName.trim()) ||
    [breedingFollowUpFarmer?.firstName, breedingFollowUpFarmer?.lastName]
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .join(" ") ||
    breedingFollowUp?.farmerName ||
    "Farmer";

  const breedingFollowUpFarmerPhone =
    (typeof breedingFollowUpFarmer?.phoneNumber === "string" &&
      breedingFollowUpFarmer.phoneNumber.trim()) ||
    (typeof breedingFollowUpFarmer?.phone === "string" &&
      breedingFollowUpFarmer.phone.trim()) ||
    (typeof breedingFollowUpFarmer?.contactNumber === "string" &&
      breedingFollowUpFarmer.contactNumber.trim()) ||
    null;

  const breedingFollowUpAnimalName =
    (typeof breedingFollowUpAnimal?.name === "string" &&
      breedingFollowUpAnimal.name.trim()) ||
    "";
  const breedingFollowUpAnimalEarTag =
    (typeof breedingFollowUpAnimal?.earTag === "string" &&
      breedingFollowUpAnimal.earTag.trim()) ||
    (typeof breedingFollowUpAnimal?.tag === "string" &&
      breedingFollowUpAnimal.tag.trim()) ||
    "";
  const breedingFollowUpAnimalDisplayName =
    breedingFollowUpAnimalName && breedingFollowUpAnimalEarTag
      ? `${breedingFollowUpAnimalName} (${breedingFollowUpAnimalEarTag})`
      : breedingFollowUpAnimalEarTag
        ? `Tag ${breedingFollowUpAnimalEarTag}`
        : breedingFollowUpAnimalName || "Unknown Animal";

  const breedingFollowUpReproductiveStatus =
    (typeof breedingFollowUpAnimal?.reproductiveStatus === "string" &&
      breedingFollowUpAnimal.reproductiveStatus.trim()) ||
    "";

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

  const handleStartAIService = async (task) => {
    if (isStartingAI) return;
    const workflowId = task.workflowId || task.id;
    if (!isMongoId(workflowId)) {
      toast.error("This AI work item has an invalid workflow identifier.");
      return;
    }

    setIsStartingAI(true);
    try {
      const response = await axiosInstance.patch(
        `/ai-request/${encodeURIComponent(workflowId)}/status`,
        {
          status: "in-progress",
        },
      );

      queryClient.invalidateQueries({ queryKey: ["technician"] });
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
        error.response?.data?.message || "Failed to start AI service.";
      toast.error(message);
    } finally {
      setIsStartingAI(false);
    }
  };

  const openTask = (task, { startHealthService = false } = {}) => {
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
    const isAI =
      task.workflowType === "AI" ||
      task.type === "insemination" ||
      task.type === "ai";
    const isFuture = isAI
      ? task.workTiming === "upcoming"
      : isFutureSchedule(scheduledDate, visitPeriod);
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
      setScheduledAIVisit(task);
      return;
    }

    if (
      String(task.workflowType || "").toLowerCase() === "health" &&
      task.allowedAction === "VIEW_DETAILS" &&
      !isTerminal
    ) {
      setStartHealthServiceOnOpen(false);
      setSelectedTaskWrapper(task);
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
        if (
          task.workflowType === "AI" &&
          normalizedTaskStatus === "scheduled"
        ) {
          void handleStartAIService(task);
          return;
        }
        if (task.workflowType === "Health") {
          setStartHealthServiceOnOpen(startHealthService);
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
        setStartHealthServiceOnOpen(startHealthService);
        setSelectedTaskWrapper(task);
        return;
      case "VIEW_RECORD": {
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
      case "VIEW_DETAILS": {
        if (
          String(task.workflowType || "").toLowerCase() === "health" &&
          !isTerminal
        ) {
          setStartHealthServiceOnOpen(false);
          setSelectedTaskWrapper(task);
          return;
        }
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
          setStartHealthServiceOnOpen(startHealthService);
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
  const openDeepLinkedTask = useEffectEvent((target) => openTask(target));

  useEffect(() => {
    if (!hasDeepLink) {
      firedDeepLinkIdentifier.current = null;
    } else if (
      deepLinkQuery.isSuccess &&
      (deepLinkQuery.data ||
        !deepLinkRequestId ||
        handledHealthLinkQuery.isSuccess ||
        handledHealthLinkQuery.isError) &&
      firedDeepLinkIdentifier.current !== currentIdentifier
    ) {
      firedDeepLinkIdentifier.current = currentIdentifier;
      const target = deepLinkQuery.data;
      if (target) {
        if (
          !selectedTaskWrapper &&
          !selectedWorkDetails &&
          !breedingFollowUp &&
          !pregnancyLossReviewTask &&
          !scheduledAIVisit
        ) {
          queueMicrotask(() => openDeepLinkedTask(target));
        }
      } else {
        const handledRequest = handledHealthLinkQuery.data;
        const assignedHealthRequest = Boolean(
          handledRequest?.handledBy || handledRequest?.assignedTechnicianId,
        );
        if (
          assignedHealthRequest &&
          handledRequest?.status === "cancelled" &&
          handledRequest?.cancellationStatus === "approved"
        ) {
          toast.info("This Health request has already been cancelled.");
        } else if (
          assignedHealthRequest &&
          handledRequest?.cancellationStatus === "rejected"
        ) {
          toast.info("This cancellation request has already been handled.");
        } else {
          toast.error(
            "This work item is unavailable or is not assigned to you.",
          );
        }
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("taskId");
            next.delete("requestId");
            return next;
          },
          { replace: true },
        );
      }
    }
  }, [
    hasDeepLink,
    deepLinkQuery.isSuccess,
    deepLinkQuery.data,
    deepLinkRequestId,
    handledHealthLinkQuery.isSuccess,
    handledHealthLinkQuery.isError,
    handledHealthLinkQuery.data,
    setSearchParams,
    selectedTaskWrapper,
    selectedWorkDetails,
    breedingFollowUp,
    pregnancyLossReviewTask,
    scheduledAIVisit,
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
                    const lifecycle = getLifecycleTaskPresentation(task);
                    const supportingText = getTaskSupportingText(task);
                    const workflowStatus = normalizeWorkflowStatus(task);
                    const statusPresentation =
                      getWorkflowStatusPresentation(workflowStatus);
                    const serviceType = normalizeServiceType(task);
                    const servicePresentation =
                      getServicePresentation(serviceType);
                    const healthRequestType =
                      task.requestType || task.raw?.requestType;
                    const isLoss =
                      task.sourceType === "farmer_pregnancy_loss_report" ||
                      task.raw?.sourceType === "farmer_pregnancy_loss_report" ||
                      task.allowedAction === "REVIEW_PREGNANCY_LOSS" ||
                      lifecycle?.title === "Pregnancy Loss Review";
                    const taskLabel =
                      serviceType === "health" && healthRequestType
                        ? formatHealthRequestType(healthRequestType)
                        : isLoss && task.title
                          ? task.title
                          : lifecycle?.title ||
                            task.title ||
                            servicePresentation.label;
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
                    const timingLabel = lifecycle
                      ? lifecycle.detail ||
                        lifecycle.timing ||
                        (lifecycle.actionState === "Ready for check"
                          ? lifecycle.actionState
                          : null)
                      : timing.kind === "scheduled_visit"
                        ? formatCanonicalVisitSchedule({
                            date: timing.date,
                            visitPeriod: timing.visitPeriod,
                          })
                        : timing.kind === "completed"
                          ? `Completed ${formatRecordDate(timing.date)}`
                          : `Due ${formatRelativeSchedule(timing.date)}`;
                    const isHealthFarmVisitScheduled =
                      task.workflowType === "Health" &&
                      task.allowedAction === "START_SERVICE";
                    const primaryActionLabel = isHealthFarmVisitScheduled
                      ? "Record Health Assistance"
                      : task.actionLabel || getTaskPrimaryActionLabel(task);
                    const theme = getWorkItemTheme(
                      task,
                      serviceType,
                      lifecycle,
                    );
                    const ItemIcon = theme.icon;
                    return (
                      <article
                        key={task.id}
                        className="rounded-box border border-base-300 bg-base-100 p-4 transition-colors hover:border-base-content/25 sm:p-5"
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(13rem,.8fr)_auto] lg:items-center">
                          {/* Left: Themed Leading Icon + Information */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            {/* Themed Icon Container */}
                            <div
                              className={`flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl ${theme.iconClass}`}
                              aria-hidden="true"
                            >
                              <ItemIcon size={22} />
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Badges Row */}
                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span className="badge badge-sm badge-ghost border-base-300 text-xs font-semibold text-base-content/70">
                                  {servicePresentation.label}
                                </span>
                                {(!lifecycle || lifecycle.actionState) && (
                                  <span
                                    className={`badge badge-sm font-bold border ${theme.badgeClass}`}
                                  >
                                    {lifecycle?.actionState ||
                                      statusPresentation.label}
                                  </span>
                                )}
                                {task.urgent ? (
                                  <span className="badge badge-sm badge-error badge-outline font-bold">
                                    Urgent
                                  </span>
                                ) : null}
                              </div>

                              {/* Title / Headline */}
                              <h3 className="text-sm sm:text-base font-bold text-base-content leading-snug">
                                {taskLabel}
                              </h3>

                              {/* Context note (e.g. Recommended time for pregnancy diagnosis reached) */}
                              {lifecycle?.context && (
                                <p className="mt-1 text-xs text-base-content/70 font-medium">
                                  {lifecycle.context}
                                </p>
                              )}

                              {/* Farmer and Animal Metadata Row */}
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-base-content/70">
                                {/* Farmer name */}
                                {farmerId ? (
                                  <button
                                    type="button"
                                    className="group/farmer flex items-center gap-1.5 font-semibold text-base-content/90 hover:text-primary transition-colors cursor-pointer"
                                    onClick={() =>
                                      navigate(
                                        `/technician/farmers/${farmerId}`,
                                      )
                                    }
                                  >
                                    <User
                                      size={13}
                                      className="shrink-0 text-base-content/40 group-hover/farmer:text-primary transition-colors"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">
                                      {toTitleCase(
                                        task.farmer?.name ||
                                          task.farmerName ||
                                          "Farmer not recorded",
                                      )}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1.5 font-semibold text-base-content/90">
                                    <User
                                      size={13}
                                      className="shrink-0 text-base-content/40"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate">
                                      {toTitleCase(
                                        task.farmer?.name ||
                                          task.farmerName ||
                                          "Farmer not recorded",
                                      )}
                                    </span>
                                  </span>
                                )}

                                {/* Animal info — clickable with paw icon */}
                                {animalId ? (
                                  <button
                                    type="button"
                                    className="group/animal flex items-center gap-1 text-base-content/75 hover:text-primary transition-colors cursor-pointer"
                                    onClick={() =>
                                      navigate(
                                        `/technician/animals/${animalId}`,
                                      )
                                    }
                                  >
                                    <PawPrint
                                      size={12}
                                      className="shrink-0 text-base-content/40 group-hover/animal:text-primary transition-colors"
                                      aria-hidden="true"
                                    />
                                    <span className="font-mono font-bold">
                                      Tag{" "}
                                      {animalReference !== "Not recorded"
                                        ? animalReference
                                        : "Unknown"}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1 text-base-content/75">
                                    <PawPrint
                                      size={12}
                                      className="shrink-0 text-base-content/40"
                                      aria-hidden="true"
                                    />
                                    <span className="font-mono font-bold">
                                      Tag{" "}
                                      {animalReference !== "Not recorded"
                                        ? animalReference
                                        : "Unknown"}
                                    </span>
                                  </span>
                                )}
                              </div>

                              {supportingText ? (
                                <p className="mt-2 line-clamp-2 text-xs text-base-content/55">
                                  {formatTaskSummary(supportingText)}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          {/* Middle: Timing & Location */}
                          <dl className="grid gap-2 text-sm">
                            {timingLabel ? (
                              <div>
                                <dt className="text-xs font-semibold text-base-content/50">
                                  {timing.kind === "scheduled_visit"
                                    ? "Visit"
                                    : timing.kind === "completed"
                                      ? "Completed"
                                      : lifecycle
                                        ? "Timing"
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
                            ) : null}
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

                          {/* Right: Primary CTA Action */}
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
                                  className="btn btn-primary btn-sm shadow-xs hover:shadow transition-all"
                                  disabled={actionDisabled}
                                  onClick={() =>
                                    openTask(task, { startHealthService: true })
                                  }
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
          String(selectedTaskWrapper?.workflowType || "").toLowerCase() ===
            "health"
        }
        onClose={handleCloseModal}
        startServiceOnOpen={startHealthServiceOnOpen}
        task={
          String(selectedTaskWrapper?.workflowType || "").toLowerCase() ===
          "health"
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
      {scheduledAIVisit ? (
        <AIScheduledVisitModal
          key={scheduledAIVisit.workflowId || scheduledAIVisit.id}
          task={scheduledAIVisit}
          isOpen
          onClose={() => setScheduledAIVisit(null)}
          onRescheduled={() => {
            setScheduledAIVisit(null);
            queryClient.invalidateQueries({ queryKey: ["technician"] });
          }}
        />
      ) : null}
      <Modal
        isOpen={Boolean(selectedWorkDetails) && !selectedTaskWrapper}
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
                  {selectedWorkDetails.location ||
                    selectedWorkDetails.farmer?.location ||
                    "Location not recorded"}
                </p>
              </div>
            </div>
            {selectedWorkSupportingText && (
              <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
                <p className="text-xs text-base-content/55">
                  Service information
                </p>
                <p className="font-semibold">
                  {formatTaskSummary(selectedWorkSupportingText)}
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
            )}
          </div>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(breedingFollowUp)}
        onClose={handleCloseModal}
        title={
          breedingFollowUpStep === "overview"
            ? "Breeding Follow-up"
            : "Record Breeding Follow-up"
        }
        subtitle={
          breedingFollowUpStep === "overview"
            ? "Review farmer observation and record breeding outcome"
            : "Record the technician's current observation for this AI attempt."
        }
        size="xl"
        icon={<Activity className="text-primary h-5 w-5" />}
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
                className="btn btn-sm btn-primary font-semibold"
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
                className="btn btn-sm btn-primary font-semibold"
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
          <div className="space-y-4 py-1">
            {breedingFollowUpDetailsQuery.isError ? (
              <div
                className="alert alert-error text-xs rounded-2xl"
                role="alert"
              >
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

            {/* Soft Guidance Banner (matching PregnancyLossReviewModal palette) */}
            <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
              <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
              <div>
                <p className="font-bold text-base-content">
                  Day-21 Return-to-Heat Monitoring
                </p>
                <p className="mt-0.5 leading-relaxed text-base-content/75">
                  Review the farmer's observation to determine if return-to-heat
                  occurred or if pregnancy monitoring will proceed.
                </p>
              </div>
            </div>

            {/* Animal & Farmer Cards Grid (matching PregnancyLossReviewModal) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Breeding Reference */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Breeding Reference
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-base-content">
                      {breedingFollowUpAnimalDisplayName}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5">
                      {[
                        breedingFollowUpAnimal?.species,
                        breedingFollowUpAnimal?.breed,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "No breed info"}
                    </p>
                  </div>
                  {breedingFollowUpReproductiveStatus ? (
                    <span className="badge badge-success badge-sm font-semibold">
                      {breedingFollowUpReproductiveStatus}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-base-content/70">
                    <span>Date Inseminated</span>
                    <span className="font-semibold text-base-content">
                      {breedingFollowUpInsemination?.inseminationDate
                        ? formatInseminationDate(
                            breedingFollowUpInsemination.inseminationDate,
                          )
                        : breedingFollowUpUnavailableLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base-content/70">
                    <span>Attempt</span>
                    <span className="font-semibold text-base-content">
                      {breedingFollowUpInsemination?.attemptNumber != null
                        ? `#${breedingFollowUpInsemination.attemptNumber}`
                        : breedingFollowUpUnavailableLabel}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-base-content/70">
                    <span>Sire</span>
                    <span className="font-semibold text-base-content">
                      {breedingFollowUpSire || breedingFollowUpUnavailableLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reporting Farmer */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Reporting Farmer
                </span>
                <div className="flex items-start gap-3">
                  {breedingFollowUpFarmer?.imageUrl ? (
                    <div className="avatar">
                      <div className="h-10 w-10 rounded-full">
                        <img
                          src={breedingFollowUpFarmer.imageUrl}
                          alt={`${breedingFollowUpFarmerName} profile`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="avatar avatar-placeholder">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary">
                        <span className="text-sm font-semibold">
                          {breedingFollowUpFarmerName
                            ? breedingFollowUpFarmerName.charAt(0).toUpperCase()
                            : "F"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-base-content truncate">
                      {breedingFollowUpFarmerName}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5 truncate">
                      {formatFollowUpLocation(
                        breedingFollowUpFarmer,
                        "Location not provided",
                      )}
                    </p>
                  </div>
                </div>

                {breedingFollowUpFarmerPhone ? (
                  <a
                    href={`tel:${breedingFollowUpFarmerPhone}`}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-3 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {breedingFollowUpFarmerPhone}
                  </a>
                ) : (
                  <p className="text-xs text-base-content/50 mt-3 italic">
                    No phone number available
                  </p>
                )}
              </div>
            </div>

            {/* Farmer Observation / Update Section (matching PregnancyLossReviewModal) */}
            <div className="border border-base-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                    Farmer Update
                  </span>
                  {farmerObservation.hasObservation ? (
                    <span className="badge badge-info badge-sm font-semibold">
                      Needs review
                    </span>
                  ) : null}
                </div>
                {farmerObservation.hasObservation &&
                farmerObservation.reportedAt ? (
                  <span className="text-[11px] text-base-content/60 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Submitted {formatSubmittedAt(farmerObservation.reportedAt)}
                  </span>
                ) : null}
              </div>

              {breedingFollowUpDetailsQuery.isLoading &&
              !farmerObservation.hasObservation ? (
                <div className="flex items-center justify-center py-6 text-xs text-base-content/50">
                  <span className="loading loading-spinner loading-sm mr-2" />
                  Loading farmer update…
                </div>
              ) : farmerObservation.hasObservation ? (
                <div className="space-y-3">
                  {farmerObservation.reportType ? (
                    <h4 className="text-sm font-bold text-base-content">
                      {getBreedingObservationLabel(
                        farmerObservation.reportType,
                      )}
                    </h4>
                  ) : null}

                  {farmerObservation.signs.length > 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                        Signs observed:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-xs text-base-content font-medium">
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
                      <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                        Farmer Notes / Description:
                      </span>
                      <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium whitespace-pre-wrap">
                        {farmerObservation.notes}
                      </p>
                    </div>
                  ) : null}

                  {farmerObservation.evidencePhotos.length > 0 ? (
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1.5">
                        Supporting Photos (
                        {farmerObservation.evidencePhotos.length})
                      </span>
                      <div className="flex flex-wrap gap-2.5">
                        {farmerObservation.evidencePhotos.map(
                          (photo, index) => {
                            const url = imagePreviewUrl(photo);
                            return (
                              <button
                                key={url || index}
                                type="button"
                                className="relative h-20 w-20 rounded-xl overflow-hidden border border-base-300 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer"
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
                          },
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-center py-6 bg-base-200/30 rounded-xl border border-dashed border-base-300">
                  <MessageSquare
                    className="mx-auto text-base-content/30 mb-2"
                    size={24}
                  />
                  <h4 className="font-bold text-base-content text-sm">
                    No farmer update received
                  </h4>
                  <p className="text-xs text-base-content/60 mt-1 max-w-xs mx-auto">
                    Contact the farmer to ask whether the animal showed signs of
                    returning to heat.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Form Step */
          <div className="space-y-4 py-1">
            <div className="border border-base-300 rounded-2xl p-4 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                Follow-up Outcome
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({
                      ...c,
                      reportType: "possible_pregnancy",
                    }))
                  }
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    followUpDraft.reportType === "possible_pregnancy"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-base-content">
                      No heat noticed
                    </h4>
                    <p className="mt-0.5 text-xs text-base-content/70 leading-relaxed">
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
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    followUpDraft.reportType === "return_to_heat"
                      ? "border-error bg-error/5 shadow-sm"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
                    <AlertCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-base-content">
                      Returned to heat
                    </h4>
                    <p className="mt-0.5 text-xs text-base-content/70 leading-relaxed">
                      Return-to-heat signs were observed or reported.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFollowUpDraft((c) => ({ ...c, reportType: "unsure" }))
                  }
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    followUpDraft.reportType === "unsure"
                      ? "border-warning bg-warning/5 shadow-sm"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <HelpCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-base-content">
                      Not sure
                    </h4>
                    <p className="mt-0.5 text-xs text-base-content/70 leading-relaxed">
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
                  className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    followUpDraft.reportType === "unable_to_contact"
                      ? "border-base-content/30 bg-base-200 shadow-sm"
                      : "border-base-300 bg-base-100 hover:border-base-content/20"
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-base-300 text-base-content/60">
                    <PhoneOff size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-base-content">
                      Unable to contact farmer
                    </h4>
                    <p className="mt-0.5 text-xs text-base-content/70 leading-relaxed">
                      No reproductive observation will be recorded.
                    </p>
                  </div>
                </button>
              </div>

              <div>
                <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                  Technician Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={followUpDraft.notes}
                  onChange={(e) =>
                    setFollowUpDraft((c) => ({ ...c, notes: e.target.value }))
                  }
                  placeholder="Enter your observations, examination findings, or follow-up notes..."
                  className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl"
                />
              </div>
            </div>
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
