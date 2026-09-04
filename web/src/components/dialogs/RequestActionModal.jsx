/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock3,
  HeartPulse,
  User,
  CalendarDays,
  ClipboardPen,
  BadgeCheck,
  Syringe,
  Loader2,
  Trash2,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Lock,
  MapPin,
  Phone,
  ImageIcon,
  CirclePlus,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../../lib/axios";
import { toast } from "sonner";
import { getSireCodeByBreed } from "../../constants/sireRegistry";
import { CATTLE_BREEDS } from "../../constants/breeds";
import { getClaimType } from "../../constants/technicianWorkflow";
import {
  invalidateAdminReassignmentQueries,
  reassignRequest,
} from "../../services/adminRequestsService";
import AdminRequestActions from "./AdminRequestActions";
import {
  WEB_ROLES,
  getRequestActionPolicy,
} from "../../constants/webRoles";

const inputClass = `input input-bordered w-full h-11 bg-base-100 text-sm font-medium text-base-content placeholder:text-base-content/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;
const selectClass = `select select-bordered w-full h-11 bg-base-100 text-sm font-medium text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;
const textareaClass = `textarea textarea-bordered min-h-24 w-full resize-none bg-base-100 text-sm font-medium leading-relaxed text-base-content placeholder:text-base-content/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;
const labelClass = `text-xs font-semibold text-base-content/70`;
const sectionHeadingClass = `text-xs font-bold text-base-content/75`;
const sectionClass = `min-w-0 space-y-3 rounded-xl border border-base-300 bg-base-200/20 p-4 sm:p-5`;

const getAdditionalNotesOnly = (fullComment) => {
  if (!fullComment) return "";
  const parts = fullComment.split("Additional Notes:\n");
  if (parts.length > 1) {
    return parts[1].trim();
  }
  if (fullComment.includes("Observed Heat Signs:\n")) {
    return "";
  }
  return fullComment;
};

const humanizeValue = (value, fallback = "Not recorded") => {
  if (!value) return fallback;
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const formatDateTime = (value, fallback = "Not provided") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getRequestPhotos = (task) => {
  const raw = task?.raw || {};
  const sources = [
    ...(Array.isArray(raw.photos) ? raw.photos : []),
    ...(Array.isArray(raw.evidencePhotos) ? raw.evidencePhotos : []),
    raw.imageUrl,
    task?.imageUrl,
  ];

  return [
    ...new Set(
      sources.filter((source) => typeof source === "string" && source.trim()),
    ),
  ];
};

const RequestActionModal = ({
  isOpen,
  onClose,
  task: taskData,
  onSuccess,
  role = WEB_ROLES.TECHNICIAN,
}) => {
  const queryClient = useQueryClient();
  const actionPolicy = getRequestActionPolicy(role);
  const { isAdmin } = actionPolicy;

  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [advice, setAdvice] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireCode, setSireCode] = useState("");
  const [estrus, setEstrus] = useState("Natural");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const technicianSelectRef = useRef(null);

  const serviceType = taskData?.type;
  const isHealth = serviceType === "health";
  const isAI = serviceType === "insemination" || serviceType === "ai";

  const isPending = taskData?.status?.toLowerCase() === "pending";
  const isApproved = taskData?.status?.toLowerCase() === "approved";
  const isScheduled = taskData?.status?.toLowerCase() === "scheduled";
  const isInProgress = ["in-progress", "in_progress"].includes(
    taskData?.status?.toLowerCase(),
  );

  const isCompleted = ["done", "resolved", "completed"].includes(
    taskData?.status?.toLowerCase(),
  );
  const isArchived = ["rejected", "cancelled"].includes(
    taskData?.status?.toLowerCase(),
  );
  const isCancellationRequested =
    (taskData?.cancellationStatus || taskData?.raw?.cancellationStatus) ===
    "requested";

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: isOpen && actionPolicy.isTechnician,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicianListForAdmin"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=technician");
      return Array.isArray(res.data) ? res.data : res.data?.users || [];
    },
    enabled: isOpen && actionPolicy.canReassign,
  });

  const { data: scheduleData } = useQuery({
    queryKey: ["technician", "schedule-conflict-check"],
    queryFn: async () => {
      const firstPage = await axiosInstance.get("/technician/requests", {
        params: { status: "scheduled", limit: 100 },
      });
      const firstRequests = Array.isArray(firstPage.data?.requests)
        ? firstPage.data.requests
        : [];
      const totalPages = Number(firstPage.data?.pagination?.totalPages || 1);
      const remainingPages =
        totalPages > 1
          ? await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, index) =>
                axiosInstance.get("/technician/requests", {
                  params: {
                    status: "scheduled",
                    limit: 100,
                    page: index + 2,
                  },
                }),
              ),
            )
          : [];

      return [
        ...firstRequests,
        ...remainingPages.flatMap((response) =>
          Array.isArray(response.data?.requests) ? response.data.requests : [],
        ),
      ].filter(
        (request) =>
          String(request.status || "").toLowerCase() === "scheduled" &&
          Boolean(request.scheduledDate || request.raw?.scheduledDate),
      );
    },
    enabled:
      isOpen &&
      isApproved &&
      Boolean(scheduledDate) &&
      actionPolicy.canSchedule,
  });

  const scheduleConflict = useMemo(() => {
    if (!scheduledDate || !scheduledTime) return null;
    const targetStr = `${scheduledDate}T${scheduledTime}`;
    const targetDateObj = new Date(targetStr);
    if (Number.isNaN(targetDateObj.getTime())) return null;

    const existingList = Array.isArray(scheduleData) ? scheduleData : [];
    for (const req of existingList) {
      if (String(req.id) === String(taskData?.id)) continue;
      const reqVal = req.scheduledDate || req.raw?.scheduledDate;
      if (!reqVal) continue;
      const reqDateObj = new Date(reqVal);
      if (Number.isNaN(reqDateObj.getTime())) continue;

      const diffMins =
        Math.abs(targetDateObj.getTime() - reqDateObj.getTime()) / (1000 * 60);
      if (diffMins < 60) {
        return {
          farmer: req.farmer || req.raw?.farmerId?.name || "Another Farmer",
          time: reqDateObj.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
          date: reqDateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          service: req.serviceLabel || req.type || "Service",
        };
      }
    }
    return null;
  }, [scheduledDate, scheduledTime, scheduleData, taskData?.id]);

  const formattedPreferredDate = useMemo(() => {
    const prefVal = taskData?.preferredDate || taskData?.raw?.preferredDate;
    if (!prefVal) return null;
    const d = new Date(prefVal);
    if (Number.isNaN(d.getTime())) return null;
    const dateStr = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateStr}, ${timeStr}`;
  }, [taskData?.preferredDate, taskData?.raw?.preferredDate]);

  const formattedScheduledDate = useMemo(() => {
    if (!scheduledDate) return null;
    const d = new Date(scheduledDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, [scheduledDate]);

  const isEarlyVisit = useMemo(() => {
    if (!scheduledDate) return false;
    const d = new Date(scheduledDate);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d > now;
  }, [scheduledDate]);

  const assignedTechId =
    taskData?.raw?.approvedBy?._id ||
    taskData?.raw?.approvedBy ||
    taskData?.raw?.handledBy?._id ||
    taskData?.raw?.handledBy ||
    null;

  const assignedTechName =
    taskData?.raw?.approvedBy?.name ||
    taskData?.raw?.handledBy?.name ||
    (assignedTechId ? "another technician" : null);
  const canAdminReassign =
    Boolean(actionPolicy.canReassign && assignedTechId) &&
    !isCompleted &&
    !isArchived;

  const isAssignedToOther =
    actionPolicy.isTechnician &&
    assignedTechId &&
    dbUser?._id &&
    String(assignedTechId) !== String(dbUser._id);

  const isUnsupportedService = !isAI && !isHealth;
  const isReadOnly =
    isCompleted ||
    isArchived ||
    isAssignedToOther ||
    actionPolicy.readOnlyClinical ||
    isUnsupportedService;

  useEffect(() => {
    setIsSubmitting(false);
    if (taskData) {
      try {
        const dateVal =
          taskData.visitDate ||
          taskData.displayDate ||
          taskData.raw?.scheduledDate ||
          taskData.raw?.preferredDate ||
          taskData.scheduledDate ||
          taskData.preferredDate ||
          new Date();
        const d = new Date(dateVal);

        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          setScheduledDate(`${year}-${month}-${day}`);

          const hours = String(d.getHours()).padStart(2, "0");
          const minutes = String(d.getMinutes()).padStart(2, "0");
          setScheduledTime(`${hours}:${minutes}`);
        } else {
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          setScheduledDate(`${year}-${month}-${day}`);

          const hours = String(now.getHours()).padStart(2, "0");
          const minutes = String(now.getMinutes()).padStart(2, "0");
          setScheduledTime(`${hours}:${minutes}`);
        }
      } catch {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        setScheduledDate(`${year}-${month}-${day}`);

        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        setScheduledTime(`${hours}:${minutes}`);
      }

      setNote(taskData.note || "");
      setDiagnosis(taskData.raw?.diagnosis || "");
      setTreatment(taskData.raw?.treatment || "");
      setAdvice(taskData.raw?.advice || "");
      setSireBreed(taskData.raw?.sireBreed || "");
      setSireCode(taskData.raw?.sireCode || "");
      setEstrus(taskData.raw?.estrus || "Natural");

    }
  }, [taskData, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isSubmitting) onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !taskData) return null;

  const combinedScheduledDate =
    scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`)
      : null;

  const animal = taskData.raw?.animalId || {};
  const farmer = taskData.raw?.farmerId || {};
  const preferredDateTime =
    taskData.preferredDate ||
    taskData.raw?.preferredDate ||
    taskData.displayDate ||
    null;
  const requestPhotos = getRequestPhotos(taskData);
  const requestType = isHealth
    ? humanizeValue(taskData.raw?.requestType, "Health Assistance")
    : taskData.serviceLabel || "Artificial Insemination";
  const submittedAt = taskData.createdAt || taskData.raw?.createdAt;
  const isAvailablePreview = isPending && actionPolicy.isTechnician;
  const contactIsUnlocked = !isPending || Boolean(assignedTechId);
  const scheduledVisitValue =
    taskData.scheduledDate ||
    taskData.raw?.scheduledDate ||
    taskData.visitDate ||
    combinedScheduledDate;
  const scheduledVisitDay = scheduledVisitValue
    ? new Date(scheduledVisitValue)
    : null;
  const todayForVisit = new Date();
  todayForVisit.setHours(0, 0, 0, 0);
  const comparedVisitDay = scheduledVisitDay
    ? new Date(scheduledVisitDay)
    : null;
  comparedVisitDay?.setHours(0, 0, 0, 0);
  const isFutureVisit = Boolean(
    isInProgress &&
    comparedVisitDay &&
    !Number.isNaN(comparedVisitDay.getTime()) &&
    comparedVisitDay > todayForVisit,
  );
  const canRecordService =
    actionPolicy.canComplete && isInProgress && !isFutureVisit;

  const handleClaimTask = async () => {
    if (!actionPolicy.canClaim) return;
    const claimType = getClaimType(taskData.queueType || taskData.type);
    if (!claimType) {
      toast.error("This request cannot be claimed from the service queue.");
      return;
    }
    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(
        `/technician/requests/${claimType}/${taskData.id}/claim`,
      ),
      {
        loading: "Claiming request...",
        success: () => {
          setIsSubmitting(false);
          queryClient.invalidateQueries({
            queryKey: ["technician"],
          });
          if (onSuccess) onSuccess();
          onClose();
          return "Request successfully claimed!";
        },
        error: (err) => {
          setIsSubmitting(false);
          return "Error: " + (err.response?.data?.message || err.message);
        },
      },
    );
  };

  const handleRejectTask = () => {
    if (!actionPolicy.canCancelOwnRequest) return;
    if (isUnsupportedService) {
      toast.error(
        "Open this service from its official workflow detail screen.",
      );
      return;
    }
    const claimType = getClaimType(taskData.queueType || taskData.type);
    if (!claimType) {
      toast.error("This request cannot be declined from the service queue.");
      return;
    }
    const endpoint = `/technician/requests/${claimType}/${taskData.id}/decline`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        reason: note || "Declined by technician from request details.",
      }),
      {
        loading: "Processing decline...",
        success: () => {
          setIsSubmitting(false);
          queryClient.invalidateQueries({
            queryKey: ["technician", "dashboard"],
          });
          if (onSuccess) onSuccess();
          onClose();
          return "Request removed from your queue";
        },
        error: (err) => {
          setIsSubmitting(false);
          return "Error: " + (err.response?.data?.message || err.message);
        },
      },
    );
  };

  const handleAction = () => {
    if (!actionPolicy.isTechnician) return;
    if (isUnsupportedService) {
      toast.error(
        "Open this service from its official workflow detail screen.",
      );
      return;
    }
    if (isPending) {
      handleClaimTask();
      return;
    }
    if (isApproved && (!scheduledDate || !scheduledTime)) {
      toast.error("Choose a visit date and time before scheduling.");
      return;
    }
    if (isFutureVisit) {
      toast.error(
        `This visit is scheduled for ${formatDateTime(scheduledVisitValue)}. Reschedule it before submitting the service record.`,
      );
      return;
    }
    if (isInProgress && isHealth && (!diagnosis.trim() || !treatment.trim())) {
      toast.error(
        "Add both the diagnosis and treatment before resolving this request.",
      );
      return;
    }
    if (isInProgress && isAI && (!sireBreed || !sireCode.trim())) {
      toast.error(
        "Enter or select the sire breed and enter the sire code before completing AI service.",
      );
      return;
    }

    if (isScheduled && isEarlyVisit) {
      toast.error(
        `This visit is scheduled for ${formatDateTime(scheduledVisitValue)}. Reschedule it before starting the visit.`,
      );
      return;
    }

    const nextStatus = isApproved
      ? "scheduled"
      : isScheduled
        ? "in-progress"
        : isHealth
          ? "resolved"
          : "done";

    const endpoint = isHealth
      ? `/health-request/${taskData.id}/status`
      : `/ai-request/${taskData.id}/status`;

    setIsSubmitting(true);
    toast.promise(
      axiosInstance.patch(endpoint, {
        status: nextStatus,
        technicianNote:
          note || `${nextStatus.replaceAll("-", " ")} by technician.`,
        ...(isInProgress
          ? isHealth
            ? { diagnosis, treatment, advice }
            : { sireBreed, sireCode, estrus }
          : {}),
        ...(isApproved ? { scheduledDate: combinedScheduledDate } : {}),
      }),
      {
        loading: "Updating request status...",
        success: () => {
          setIsSubmitting(false);
          queryClient.invalidateQueries({
            queryKey: ["technician", "dashboard"],
          });
          if (onSuccess) onSuccess();
          onClose();
          if (nextStatus === "scheduled") return "Visit scheduled";
          if (nextStatus === "in-progress") return "Visit started";
          return isHealth ? "Health request resolved" : "AI service completed";
        },
        error: (err) => {
          setIsSubmitting(false);
          return "Error: " + (err.response?.data?.message || err.message);
        },
      },
    );
  };

  const handleAdminAssign = async () => {
    if (!actionPolicy.canReassign || !canAdminReassign) return;
    if (isUnsupportedService) {
      toast.error(
        "Open this service from its official workflow detail screen.",
      );
      return;
    }
    const selectedTech = technicianSelectRef.current?.value || "";
    if (!selectedTech) {
      toast.error("Please select a technician first.");
      return;
    }
    setIsSubmitting(true);
    try {
      await reassignRequest({
        type: serviceType,
        requestId: taskData.id || taskData.raw?._id,
        technicianId: selectedTech,
      });
      await invalidateAdminReassignmentQueries(queryClient);
      toast.success("Request successfully reassigned.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to reassign request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminCancellationResponse = async (approved) => {
    if (
      !actionPolicy.canReviewCancellation ||
      !isCancellationRequested ||
      isUnsupportedService
    ) {
      return;
    }

    const endpoint = isHealth
      ? `/health-request/${taskData.id}/cancel-respond`
      : `/ai-request/${taskData.id}/cancel-respond`;
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(endpoint, {
        approved,
        reason: note.trim() || undefined,
      });
      await invalidateAdminReassignmentQueries(queryClient);
      toast.success(
        approved
          ? "Cancellation request approved."
          : "Cancellation request declined.",
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to respond to the cancellation request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const visitDateVal =
    taskData?.visitDate ||
    taskData?.raw?.scheduledDate ||
    taskData?.raw?.preferredDate ||
    null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    (taskData?.status === "in-progress" || taskData?.status === "approved") &&
    visitDateVal &&
    new Date(visitDateVal) < today;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4">
          {/* MODAL CONTAINER */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xl sm:max-h-[calc(100dvh-2rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-details-title"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between gap-3 border-b border-base-300 bg-base-200/40 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-12 sm:w-12">
                  {isHealth ? <HeartPulse size={20} /> : <Syringe size={20} />}
                </div>
                <div className="min-w-0">
                  <h3
                    id="request-details-title"
                    className="text-lg font-bold leading-tight text-base-content sm:text-xl"
                  >
                    {isUnsupportedService
                      ? taskData.serviceLabel || "Service Request"
                      : isHealth
                        ? "Health Visit Request"
                        : serviceType === "pregnancy_diagnosis" ||
                            taskData.raw?.metadata?.workflowStage ===
                              "pregnancy_diagnosis"
                          ? "Pregnancy Diagnosis Request"
                          : serviceType === "breeding_verification"
                            ? "Breeding Verification Request"
                            : "AI Service Request"}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-base-content/60">
                    {isAvailablePreview
                      ? "Review the request, then claim it to contact the farmer."
                      : isAdmin
                        ? "Review the request and assign the field visit."
                        : "Review the visit and record the next service step."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-circle h-11 min-h-11 w-11 shrink-0 text-base-content/60"
                aria-label="Close request details"
              >
                <X size={16} />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto overscroll-contain bg-base-100 px-4 py-5 sm:p-6 lg:grid-cols-2">
              {isAssignedToOther && (
                <div className="alert alert-warning alert-soft items-start lg:col-span-2">
                  <Lock size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold leading-tight">
                      Assigned to another technician
                    </h5>
                    <p className="mt-1 text-sm leading-relaxed">
                      {assignedTechName || "Another technician"} is handling
                      this request. You can review the details, but service
                      actions are locked.
                    </p>
                  </div>
                </div>
              )}

              {isOverdue && (
                <div className="alert alert-error alert-soft items-start lg:col-span-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold leading-tight">
                      Visit overdue
                    </h5>
                    <p className="mt-1 text-sm leading-relaxed">
                      This visit was scheduled for{" "}
                      {new Date(visitDateVal).toLocaleDateString()} and is still
                      open. Record the findings and complete the service.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 1: REQUEST SUMMARY */}
              <section className={`${sectionClass} lg:col-span-2`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-base-content/60">
                      {requestType}
                    </p>
                    <h4 className="mt-1 text-base font-bold text-base-content">
                      Request summary
                    </h4>
                    <p className="mt-1 text-xs text-base-content/60">
                      Submitted {formatDateTime(submittedAt)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 divide-y divide-base-300 rounded-xl bg-base-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <User size={16} aria-hidden="true" />
                        <h5 className="text-xs font-bold uppercase tracking-wide">
                          Farmer information
                        </h5>
                      </div>
                      <div>
                        <p className="font-bold text-base-content">
                          {taskData.farmer ||
                            farmer.name ||
                            "Farmer unavailable"}
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm text-base-content/70">
                          <MapPin
                            size={15}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {taskData.location || "Location unavailable"}
                          </span>
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-base-content/70">
                          <Phone
                            size={15}
                            className="shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {contactIsUnlocked
                              ? taskData.farmerPhone ||
                                farmer.phoneNumber ||
                                "Not provided"
                              : "Claim request to view contact"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <HeartPulse size={16} aria-hidden="true" />
                        <h5 className="text-xs font-bold uppercase tracking-wide">
                          Animal profile
                        </h5>
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-base-content/60">Ear tag</dt>
                        <dd className="text-right font-bold text-base-content">
                          #
                          {animal.earTag ||
                            taskData.animalTag ||
                            "Not recorded"}
                        </dd>
                        <dt className="text-base-content/60">Breed</dt>
                        <dd className="text-right font-semibold text-base-content/70">
                          {animal.breed || taskData.breed || "Not recorded"}
                        </dd>
                        <dt className="text-base-content/60">Species</dt>
                        <dd className="text-right font-semibold text-base-content/70">
                          {animal.species ||
                            taskData.raw?.species ||
                            "Not recorded"}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-3 border-t border-base-300 pt-4 sm:grid-cols-2">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm text-base-content/60">Priority</dt>
                    <dd className="font-semibold text-base-content">
                      {humanizeValue(taskData.urgency || "normal")}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-sm text-base-content/60">
                      Preferred visit
                    </dt>
                    <dd className="text-right font-semibold text-base-content">
                      {formatDateTime(preferredDateTime)}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* SECTION 2: FARMER-SUBMITTED REQUEST DETAILS */}
              {isAvailablePreview && (
                <section className={`${sectionClass} lg:col-span-2`}>
                  <div className="flex items-center gap-2">
                    <ClipboardPen
                      size={16}
                      className="text-primary"
                      aria-hidden="true"
                    />
                    <h4 className="text-sm font-bold text-base-content">
                      Request details
                    </h4>
                  </div>

                  {isHealth ? (
                    <div className="grid grid-cols-1 divide-y divide-base-300 rounded-xl bg-base-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                          Symptoms reported
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-base-content">
                          {taskData.raw?.symptoms ||
                            "No specific symptoms described"}
                        </p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                          Farmer notes
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                          {taskData.raw?.farmerNotes || "No additional notes"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 divide-y divide-base-300 rounded-xl bg-base-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                          Observed heat signs
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-relaxed text-base-content">
                          {taskData.raw?.heatSigns?.length
                            ? taskData.raw.heatSigns
                                .map((sign) => humanizeValue(sign))
                                .join(", ")
                            : "No specific heat signs listed"}
                        </p>
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                          Farmer comments
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                          {getAdditionalNotesOnly(taskData.raw?.comment) ||
                            "No additional comments"}
                        </p>
                      </div>
                    </div>
                  )}

                  {requestPhotos.length > 0 && (
                    <div className="border-t border-base-300 pt-4">
                      <div className="mb-3 flex items-center gap-2">
                        <ImageIcon
                          size={16}
                          className="text-primary"
                          aria-hidden="true"
                        />
                        <h5 className="text-xs font-bold uppercase tracking-wide text-base-content/70">
                          Submitted photos ({requestPhotos.length})
                        </h5>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {requestPhotos.map((photo, index) => (
                          <a
                            key={`${photo}-${index}`}
                            href={photo}
                            target="_blank"
                            rel="noreferrer"
                            className="group aspect-square overflow-hidden rounded-xl border border-base-300 bg-base-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                            aria-label={`Open submitted photo ${index + 1}`}
                          >
                            <img
                              src={photo}
                              alt={`Farmer-submitted request evidence ${index + 1}`}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {isAdmin && (
                <AdminRequestActions
                  showAssignment={!isCompleted && !isArchived}
                  canReassign={canAdminReassign}
                  requestKey={taskData.id || taskData.raw?._id}
                  assignedTechnicianId={assignedTechId}
                  technicians={technicians}
                  technicianSelectRef={technicianSelectRef}
                  cancellationRequested={isCancellationRequested}
                  cancellationReason={
                    taskData.raw?.cancellationReason ||
                    taskData.cancellationReason
                  }
                  responseNote={note}
                  onResponseNoteChange={setNote}
                  isSubmitting={isSubmitting}
                  onCancellationResponse={handleAdminCancellationResponse}
                />
              )}

              {isFutureVisit && (
                <div
                  role="alert"
                  className="alert alert-info alert-soft lg:col-span-2"
                >
                  <Clock3 size={18} aria-hidden="true" />
                  <div>
                    <p className="font-bold">
                      Service record not available yet
                    </p>
                    <p className="text-sm">
                      This visit is scheduled for{" "}
                      {formatDateTime(scheduledVisitValue)}. Record findings
                      after the visit starts, or reschedule it first.
                    </p>
                  </div>
                </div>
              )}

              {/* SECTION 2: SERVICE METRICS & PARAMETERS */}
              {(canRecordService || isCompleted) && (
                <section
                  className={`${sectionClass} ${!isHealth ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <ClipboardPen size={14} className="text-primary" />
                    <h4 className={sectionHeadingClass}>
                      {isHealth ? "Treatment details" : "Insemination details"}
                    </h4>
                  </div>

                  {/* AI SPECIFIC FIELDS */}
                  {!isHealth && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire breed</label>
                        <input
                          type="text"
                          list="sire-breed-options"
                          disabled={isReadOnly}
                          value={sireBreed}
                          onChange={(e) => {
                            const breed = e.target.value;
                            setSireBreed(breed);
                            const code = getSireCodeByBreed(breed);
                            if (code) setSireCode(code);
                          }}
                          placeholder="Select or enter a breed"
                          className={inputClass}
                        />
                        <datalist id="sire-breed-options">
                          {CATTLE_BREEDS.map((breed) => (
                            <option key={breed} value={breed} />
                          ))}
                        </datalist>
                        <p className="text-[11px] text-base-content/55">
                          Choose a listed breed or type a custom one.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire code</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={sireCode}
                          onChange={(e) => setSireCode(e.target.value)}
                          placeholder="e.g. 507HO12345"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Estrus cycle</label>
                        <div className="relative">
                          <select
                            disabled={isReadOnly}
                            value={estrus}
                            onChange={(e) => setEstrus(e.target.value)}
                            className={`${selectClass} cursor-pointer`}
                          >
                            <option value="Natural">Natural</option>
                            <option value="Synchronized">Synchronized</option>
                            <option value="Induced">Induced</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HEALTH SPECIFIC FIELDS */}
                  {isHealth && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Diagnosis</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          placeholder="Record the diagnosis"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>
                          Treatment
                        </label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={treatment}
                          onChange={(e) => setTreatment(e.target.value)}
                          placeholder="Example: antibiotics or deworming"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* SECTION 3: SCHEDULE & OBSERVATIONS */}
              {!isAvailablePreview &&
                (actionPolicy.isTechnician || isCompleted || isArchived) && (
                  <section
                    className={`${sectionClass} ${isHealth && !isInProgress && !isCompleted ? "lg:col-span-2" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-primary" />
                      <h4 className={sectionHeadingClass}>
                        {isApproved ? "Schedule visit" : "Visit details"}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Scheduled Inputs block arranged in an equal inline grid */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label
                            className={labelClass}
                            htmlFor="request-scheduled-date"
                          >
                            Visit date
                          </label>
                          <div className="relative">
                            <Calendar
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/20"
                              size={14}
                            />
                            <input
                              id="request-scheduled-date"
                              name="request-scheduled-date"
                              type="date"
                              disabled={isReadOnly || !isApproved}
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className={`${inputClass} pl-10 cursor-pointer`}
                            />
                          </div>
                          {formattedPreferredDate && (
                            <p className="mt-2 text-xs text-base-content/70">
                              Farmer preferred{" "}
                              <strong>{formattedPreferredDate}</strong>. Confirm
                              it or choose another time.
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <label
                            className={labelClass}
                            htmlFor="request-scheduled-time"
                          >
                            Visit time
                          </label>
                          <div className="relative">
                            <Clock3
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/20"
                              size={14}
                            />
                            <input
                              id="request-scheduled-time"
                              name="request-scheduled-time"
                              type="time"
                              disabled={isReadOnly || !isApproved}
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className={`${inputClass} pl-10 cursor-pointer`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* EARLY VISIT WARNING BLOCK */}
                      {isScheduled && isEarlyVisit && (
                        <div
                          role="alert"
                          className="alert alert-warning alert-soft items-start text-xs"
                        >
                          <AlertTriangle
                            size={18}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="text-sm font-bold">
                              Visit is scheduled for later
                            </span>
                            <p className="mt-1 text-sm leading-relaxed">
                              This visit is scheduled for{" "}
                              <strong>
                                {formattedScheduledDate || scheduledDate}
                              </strong>
                              . If the visit date changed, reschedule it before
                              starting the service.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* SCHEDULE CONFLICT WARNING */}
                      {scheduleConflict && (
                        <div
                          role="alert"
                          className="alert alert-warning alert-soft items-start text-xs"
                        >
                          <AlertCircle
                            size={16}
                            className="mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="text-sm font-bold">
                              Schedule conflict
                            </span>
                            <p className="mt-1 text-sm leading-relaxed">
                              You already have a visit scheduled at{" "}
                              <strong>{scheduleConflict.time}</strong> on{" "}
                              <strong>{scheduleConflict.date}</strong> for{" "}
                              <strong>{scheduleConflict.farmer}</strong>. Please
                              choose another time to avoid overlapping visits.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Observations Block shown ON the visit day or during in-progress / completion */}
                      {!isFutureVisit && !isScheduled ? (
                        <div className="space-y-1.5">
                          <label className={labelClass}>
                            Field observations
                          </label>
                          <textarea
                            disabled={isReadOnly}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Record symptoms, behavior changes, and other findings"
                            className={textareaClass}
                          />
                        </div>
                      ) : (
                        <div className="p-3 bg-base-200/50 rounded-xl border border-base-300 text-xs font-semibold text-base-content/60 italic flex items-center gap-2">
                          <Clock3 size={14} className="text-info shrink-0" />
                          <span>
                            Field observations unlock on{" "}
                            {formattedScheduledDate || "the scheduled visit date"}.
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )}

              {/* SECTION 4: FARMER OBSERVATIONS & HEAT SIGNS */}
              {!isHealth && !isAvailablePreview && (
                <section className={sectionClass}>
                  <div className="flex items-center gap-2">
                    <ClipboardPen size={14} className="text-primary" />
                    <h4 className={sectionHeadingClass}>
                      Farmer observations
                    </h4>
                  </div>

                  {/* Heat Signs List */}
                  {taskData.raw?.heatSigns &&
                  taskData.raw.heatSigns.length > 0 ? (
                    <div className="space-y-2">
                      <label className={labelClass}>Observed Heat Signs</label>
                      <div className="flex flex-wrap gap-2">
                        {taskData.raw.heatSigns.map((signId) => {
                          const signMap = {
                            standing_heat: "Standing heat",
                            attempt_mount: "Attempting to Mount",
                            restlessness: "Restlessness / Activity",
                            vocalization: "Vocalization (Bellowing)",
                            flehmen: "Flehmen Response",
                            grouping: "Friendly Grouping",
                            mucus_discharge: "Clear mucus discharge",
                            swollen_vulva: "Swollen, Red Vulva",
                            muddy_flanks: "Muddy Flanks / Tailhead",
                            metestrus_bleeding: "Metestrus bleeding",
                          };
                          const label = signMap[signId] || signId;
                          const isPrimary = signId === "standing_heat";
                          const isBleeding = signId === "metestrus_bleeding";

                          return (
                            <span
                              key={signId}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                                isPrimary
                                  ? "bg-warning/10 border-warning/20 text-warning"
                                  : isBleeding
                                    ? "bg-error/10 border-error/20 text-error"
                                    : "bg-success/10 border-success/20 text-success"
                              }`}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] font-medium text-base-content/40 italic">
                      No specific heat signs selected.
                    </p>
                  )}

                  {/* Additional Comment from Farmer */}
                  {getAdditionalNotesOnly(taskData.raw?.comment) && (
                    <div className="space-y-1.5 pt-3 border-t border-base-300">
                      <label className={labelClass}>
                        Farmer comment
                      </label>
                      <div className="p-3 bg-base-200/50 rounded-xl border border-base-300 text-xs font-semibold text-base-content/75 leading-relaxed">
                        {getAdditionalNotesOnly(taskData.raw.comment)}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>

            {/* FOOTER */}
            <div className="flex flex-col items-stretch justify-between gap-3 border-t border-base-300 bg-base-200/20 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
              {isAdmin ? (
                // Admin Footer
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-base-content/60">
                    {assignedTechName
                      ? `Assigned to ${assignedTechName}`
                      : "Unassigned request"}
                  </p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn min-h-11 w-full text-xs sm:w-auto"
                    >
                      Close details
                    </button>
                    {canAdminReassign && (
                      <button
                        type="button"
                        onClick={handleAdminAssign}
                        disabled={isSubmitting}
                        className="btn btn-primary min-h-11 w-full text-xs sm:w-auto"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving assignment...
                          </>
                        ) : (
                          <>
                            <BadgeCheck size={14} />
                            Reassign Technician
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                // Technician Footer
                <>
                  <button
                    type="button"
                    onClick={handleRejectTask}
                    disabled={isSubmitting || isReadOnly}
                    className="btn btn-error btn-soft w-full sm:w-auto min-h-11 h-auto text-xs"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Decline request
                  </button>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn min-h-11 h-auto w-full sm:w-auto text-xs"
                    >
                      Close details
                    </button>
                    <button
                      type="button"
                      onClick={handleAction}
                      disabled={isSubmitting || isReadOnly}
                      className="btn btn-primary min-h-11 h-auto w-full sm:w-auto py-2 text-xs leading-tight whitespace-normal"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2
                            size={14}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                          Saving...
                        </>
                      ) : (
                        <>
                          {isPending ? (
                            <CirclePlus size={14} aria-hidden="true" />
                          ) : (
                            <BadgeCheck size={14} aria-hidden="true" />
                          )}
                          {isPending
                            ? "Claim request"
                            : isApproved
                              ? "Schedule visit"
                              : isScheduled
                                ? "Start visit"
                                : isHealth
                                  ? "Submit health record"
                                  : serviceType === "pregnancy_diagnosis" ||
                                      taskData?.raw?.metadata?.workflowStage ===
                                        "pregnancy_diagnosis"
                                    ? "Record pregnancy result"
                                    : serviceType === "breeding_verification"
                                      ? "Verify observation"
                                      : "Complete AI service"}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RequestActionModal;
