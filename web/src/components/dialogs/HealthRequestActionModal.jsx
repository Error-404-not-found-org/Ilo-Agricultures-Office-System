/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageSquareText,
  Phone,
  Stethoscope,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import Modal from "../ui/Modal";
import UserAvatar from "../ui/UserAvatar";
import { formatFarmerLocation } from "./PregnancyLossReviewModal";
import {
  HEALTH_ADVICE_MAX_LENGTH,
  HEALTH_PICKUP_ITEM_MAX_LENGTH,
  HEALTH_PICKUP_TEXT_MAX_LENGTH,
  buildHealthAdvicePayload,
  buildHealthOfficePickupPayload,
  formatHealthVisitSchedule,
  getHealthRequestId,
  getHealthVisitPeriodAvailability,
  getManilaDateKey,
  isHealthAdviceEligible,
  isHealthFarmVisitEligible,
  isHealthOfficePickupEligible,
  isOwnedHealthRequest,
  normalizeHealthStatus,
  validateHealthAdvice,
  validateHealthOfficePickup,
} from "../../utils/healthRequestWorkflow";

const EMPTY_ADVICE = {
  adviceForFarmer: "",
  followUpDate: "",
  internalNote: "",
};

const EMPTY_PICKUP = {
  item: "",
  availabilityConfirmed: false,
  pickupInstructions: "",
  farmerMessage: "",
  dosageInstructions: "",
  withdrawalGuidance: "",
  followUpDate: "",
  internalNote: "",
};

const text = (value) => (typeof value === "string" ? value.trim() : "");

const unwrapDetail = (response) =>
  response?.data?.data || response?.data?.request || response?.data || null;

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const getRequestPhotos = (request) => {
  const raw = request?.raw || request || {};
  return Array.from(
    new Set(
      [
        ...(Array.isArray(raw?.photos) ? raw.photos : []),
        ...(Array.isArray(raw?.farmerRequest?.photos) ? raw.farmerRequest.photos : []),
        raw?.photoUrl,
        raw?.imageUrl,
        raw?.farmerRequest?.photoUrl,
      ]
        .filter((url) => typeof url === "string" && url.trim().length > 0)
        .map((url) => url.trim())
    )
  );
};

const formatRequestDate = (dateString) => {
  if (!dateString) return "Date unknown";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch {
    return "Invalid date";
  }
};

