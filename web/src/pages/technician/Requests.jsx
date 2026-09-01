import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/layout/Topbar";
import RequestActionModal from "../../components/dialogs/RequestActionModal";
import HealthRequestActionModal from "../../components/dialogs/HealthRequestActionModal";
import AIClaimScheduleAction from "../../components/dialogs/AIClaimScheduleAction";
import RequestQueueCard from "../../features/technician/RequestQueueCard";
import { ui } from "../../components/ui/uiClasses";
import AdminRequestCards from "../../components/admin/requests/AdminRequestCards";
import Modal from "../../components/ui/Modal";
import { getClaimType } from "../../constants/technicianWorkflow";
import { WEB_ROLES, getRequestActionPolicy } from "../../constants/webRoles";
import WorkQueue from "./WorkQueue";
import {
  REQUEST_BOARD_VIEWS,
  getInitialRequestBoardView,
  getRequestBoardViewSelection,
} from "../../utils/requestBoardViews";

// Helper to convert strings to Title Case
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCanonicalVisitSchedule = (schedule = {}) => {
  if (!schedule.date) {
    return {
      combined: "Not scheduled",
      dateLabel: "Not scheduled",
      periodLabel: "",
    };
  }

  const date = new Date(schedule.date);
  if (Number.isNaN(date.getTime())) {
    return {
      combined: "Not scheduled",
      dateLabel: "Not scheduled",
      periodLabel: "",
    };
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateKey = localDateKey(date);
  const dateLabel =
    dateKey === localDateKey(today)
      ? "Today"
      : dateKey === localDateKey(tomorrow)
        ? "Tomorrow"
        : date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
  const periodLabel = schedule.visitPeriod
    ? toTitleCase(schedule.visitPeriod)
    : "";

  return {
    combined: [dateLabel, periodLabel].filter(Boolean).join(" · "),
    dateLabel,
    periodLabel,
  };
};

const getServiceMeta = (request = {}) => {
  const raw = request.raw || request;
  const rawType = String(
    request.type ||
      raw.type ||
      raw.serviceType ||
      raw.taskType ||
      raw.requestType ||
      "",
  ).toLowerCase();
  const hasHealthSignal =
    raw.symptoms || raw.issueDescription || raw.diagnosis || raw.treatment;

  if (["ai", "insemination", "artificial_insemination"].includes(rawType)) {
    return {
      workflow: "insemination",
      serviceType: "ai",
      label: "AI Service",
      badge: "AI",
      badgeClass: "badge-info",
      iconColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    };
  }

  if (
    rawType === "health" ||
    rawType.includes("health") ||
    rawType.includes("medical") ||
    hasHealthSignal
  ) {
    return {
      workflow: "health",
      serviceType: raw.requestType || rawType || "health",
      label: "Health Assistance",
      badge: "HEALTH",
      badgeClass: "badge-error",
      iconColor: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    };
  }

  return {
    workflow: "service",
    serviceType: rawType || "service",
    label: "Service Request",
    badge: "SERVICE",
    badgeClass: "badge-ghost",
    iconColor: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  };
};

const REQUEST_SECTIONS = Object.freeze({
  AVAILABLE: "available",
  MY_WORK: "myWork",
});

function RequestsSectionTabs({ activeSection, onSelect }) {
  return (
    <div
      role="tablist"
      aria-label="Technician request sections"
      className="tabs tabs-box tabs-sm w-full sm:w-fit"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeSection === REQUEST_SECTIONS.AVAILABLE}
        className={`tab grow sm:grow-0 ${
          activeSection === REQUEST_SECTIONS.AVAILABLE ? "tab-active" : ""
        }`}
        onClick={() => onSelect(REQUEST_SECTIONS.AVAILABLE)}
      >
        Available
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeSection === REQUEST_SECTIONS.MY_WORK}
        className={`tab grow sm:grow-0 ${
          activeSection === REQUEST_SECTIONS.MY_WORK ? "tab-active" : ""
        }`}
        onClick={() => onSelect(REQUEST_SECTIONS.MY_WORK)}
      >
        My Work
      </button>
    </div>
  );
}

