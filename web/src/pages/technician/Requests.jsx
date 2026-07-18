import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  ClipboardList,
  MapPin,
  Check,
  X,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Lock,
  LocateFixed,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Topbar from "../../components/ui/Topbar";
import { TableRowSkeleton } from "../../components/Skeleton";
import TaskActionModal from "../../components/modals/TaskActionModal";
import { ui } from "../../components/ui/uiClasses";
import Modal from "../../components/ui/Modal";
import RequestQueueCard from "../../components/technician/RequestQueueCard";
import { getClaimType, getTechnicianStatus } from "../../constants/technicianWorkflow";
import {
  ILOILO_CITY_DISTRICT_OPTIONS,
  ILOILO_CITY_NAME,
  ILOILO_MUNICIPALITY_OPTIONS,
  getIloiloBarangayOptions,
} from "../../utils/addressOptions";

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
    };
  }

  if (["ai", "insemination", "artificial_insemination"].includes(rawType)) {
    return {
      workflow: "insemination",
      serviceType: "ai",
      label: "Artificial Insemination",
      badge: "AI",
      badgeClass: "badge-info",
    };
  }

  if (rawType.includes("pregnancy") || rawType === "pd") {
    return {
      workflow: "pregnancy_check",
      serviceType: "pregnancy_check",
      label: "Pregnancy Check",
      badge: "PD",
      badgeClass: "badge-warning",
    };
  }

  if (rawType.includes("calving") || rawType === "cd") {
    return {
      workflow: "calving",
      serviceType: "calving",
      label: "Calving Assistance",
      badge: "CD",
      badgeClass: "badge-accent",
    };
  }

  if (rawType.includes("follow")) {
    return {
      workflow: "task",
      serviceType: "follow_up",
      label: "Follow-up Visit",
      badge: "TASK",
      badgeClass: "badge-success",
    };
  }

  if (rawType.includes("visit") || rawType.includes("inspection") || rawType === "task") {
    return {
      workflow: "task",
      serviceType: "general_visit",
      label: "General Visit",
      badge: "TASK",
      badgeClass: "badge-ghost",
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
    };
  }

  return {
    workflow: "service",
    serviceType: rawType || "service",
    label: "Service Request",
    badge: "SERVICE",
    badgeClass: "badge-ghost",
  };
};