const formatRequestType = (type) => {
  if (!type) return "Not specified";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

const getInitialRequest = (task, requestId) => ({
  ...(task?.raw || {}),
  ...task,
  _id: requestId,
  id: requestId,
  status: task?.status || task?.raw?.status,
  scheduledDate:
    task?.schedule?.date || task?.scheduledDate || task?.raw?.scheduledDate,
  visitPeriod:
    task?.schedule?.visitPeriod || task?.visitPeriod || task?.raw?.visitPeriod,
});

function Field({ label, helper, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="label-text text-xs font-semibold text-base-content/80 block">
          {label}
        </label>
        {helper && (
          <span className="text-[10px] text-base-content/50 font-medium">
            {helper}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function MethodButton({ icon: Icon, title, description, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex min-h-16 w-full cursor-pointer flex-col items-start gap-1 rounded-xl border border-base-300 bg-base-100 p-3.5 text-left transition-all hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-content">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="font-bold text-xs text-base-content">
          {title}
        </span>
      </div>
      <span className="text-[10px] leading-tight text-base-content/65 font-normal">
        {description}
      </span>
    </button>
  );
}

export default function HealthRequestActionModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const requestId = getHealthRequestId(task);
  const [view, setView] = useState("summary");
  const [previewImage, setPreviewImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [advice, setAdvice] = useState(EMPTY_ADVICE);
  const [pickup, setPickup] = useState(EMPTY_PICKUP);
  const [schedule, setSchedule] = useState({
    scheduledDate: "",
    visitPeriod: "",
  });
  const [samePeriodConfirmation, setSamePeriodConfirmation] = useState(false);
  const [clinical, setClinical] = useState({
    diagnosis: "",
    treatment: "",
    advice: "",
    technicianNote: "",
  });

  const detailQuery = useQuery({
    queryKey: ["technician", "health-request", requestId],
    queryFn: async () =>
      unwrapDetail(await axiosInstance.get(`/health-request/${requestId}`)),
    enabled: isOpen && Boolean(requestId),
    retry: false,
  });

  const request = useMemo(
    () => detailQuery.data || getInitialRequest(task, requestId),
    [detailQuery.data, requestId, task],
  );
  const requestPhotos = useMemo(() => getRequestPhotos(request), [request]);
  const status = normalizeHealthStatus(request?.status);
  const isOwned = isOwnedHealthRequest(request);
  const isScheduled = status === "scheduled";
  const isInProgress = status === "in-progress";
  const isTerminal = [
    "resolved",
    "done",
    "completed",
    "cancelled",
    "rejected",
    "declined",
  ].includes(status);
  const adviceEligible = isHealthAdviceEligible(request);
  const pickupEligible = isHealthOfficePickupEligible(request);
  const farmVisitEligible = isHealthFarmVisitEligible(request);
  const canChooseMethod = adviceEligible || pickupEligible || farmVisitEligible;
  const todayKey = getManilaDateKey();

  useEffect(() => {
    if (!isOpen) return;
    setView("summary");
    setBusy(false);
    setErrorMessage("");
    setAdvice(EMPTY_ADVICE);
    setPickup(EMPTY_PICKUP);
    setSchedule({ scheduledDate: "", visitPeriod: "" });
    setSamePeriodConfirmation(false);
    setClinical({
      diagnosis: "",
      treatment: "",
      advice: "",
      technicianNote: "",
    });
    setJustClaimed(false);
  }, [isOpen, requestId]);

  useEffect(() => {
    if (!isOpen || !detailQuery.data) return;
    const nextStatus = normalizeHealthStatus(detailQuery.data.status);
    if (nextStatus === "in-progress") {
      setClinical({
        diagnosis: text(detailQuery.data.diagnosis),
        treatment: text(detailQuery.data.treatment),
        advice: text(detailQuery.data.advice),
        technicianNote: text(detailQuery.data.technicianNote),
      });
    }
  }, [detailQuery.data, isOpen]);

  const invalidateHealth = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["technician"] }),
      queryClient.invalidateQueries({
        queryKey: ["technician", "health-request", requestId],
      }),
    ]);
  };

  const finish = async (message) => {
    await invalidateHealth();
    await onSuccess?.();
    onClose();
    toast.success(message);
  };

  const claimRequest = async () => {
    if (!requestId || busy) return;
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(
        `/technician/requests/health/${requestId}/claim`,
      );
      await invalidateHealth();
      const refreshed = await detailQuery.refetch();
      if (refreshed.error) throw refreshed.error;
      toast.success("Health request claimed");
      setJustClaimed(true);
      setView("summary");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "The Health request could not be claimed."),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitAdvice = async () => {
    if (busy) return;
    const validation = validateHealthAdvice(advice);
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(
        `/health-request/${requestId}/advice`,
        buildHealthAdvicePayload(advice),
      );
      await finish("Advice sent to farmer");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Advice could not be sent. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitPickup = async () => {
    if (busy) return;
    const validation = validateHealthOfficePickup(pickup);
    if (validation) {
      setErrorMessage(validation);
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(
        `/health-request/${requestId}/office-pickup`,
        buildHealthOfficePickupPayload(pickup),
      );
      await finish("Pickup information sent to farmer");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Pickup instructions could not be sent. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  const submitSchedule = async (samePeriodConfirmed = false) => {
    if (busy) return;
    if (!schedule.scheduledDate || !schedule.visitPeriod) {
      setErrorMessage("Choose a visit date and period.");
      return;
    }
    const availability = getHealthVisitPeriodAvailability(
      schedule.scheduledDate,
      schedule.visitPeriod,
    );
    if (availability.disabled) {
      setErrorMessage(availability.reason);
      return;
    }
    if (availability.requiresConfirmation && !samePeriodConfirmed) {
      setSamePeriodConfirmation(true);
      setErrorMessage("");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(`/health-request/${requestId}/status`, {
        status: "scheduled",
        scheduledDate: schedule.scheduledDate,
        visitPeriod: schedule.visitPeriod,
        ...(samePeriodConfirmed ? { samePeriodConfirmed: true } : {}),
      });
      await finish(
        isScheduled ? "Health visit rescheduled" : "Health visit scheduled",
      );
    } catch (error) {
      if (
        error?.response?.data?.code === "VISIT_PERIOD_CONFIRMATION_REQUIRED"
      ) {
        setSamePeriodConfirmation(true);
      }
      setErrorMessage(
        getErrorMessage(error, "The Health visit could not be scheduled."),
      );
      if ([403, 409].includes(error?.response?.status)) {
        await invalidateHealth();
        await detailQuery.refetch();
      }
    } finally {
      setBusy(false);
    }
  };

  const startVisit = async () => {
    if (busy) return;
    const scheduledKey = text(request?.scheduledDate).match(
      /^(\d{4}-\d{2}-\d{2})/,
    )?.[1];
    if (scheduledKey && scheduledKey > todayKey) {
      setErrorMessage(
        `This visit is scheduled for ${formatHealthVisitSchedule(
          request.scheduledDate,
          request.visitPeriod,
        )}. Reschedule it before starting early.`,
      );
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(`/health-request/${requestId}/status`, {
        status: "in-progress",
      });
      await invalidateHealth();
      const refreshed = await detailQuery.refetch();
      if (refreshed.error) throw refreshed.error;
      toast.success("Health service started");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "The Health visit could not be started."),
      );
    } finally {
      setBusy(false);
    }
  };

  const completeVisit = async () => {
    if (busy) return;
    if (!clinical.diagnosis.trim() || !clinical.treatment.trim()) {
      setErrorMessage(
        "Add both the diagnosis and treatment before resolving this request.",
      );
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(`/health-request/${requestId}/status`, {
        status: "resolved",
        diagnosis: clinical.diagnosis.trim(),
        treatment: clinical.treatment.trim(),
        ...(task?.taskId ? { taskId: task.taskId } : {}),
        ...(clinical.advice.trim() ? { advice: clinical.advice.trim() } : {}),
        ...(clinical.technicianNote.trim()
          ? { technicianNote: clinical.technicianNote.trim() }
          : {}),
      });
      await finish("Health service completed");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "The Health service could not be completed."),
      );
    } finally {
      setBusy(false);
    }
  };

  const openSchedule = () => {
    setSchedule({
      scheduledDate:
        text(request?.scheduledDate).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ||
        todayKey,
      visitPeriod: text(request?.visitPeriod).toLowerCase(),
    });
    setSamePeriodConfirmation(false);
    setErrorMessage("");
    setView("schedule");
  };

  const returnToSummary = () => {
    setView("summary");
    setSamePeriodConfirmation(false);
    setErrorMessage("");
  };

  const actions = (() => {
    if (view === "advice") {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={returnToSummary}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={submitAdvice}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Send
            Advice
          </button>
        </>
      );
    }
    if (view === "pickup") {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={returnToSummary}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={submitPickup}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Send
            Pickup Information
          </button>
        </>
      );
    }
    if (view === "schedule" && samePeriodConfirmation) {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={() => setSamePeriodConfirmation(false)}
          >
            Go Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-warning font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={() => submitSchedule(true)}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}{" "}
            Schedule Anyway
          </button>
        </>
      );
    }
    if (view === "schedule") {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={returnToSummary}
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy || !schedule.visitPeriod}
            onClick={() => submitSchedule(false)}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}{" "}
            {isScheduled ? "Save New Visit" : "Schedule Visit"}
          </button>
        </>
      );
    }
    if (isInProgress) {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={completeVisit}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}{" "}
            Complete Service
          </button>
        </>
      );
    }
    if (isScheduled) {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl"
            disabled={busy}
            onClick={openSchedule}
          >
            Reschedule
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={startVisit}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Record
            Health Assistance
          </button>
        </>
      );
    }
    if (!isOwned && !isTerminal) {
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold gap-1.5 rounded-xl"
            disabled={busy}
            onClick={claimRequest}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Claim
            Request
          </button>
        </>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-ghost btn-sm font-bold rounded-xl text-base-content/70"
        disabled={busy}
        onClick={onClose}
      >
        Close
      </button>
    );
  })();

  const availabilityByPeriod = {
    morning: getHealthVisitPeriodAvailability(
      schedule.scheduledDate,
      "morning",
    ),
    afternoon: getHealthVisitPeriodAvailability(
      schedule.scheduledDate,
      "afternoon",
    ),
  };

  return (
    <>
      <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onClose}
      title="Health Request"
      subtitle="Respond to this request without creating a separate walk-in operation."
      icon={
        <HeartPulse size={22} className="text-primary" aria-hidden="true" />
      }
      size="xl"
      actions={actions}
    >
      <div className="space-y-5 py-1">
        {detailQuery.isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="h-28 rounded-2xl bg-base-200 border border-base-300"></div>
              <div className="h-28 rounded-2xl bg-base-200 border border-base-300"></div>
            </div>
            <div className="h-32 rounded-2xl bg-base-200 border border-base-300"></div>
          </div>
        ) : (
          <>
            {/* Animal & Farmer Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mother Animal / Patient Animal */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                    Animal Patient
                  </span>
                  <span className="badge badge-primary/15 text-primary border-primary/20 badge-sm font-semibold">
                    {formatRequestType(
                      request?.requestType || task?.requestType,
                    )}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-base-content">
                      Tag #{request?.animalId?.earTag ||
                        request?.animalId?.animalId ||
                        task?.animalTag ||
                        task?.animalName ||
                        "Not recorded"}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5">
                      {[
                        request?.animalId?.species || task?.animalSpecies,
                        request?.animalId?.breed || task?.animalBreed,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "Species not recorded"}
                    </p>
                  </div>
                </div>
                {request?.createdAt && (
                  <p className="text-[11px] text-base-content/60 mt-2 flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-primary/70" />
                    Submitted: <strong>{formatRequestDate(request.createdAt)}</strong>
                  </p>
                )}
              </div>

              {/* Reporting Farmer */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Reporting Farmer
                </span>
                <div className="flex items-start gap-3">
                  <UserAvatar
                    name={
                      request?.farmerId?.name ||
                      request?.farmerName ||
                      task?.farmer
                    }
                    imageUrl={
                      request?.farmerId?.imageUrl || task?.farmerImageUrl
                    }
                    size={40}
                    sizeClass="h-10 w-10"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-base-content truncate">
                      {request?.farmerId?.name ||
                        request?.farmerName ||
                        task?.farmer ||
                        "Not recorded"}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5 truncate">
                      {formatFarmerLocation(request?.farmerId, "Location unknown")}
                    </p>
                    {(request?.farmerId?.phoneNumber ||
                      request?.farmerId?.phone) && (
                      <a
                        href={`tel:${request?.farmerId?.phoneNumber || request?.farmerId?.phone}`}
                        className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-1.5 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {request?.farmerId?.phoneNumber ||
                          request?.farmerId?.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Request Details Section */}
            <div className="border border-base-300 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                Clinical Request Details
              </span>

              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                    Assistance Requested
                  </span>
                  <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium wrap-break-word whitespace-pre-wrap capitalize">
                    {request?.requestDetails?.assistanceRequested
                      ? request.requestDetails.assistanceRequested.replace(
                          /_/g,
                          " ",
                        )
                      : request?.symptoms ||
                        request?.description ||
                        task?.symptoms ||
                        "Not recorded."}
                  </p>
                </div>

                {request?.requestDetails?.observedSigns?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1.5">
                      Observed Signs ({request.requestDetails.observedSigns.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {request.requestDetails.observedSigns.map(
                        (sign, index) => (
                          <span
                            key={index}
                            className="badge badge-primary/15 text-primary border-primary/25 badge-sm font-semibold capitalize py-2 px-2.5"
                          >
                            {sign.replace(/_/g, " ")}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Photos Section */}
            {requestPhotos.length > 0 && (
              <div className="border border-base-300 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                    Farmer Request Photos ({requestPhotos.length})
                  </span>
                  <span className="text-[11px] text-base-content/60 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3 text-primary" />
                    {requestPhotos.length} {requestPhotos.length === 1 ? "photo attached" : "photos attached"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {requestPhotos.map((photo, index) => (
                    <button
                      type="button"
                      key={photo}
                      onClick={() => setPreviewImage(photo)}
                      aria-label={`Open Farmer Health request photo ${index + 1}`}
                      className="relative h-20 w-28 rounded-xl overflow-hidden border border-base-300 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <img
                        src={photo}
                        alt={`Farmer Health request photo ${index + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detailQuery.isLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-8 text-base-content/65"
                role="status"
              >
                <Loader2 size={18} className="animate-spin" /> Loading request
                details...
              </div>
            ) : null}

            {detailQuery.isError ? (
              <div
                role="alert"
                className="alert alert-error/15 border-error/30 text-xs text-error flex items-start gap-3 rounded-2xl py-3 px-4"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {getErrorMessage(
                    detailQuery.error,
                    "Request details could not be loaded.",
                  )}
                </span>
              </div>
            ) : null}

            {errorMessage ? (
              <div
                role="alert"
                className="alert alert-error/15 border-error/30 text-xs text-error flex items-start gap-3 rounded-2xl py-3 px-4"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            ) : null}

            {!detailQuery.isLoading && view === "summary" && isScheduled ? (
              <div className="border border-base-300 rounded-2xl bg-base-200/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                    <CalendarDays size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                      Scheduled Farm Visit
                    </span>
                    <h4 className="font-bold text-sm text-base-content mt-0.5">
                      {formatHealthVisitSchedule(
                        request.scheduledDate,
                        request.visitPeriod,
                      )}
                    </h4>
                  </div>
                </div>
              </div>
            ) : null}

            {!detailQuery.isLoading && view === "summary" && canChooseMethod ? (
              <div
                className={`border border-base-300 rounded-2xl p-4 space-y-3 ${justClaimed ? "animate-in slide-in-from-top-4 fade-in duration-500" : ""}`}
              >
                {justClaimed && (
                  <div className="alert alert-success/15 border-success/30 text-xs text-base-content/80 flex items-start gap-2.5 rounded-xl py-2.5 px-3 mb-1">
                    <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      Request claimed successfully. Please select a response
                      method below.
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Response Determination
                  </span>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    Choose one response method. Only a Farm Visit creates a calendar schedule.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <MethodButton
                    icon={MessageSquareText}
                    title="Give Advice"
                    description="Send guidance to farmer without scheduling a visit."
                    disabled={!adviceEligible || busy}
                    onClick={() => {
                      setErrorMessage("");
                      setView("advice");
                    }}
                  />
                  <MethodButton
                    icon={Building2}
                    title="Office Pickup"
                    description="Confirm available item and provide pickup guidance."
                    disabled={!pickupEligible || busy}
                    onClick={() => {
                      setErrorMessage("");
                      setView("pickup");
                    }}
                  />
                  <MethodButton
                    icon={CalendarDays}
                    title="Schedule Farm Visit"
                    description="Choose visit date and morning or afternoon period."
                    disabled={!farmVisitEligible || busy}
                    onClick={openSchedule}
                  />
                </div>
              </div>
            ) : null}

            {!detailQuery.isLoading &&
            view === "summary" &&
            !isOwned &&
            !isTerminal ? (
              <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
                <Stethoscope size={16} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                <span>Claim this request before choosing how to respond.</span>
              </div>
            ) : null}

            {view === "advice" ? (
              <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Give Advice
                  </span>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    This resolves the request without creating a Medical Record
                    or farm schedule.
                  </p>
                </div>
                <Field label="Advice for Farmer" helper="Required">
                  <textarea
                    aria-label="Advice for Farmer"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-28 resize-none"
                    maxLength={HEALTH_ADVICE_MAX_LENGTH}
                    value={advice.adviceForFarmer}
                    onChange={(event) => {
                      setAdvice({
                        ...advice,
                        adviceForFarmer: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                    placeholder="Provide guidance, symptoms analysis, or instructions for the farmer..."
                  />
                </Field>
                <Field label="Follow-up date" helper="Optional">
                  <input
                    aria-label="Follow-up date"
                    type="date"
                    min={todayKey}
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    value={advice.followUpDate}
                    onChange={(event) => {
                      setAdvice({
                        ...advice,
                        followUpDate: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                  />
                </Field>
                <Field
                  label="Internal Note"
                  helper="Optional. Only visible to technicians and administrators."
                >
                  <textarea
                    aria-label="Internal Note"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                    maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                    value={advice.internalNote}
                    onChange={(event) => {
                      setAdvice({
                        ...advice,
                        internalNote: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                    placeholder="Notes for municipal staff..."
                  />
                </Field>
              </div>
            ) : null}

            {view === "pickup" ? (
              <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Office Pickup
                  </span>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    Confirm availability and tell the farmer where and how to
                    collect the item. This does not record treatment or
                    collection.
                  </p>
                </div>
                <Field label="Item available for pickup" helper="Required">
                  <input
                    aria-label="Item available for pickup"
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    maxLength={HEALTH_PICKUP_ITEM_MAX_LENGTH}
                    value={pickup.item}
                    onChange={(event) => {
                      setPickup({ ...pickup, item: event.target.value });
                      setErrorMessage("");
                    }}
                    placeholder="Dewormer, medicine, vaccine, or supplements"
                  />
                </Field>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-3 hover:bg-base-200/50 transition-colors">
                  <input
                    aria-label="I confirm this item is available for office pickup"
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm rounded-lg"
                    checked={pickup.availabilityConfirmed}
                    onChange={(event) => {
                      setPickup({
                        ...pickup,
                        availabilityConfirmed: event.target.checked,
                      });
                      setErrorMessage("");
                    }}
                  />
                  <span className="font-semibold text-xs text-base-content">
                    I confirm this item is available for office pickup
                  </span>
                </label>
                <Field
                  label="Pickup instructions"
                  helper="Required. Visible to the farmer."
                >
                  <textarea
                    aria-label="Pickup instructions"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-24 resize-none"
                    maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                    value={pickup.pickupInstructions}
                    onChange={(event) => {
                      setPickup({
                        ...pickup,
                        pickupInstructions: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                    placeholder="Available at the Municipal Agriculture Office. Please visit during office hours."
                  />
                </Field>
                <Field label="Message for Farmer" helper="Optional">
                  <textarea
                    aria-label="Message for Farmer"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                    maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                    value={pickup.farmerMessage}
                    onChange={(event) =>
                      setPickup({
                        ...pickup,
                        farmerMessage: event.target.value,
                      })
                    }
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Dosage / Use instructions" helper="Optional">
                    <textarea
                      aria-label="Dosage / Use instructions"
                      className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                      maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                      value={pickup.dosageInstructions}
                      onChange={(event) =>
                        setPickup({
                          ...pickup,
                          dosageInstructions: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Withdrawal guidance"
                    helper="Optional. Informational only."
                  >
                    <textarea
                      aria-label="Withdrawal guidance"
                      className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                      maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                      value={pickup.withdrawalGuidance}
                      onChange={(event) =>
                        setPickup({
                          ...pickup,
                          withdrawalGuidance: event.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Follow-up date" helper="Optional">
                  <input
                    aria-label="Pickup follow-up date"
                    type="date"
                    min={todayKey}
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    value={pickup.followUpDate}
                    onChange={(event) => {
                      setPickup({
                        ...pickup,
                        followUpDate: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                  />
                </Field>
                <Field
                  label="Internal Note"
                  helper="Optional. Only visible to technicians and administrators."
                >
                  <textarea
                    aria-label="Pickup Internal Note"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                    maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH}
                    value={pickup.internalNote}
                    onChange={(event) =>
                      setPickup({ ...pickup, internalNote: event.target.value })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {view === "schedule" ? (
              <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Schedule Farm Visit
                  </span>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    Choose a calendar date and service period. No exact
                    appointment time is stored.
                  </p>
                </div>
                <Field label="Visit date" helper="Required">
                  <input
                    aria-label="Visit date"
                    type="date"
                    min={todayKey}
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    value={schedule.scheduledDate}
                    onChange={(event) => {
                      setSchedule({
                        scheduledDate: event.target.value,
                        visitPeriod: "",
                      });
                      setSamePeriodConfirmation(false);
                      setErrorMessage("");
                    }}
                  />
                </Field>
                <div className="space-y-1.5">
                  <label className="label-text text-xs font-semibold text-base-content/80 block">
                    Visit Period
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {["morning", "afternoon"].map((period) => {
                      const availability = availabilityByPeriod[period];
                      const selected = schedule.visitPeriod === period;
                      const label =
                        period === "morning" ? "Morning" : "Afternoon";
                      return (
                        <button
                          key={period}
                          type="button"
                          aria-label={label}
                          aria-pressed={selected}
                          disabled={busy || availability.disabled}
                          onClick={() => {
                            setSchedule({ ...schedule, visitPeriod: period });
                            setSamePeriodConfirmation(false);
                            setErrorMessage("");
                          }}
                          className={`min-h-14 rounded-xl border p-3 text-left transition-all ${
                            selected
                              ? "border-primary bg-primary/15 text-primary shadow-sm"
                              : "border-base-300 bg-base-100 text-base-content hover:border-primary/50 hover:bg-primary/5"
                          } disabled:cursor-not-allowed disabled:opacity-45`}
                        >
                          <span className="flex items-center gap-2 font-bold text-xs">
                            <Clock3 size={15} aria-hidden="true" /> {label}
                          </span>
                          {availability.reason ? (
                            <span className="mt-1 block text-[10px] opacity-70">
                              {availability.reason}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {samePeriodConfirmation ? (
                  <div
                    role="alert"
                    className="alert alert-warning/15 border-warning/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4"
                  >
                    <Clock3 size={16} className="text-warning shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-bold text-base-content">
                        Schedule for the current period?
                      </p>
                      <p className="mt-0.5 leading-relaxed text-base-content/75">
                        Confirm that you still have enough time to travel to the
                        farm and provide the service.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!detailQuery.isLoading && view === "summary" && isInProgress ? (
              <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                    Record Health Service
                  </span>
                  <p className="text-xs text-base-content/70 mt-0.5">
                    Complete the clinical visit against this original Health
                    request.
                  </p>
                </div>
                <Field label="Diagnosis" helper="Required">
                  <input
                    aria-label="Diagnosis"
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    value={clinical.diagnosis}
                    onChange={(event) => {
                      setClinical({
                        ...clinical,
                        diagnosis: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                    placeholder="Clinical diagnosis..."
                  />
                </Field>
                <Field label="Treatment" helper="Required">
                  <input
                    aria-label="Treatment"
                    className="input input-bordered w-full text-xs font-semibold rounded-xl"
                    value={clinical.treatment}
                    onChange={(event) => {
                      setClinical({
                        ...clinical,
                        treatment: event.target.value,
                      });
                      setErrorMessage("");
                    }}
                    placeholder="Administered treatment..."
                  />
                </Field>
                <Field label="Advice for Farmer" helper="Optional">
                  <textarea
                    aria-label="Clinical Advice for Farmer"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                    value={clinical.advice}
                    onChange={(event) =>
                      setClinical({ ...clinical, advice: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Internal Note"
                  helper="Optional. Only visible to technicians and administrators."
                >
                  <textarea
                    aria-label="Clinical Internal Note"
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary rounded-xl min-h-20 resize-none"
                    value={clinical.technicianNote}
                    onChange={(event) =>
                      setClinical({
                        ...clinical,
                        technicianNote: event.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {!detailQuery.isLoading && view === "summary" && isTerminal ? (
              <div className="alert alert-success/15 border-success/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
                <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  This Health request is already {status.replaceAll("-", " ")}.
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
      </Modal>
      <ImagePreviewModal
        images={requestPhotos}
        selectedImage={previewImage}
        onSelectImage={setPreviewImage}
        onClose={() => setPreviewImage(null)}
        title="Farmer Health request photo"
      />
    </>
  );
}