export default function OperationalInbox({ role = WEB_ROLES.TECHNICIAN }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const isTechnician = role === WEB_ROLES.TECHNICIAN;
  const requestedSection = searchParams.get("section");
  const activeSection =
    requestedSection === REQUEST_SECTIONS.MY_WORK
      ? REQUEST_SECTIONS.MY_WORK
      : REQUEST_SECTIONS.AVAILABLE;

  useEffect(() => {
    if (!isTechnician || requestedSection === activeSection) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("section", activeSection);
        return next;
      },
      { replace: true },
    );
  }, [activeSection, isTechnician, requestedSection, setSearchParams]);

  const selectSection = (section) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("section", section);
      if (section === REQUEST_SECTIONS.MY_WORK) {
        next.delete("requestId");
        next.delete("status");
      } else {
        next.delete("taskId");
        next.delete("workState");
        next.delete("workStateFilter");
      }
      return next;
    });
  };

  if (!isTechnician) return <RequestBoard role={role} />;

  if (activeSection === REQUEST_SECTIONS.MY_WORK) {
    return (
      <div className={`${ui.page} bg-base-200/50`}>
        <Topbar
          title="Requests"
          subtitle="Available Farmer requests and work already assigned to you"
        />
        <main
          className={`${ui.main} mx-auto w-full max-w-500 space-y-6 p-4 lg:p-6`}
        >
          <RequestsSectionTabs
            activeSection={activeSection}
            onSelect={selectSection}
          />
          <div>
            <h2 className="text-lg font-semibold text-base-content">My Work</h2>
            <p className="mt-1 text-sm text-base-content/65">
              Work currently assigned to you.
            </p>
          </div>
          <WorkQueue embedded />
        </main>
      </div>
    );
  }

  return <RequestBoard role={role} onSelectSection={selectSection} />;
}

