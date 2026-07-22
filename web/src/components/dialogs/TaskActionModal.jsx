/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";
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

const inputClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content placeholder:text-base-content/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors`;
const selectClass = `w-full h-11 bg-base-200 border border-base-300 rounded-xl px-4 text-xs font-bold text-base-content focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors appearance-none`;
const labelClass = `text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] ml-1`;
const sectionClass = `bg-base-200/20 border border-base-300 rounded-2xl p-4 sm:p-5 space-y-4 min-w-0`;

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
      sources.filter(
        (source) => typeof source === "string" && source.trim(),
      ),
    ),
  ];
};

const TaskActionModal = ({
  isOpen,
  onClose,
  task: taskData,
  onSuccess,
  isAdmin,
}) => {
  const queryClient = useQueryClient();

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
  const [selectedTech, setSelectedTech] = useState("");

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

  const { data: dbUser } = useQuery({
    queryKey: ["technician", "profile-me"],
    queryFn: async () => {
      const res = await axiosInstance.get("/technician/profile");
      return res.data || {};
    },
    enabled: isOpen && !isAdmin,
  });

  const { data: technicians = [] } = useQuery({
    queryKey: ["technicianListForAdmin"],
    queryFn: async () => {
      const res = await axiosInstance.get("/user?role=technician");
      return Array.isArray(res.data) ? res.data : res.data?.users || [];
    },
    enabled: isOpen && !!isAdmin,
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
    enabled: isOpen && isApproved && Boolean(scheduledDate) && !isAdmin,
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
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const isAssignedToOther =
    !isAdmin &&
    assignedTechId &&
    dbUser?._id &&
    String(assignedTechId) !== String(dbUser._id);

  const isUnsupportedService = !isAI && !isHealth;
  const isReadOnly =
    isCompleted ||
    isArchived ||
    isAssignedToOther ||
    !!isAdmin ||
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

      const rawTechId =
        taskData.raw?.approvedBy?._id ||
        taskData.raw?.approvedBy ||
        taskData.raw?.handledBy?._id ||
        taskData.raw?.handledBy ||
        "";
      setSelectedTech(
        typeof rawTechId === "object" ? rawTechId._id : rawTechId,
      );
    }
  }, [taskData, isOpen]);

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
  const isAvailablePreview = isPending && !isAdmin;
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
  const canRecordService = isInProgress && !isFutureVisit;

  const handleClaimTask = async () => {
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
        "Select the sire breed and enter the sire code before completing AI service.",
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

  const handleAdminAssign = () => {
    if (isUnsupportedService) {
      toast.error(
        "Open this service from its official workflow detail screen.",
      );
      return;
    }
    if (!selectedTech) {
      toast.error("Please select a technician first.");
      return;
    }
    const endpoint = isHealth
      ? `/health-request/${taskData.id}/status`
      : `/ai-request/${taskData.id}/status`;

    const body = isHealth
      ? {
          status: scheduledDate ? "scheduled" : "in-progress",
          handledBy: selectedTech,
          scheduledDate: combinedScheduledDate || undefined,
          technicianNote: note || "Assigned by Administrator.",
        }
      : {
          status: scheduledDate ? "scheduled" : "approved",
          approvedBy: selectedTech,
          scheduledDate: combinedScheduledDate || undefined,
          technicianNote: note || "Assigned by Administrator.",
        };

    setIsSubmitting(true);
    toast.promise(axiosInstance.patch(endpoint, body), {
      loading: "Saving assignment...",
      success: () => {
        setIsSubmitting(false);
        queryClient.invalidateQueries({
          queryKey: ["technician", "requests"],
        });
        queryClient.invalidateQueries({
          queryKey: ["admin", "dashboard-overview"],
        });
        if (onSuccess) onSuccess();
        onClose();
        return "Assignment successfully updated!";
      },
      error: (err) => {
        setIsSubmitting(false);
        return (
          "Failed to assign: " + (err.response?.data?.message || err.message)
        );
      },
    });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          {/* MODAL CONTAINER */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-details-title"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-base-300 bg-base-200/40 px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                  {isHealth ? <HeartPulse size={20} /> : <Syringe size={20} />}
                </div>
                <div className="min-w-0">
                  <h3
                    id="request-details-title"
                    className="text-lg font-black uppercase tracking-tighter text-base-content leading-tight sm:text-xl"
                  >
                    {isUnsupportedService
                      ? taskData.serviceLabel || "Service Request"
                      : isHealth
                        ? "Health Visit Request"
                        : serviceType === "pregnancy_diagnosis" ||
                          taskData.raw?.metadata?.workflowStage === "pregnancy_diagnosis"
                          ? "Pregnancy Diagnosis Request"
                          : serviceType === "breeding_verification"
                            ? "Breeding Verification Request"
                            : "AI Service Request"}
                  </h3>
                  <p className="mt-1 text-xs font-medium text-base-content/60">
                    {isAvailablePreview
                      ? "Review the farmer's request before claiming it."
                      : "Request details and service workflow"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-base-200 text-base-content/40 transition-all hover:bg-base-300 hover:text-base-content cursor-pointer"
                aria-label="Close request details"
              >
                <X size={16} />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="custom-scrollbar grid flex-1 grid-cols-1 gap-5 overflow-y-auto bg-base-100 p-4 sm:p-6 lg:grid-cols-2 lg:gap-6">
              {isAssignedToOther && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-amber-600 dark:text-amber-400 lg:col-span-2">
                  <Lock size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest leading-none">
                      Assistance Lock Active
                    </h5>
                    <p className="text-[9px] font-bold uppercase tracking-widest mt-2 leading-tight opacity-75">
                      This field service is already being assisted by
                      technician:{" "}
                      <span className="font-extrabold underline">
                        {assignedTechName || "another technician"}
                      </span>
                      .
                    </p>
                  </div>
                </div>
              )}

              {isOverdue && (
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 text-rose-600 dark:text-rose-400 animate-pulse lg:col-span-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest leading-none">
                      ⚠️ Overdue Service Request
                    </h5>
                    <p className="text-[9px] font-bold uppercase tracking-widest mt-2 leading-tight opacity-75">
                      This field service was scheduled for yesterday or earlier
                      ({new Date(visitDateVal).toLocaleDateString()}) and has
                      not been marked as completed. Please log the service
                      findings and mark complete as soon as possible.
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
                  <span
                    className={`badge badge-outline font-bold ${
                      isPending
                        ? "badge-warning"
                        : isCompleted
                          ? "badge-success"
                          : isArchived
                            ? "badge-error"
                            : "badge-info"
                    }`}
                  >
                    {humanizeValue(taskData.status, "Unknown status")}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="card border border-base-300 bg-base-100 shadow-none">
                    <div className="card-body gap-3 p-4">
                      <div className="flex items-center gap-2 text-primary">
                        <User size={16} aria-hidden="true" />
                        <h5 className="text-xs font-bold uppercase tracking-wide">
                          Farmer information
                        </h5>
                      </div>
                      <div>
                        <p className="font-bold text-base-content">
                          {taskData.farmer || farmer.name || "Farmer unavailable"}
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm text-base-content/70">
                          <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{taskData.location || "Location unavailable"}</span>
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-base-content/70">
                          <Phone size={15} className="shrink-0" aria-hidden="true" />
                          <span>
                            {contactIsUnlocked
                              ? taskData.farmerPhone || farmer.phoneNumber || "Not provided"
                              : "Claim request to view contact"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="card border border-base-300 bg-base-100 shadow-none">
                    <div className="card-body gap-3 p-4">
                      <div className="flex items-center gap-2 text-primary">
                        <HeartPulse size={16} aria-hidden="true" />
                        <h5 className="text-xs font-bold uppercase tracking-wide">
                          Animal profile
                        </h5>
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-base-content/60">Ear tag</dt>
                        <dd className="text-right font-bold text-base-content">
                          #{animal.earTag || taskData.animalTag || "Not recorded"}
                        </dd>
                        <dt className="text-base-content/60">Breed</dt>
                        <dd className="text-right font-semibold text-base-content/70">
                          {animal.breed || taskData.breed || "Not recorded"}
                        </dd>
                        <dt className="text-base-content/60">Species</dt>
                        <dd className="text-right font-semibold text-base-content/70">
                          {animal.species || taskData.raw?.species || "Not recorded"}
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
                    <dt className="text-sm text-base-content/60">Preferred visit</dt>
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
                  <ClipboardPen size={16} className="text-primary" aria-hidden="true" />
                  <h4 className="text-sm font-bold text-base-content">
                    Request details
                  </h4>
                </div>

                {isHealth ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                        Symptoms reported
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-base-content">
                        {taskData.raw?.symptoms || "No specific symptoms described"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-base-content/60">
                        Farmer notes
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                        {taskData.raw?.farmerNotes || "No additional notes"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
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
                    <div className="rounded-xl border border-base-300 bg-base-100 p-4">
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
                      <ImageIcon size={16} className="text-primary" aria-hidden="true" />
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

              {isAdmin && !isCompleted && !isArchived && (
                <section className={`${sectionClass} lg:col-span-2`}>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-emerald-600" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Administrative Assignment
                    </h4>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Select Attending Officer
                      </label>
                      <select
                        value={selectedTech}
                        onChange={(e) => setSelectedTech(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">-- Choose a Technician --</option>
                        {technicians.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={labelClass} htmlFor="request-scheduled-date">
                          Scheduled Date
                        </label>
                        <input
                          id="request-scheduled-date"
                          name="request-scheduled-date"
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClass} htmlFor="request-scheduled-time">
                          Scheduled Time
                        </label>
                        <input
                          id="request-scheduled-time"
                          name="request-scheduled-time"
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className={labelClass}>
                        Assignment / Internal Note
                      </label>
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add special instructions, notes or dispatch remarks for the technician..."
                        className="w-full h-20 bg-base-200 border border-base-300 rounded-xl p-3 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all resize-none custom-scrollbar"
                      />
                    </div>
                  </div>
                </section>
              )}

              {isFutureVisit && (
                <div
                  role="alert"
                  className="alert alert-info alert-soft lg:col-span-2"
                >
                  <Clock3 size={18} aria-hidden="true" />
                  <div>
                    <p className="font-bold">Service record not available yet</p>
                    <p className="text-sm">
                      This visit is scheduled for {formatDateTime(scheduledVisitValue)}.
                      Record findings after the visit starts, or reschedule it first.
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
                    <ClipboardPen size={14} className="text-emerald-600" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Service Metrics
                    </h4>
                  </div>

                  {/* AI SPECIFIC FIELDS */}
                  {!isHealth && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire Breed</label>
                        <div className="relative">
                          <select
                            disabled={isReadOnly}
                            value={sireBreed}
                            onChange={(e) => {
                              const breed = e.target.value;
                              setSireBreed(breed);
                              const code = getSireCodeByBreed(breed);
                              if (code) setSireCode(code);
                            }}
                            className={`${selectClass} cursor-pointer`}
                          >
                            <option value="" disabled>
                              Select Breed
                            </option>
                            {CATTLE_BREEDS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>Sire Code</label>
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
                        <label className={labelClass}>Estrus Cycle</label>
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
                        <label className={labelClass}>Medical Diagnosis</label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={diagnosis}
                          onChange={(e) => setDiagnosis(e.target.value)}
                          placeholder="Enter diagnosis findings"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass}>
                          Prescribed Treatment
                        </label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={treatment}
                          onChange={(e) => setTreatment(e.target.value)}
                          placeholder="e.g. Antibiotics, Deworming"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* SECTION 3: SCHEDULE & OBSERVATIONS */}
              {!isAvailablePreview &&
                (!isAdmin || isCompleted || isArchived) && (
                <section
                  className={`${sectionClass} ${isHealth && !isInProgress && !isCompleted ? "lg:col-span-2" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} className="text-emerald-600" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Schedule & Findings
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Scheduled Inputs block arranged in an equal inline grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={labelClass} htmlFor="request-scheduled-date">
                          Scheduled Date
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
                          <p className="mt-1 text-[10px] font-semibold italic text-base-content/70">
                            Farmer requested visit on: <strong>{formattedPreferredDate}</strong>. Confirm or adjust the schedule date and time.
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelClass} htmlFor="request-scheduled-time">
                          Scheduled Time
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
                          <span className="text-[10px] font-extrabold uppercase tracking-wider">
                            Early Visit Notice
                          </span>
                          <p className="mt-1 text-[11px] font-semibold leading-relaxed">
                            This visit is scheduled for <strong>{formattedScheduledDate || scheduledDate}</strong>. Today is not the actual visitation date. Please reschedule the date if the visitation date has changed.
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
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Schedule Conflict Warning
                          </span>
                          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed">
                            You already have a visit scheduled at{" "}
                            <strong>
                              {scheduleConflict.time}
                            </strong>{" "}
                            on <strong>{scheduleConflict.date}</strong> for{" "}
                            <strong>{scheduleConflict.farmer}</strong>.
                            Please adjust the time slot to avoid overlapping visits.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Observations Block shown ON the visit day or during in-progress / completion */}
                    {!isFutureVisit && !isScheduled ? (
                      <div className="space-y-1.5">
                        <label className={labelClass}>Observations & Field Findings</label>
                        <textarea
                          disabled={isReadOnly}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Enter specific behavioral changes, physical observations or custom internal notes here..."
                          className="w-full h-24 bg-base-200 border border-base-300 rounded-xl p-3 text-xs font-bold text-base-content placeholder:text-base-content/25 focus:border-emerald-500 focus:outline-none transition-all resize-none custom-scrollbar"
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-base-200/50 rounded-xl border border-base-300 text-xs font-semibold text-base-content/60 italic flex items-center gap-2">
                        <Clock3 size={14} className="text-info shrink-0" />
                        <span>Clinical observations and service findings will unlock on the visit day ({formattedScheduledDate || "scheduled date"}).</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* SECTION 4: FARMER OBSERVATIONS & HEAT SIGNS */}
              {!isHealth && !isAvailablePreview && (
                <section className={sectionClass}>
                  <div className="flex items-center gap-2">
                    <ClipboardPen size={14} className="text-emerald-600" />
                    <h4 className="text-[9px] font-black text-base-content/40 uppercase tracking-[0.2em] leading-none">
                      Farmer Observations
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
                            standing_heat: "Standing Heat 🐮",
                            attempt_mount: "Attempting to Mount",
                            restlessness: "Restlessness / Activity",
                            vocalization: "Vocalization (Bellowing)",
                            flehmen: "Flehmen Response",
                            grouping: "Friendly Grouping",
                            mucus_discharge: "Clear Mucus Discharge 💧",
                            swollen_vulva: "Swollen, Red Vulva",
                            muddy_flanks: "Muddy Flanks / Tailhead",
                            metestrus_bleeding: "Metestrus Bleeding 🩸",
                          };
                          const label = signMap[signId] || signId;
                          const isPrimary = signId === "standing_heat";
                          const isBleeding = signId === "metestrus_bleeding";

                          return (
                            <span
                              key={signId}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${
                                isPrimary
                                  ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                                  : isBleeding
                                    ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
                                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
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
                        Additional Farmer Comment
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
            <div className="bg-base-200/20 border-t border-base-300 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              {isAdmin ? (
                // Admin Footer
                <div className="flex justify-between items-center w-full">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {assignedTechName
                      ? `Assigned to: ${assignedTechName}`
                      : "Unassigned request"}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="h-11 px-6 rounded-xl bg-base-200 hover:bg-base-300 text-[10px] font-black uppercase tracking-widest transition-all text-base-content/50 cursor-pointer"
                    >
                      Close
                    </button>
                    {!isCompleted && !isArchived && (
                      <button
                        onClick={handleAdminAssign}
                        disabled={isSubmitting}
                        className="h-11 px-8 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-md bg-[#00643b] hover:bg-[#004d2e] cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <BadgeCheck size={14} />
                            {assignedTechId
                              ? "Reassign & Schedule"
                              : "Assign & Schedule"}
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
                    onClick={handleRejectTask}
                    disabled={isSubmitting || isReadOnly}
                    className="btn btn-error btn-soft w-full sm:w-auto min-h-11 h-auto text-xs"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Decline
                  </button>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      onClick={onClose}
                      className="btn min-h-11 h-auto w-full sm:w-auto text-xs"
                    >
                      Close
                    </button>
                    <button
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
                          Synchronizing...
                        </>
                      ) : (
                        <>
                          {isPending ? (
                            <CirclePlus size={14} aria-hidden="true" />
                          ) : (
                            <BadgeCheck size={14} aria-hidden="true" />
                          )}
                          {isPending
                            ? "Claim"
                            : isApproved
                              ? "Schedule visit"
                              : isScheduled
                                ? "Start visit"
                                : isHealth
                                  ? "Submit health record"
                                  : serviceType === "pregnancy_diagnosis" ||
                                    taskData?.raw?.metadata?.workflowStage === "pregnancy_diagnosis"
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

export default TaskActionModal;
