import { useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search,
  MapPin,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Lock,
  Phone,
  Calendar,
  Clock,
  AlertCircle,
  Filter,
  Eye,
  MoreVertical,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/layout/Topbar";
import UserAvatar from "../../components/ui/UserAvatar";
import { TableRowSkeleton } from "../../components/ui/Skeleton";
import RequestActionModal from "../../components/dialogs/RequestActionModal";
import AIClaimScheduleAction from "../../components/dialogs/AIClaimScheduleAction";
import { ui } from "../../components/ui/uiClasses";
import Modal from "../../components/ui/Modal";
import {
  getClaimType,
  getTechnicianStatus,
} from "../../constants/technicianWorkflow";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";
import {
  REQUEST_BOARD_VIEWS,
  getInitialRequestBoardView,
  getRequestAssigneeId,
  getRequestBoardViewSelection,
  getRequestStatusPresentation,
  isActiveRequestAssignedTo,
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

const formatRequestLocation = (address, fallback) => {
  if (typeof address === "string" && address.trim()) return address.trim();
  const normalizedAddress = Array.isArray(address) ? address[0] || {} : address || {};
  const city = String(normalizedAddress.city || normalizedAddress.municipality || "").trim();
  const barangay = String(normalizedAddress.barangay || "").trim();
  const zonePurok = String(
    normalizedAddress.zone ||
      normalizedAddress.purok ||
      normalizedAddress.sitio ||
      normalizedAddress.streetPurok ||
      normalizedAddress.street ||
      ""
  ).trim();

  if (city && barangay) {
    const formattedBarangay = barangay.toLowerCase().startsWith("brgy.")
      ? barangay
      : `Brgy. ${barangay}`;
    return `${city}, ${formattedBarangay}${zonePurok ? ` ${zonePurok}` : ""}`;
  }

  return String(fallback || "Location unavailable").trim() || "Location unavailable";
};

const localDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatCanonicalAISchedule = (schedule = {}) => {
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

  if (rawType === "breeding_verification") {
    return {
      workflow: "breeding_verification",
      serviceType: "breeding_verification",
      label: "Breeding Verification",
      badge: "VERIFY",
      badgeClass: "badge-secondary",
      iconColor: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    };
  }

  if (["ai", "insemination", "artificial_insemination"].includes(rawType)) {
    return {
      workflow: "insemination",
      serviceType: "ai",
      label: "",
      badge: "AI",
      badgeClass: "badge-info",
      iconColor: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    };
  }

  if (rawType.includes("pregnancy") || rawType === "pd") {
    return {
      workflow: "pregnancy_check",
      serviceType: "pregnancy_check",
      label: "Pregnancy Check",
      badge: "PD",
      badgeClass: "badge-warning",
      iconColor: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    };
  }

  if (rawType.includes("calving") || rawType === "cd") {
    return {
      workflow: "calving",
      serviceType: "calving",
      label: "Calving Assistance",
      badge: "CD",
      badgeClass: "badge-accent",
      iconColor: "text-pink-500 bg-pink-500/10 border-pink-500/20",
    };
  }

  if (rawType.includes("follow")) {
    return {
      workflow: "task",
      serviceType: "follow_up",
      label: "Follow-up Visit",
      badge: "TASK",
      badgeClass: "badge-success",
      iconColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    };
  }

  if (
    rawType.includes("visit") ||
    rawType.includes("inspection") ||
    rawType === "task"
  ) {
    return {
      workflow: "task",
      serviceType: "general_visit",
      label: "General Check-up",
      badge: "TASK",
      badgeClass: "badge-ghost",
      iconColor: "text-amber-500 bg-amber-500/10 border-amber-500/20",
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

export default function OperationalInbox() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = window.location.pathname.startsWith("/admin");
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("requestId");
  const requestedStatusFilter = searchParams.get("status") || "pending";
  const initialStatusFilter =
    requestedStatusFilter === "in_progress"
      ? "in-progress"
      : requestedStatusFilter;
  const initialRequestView = getInitialRequestBoardView(initialStatusFilter);
  const [dismissedDeepLink, setDismissedDeepLink] = useState(null);
  const filtersPanelRef = useRef(null);

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me", "operational-inbox"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: !isAdmin,
  });

  const [primaryView] = useState(initialRequestView);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState(
    getRequestBoardViewSelection(initialRequestView, { isAdmin }).assignment,
  );
  const [sortBy, setSortBy] = useState("newest");
  const [municipality, setMunicipality] = useState("");
  const [district, setDistrict] = useState("");
  const [barangay, setBarangay] = useState("");
  const [nearCoords, setNearCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
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

  const itemsPerPage = 6;
  const toast = useToast();

  const statusParam =
    statusFilter === "in-progress" ? "in_progress" : statusFilter;

  // Background query to fetch stats and sidebar summary counts
  const { data: statsRequests = [] } = useQuery({
    queryKey: ["technician", "requests-stats-background"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/requests", {
        params: { limit: 200, status: "all" },
      });
      return res.data?.requests || [];
    },
  });

  const requestsQueryKey = [
    "technician",
    "requests",
    statusParam,
    typeFilter,
    urgencyFilter,
    assignmentFilter,
    sortBy,
    municipality,
    barangay,
    nearCoords?.latitude,
    nearCoords?.longitude,
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
          urgency: urgencyFilter === "all" ? undefined : urgencyFilter,
          assignment: assignmentFilter,
          sortBy,
          municipality: municipality || undefined,
          barangay: barangay || undefined,
          nearLat: nearCoords?.latitude,
          nearLng: nearCoords?.longitude,
          search: searchQuery || undefined,
          includeOperationalTasks: true,
          page: currentPage,
          limit: itemsPerPage,
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
      const canonicalSchedule = {
        date: req.schedule?.date || null,
        visitPeriod: req.schedule?.visitPeriod || null,
      };
      const legacyScheduleValue =
        req.scheduledDate || req.preferredDate || req.createdAt || null;
      const legacyScheduleDate = legacyScheduleValue
        ? new Date(legacyScheduleValue)
        : null;
      const isValidLegacyDate =
        legacyScheduleDate && !Number.isNaN(legacyScheduleDate.getTime());
      const canonicalSchedulePresentation = formatCanonicalAISchedule(
        canonicalSchedule,
      );

      const formattedDateOnly = isCanonicalAI
        ? canonicalSchedulePresentation.dateLabel
        : isValidLegacyDate
          ? legacyScheduleDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Date unavailable";

      const formattedTimeOnly = isCanonicalAI
        ? canonicalSchedulePresentation.periodLabel
        : isValidLegacyDate
          ? legacyScheduleDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "Time unavailable";

      const formattedSchedule = isCanonicalAI
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
      const requestLocation = formatRequestLocation(
        req.raw?.farmerId?.address || farmerDetails?.address,
        req.locationLabel || req.location,
      );

      return {
        id: req.id,
        workflowId: req.workflowId,
        workflowType: req.workflowType,
        allowedAction: req.allowedAction || null,
        actionLabel: req.actionLabel || null,
        farmer:
          farmerDetails?.name || req.farmer || "Farmer unavailable",
        farmerDetails,
        farmerImageUrl: req.farmerImageUrl || null,
        farmerPhone:
          req.phone ||
          req.farmerPhone ||
          farmerDetails?.phone ||
          req.raw?.farmerId?.phoneNumber ||
          "Not provided",
        location: requestLocation,
        type: service.workflow,
        queueType: req.type,
        serviceType: service.serviceType,
        serviceLabel: isReInsemination
          ? `Re-insemination · Attempt ${attemptNumber}`
          : service.label,
        serviceBadge: service.badge,
        badgeClass: service.badgeClass,
        iconColor: service.iconColor,
        distanceText,
        farmerBadge,
        animalTag,
        animalName:
          animalDetails?.name ||
          (typeof req.animal === "string" ? req.animal : null) ||
          animalTag,
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
            : service.workflow === "breeding_verification"
              ? "Breeding observation verification"
              : service.workflow === "pregnancy_check"
                ? "Pregnancy diagnosis check"
                : service.workflow === "calving"
                  ? "Calving assistance requested"
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

    if (primaryView === REQUEST_BOARD_VIEWS.MINE) {
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
  }, [queueData, primaryView]);

  const deepLinkedTask = requestedId
    ? requests.find((request) => String(request.id) === requestedId) || null
    : null;
  const activeTask = selectedTask || deepLinkedTask;
  const isActiveTaskModalOpen =
    isTaskModalOpen ||
    Boolean(deepLinkedTask && dismissedDeepLink !== requestedId);

  // Dynamic request type summary calculations
  const pregnancyCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return meta.workflow === "pregnancy_check";
  }).length;

  const vaccinationCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return (
      meta.serviceType === "vaccination" ||
      String(r.type).toLowerCase().includes("vacc")
    );
  }).length;

  const aiCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return meta.workflow === "insemination";
  }).length;

  const healthCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return meta.workflow === "health";
  }).length;

  const calvingCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return meta.workflow === "calving";
  }).length;

  const generalCount = statsRequests.filter((r) => {
    const meta = getServiceMeta(r);
    return meta.workflow === "task";
  }).length;

  // Dynamic claimed requests list for current technician
  const claimedRequests = useMemo(() => {
    if (!dbUser?._id) return [];
    return statsRequests
      .filter((req) => isActiveRequestAssignedTo(req, dbUser._id))
      .slice(0, 3)
      .map((req) => {
        const meta = getServiceMeta(req);
        const status = getTechnicianStatus(req.status);
        return {
          id: req.id,
          label: meta.label,
          animal: `Tag #${req.earTag || "Livestock"}`,
          status: status.label,
          statusClass: status.badgeClass,
        };
      });
  }, [statsRequests, dbUser]);

  // Action Handlers
  const handleClaimRequest = async (request) => {
    if (
      !isAdmin &&
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
    if (isUpdating) return;
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
  const barangayOptions = getIloiloBarangayOptions(municipality, district);
  const defaultViewSelection = getRequestBoardViewSelection(primaryView, {
    isAdmin,
  });

  const clearAdvancedFilters = () => {
    setStatusFilter(defaultViewSelection.status);
    setAssignmentFilter(defaultViewSelection.assignment);
    setMunicipality("");
    setDistrict("");
    setBarangay("");
    setTypeFilter("all");
    setUrgencyFilter("all");
    setSortBy("newest");
    setNearCoords(null);
    setCurrentPage(1);
  };

  const activeFilters = [
    ...(statusFilter !== defaultViewSelection.status
      ? [
          {
            key: "status",
            label: `Status: ${
              statusFilter === "in-progress"
                ? "In progress"
                : statusFilter === "declined"
                  ? "Declined / cancelled"
                  : statusFilter === "active"
                    ? "Active requests"
                    : statusFilter === "history"
                      ? "History"
                      : toTitleCase(statusFilter)
            }`,
            clear: () => setStatusFilter(defaultViewSelection.status),
          },
        ]
      : []),
    ...(typeFilter !== "all"
      ? [
          {
            key: "type",
            label: typeFilter === "ai" ? "AI Services" : "Health Assistance",
            clear: () => setTypeFilter("all"),
          },
        ]
      : []),
    ...(urgencyFilter !== "all"
      ? [
          {
            key: "urgency",
            label: "Urgent only",
            clear: () => setUrgencyFilter("all"),
          },
        ]
      : []),
    ...(municipality
      ? [
          {
            key: "municipality",
            label: municipality,
            clear: () => {
              setMunicipality("");
              setDistrict("");
              setBarangay("");
            },
          },
        ]
      : []),
    ...(district
      ? [
          {
            key: "district",
            label: district,
            clear: () => {
              setDistrict("");
              setBarangay("");
            },
          },
        ]
      : []),
    ...(barangay
      ? [
          {
            key: "barangay",
            label: barangay,
            clear: () => setBarangay(""),
          },
        ]
      : []),
    ...(nearCoords
      ? [
          {
            key: "near",
            label: "Near me",
            clear: () => {
              setNearCoords(null);
              setSortBy("newest");
            },
          },
        ]
      : []),
    ...(sortBy !== "newest" && !(nearCoords && sortBy === "distance")
      ? [
          {
            key: "sort",
            label:
              sortBy === "oldest"
                ? "Oldest first"
                : sortBy === "preferredDate"
                  ? "Visit date"
                  : "Nearest first",
            clear: () => setSortBy("newest"),
          },
        ]
      : []),
  ];

  const toggleNearMe = () => {
    if (nearCoords) {
      setNearCoords(null);
      setSortBy("newest");
      setCurrentPage(1);
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Location is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNearCoords({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setSortBy("distance");
        setCurrentPage(1);
        setIsLocating(false);
      },
      (error) => {
        toast.error(error.message || "Unable to access your location.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const openAIRequest = (request, view = "details") => {
    setAIRequestModal({ request, view });
  };

  const closeAIRequest = () => {
    setAIRequestModal({ request: null, view: "details" });
  };

  const openRequest = (request) => {
    if (!isAdmin && request.workflowType === "AI") {
      openAIRequest(request, "details");
      return;
    }
    setSelectedTask(request);
    setIsTaskModalOpen(true);
  };

  return (
    <div className={`${ui.page} bg-base-200/50`}>
      <Topbar
        title={isAdmin ? "Request Monitoring" : "Request Board"}
        subtitle={
          isAdmin
            ? "Review municipal service requests and technician assignments"
            : "Claim new farmer requests or manage visits already assigned to you"
        }
      />

      <main
        className={`${ui.main} w-full max-w-500 mx-auto p-4 lg:p-6 space-y-6`}
      >
        {/* ================= 1. PRIMARY SPLIT LAYOUT ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
          {/* LEFT COLUMN: FILTERS, REQUEST LIST, PAGINATION */}
          <div className="space-y-6">
            {/* Filter toolbar */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-base-content tracking-tight">
                  {isAdmin ? "Needs review" : "Available Requests"}
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

              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-base-300/60">
                <label className="input input-sm w-full flex items-center gap-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary">
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
                </label>

                <details
                  ref={filtersPanelRef}
                  className="dropdown dropdown-end w-full sm:w-auto"
                >
                  <summary className="btn btn-sm btn-outline w-full sm:w-auto gap-2 list-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <Filter size={14} aria-hidden="true" />
                    Filters
                    {activeFilters.length > 0 && (
                      <span className="badge badge-sm badge-primary">
                        {activeFilters.length}
                      </span>
                    )}
                  </summary>

                  <div className="dropdown-content z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-box border border-base-300 bg-base-100 p-4 shadow-lg">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold text-lg text-base-content">
                          Filter requests
                        </h3>
                        <p className="text-base text-base-content/60 mt-0.5">
                          Results update as you choose filters.
                        </p>
                      </div>
                      {activeFilters.length > 0 && (
                        <button
                          type="button"
                          onClick={clearAdvancedFilters}
                          className="btn btn-xs btn-ghost"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Request status
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
                          {primaryView === REQUEST_BOARD_VIEWS.AVAILABLE ? (
                            <>
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="all">All available</option>
                            </>
                          ) : primaryView === REQUEST_BOARD_VIEWS.MINE ? (
                            <>
                              {!isAdmin && (
                                <option value="active">
                                  All active requests
                                </option>
                              )}
                              <option value="scheduled">Scheduled</option>
                              <option value="in-progress">In progress</option>
                            </>
                          ) : (
                            <>
                              <option value="history">All history</option>
                              <option value="completed">Completed</option>
                              <option value="declined">
                                Declined / cancelled
                              </option>
                            </>
                          )}
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Service type
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
                          <option value="ai">AI Service</option>
                          <option value="health">Health Assistance</option>
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Urgency
                        </span>
                        <select
                          aria-label="Urgency"
                          value={urgencyFilter}
                          onChange={(event) => {
                            setUrgencyFilter(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="all">All urgency levels</option>
                          <option value="urgent">Urgent only</option>
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Municipality
                        </span>
                        <select
                          aria-label="Municipality"
                          value={municipality}
                          onChange={(event) => {
                            setMunicipality(event.target.value);
                            setDistrict("");
                            setBarangay("");
                            setCurrentPage(1);
                          }}
                          className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="">All municipalities</option>
                          {ILOILO_MUNICIPALITY_OPTIONS.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      {municipality === ILOILO_CITY_NAME && (
                        <label className="form-control">
                          <span className="label text-sm font-semibold text-base-content/60">
                            District
                          </span>
                          <select
                            aria-label="District"
                            value={district}
                            onChange={(event) => {
                              setDistrict(event.target.value);
                              setBarangay("");
                              setCurrentPage(1);
                            }}
                            className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            <option value="">All districts</option>
                            {ILOILO_CITY_DISTRICT_OPTIONS.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Barangay
                        </span>
                        <select
                          aria-label="Barangay"
                          value={barangay}
                          disabled={
                            !municipality ||
                            (municipality === ILOILO_CITY_NAME && !district)
                          }
                          onChange={(event) => {
                            setBarangay(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="">All barangays</option>
                          {barangayOptions.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="form-control">
                        <span className="label text-sm font-semibold text-base-content/60">
                          Sort order
                        </span>
                        <select
                          aria-label="Sort order"
                          value={sortBy}
                          onChange={(event) => {
                            setSortBy(event.target.value);
                            setCurrentPage(1);
                          }}
                          className="select select-sm w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="preferredDate">Visit date</option>
                          {nearCoords && (
                            <option value="distance">Nearest first</option>
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-4 border-t border-base-300">
                      <button
                        type="button"
                        onClick={toggleNearMe}
                        disabled={isLocating}
                        className={`btn btn-sm gap-2 ${nearCoords ? "btn-primary" : "btn-ghost"}`}
                      >
                        {isLocating ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          <MapPin size={14} aria-hidden="true" />
                        )}
                        {nearCoords ? "Using my location" : "Near me"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          filtersPanelRef.current?.removeAttribute("open")
                        }
                        className="btn btn-sm"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </details>
              </div>

              {activeFilters.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-2"
                  aria-label="Active filters"
                >
                  {activeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => {
                        filter.clear();
                        setCurrentPage(1);
                      }}
                      className="badge badge-outline gap-1.5 min-h-7 px-3 text-base-content/70 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Remove ${filter.label} filter`}
                    >
                      {filter.label}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearAdvancedFilters}
                    className="btn btn-xs btn-ghost"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Main items display grid/list with static container height and fixed column widths */}
            <div id="request-board-results" className="w-full">
              <div className="card bg-base-100 border border-base-300/60 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-145 xl:h-150">
                {/* Scrollable table viewport with table-fixed layout */}
                <div className="overflow-x-auto overflow-y-auto flex-1">
                  <table className="table table-pin-rows table-fixed w-full min-w-155 text-left">
                    <colgroup>
                      <col className="w-[23%] min-w-32.5" />
                      <col className="w-[27%] min-w-45" />
                      <col className="w-[27%] min-w-37.5" />
                      <col className="w-[16%] min-w-27.5" />
                      <col className="w-[7%] min-w-16" />
                    </colgroup>
                    <thead>
                      <tr className="bg-base-200/70 text-xs font-semibold text-base-content/70 border-b border-base-300 uppercase tracking-wider">
                        <th scope="col" className="p-4 pl-6">
                          Farmer / Contact
                        </th>
                        <th scope="col" className="p-4">
                          Service Request
                        </th>
                        <th scope="col" className="p-4">
                          Schedule / Location
                        </th>
                        <th scope="col" className="p-4 text-center">
                          Status
                        </th>
                        <th scope="col" className="p-4 pr-6 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200/50">
                      {isMasterLoading ? (
                        [...Array(6)].map((_, idx) => (
                          <TableRowSkeleton key={idx} />
                        ))
                      ) : isQueueError ? (
                        <tr>
                          <td colSpan={5} className="p-12 text-center">
                            <div
                              className="alert alert-error max-w-md mx-auto flex flex-col justify-center items-center"
                              role="alert"
                            >
                              <AlertCircle size={24} aria-hidden="true" />
                              <div className="text-center">
                                <h3 className="font-semibold">
                                  Requests are unavailable
                                </h3>
                                <p className="text-sm">
                                  {queueError?.response?.data?.message ||
                                    "Refresh the request board to try again."}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm mt-2"
                                onClick={() => refetchQueue()}
                              >
                                Retry
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : requests.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-3 py-12">
                              <ShieldAlert
                                size={40}
                                className="text-base-content/20"
                              />
                              <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mt-1">
                                No matches found
                              </h3>
                              <p className="text-sm font-semibold text-base-content/40 max-w-sm leading-relaxed">
                                {searchQuery
                                  ? `We couldn't find any service requests matching "${searchQuery}".`
                                  : "There are currently no active requests under this tab category."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        requests.map((req) => {
                          const reqTechId = getRequestAssigneeId(req);
                          const statusPresentation =
                            getRequestStatusPresentation(req, { isAdmin }) ||
                            getTechnicianStatus(req.status);

                          const isAssignedToOther =
                            reqTechId &&
                            dbUser?._id &&
                            String(reqTechId) !== String(dbUser._id);
                          const isAIClaimAndSchedule =
                            !isAdmin &&
                            req.workflowType === "AI" &&
                            req.allowedAction === "CLAIM_AND_SCHEDULE";

                          const visitDate = req.visitDate
                            ? new Date(req.visitDate)
                            : null;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const isOverdue =
                            (req.status === "in-progress" ||
                              req.status === "approved") &&
                            visitDate &&
                            visitDate < today;

                          return (
                            <tr
                              key={req.id}
                              onClick={() => openRequest(req)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  openRequest(req);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-label={`Open ${req.serviceLabel} request for ${req.farmer}`}
                              className="hover:bg-base-200/40 transition-colors cursor-pointer relative text-base font-semibold text-base-content/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                              {/* COLUMN 1: FARMER INFO */}
                              <td className="p-4 pl-6 align-top">
                                <div className="flex items-start gap-3 min-w-0">
                                  {isOverdue && (
                                    <div
                                      className="w-1.5 h-10 bg-rose-500 rounded-full animate-pulse shrink-0 self-center"
                                      title="Overdue Request"
                                    />
                                  )}
                                  <UserAvatar
                                    name={req.farmer}
                                    imageUrl={req.farmerImageUrl}
                                    size={48}
                                    sizeClass="h-12 w-12"
                                    className="shadow-sm shrink-0"
                                  />
                                  <div className="min-w-0 grow">
                                    <h4 className="text-sm font-semibold text-base-content tracking-tight truncate">
                                      {toTitleCase(req.farmer)}
                                    </h4>
                                    <p
                                      className="text-xs font-medium text-primary mt-1.5 flex items-center gap-1.5 truncate"
                                      aria-label={`Farmer contact: ${req.farmerPhone}`}
                                    >
                                      <Phone
                                        size={15}
                                        aria-hidden="true"
                                        className="shrink-0"
                                      />
                                      <span className="truncate">
                                        {req.farmerPhone}
                                      </span>
                                    </p>
                                    {req.farmerBadge && (
                                      <span className="badge badge-sm badge-ghost mt-1 font-semibold uppercase text-[10px]">
                                        {String(req.farmerBadge).replaceAll(
                                          "_",
                                          " ",
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* COLUMN 2: SERVICE DETAILS */}
                              <td className="p-4 align-top">
                                <dl className="grid gap-2 text-xs">
                                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                                    <dt className="font-medium text-base-content/55">Service request</dt>
                                    <dd className="flex min-w-0 items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border shrink-0 ${req.iconColor}`}>{req.serviceBadge}</span>
                                      <span className="truncate font-semibold text-sm text-base-content">{req.serviceLabel}</span>
                                    </dd>
                                  </div>
                                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                                    <dt className="font-medium text-base-content/55">Animal</dt>
                                    <dd className="truncate font-medium text-base-content/90">
                                      Tag #{req.animalTag}
                                    </dd>
                                  </div>
                                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                                    <dt className="font-medium text-base-content/55">Timeframe</dt>
                                    <dd className="flex min-w-0 items-center gap-1.5 text-base-content/70">
                                      <Clock size={13} aria-hidden="true" className="shrink-0 text-base-content/50" />
                                      <time dateTime={req.createdAt} className="truncate">
                                        {req.formattedSentAt ? `Requested: ${req.formattedSentAt}` : req.date}
                                      </time>
                                    </dd>
                                  </div>
                                </dl>
                              </td>

                              {/* COLUMN 3: GEOGRAPHIC AND DATETIME */}
                              <td className="p-4 align-top">
                                <dl className="grid gap-2.5 text-xs">
                                  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                                    <dt className="font-medium text-base-content/55">Schedule</dt>
                                    <dd className="flex min-w-0 items-start gap-1.5 font-medium text-base-content/85">
                                      <Calendar size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-base-content/45" />
                                      <span className="break-words">{req.workflowType === "AI" ? req.date : `${req.formattedDateOnly}, ${req.formattedTimeOnly}`}</span>
                                    </dd>
                                  </div>
                                  <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                                    <dt className="font-medium text-base-content/55">Location</dt>
                                    <dd className="flex min-w-0 items-start gap-1.5 font-medium text-base-content/85">
                                      <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-base-content/45" />
                                      <span className="break-words">{req.location}</span>
                                    </dd>
                                  </div>
                                </dl>
                              </td>

                              {/* COLUMN 4: STATUS */}
                              <td className="p-4 align-top text-center">
                                <div className="flex items-center justify-center pt-1">
                                  <span
                                    className={`badge badge-soft text-xs font-semibold px-3 py-1 shadow-2xs ${statusPresentation.badgeClass}`}
                                  >
                                    {statusPresentation.label}
                                  </span>
                                </div>
                              </td>

                              {/* COLUMN 5: ACTIONS */}
                              <td className="p-4 pr-6 align-top text-right">
                                <div className="flex items-start justify-end pt-0.5" onClick={(event) => event.stopPropagation()}>
                                  {isAssignedToOther ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 uppercase tracking-wider select-none bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
                                      <Lock size={15} /> Assigned
                                    </span>
                                  ) : (
                                    <div className="dropdown dropdown-end">
                                      <button tabIndex={0} type="button" className="btn btn-ghost btn-sm btn-square" aria-label={`Actions for ${req.serviceLabel} request from ${req.farmer}`}>
                                        <MoreVertical size={18} aria-hidden="true" />
                                      </button>
                                      <ul tabIndex={0} className="dropdown-content menu z-30 mt-1 w-52 rounded-box border border-base-300 bg-base-100 p-1.5 shadow-lg">
                                        {isAIClaimAndSchedule && (
                                          <li>
                                            <button type="button" disabled={isUpdating} onClick={() => openAIRequest(req, "schedule")}>
                                              <Calendar size={16} aria-hidden="true" />
                                              Claim &amp; Scheduled
                                            </button>
                                          </li>
                                        )}

                                        {!isAIClaimAndSchedule &&
                                          req.status === "pending" &&
                                          !reqTechId && (
                                          <li>
                                            <button type="button" disabled={isUpdating} onClick={() => handleClaimRequest(req)}>
                                              <CheckCircle size={16} aria-hidden="true" />
                                              Claim &amp; Scheduled
                                            </button>
                                          </li>
                                        )}

                                        <li>
                                          <button type="button" onClick={() => openRequest(req)}>
                                            <Eye size={16} aria-hidden="true" />
                                            View details
                                          </button>
                                        </li>

                                        {req.status === "in-progress" &&
                                          req.type !== "breeding_verification" && (
                                          <li>
                                            <button type="button" disabled={isUpdating} onClick={() => openRequest(req)}>
                                              <CheckCircle size={16} aria-hidden="true" />
                                              {req.type === "health" ? "Submit health record" : `Complete ${req.serviceLabel}`}
                                            </button>
                                          </li>
                                        )}

                                        {["insemination", "health"].includes(req.type) && (
                                          <li>
                                            <button type="button" disabled={isUpdating} className="text-error hover:bg-error/10 hover:text-error" onClick={() => handleDeleteRequest(req.id, req.type)}>
                                              <Trash2 size={16} aria-hidden="true" />
                                              Delete request
                                            </button>
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

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

          {/* RIGHT COLUMN: RADAR MAP, STATS SUMMARY, CLAIMED LIST */}
          <aside className="space-y-6">
            {/* 2. REQUEST TYPE SUMMARY COUNTS */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                  Request Summary
                </h3>
              </div>

              <div className="space-y-3 pt-1">
                {/* Pregnancy Check */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />{" "}
                    Pregnancy Check
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {pregnancyCount}
                  </span>
                </div>

                {/* Vaccination */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />{" "}
                    Vaccination
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {vaccinationCount}
                  </span>
                </div>

                {/* AI Service */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{" "}
                    AI Service
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {aiCount}
                  </span>
                </div>

                {/* Health Assistance */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />{" "}
                    Health Assistance
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {healthCount}
                  </span>
                </div>

                {/* Calving Assistance */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />{" "}
                    Calving Assistance
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {calvingCount}
                  </span>
                </div>

                {/* General Check-up */}
                <div className="flex items-center justify-between text-sm font-semibold text-base-content/85">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />{" "}
                    General Check-up
                  </span>
                  <span className="text-base-content/60 font-semibold">
                    {generalCount}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. MY CLAIMED REQUESTS PANEL */}
            <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
                    Claimed Requests
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigate(isAdmin ? "/admin/work-queue" : "/technician/work-queue");
                  }}
                  className="btn btn-sm btn-ghost text-primary text-[10px] uppercase font-semibold"
                >
                  View all
                </button>
              </div>

              <ul className="list gap-2 pt-1">
                {claimedRequests.length === 0 ? (
                  <li className="py-6 text-center text-base text-base-content/60">
                    No active claimed requests.
                  </li>
                ) : (
                  claimedRequests.map((claimed) => (
                    <li
                      key={claimed.id}
                      onClick={() => {
                        navigate(isAdmin ? "/admin/work-queue" : "/technician/work-queue");
                      }}
                      className="list-row items-center gap-3 rounded-xl bg-base-200/60 p-3 cursor-pointer hover:bg-base-200/80 transition-colors"
                    >
                      <div className="list-col-grow min-w-0">
                        <span className="text-sm font-semibold text-base-content block leading-tight truncate">
                          {claimed.label}
                        </span>
                        <span className="text-sm text-base-content/65 block mt-1 truncate">
                          {claimed.animal}
                        </span>
                      </div>
                      <span
                        className={`badge badge-md font-extrabold text-xs shrink-0 ${claimed.statusClass}`}
                      >
                        {claimed.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </aside>
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

      <AIClaimScheduleAction
        key={aiRequestModal.request?.workflowId || "closed-ai-request"}
        modalState={aiRequestModal}
        requestQueryKey={requestsQueryKey}
        onClose={closeAIRequest}
        onViewChange={(view) =>
          setAIRequestModal((current) => ({ ...current, view }))
        }
      />

      {/* ===== TASK ACTION DIALOG MODAL ===== */}
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
        isAdmin={isAdmin}
      />
    </div>
  );
}