function RequestBoard({ role, onSelectSection }) {
  const queryClient = useQueryClient();
  const actionPolicy = getRequestActionPolicy(role);
  const { isAdmin } = actionPolicy;
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("requestId");
  const requestedStatusFilter = searchParams.get("status") || "pending";
  const normalizedInitialStatus =
    requestedStatusFilter === "in_progress"
      ? "in-progress"
      : requestedStatusFilter;
  const requestedInitialView = getInitialRequestBoardView(
    normalizedInitialStatus,
  );
  const initialRequestView = isAdmin
    ? requestedInitialView
    : REQUEST_BOARD_VIEWS.AVAILABLE;
  const initialStatusFilter = isAdmin ? normalizedInitialStatus : "pending";
  const [dismissedDeepLink, setDismissedDeepLink] = useState(null);

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me", "operational-inbox"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: actionPolicy.isTechnician,
  });

  const [primaryView] = useState(initialRequestView);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [assignmentFilter] = useState(
    getRequestBoardViewSelection(initialRequestView, { isAdmin }).assignment,
  );
  const [technicianFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [selectedTask, setSelectedTask] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [aiRequestModal, setAIRequestModal] = useState({
    request: null,
    view: "details",
  });
  const [isUpdating, setIsUpdating] = useState(false);

  const itemsPerPage = 6; // Set to 6 to match the pagination of the redesigned screen
  const toast = useToast();

  const statusParam =
    statusFilter === "in-progress" ? "in_progress" : statusFilter;

  useQuery({
    queryKey: ["technicianListForAdmin"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=technician");
      return Array.isArray(res.data) ? res.data : res.data?.users || [];
    },
    enabled: isAdmin,
  });

  const effectiveAssignmentFilter = isAdmin
    ? technicianFilter === "unassigned"
      ? "unassigned"
      : "all"
    : assignmentFilter;

  const requestsQueryKey = [
    "technician",
    "requests",
    isAdmin ? "admin" : "technician",
    statusParam,
    typeFilter,
    urgencyFilter,
    assignmentFilter,
    technicianFilter,
    searchQuery,
    currentPage,
    requestedId,
  ];

  // Main list query
  const {
    data: queueData,
    refetch: refetchQueue,
    isLoading: isLoadingQueue,
    isError: isQueueError,
    error: queueError,
  } = useQuery({
    queryKey: requestsQueryKey,
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/requests", {
        params: {
          status: statusParam,
          type: typeFilter,
          urgency:
            !isAdmin && urgencyFilter !== "all" ? urgencyFilter : undefined,
          assignment: effectiveAssignmentFilter,
          assignedTechnicianId:
            isAdmin && !["all", "unassigned"].includes(technicianFilter)
              ? technicianFilter
              : undefined,
          sortBy: "newest",
          search: searchQuery || undefined,
          includeOperationalTasks: false,
          page: currentPage,
          limit: itemsPerPage,
          requestId: requestedId || undefined,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  const isMasterLoading = isLoadingQueue;

  const requests = useMemo(() => {
    const queue = Array.isArray(queueData?.requests) ? queueData.requests : [];
    let mapped = queue.map((req) => {
      const service = getServiceMeta(req);
      const animalTag = req.earTag || req.animal || "Not recorded";
      const breed = req.breed || req.raw?.animalId?.breed || "Not recorded";
      const healthDetail =
        req.raw?.symptoms || req.raw?.requestType || "No symptoms listed";
      const previousAttempt = req.raw?.previousAttemptId;
      const isReInsemination =
        service.workflow === "insemination" && Boolean(previousAttempt);
      const attemptNumber = Number(req.raw?.attemptNumber || 1);
      const previousTechnician =
        previousAttempt?.technicianId?.name ||
        previousAttempt?.approvedBy?.name;
      const normalizedStatus = String(req.status || "")
        .trim()
        .toLowerCase()
        .replaceAll(" ", "-")
        .replaceAll("_", "-");

      const distanceText = Number.isFinite(req.distanceKm)
        ? `${req.distanceKm.toFixed(1)} km away`
        : "Distance unavailable";

      const farmerBadge = req.raw?.farmerId?.accountStatus || null;
      const isCanonicalAI = req.workflowType === "AI";
      const isCanonicalHealth = service.workflow === "health";
      const usesCanonicalVisitPeriod = isCanonicalAI || isCanonicalHealth;
      const canonicalSchedule = {
        date:
          req.schedule?.date ||
          (isCanonicalHealth
            ? req.scheduledDate || req.raw?.scheduledDate || null
            : null),
        visitPeriod:
          req.schedule?.visitPeriod ||
          (isCanonicalHealth
            ? req.visitPeriod || req.raw?.visitPeriod || null
            : null),
      };
      const legacyScheduleValue =
        req.scheduledDate || req.preferredDate || req.createdAt || null;
      const legacyScheduleDate = legacyScheduleValue
        ? new Date(legacyScheduleValue)
        : null;
      const isValidLegacyDate =
        legacyScheduleDate && !Number.isNaN(legacyScheduleDate.getTime());
      const canonicalSchedulePresentation =
        formatCanonicalVisitSchedule(canonicalSchedule);

      const formattedDateOnly = usesCanonicalVisitPeriod
        ? canonicalSchedulePresentation.dateLabel
        : isValidLegacyDate
          ? legacyScheduleDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Date unavailable";

      const formattedTimeOnly = usesCanonicalVisitPeriod
        ? canonicalSchedulePresentation.periodLabel
        : isValidLegacyDate
          ? legacyScheduleDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "Time unavailable";

      const formattedSchedule = usesCanonicalVisitPeriod
        ? canonicalSchedulePresentation.combined
        : isValidLegacyDate
          ? `${formattedDateOnly}, ${formattedTimeOnly}`
          : "Date unavailable";
      const sentDate = req.createdAt ? new Date(req.createdAt) : null;
      const isValidSentDate = sentDate && !Number.isNaN(sentDate.getTime());
      const formattedSentAt = isValidSentDate
        ? sentDate.toLocaleString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null;
      const farmerDetails =
        req.farmer && typeof req.farmer === "object"
          ? req.farmer
          : req.farmerDetails || null;
      const animalDetails =
        req.animal && typeof req.animal === "object" ? req.animal : null;

      return {
        id: req.id,
        workflowId: req.workflowId,
        workflowType: req.workflowType,
        allowedAction: req.allowedAction || null,
        actionLabel: req.actionLabel || null,
        farmer: farmerDetails?.name || req.farmer || "Farmer unavailable",
        farmerDetails,
        farmerImageUrl: req.farmerImageUrl || null,
        farmerPhone:
          req.phone ||
          req.farmerPhone ||
          farmerDetails?.phone ||
          req.raw?.farmerId?.phoneNumber ||
          "Not provided",
        location:
          req.locationLabel ||
          req.location ||
          req.raw?.farmerId?.address?.barangay ||
          "Location unavailable",
        type: service.workflow,
        queueType: req.type,
        serviceType: service.serviceType,
        serviceLabel: isReInsemination
          ? `Re-insemination · Attempt ${attemptNumber}`
          : service.label,
        serviceBadge: service.badge,
        badgeClass: service.badgeClass,
        iconColor: isAdmin
          ? "border-base-300 bg-base-200 text-base-content/70"
          : service.iconColor,
        distanceText,
        farmerBadge,
        animalTag,
        animalName:
          animalDetails?.name ||
          (typeof req.animal === "string" ? req.animal : null) ||
          animalTag,
        species: req.species || req.raw?.animalId?.species || "",
        breed,
        taskDetails:
          req.raw?.symptoms ||
          req.raw?.issueDescription ||
          req.raw?.diagnosis ||
          req.raw?.treatment ||
          req.raw?.farmerObservation ||
          req.raw?.observationNotes ||
          req.raw?.notes ||
          req.raw?.remarks ||
          req.raw?.taskDescription ||
          req.raw?.description ||
          (service.workflow === "insemination"
            ? isReInsemination
              ? `Re-insemination attempt ${attemptNumber}`
              : "Artificial insemination requested"
            : service.workflow === "health"
              ? req.raw?.requestType || "Health assistance requested"
              : service.label),
        task:
          service.workflow === "insemination"
            ? `AI request for Tag #${animalTag} (${breed})`
            : service.workflow === "health"
              ? `Health Assistance for Tag #${animalTag} - ${healthDetail}`
              : `${service.label} for Tag #${animalTag}`,
        date: formattedSchedule,
        formattedDateOnly,
        formattedTimeOnly,
        formattedSentAt,
        status: normalizedStatus === "resolved" ? "done" : normalizedStatus,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt || req.raw?.updatedAt || req.createdAt || null,
        updatedAtTime: new Date(
          req.updatedAt || req.raw?.updatedAt || req.createdAt || 0,
        ).getTime(),
        preferredDate: req.preferredDate || req.raw?.preferredDate || null,
        scheduledDate: req.scheduledDate || req.raw?.scheduledDate || null,
        schedule: canonicalSchedule,
        visitDate: isCanonicalAI
          ? canonicalSchedule.date
          : req.scheduledDate || req.preferredDate || null,
        heatSigns: Array.isArray(req.heatSigns) ? req.heatSigns : [],
        requestSubmissionDate:
          req.requestSubmissionDate || req.createdAt || null,
        attachments: req.attachments || { count: 0, urls: [] },
        urgency: req.urgency,
        previousTechnician,
        raw: req.raw || req,
      };
    });

    mapped = mapped.filter(
      (request) =>
        request.type === "insemination" || request.type === "health",
    );

    if (primaryView === REQUEST_BOARD_VIEWS.AVAILABLE) {
      mapped = mapped.filter((req) => {
        const isAI =
          req.workflowType === "AI" ||
          req.serviceType === "ai" ||
          req.queueType === "insemination";
        const isHealth =
          req.workflowType === "Health" ||
          req.serviceType === "health" ||
          req.queueType === "health";
        const isCompleted = ["done", "completed", "resolved"].includes(
          String(req.status || "").toLowerCase(),
        );
        return !((isAI || isHealth) && isCompleted);
      });
    } else if (primaryView === REQUEST_BOARD_VIEWS.MINE) {
      mapped = mapped.filter((req) => {
        const s = String(req.status || "")
          .toLowerCase()
          .replaceAll("_", "-");
        return ![
          "completed",
          "done",
          "resolved",
          "declined",
          "cancelled",
          "rejected",
        ].includes(s);
      });
    } else if (primaryView === REQUEST_BOARD_VIEWS.HISTORY) {
      mapped = mapped.filter((req) => {
        const s = String(req.status || "")
          .toLowerCase()
          .replaceAll("_", "-");
        return [
          "completed",
          "done",
          "resolved",
          "declined",
          "cancelled",
          "rejected",
        ].includes(s);
      });
    }

    // Ensure newly claimed/updated tasks stack right at the top
    return mapped.sort((a, b) => b.updatedAtTime - a.updatedAtTime);
  }, [isAdmin, queueData, primaryView]);

  const deepLinkedTask = requestedId
    ? requests.find((request) => String(request.id) === requestedId) || null
    : null;
  const activeTask = selectedTask || deepLinkedTask;
  const isActiveTaskModalOpen =
    isTaskModalOpen ||
    Boolean(deepLinkedTask && dismissedDeepLink !== requestedId);
  const isTechnicianHealthTask =
    actionPolicy.isTechnician &&
    (activeTask?.workflowType === "Health" || activeTask?.type === "health");

  // Action Handlers
  const handleClaimRequest = async (request) => {
    if (!actionPolicy.canClaim) return;
    if (
      actionPolicy.canSchedule &&
      request.workflowType === "AI" &&
      request.allowedAction === "CLAIM_AND_SCHEDULE"
    ) {
      return;
    }
    if (isUpdating) return;
    const claimType = getClaimType(request.queueType || request.type);
    if (!claimType) {
      toast.error("This request cannot be claimed from the service queue.");
      return;
    }

    setIsUpdating(true);
    try {
      await axiosInstance.patch(
        `/technician/requests/${claimType}/${request.id}/claim`,
      );
      toast.success(
        "Request claimed. You can now schedule or open its details.",
      );
      await queryClient.invalidateQueries({ queryKey: ["technician"] });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "The request could not be claimed.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRequest = async (id, type) => {
    if (!actionPolicy.canCancelOwnRequest || isUpdating) return;
    if (!["insemination", "health"].includes(type)) {
      toast.error(
        "This service type cannot be cancelled from the generic queue.",
      );
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Cancel Request",
      message:
        "Are you sure you want to cancel this field service request? The record stays available for audit/history.",
      onConfirm: async () => {
        setIsUpdating(true);
        try {
          const endpoint =
            type === "insemination"
              ? `/ai-request/${id}/cancel`
              : `/health-request/${id}/cancel`;
          await axiosInstance.patch(endpoint, {
            reason: "Cancelled from web operational inbox.",
          });
          toast.success("Request cancelled successfully");
          await queryClient.invalidateQueries({ queryKey: ["technician"] });
        } catch (error) {
          toast.error(
            "Failed to cancel request: " +
              (error.response?.data?.message || error.message),
          );
        } finally {
          setIsUpdating(false);
        }
      },
    });
  };

  // Pagination totals
  const totalItems = queueData?.pagination?.total || requests.length;
  const totalPages = queueData?.pagination?.totalPages || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const clearListFilters = () => {
    setTypeFilter("all");
    setUrgencyFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };
  const hasListFilters =
    Boolean(searchQuery) || typeFilter !== "all" || urgencyFilter !== "all";

  const openAIRequest = (request, view = "details") => {
    setAIRequestModal({ request, view });
  };

  const closeAIRequest = () => {
    setAIRequestModal({ request: null, view: "details" });
  };

  const openRequest = (request) => {
    if (actionPolicy.isTechnician && request.workflowType === "AI") {
      openAIRequest(request, "details");
      return;
    }
    setSelectedTask(request);
    setIsTaskModalOpen(true);
  };

  return (
    <div className={`${ui.page} bg-base-200/50`}>
      <Topbar
        title="Requests"
        subtitle={
          isAdmin
            ? "Review municipal service requests and technician assignments"
            : "Claim incoming AI and Health requests or review ones assigned to you"
        }
      />

      <main
        className={`${ui.main} w-full max-w-500 mx-auto p-4 lg:p-6 space-y-6`}
      >
        {!isAdmin && (
          <RequestsSectionTabs
            activeSection={REQUEST_SECTIONS.AVAILABLE}
            onSelect={onSelectSection}
          />
        )}
        <div className="space-y-6">
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="card card-border bg-base-100 p-4 space-y-4">
              {isAdmin ? (
                <>
                  {/* Admin request filters */}
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
                    <label className="form-control w-full lg:min-w-72 lg:flex-[1_1_45%] lg:max-w-2xl">
                      <span className="label text-sm font-semibold text-base-content/60">
                        Search
                      </span>
                      <span className="input input-sm w-full flex items-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                        <Search
                          size={16}
                          className="text-base-content/60 shrink-0"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          aria-label="Search service requests"
                          placeholder="Search farmer, animal, or tag…"
                          value={searchQuery}
                          onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="grow min-w-0 text-base placeholder:text-base-content/60"
                        />
                      </span>
                    </label>

                    <label className="form-control w-full lg:w-44">
                      <span className="label text-sm font-semibold text-base-content/60">
                        Status
                      </span>
                      <select
                        aria-label="Request status"
                        value={statusFilter}
                        onChange={(event) => {
                          setStatusFilter(event.target.value);
                          setCurrentPage(1);
                        }}
                        className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="in-progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="declined">Declined / cancelled</option>
                      </select>
                    </label>

                    <label className="form-control w-full lg:w-48">
                      <span className="label text-sm font-semibold text-base-content/60">
                        Service Type
                      </span>
                      <select
                        aria-label="Service type"
                        value={typeFilter}
                        onChange={(event) => {
                          setTypeFilter(event.target.value);
                          setCurrentPage(1);
                        }}
                        className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <option value="all">All service types</option>
                        <option value="ai">AI Services</option>
                        <option value="health">Health Assistance</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-2 border-t border-base-300/60">
                    <h2 className="text-lg font-semibold text-base-content tracking-tight">
                      Needs review
                    </h2>
                    <p
                      className="text-sm font-medium text-base-content/60 whitespace-nowrap"
                      aria-live="polite"
                    >
                      {isMasterLoading
                        ? "Loading requests…"
                        : `${totalItems} request${totalItems !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Technician request filters */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-base-content">
                        Incoming requests
                      </h2>
                      <p className="mt-1 text-sm text-base-content/65">
                        Farmer service requests you can claim.
                      </p>
                    </div>
                    <p
                      className="text-sm font-medium text-base-content/65"
                      aria-live="polite"
                    >
                      {isMasterLoading
                        ? "Loading requests…"
                        : `${totalItems} request${totalItems !== 1 ? "s" : ""}`}
                    </p>
                  </div>

                  <div className="grid gap-3 border-t border-base-300 pt-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto] lg:items-end">
                    <label className="form-control">
                      <span className="label text-sm font-semibold text-base-content/65">
                        Search
                      </span>
                      <span className="input input-sm flex w-full items-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
                        <Search
                          size={16}
                          className="shrink-0 text-base-content/60"
                          aria-hidden="true"
                        />
                        <input
                          type="search"
                          aria-label="Search service requests"
                          placeholder="Search farmer or animal…"
                          value={searchQuery}
                          onChange={(event) => {
                            setSearchQuery(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="min-w-0 grow text-base placeholder:text-base-content/60"
                        />
                      </span>
                    </label>

                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold text-base-content/65">
                        Type
                      </legend>
                      <div className="join flex" aria-label="Request type">
                        {[
                          ["all", "All"],
                          ["ai", "AI"],
                          ["health", "Health"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={typeFilter === value}
                            className={`btn btn-sm join-item grow lg:grow-0 ${
                              typeFilter === value ? "btn-active" : ""
                            }`}
                            onClick={() => {
                              setTypeFilter(value);
                              setCurrentPage(1);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold text-base-content/65">
                        Urgency
                      </legend>
                      <div className="join flex" aria-label="Health urgency">
                        {[
                          ["all", "All"],
                          ["urgent", "Urgent Health"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={urgencyFilter === value}
                            className={`btn btn-sm join-item grow lg:grow-0 ${
                              urgencyFilter === value ? "btn-active" : ""
                            }`}
                            onClick={() => {
                              setUrgencyFilter(value);
                              setCurrentPage(1);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </>
              )}
            </div>

            {/* Main request list */}
            <div id="request-board-results" className="w-full mb-8">
              <div
                className={
                  isAdmin
                    ? "flex min-h-145 flex-col overflow-hidden rounded-2xl xl:h-150"
                    : "space-y-4"
                }
              >
                {isAdmin ? (
                  <AdminRequestCards
                    requests={requests}
                    isLoading={isMasterLoading}
                    isError={isQueueError}
                    error={queueError}
                    onRetry={() => refetchQueue()}
                    onViewRequest={openRequest}
                    emptyMessage={
                      searchQuery
                        ? `No service requests match "${searchQuery}".`
                        : "There are no requests under the selected filters."
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {isMasterLoading ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {[...Array(6)].map((_, index) => (
                          <div
                            key={index}
                            className="card card-border bg-base-100"
                            aria-hidden="true"
                          >
                            <div className="card-body gap-4 p-5">
                              <div className="flex gap-2">
                                <span className="skeleton h-5 w-20" />
                                <span className="skeleton h-5 w-24" />
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="skeleton h-11 w-11 rounded-full" />
                                <div className="grow space-y-2">
                                  <span className="skeleton block h-4 w-2/3" />
                                  <span className="skeleton block h-3 w-1/2" />
                                </div>
                              </div>
                              <span className="skeleton block h-16 w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : isQueueError ? (
                      <div
                        className="alert alert-error mx-auto max-w-lg"
                        role="alert"
                      >
                        <AlertCircle size={22} aria-hidden="true" />
                        <div>
                          <h3 className="font-semibold">
                            Requests are unavailable
                          </h3>
                          <p className="text-sm">
                            {queueError?.response?.data?.message ||
                              "Refresh the request list to try again."}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => refetchQueue()}
                        >
                          Retry
                        </button>
                      </div>
                    ) : requests.length === 0 ? (
                      <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-base-300 bg-base-100 px-6 py-10 text-center">
                        <ShieldAlert
                          size={36}
                          className="text-base-content/30"
                          aria-hidden="true"
                        />
                        <h3 className="mt-3 text-base font-semibold text-base-content">
                          {hasListFilters
                            ? "No requests match these filters"
                            : "No available requests"}
                        </h3>
                        <p className="mt-1 max-w-md text-sm leading-relaxed text-base-content/65">
                          {hasListFilters
                            ? "Try a broader search or clear the Type and Urgency filters."
                            : "New Farmer AI and Health requests will appear here when they are available to claim."}
                        </p>
                        {hasListFilters ? (
                          <button
                            type="button"
                            className="btn btn-sm mt-4"
                            onClick={clearListFilters}
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </section>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {requests.map((request) => (
                          <RequestQueueCard
                            key={request.id}
                            request={request}
                            currentUserId={dbUser?._id}
                            isUpdating={isUpdating}
                            canClaim={actionPolicy.canClaim}
                            canCancel={actionPolicy.canCancelOwnRequest}
                            onOpen={openRequest}
                            onClaim={handleClaimRequest}
                            onSchedule={(selectedRequest) =>
                              openAIRequest(selectedRequest, "schedule")
                            }
                            onCancel={(selectedRequest) =>
                              handleDeleteRequest(
                                selectedRequest.id,
                                selectedRequest.type,
                              )
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Integrated Static Pagination Footer */}
                {!isMasterLoading && totalPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-base-300/60 pt-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-base-100 rounded-b-2xl">
                    <span className="text-sm text-base-content/55">
                      Showing {totalItems === 0 ? 0 : startIndex + 1}–
                      {Math.min(startIndex + itemsPerPage, totalItems)} of{" "}
                      {totalItems} service requests
                    </span>
                    <div
                      className="join self-end sm:self-auto"
                      aria-label="Service requests pagination"
                    >
                      <button
                        type="button"
                        className="btn btn-sm join-item"
                        aria-label="Previous service requests page"
                        disabled={currentPage === 1 || isMasterLoading}
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm join-item pointer-events-none"
                        aria-current="page"
                      >
                        Page {currentPage} of {totalPages}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm join-item"
                        aria-label="Next service requests page"
                        disabled={currentPage === totalPages || isMasterLoading}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* CONFIRM ACTION DIALOG MODAL */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          })
        }
        title={confirmModal.title || "Confirm action"}
        type={
          confirmModal.title.toLowerCase().includes("cancel")
            ? "warning"
            : "info"
        }
        size="sm"
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost text-xs font-semibold"
              onClick={() =>
                setConfirmModal({
                  isOpen: false,
                  title: "",
                  message: "",
                  onConfirm: null,
                })
              }
            >
              Go back
            </button>
            <button
              type="button"
              className={`btn text-xs font-semibold ${confirmModal.title.toLowerCase().includes("cancel") ? "btn-error" : "btn-primary"}`}
              onClick={() => {
                confirmModal.onConfirm?.();
                setConfirmModal({
                  isOpen: false,
                  title: "",
                  message: "",
                  onConfirm: null,
                });
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        <p className="text-sm font-semibold text-base-content/75">
          {confirmModal.message}
        </p>
      </Modal>

      {actionPolicy.canSchedule && (
        <AIClaimScheduleAction
          key={aiRequestModal.request?.workflowId || "closed-ai-request"}
          modalState={aiRequestModal}
          requestQueryKey={requestsQueryKey}
          onClose={closeAIRequest}
          onViewChange={(view) =>
            setAIRequestModal((current) => ({ ...current, view }))
          }
        />
      )}

      {/* ===== TASK ACTION DIALOG MODAL ===== */}
      {isTechnicianHealthTask ? (
        <HealthRequestActionModal
          isOpen={isActiveTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            if (requestedId) setDismissedDeepLink(requestedId);
          }}
          task={activeTask}
          onSuccess={() => refetchQueue()}
        />
      ) : (
        <RequestActionModal
          isOpen={isActiveTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            if (requestedId) setDismissedDeepLink(requestedId);
          }}
          task={activeTask}
          onSuccess={() => {
            refetchQueue();
          }}
          role={actionPolicy.role}
        />
      )}
    </div>
  );
}