export default function OperationalInbox() {
  const isAdmin = window.location.pathname.startsWith("/admin");
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get("requestId");
  const [dismissedDeepLink, setDismissedDeepLink] = useState(null);
  
  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me", "operational-inbox"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: !isAdmin,
  });

  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "pending");
  const [typeFilter, setTypeFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState(isAdmin ? "all" : "unassigned");
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
  const [isUpdating, setIsUpdating] = useState(false);
  
  const itemsPerPage = 10;
  const toast = useToast();

  const statusParam = statusFilter === "in-progress" ? "in_progress" : statusFilter;

  // Unified Backend 2.0 operational queue. This replaces the old local merge
  // of AI requests and health requests so the screen follows backend workflow rules.
  const {
    data: queueData,
    refetch: refetchQueue,
    isLoading: isLoadingQueue,
    isFetching: isFetchingQueue,
    isError: isQueueError,
    error: queueError,
  } = useQuery({
    queryKey: [
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
    ],
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
          includeOperationalTasks: false,
          page: currentPage,
          limit: itemsPerPage,
        },
      });
      return res.data;
    },
    keepPreviousData: true,
  });

  // Calculate master aggregate loading variable context handles
  const isMasterLoading = isLoadingQueue;

  const requests = useMemo(() => {
    const queue = Array.isArray(queueData?.requests) ? queueData.requests : [];
    return queue.map((req) => {
      const service = getServiceMeta(req);
      const animalTag = req.earTag || req.animal || "Unknown";
      const breed = req.breed || req.raw?.animalId?.breed || "Livestock";
      const healthDetail = req.raw?.symptoms || req.raw?.requestType || "No symptoms listed";
      const previousAttempt = req.raw?.previousAttemptId;
      const isReInsemination =
        service.workflow === "insemination" && Boolean(previousAttempt);
      const attemptNumber = Number(req.raw?.attemptNumber || 1);
      const previousTechnician =
        previousAttempt?.technicianId?.name || previousAttempt?.approvedBy?.name;
      const normalizedStatus = String(req.status || "")
        .trim()
        .toLowerCase()
        .replaceAll(" ", "-")
        .replaceAll("_", "-");

      return {
        id: req.id,
        farmer: req.farmer || "Unknown Farmer",
        location: req.location || req.raw?.farmerId?.address?.barangay || "Location unavailable",
        type: service.workflow,
        queueType: req.type,
        serviceType: service.serviceType,
        serviceLabel: isReInsemination
          ? `Re-insemination · Attempt ${attemptNumber}`
          : service.label,
        serviceBadge: service.badge,
        badgeClass: service.badgeClass,
        task:
          service.workflow === "insemination"
            ? `AI request for Tag #${animalTag} (${breed})`
            : service.workflow === "health"
              ? `Health Assistance for Tag #${animalTag} - ${healthDetail}`
              : `${service.label} for Tag #${animalTag}`,
        date: new Date(req.scheduledDate || req.preferredDate || req.createdAt).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        status: normalizedStatus === "resolved" ? "done" : normalizedStatus,
        createdAt: req.createdAt,
        visitDate: req.scheduledDate || req.preferredDate || null,
        urgency: req.urgency,
        previousTechnician,
        raw: req.raw || req,
      };
    });
  }, [queueData]);

  const deepLinkedTask = requestedId
    ? requests.find((request) => String(request.id) === requestedId) || null
    : null;
  const activeTask = selectedTask || deepLinkedTask;
  const isActiveTaskModalOpen =
    isTaskModalOpen || Boolean(deepLinkedTask && dismissedDeepLink !== requestedId);

  // State Action Dispatchers using API requests
  const handleClaimRequest = async (request) => {
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
      toast.success("Request claimed. You can now schedule or open its details.");
      await refetchQueue();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "The request could not be claimed.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeclineRequest = async (request) => {
    if (isUpdating) return;
    const claimType = getClaimType(request.queueType || request.type);
    if (!claimType) {
      toast.error("This request cannot be declined from the service queue.");
      return;
    }
    setIsUpdating(true);
    try {
      await axiosInstance.patch(
        `/technician/requests/${claimType}/${request.id}/decline`,
        { reason: "Declined by technician from the web request queue." },
      );
      toast.success("Request removed from your available queue.");
      await refetchQueue();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "The request could not be declined.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRequest = async (id, type) => {
    if (isUpdating) return;
    if (!["insemination", "health"].includes(type)) {
      toast.error("This service type cannot be cancelled from the generic queue.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Cancel Request",
      message: "Are you sure you want to cancel this field service request? The record stays available for audit/history.",
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
          await refetchQueue();
        } catch (error) {
          toast.error(
            "Failed to cancel request: " +
              (error.response?.data?.message || error.message),
          );
        } finally {
          setIsUpdating(false);
        }
      }
    });
  };

  // Pagination Engine Math
  const totalItems = queueData?.pagination?.total || requests.length;
  const totalPages = queueData?.pagination?.totalPages || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRequests = requests;

  const activeQueueCount = requests.filter(
    (r) => r.status === "pending",
  ).length;

  const openRequest = (request) => {
    setSelectedTask(request);
    setIsTaskModalOpen(true);
  };

  const barangayOptions = getIloiloBarangayOptions(municipality, district);

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
        setNearCoords({ latitude: coords.latitude, longitude: coords.longitude });
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

  return (
    <div className={ui.page}>
      <Topbar
        title={isAdmin ? "Request Monitoring" : "Request Board"}
        subtitle={isAdmin ? "Review municipal service requests and technician assignments" : "Claim new farmer requests or manage visits already assigned to you"}
      />

      <main className={ui.main}>
        <div className="card bg-neutral text-neutral-content border border-neutral-content/10 shadow-sm">
          <div className="card-body p-5 sm:p-6 flex-row justify-between items-center flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-neutral-content/65 font-semibold text-xs uppercase tracking-wider">
              <ClipboardList size={14} />
              <span>{isAdmin ? "Request monitoring" : "New farmer requests"}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight">
              {isAdmin ? "All service requests" : "Available to claim"}
            </h2>
          </div>
          <div className="stat w-auto min-w-32 rounded-box bg-neutral-content/10 p-3 text-center">
            <p className="stat-title text-xs text-neutral-content/60">
              {isAdmin ? "Pending requests" : "Ready to claim"}
            </p>
            <p className="stat-value text-2xl text-neutral-content mt-1">
              {isMasterLoading ? "..." : activeQueueCount}
            </p>
          </div></div>
        </div>

        {/* Tab Filter Controls Row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div role="tablist" className="tabs tabs-box bg-base-100 border border-base-300 p-1 overflow-x-auto max-w-full">
            {["pending", "scheduled", "in-progress", "completed", "all"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status);
                  if (!isAdmin) {
                    setAssignmentFilter(status === "pending" ? "unassigned" : status === "all" ? "all" : "mine");
                  }
                  setCurrentPage(1);
                }}
                role="tab"
                className={`tab whitespace-nowrap text-sm ${
                  statusFilter === status
                    ? "tab-active bg-primary text-primary-content"
                    : "text-base-content/65"
                }`}
              >
                {status === "pending"
                  ? "Available to claim"
                  : status === "scheduled"
                    ? "My scheduled visits"
                    : status === "in-progress"
                      ? "In progress"
                      : status === "completed"
                        ? "Completed"
                        : "All requests"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search by farmer, tag, location..."
                className={`${ui.input} pl-9 py-1.5`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <span className="text-sm text-base-content/55 font-medium whitespace-nowrap">
              {isMasterLoading
                ? "Loading requests..."
                : `${totalItems} request${totalItems !== 1 ? "s" : ""} found`}
            </span>
          </div>
        </div>

        <div className={ui.filterBar}>
          <select className={ui.select} value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setCurrentPage(1); }} aria-label="Filter by service type">
            <option value="all">All services</option>
            <option value="ai">AI services</option>
            <option value="health">Health assistance</option>
          </select>
          {isAdmin && (
            <select className={ui.select} value={assignmentFilter} onChange={(event) => { setAssignmentFilter(event.target.value); setCurrentPage(1); }} aria-label="Filter by assignment">
              <option value="all">All assignments</option>
              <option value="mine">Assigned to a technician</option>
              <option value="unassigned">Available to claim</option>
            </select>
          )}
          <select className={ui.select} value={urgencyFilter} onChange={(event) => { setUrgencyFilter(event.target.value); setCurrentPage(1); }} aria-label="Filter by urgency">
            <option value="all">All urgency</option>
            <option value="urgent">Urgent first</option>
          </select>
          <select className={ui.select} value={sortBy} onChange={(event) => { setSortBy(event.target.value); setCurrentPage(1); }} aria-label="Sort requests">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="preferredDate">Visit date</option>
            {nearCoords && <option value="distance">Nearest first</option>}
          </select>
          <select className={ui.select} value={municipality} onChange={(event) => { setMunicipality(event.target.value); setDistrict(""); setBarangay(""); setCurrentPage(1); }} aria-label="Filter by municipality">
            <option value="">All municipalities</option>
            {ILOILO_MUNICIPALITY_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {municipality === ILOILO_CITY_NAME && (
            <select className={ui.select} value={district} onChange={(event) => { setDistrict(event.target.value); setBarangay(""); setCurrentPage(1); }} aria-label="Filter by Iloilo City district">
              <option value="">Select district</option>
              {ILOILO_CITY_DISTRICT_OPTIONS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          <select className={ui.select} value={barangay} disabled={!municipality || (municipality === ILOILO_CITY_NAME && !district)} onChange={(event) => { setBarangay(event.target.value); setCurrentPage(1); }} aria-label="Filter by barangay">
            <option value="">All barangays</option>
            {barangayOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" className={`btn btn-sm ${nearCoords ? "btn-primary" : "btn-outline"}`} onClick={toggleNearMe} disabled={isLocating} aria-pressed={Boolean(nearCoords)}>
            {isLocating ? <span className="loading loading-spinner loading-xs" /> : <LocateFixed size={14} />}
            {nearCoords ? "Near me on" : "Near me"}
          </button>
        </div>

        {isQueueError && (
          <div className="alert alert-error" role="alert">
            <ShieldAlert size={18} />
            <div className="flex-1">
              <h3 className="font-semibold">Request queue could not be loaded</h3>
              <p className="text-sm opacity-80">
                {queueError?.response?.data?.message || queueError?.message || "Check your connection and try again."}
              </p>
            </div>
            <button className="btn btn-sm" onClick={() => refetchQueue()}>
              Retry
            </button>
          </div>
        )}

        {isFetchingQueue && !isLoadingQueue && (
          <div className="flex items-center gap-2 text-sm text-base-content/55" aria-live="polite">
            <span className="loading loading-spinner loading-xs" />
            Updating request list…
          </div>
        )}

        {/* Table View Component Card */}
        <div className={`${ui.panel} flex-1 flex flex-col min-h-0`}>
          <div className="grid gap-3 p-3 lg:hidden">
            {isMasterLoading
              ? [...Array(3)].map((_, index) => (
                  <div key={index} className="card card-border bg-base-100">
                    <div className="card-body p-4 gap-3">
                      <div className="skeleton h-5 w-2/3" />
                      <div className="skeleton h-4 w-full" />
                      <div className="skeleton h-4 w-4/5" />
                      <div className="flex justify-end gap-2">
                        <div className="skeleton h-9 w-24" />
                        <div className="skeleton h-9 w-20" />
                      </div>
                    </div>
                  </div>
                ))
              : paginatedRequests.map((request) => (
                  <RequestQueueCard
                    key={request.id}
                    request={request}
                    currentUserId={dbUser?._id}
                    isUpdating={isUpdating}
                    onOpen={openRequest}
                    onClaim={handleClaimRequest}
                    onDecline={handleDeclineRequest}
                  />
                ))}
            {!isMasterLoading && paginatedRequests.length === 0 && (
              <div className={ui.empty}>
                {searchQuery
                  ? `No requests match “${searchQuery}”.`
                  : statusFilter === "pending"
                    ? "No new requests are waiting to be claimed. Check My scheduled visits for work you already accepted."
                    : "No requests match the selected filters."}
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto flex-1 overflow-y-auto lg:block">
            <table className={`${ui.table} text-left`}>
              <thead>
                <tr className={ui.tableHead}>
                  <th className="p-4 pl-6">Request</th>
                  <th className="p-4">Farmer / Location</th>
                  <th className="p-4">Service</th>
                  <th className="p-4 font-medium">Requested visit</th>
                  <th className="p-4 text-center">Status</th>
                  {!isAdmin && <th className="p-4 pr-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className={ui.tableBody}>
                {isMasterLoading ? (
                  // Map structural rows over the loading indicator parameters seamlessly
                  [...Array(5)].map((_, idx) => <TableRowSkeleton key={idx} />)
                ) : paginatedRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 5 : 6}
                      className="p-6"
                    >
                      <div className={`${ui.empty} flex flex-col items-center justify-center gap-2`}>
                        <ShieldAlert size={24} className="text-slate-300" />
                        <span>
                          {searchQuery
                            ? `No requests match “${searchQuery}”.`
                            : statusFilter === "pending"
                              ? "No new requests are waiting to be claimed. Check My scheduled visits for work you already accepted."
                              : "No requests match the selected filters."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedRequests.map((req) => {
                    const reqTechId =
                      req.raw?.approvedBy?._id ||
                      req.raw?.approvedBy ||
                      req.raw?.handledBy?._id ||
                      req.raw?.handledBy ||
                      req.raw?.technicianId?._id ||
                      req.raw?.technicianId ||
                      null;

                    const reqTechName =
                      req.raw?.approvedBy?.name ||
                      req.raw?.handledBy?.name ||
                      req.raw?.technicianId?.name ||
                      (reqTechId ? "another technician" : null);

                    const isAssignedToOther =
                      reqTechId &&
                      dbUser?._id &&
                      String(reqTechId) !== String(dbUser._id);
                    const visitDate = req.visitDate ? new Date(req.visitDate) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const isOverdue = (req.status === "in-progress" || req.status === "approved") && visitDate && visitDate < today;

                    return (
                      <tr
                        key={req.id}
                        onClick={() => openRequest(req)}
                        className={`${ui.tableRow} cursor-pointer`}
                      >
                        <td className="p-4 pl-6 font-extrabold text-[#00643b] dark:text-[#10b981] relative">
                          <div className="flex items-center gap-1.5">
                            {isOverdue && (
                              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" title="Overdue Task" />
                            )}
                            <span>#{req.id.substring(0, 6).toUpperCase()}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {req.farmer}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium flex items-center gap-0.5 mt-0.5">
                            <MapPin size={10} className="shrink-0" />{" "}
                            {req.location}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`badge badge-sm ${
                                req.badgeClass
                              }`}
                            >
                              {req.serviceBadge}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {req.serviceLabel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-1.5">
                            {req.task}
                          </div>
                          {req.previousTechnician && (
                            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1">
                              Previous attempt handled by {req.previousTechnician}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {req.date}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`badge badge-sm ${getTechnicianStatus(req.status).badgeClass}`}>
                            {getTechnicianStatus(req.status).label}
                          </span>
                          {isAssignedToOther && (
                            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mt-1.5" title={`Assigned to ${reqTechName}`}>
                              <Lock size={9} /> Locked
                            </div>
                          )}
                          {isOverdue && (
                            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mt-1.5 animate-pulse" title="Task was scheduled for yesterday or earlier but is still incomplete">
                              ⚠️ Overdue
                            </div>
                          )}
                        </td>
                        {!isAdmin && (
                          <td
                            className="p-4 pr-6 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              {req.status === "pending" && (
                                <>
                                  {!reqTechId ? (
                                    <>
                                      <button
                                        disabled={isUpdating}
                                        onClick={() => handleClaimRequest(req)}
                                        className="btn btn-primary btn-xs"
                                        title="Claim request"
                                      >
                                        <Check size={12} /> Claim
                                      </button>
                                      <button
                                        disabled={isUpdating}
                                        onClick={() => handleDeclineRequest(req)}
                                        className="btn btn-ghost btn-xs text-error"
                                        title="Decline request for me"
                                      >
                                        <X size={12} /> Decline
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              )}
                              {req.status === "in-progress" && (
                                <button
                                  disabled={isAssignedToOther || isUpdating}
                                  onClick={() => openRequest(req)}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-600 hover:text-white dark:border-emerald-900/50 dark:text-emerald-400 dark:bg-emerald-950/20 dark:hover:bg-emerald-600 dark:hover:text-white flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={isAssignedToOther ? `Locked by ${reqTechName}` : `Complete ${req.serviceLabel}`}
                                >
                                  <CheckCircle size={12} /> Complete
                                </button>
                              )}
                              {["insemination", "health"].includes(req.type) && (
                                <button
                                  disabled={isAssignedToOther || isUpdating}
                                  onClick={() =>
                                    handleDeleteRequest(req.id, req.type)
                                  }
                                  className="btn btn-ghost btn-xs btn-square text-error"
                                  title={isAssignedToOther ? `Locked by ${reqTechName}` : "Cancel Request"}
                                  aria-label="Cancel request"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Toolbar */}
          <div className="p-4 border-t border-base-300 flex flex-wrap items-center justify-between gap-3 bg-base-200">
            <span className="text-[11px] font-medium text-slate-400">
              Showing {totalItems === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}{" "}
              entries
            </span>
            <div className="join">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isMasterLoading}
                className="join-item btn btn-sm btn-outline"
              >
                <ChevronLeft size={12} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    disabled={isMasterLoading}
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`join-item btn btn-sm ${
                      currentPage === pageNumber
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || isMasterLoading}
                className="join-item btn btn-sm btn-outline"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </main>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })
        }
        title={confirmModal.title || "Confirm action"}
        type={confirmModal.title.toLowerCase().includes("cancel") ? "warning" : "info"}
        size="sm"
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null })}
            >
              Go back
            </button>
            <button
              type="button"
              className={`btn ${confirmModal.title.toLowerCase().includes("cancel") ? "btn-error" : "btn-primary"}`}
              onClick={() => {
                confirmModal.onConfirm?.();
                setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: null });
              }}
            >
              Confirm
            </button>
          </>
        }
      >
        <p>{confirmModal.message}</p>
      </Modal>

      {/* ===== TASK ACTION DIALOG MODAL ===== */}
      <TaskActionModal
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
