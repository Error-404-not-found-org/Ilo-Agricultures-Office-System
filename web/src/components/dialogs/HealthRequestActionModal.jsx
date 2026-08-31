/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Loader2,
  MessageSquareText,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import Modal from "../ui/Modal";
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
    <fieldset className="fieldset min-w-0">
      <legend className="fieldset-legend text-sm font-semibold text-base-content">
        {label}
      </legend>
      {children}
      {helper ? <p className="label text-xs text-base-content/60">{helper}</p> : null}
    </fieldset>
  );
}

function MethodButton({ icon: Icon, title, description, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex min-h-18 w-full items-center gap-3 rounded-xl border border-base-300 bg-base-100 p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-base-200 text-primary group-hover:bg-primary/10">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-base-content">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-base-content/65">
          {description}
        </span>
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
  const [busy, setBusy] = useState(false);
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
  const canChooseMethod =
    adviceEligible || pickupEligible || farmVisitEligible;
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
    toast.success(message);
    onClose();
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
      await finish(isScheduled ? "Health visit rescheduled" : "Health visit scheduled");
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
      await finish("Health visit started");
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
      setErrorMessage("Add both the diagnosis and treatment before resolving this request.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    try {
      await axiosInstance.patch(`/health-request/${requestId}/status`, {
        status: "resolved",
        diagnosis: clinical.diagnosis.trim(),
        treatment: clinical.treatment.trim(),
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
          <button type="button" className="btn btn-sm" disabled={busy} onClick={returnToSummary}>Back</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={submitAdvice}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Send Advice
          </button>
        </>
      );
    }
    if (view === "pickup") {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={returnToSummary}>Back</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={submitPickup}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Send Pickup Information
          </button>
        </>
      );
    }
    if (view === "schedule" && samePeriodConfirmation) {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setSamePeriodConfirmation(false)}>Go Back</button>
          <button type="button" className="btn btn-sm btn-warning" disabled={busy} onClick={() => submitSchedule(true)}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Schedule Anyway
          </button>
        </>
      );
    }
    if (view === "schedule") {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={returnToSummary}>Back</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy || !schedule.visitPeriod} onClick={() => submitSchedule(false)}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} {isScheduled ? "Save New Visit" : "Schedule Visit"}
          </button>
        </>
      );
    }
    if (isInProgress) {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>Close</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={completeVisit}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Complete Service
          </button>
        </>
      );
    }
    if (isScheduled) {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>Close</button>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={openSchedule}>Reschedule</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={startVisit}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Start Visit
          </button>
        </>
      );
    }
    if (!isOwned && !isTerminal) {
      return (
        <>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>Close</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={claimRequest}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Claim Request
          </button>
        </>
      );
    }
    return <button type="button" className="btn btn-sm" disabled={busy} onClick={onClose}>Close</button>;
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
    <Modal
      isOpen={isOpen}
      onClose={busy ? undefined : onClose}
      title="Health Request"
      subtitle="Respond to this request without creating a separate walk-in operation."
      icon={<HeartPulse size={22} className="text-primary" aria-hidden="true" />}
      size="xl"
      actions={actions}
    >
      <div className="space-y-5">
        <section className="grid gap-3 rounded-xl border border-base-300 bg-base-200/35 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-base-content/55">Farmer</p>
            <p className="mt-1 font-bold text-base-content">
              {request?.farmerId?.name || request?.farmerName || task?.farmer || "Not recorded"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-base-content/55">Animal</p>
            <p className="mt-1 font-bold text-base-content">
              {request?.animalId?.earTag || request?.animalId?.animalId || task?.animalTag || task?.animalName || "Not recorded"}
            </p>
          </div>
        </section>

        {detailQuery.isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-base-content/65" role="status">
            <Loader2 size={18} className="animate-spin" /> Loading request details...
          </div>
        ) : null}

        {detailQuery.isError ? (
          <div role="alert" className="alert alert-error alert-soft">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{getErrorMessage(detailQuery.error, "Request details could not be loaded.")}</span>
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="alert alert-error alert-soft">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {!detailQuery.isLoading && view === "summary" && canChooseMethod ? (
          <section className="space-y-3">
            <div>
              <h4 className="text-base font-bold text-base-content">
                How will you handle this request?
              </h4>
              <p className="mt-1 text-sm text-base-content/65">
                Choose one response method. Only a Farm Visit creates a schedule.
              </p>
            </div>
            <div className="grid gap-3">
              <MethodButton
                icon={MessageSquareText}
                title="Give Advice"
                description="Send guidance to the farmer without scheduling a visit."
                disabled={!adviceEligible || busy}
                onClick={() => { setErrorMessage(""); setView("advice"); }}
              />
              <MethodButton
                icon={Building2}
                title="Office Pickup"
                description="Confirm an item is available and provide pickup instructions."
                disabled={!pickupEligible || busy}
                onClick={() => { setErrorMessage(""); setView("pickup"); }}
              />
              <MethodButton
                icon={CalendarDays}
                title="Schedule Farm Visit"
                description="Choose a visit date and a morning or afternoon period."
                disabled={!farmVisitEligible || busy}
                onClick={openSchedule}
              />
            </div>
          </section>
        ) : null}

        {!detailQuery.isLoading && view === "summary" && !isOwned && !isTerminal ? (
          <div className="alert alert-info alert-soft">
            <Stethoscope size={18} aria-hidden="true" />
            <span>Claim this request before choosing how to respond.</span>
          </div>
        ) : null}

        {view === "advice" ? (
          <section className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-base-content">Give Advice</h4>
              <p className="mt-1 text-sm text-base-content/65">This resolves the request without creating a Medical Record or farm schedule.</p>
            </div>
            <Field label="Advice for Farmer" helper="Required">
              <textarea aria-label="Advice for Farmer" className="textarea min-h-32 w-full" maxLength={HEALTH_ADVICE_MAX_LENGTH} value={advice.adviceForFarmer} onChange={(event) => { setAdvice({ ...advice, adviceForFarmer: event.target.value }); setErrorMessage(""); }} />
            </Field>
            <Field label="Follow-up date" helper="Optional">
              <input aria-label="Follow-up date" type="date" min={todayKey} className="input w-full" value={advice.followUpDate} onChange={(event) => { setAdvice({ ...advice, followUpDate: event.target.value }); setErrorMessage(""); }} />
            </Field>
            <Field label="Internal Note" helper="Optional. Only visible to technicians and administrators.">
              <textarea aria-label="Internal Note" className="textarea min-h-24 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={advice.internalNote} onChange={(event) => { setAdvice({ ...advice, internalNote: event.target.value }); setErrorMessage(""); }} />
            </Field>
          </section>
        ) : null}

        {view === "pickup" ? (
          <section className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-base-content">Office Pickup</h4>
              <p className="mt-1 text-sm text-base-content/65">Confirm availability and tell the farmer where and how to collect the item. This does not record treatment or collection.</p>
            </div>
            <Field label="Item available for pickup" helper="Required">
              <input aria-label="Item available for pickup" className="input w-full" maxLength={HEALTH_PICKUP_ITEM_MAX_LENGTH} value={pickup.item} onChange={(event) => { setPickup({ ...pickup, item: event.target.value }); setErrorMessage(""); }} placeholder="Dewormer, medicine, vaccine, or supplements" />
            </Field>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-base-300 bg-base-200/30 p-3">
              <input aria-label="I confirm this item is available for office pickup" type="checkbox" className="checkbox checkbox-primary" checked={pickup.availabilityConfirmed} onChange={(event) => { setPickup({ ...pickup, availabilityConfirmed: event.target.checked }); setErrorMessage(""); }} />
              <span className="font-semibold text-base-content">I confirm this item is available for office pickup</span>
            </label>
            <Field label="Pickup instructions" helper="Required. Visible to the farmer.">
              <textarea aria-label="Pickup instructions" className="textarea min-h-28 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={pickup.pickupInstructions} onChange={(event) => { setPickup({ ...pickup, pickupInstructions: event.target.value }); setErrorMessage(""); }} placeholder="Available at the Municipal Agriculture Office. Please visit during office hours." />
            </Field>
            <Field label="Message for Farmer" helper="Optional">
              <textarea aria-label="Message for Farmer" className="textarea min-h-22 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={pickup.farmerMessage} onChange={(event) => setPickup({ ...pickup, farmerMessage: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Dosage / Use instructions" helper="Optional">
                <textarea aria-label="Dosage / Use instructions" className="textarea min-h-24 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={pickup.dosageInstructions} onChange={(event) => setPickup({ ...pickup, dosageInstructions: event.target.value })} />
              </Field>
              <Field label="Withdrawal guidance" helper="Optional. Informational only.">
                <textarea aria-label="Withdrawal guidance" className="textarea min-h-24 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={pickup.withdrawalGuidance} onChange={(event) => setPickup({ ...pickup, withdrawalGuidance: event.target.value })} />
              </Field>
            </div>
            <Field label="Follow-up date" helper="Optional">
              <input aria-label="Pickup follow-up date" type="date" min={todayKey} className="input w-full" value={pickup.followUpDate} onChange={(event) => { setPickup({ ...pickup, followUpDate: event.target.value }); setErrorMessage(""); }} />
            </Field>
            <Field label="Internal Note" helper="Optional. Only visible to technicians and administrators.">
              <textarea aria-label="Pickup Internal Note" className="textarea min-h-24 w-full" maxLength={HEALTH_PICKUP_TEXT_MAX_LENGTH} value={pickup.internalNote} onChange={(event) => setPickup({ ...pickup, internalNote: event.target.value })} />
            </Field>
          </section>
        ) : null}

        {view === "schedule" ? (
          <section className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-base-content">Schedule Farm Visit</h4>
              <p className="mt-1 text-sm text-base-content/65">Choose a calendar date and service period. No exact appointment time is stored.</p>
            </div>
            <Field label="Visit date" helper="Required">
              <input aria-label="Visit date" type="date" min={todayKey} className="input w-full" value={schedule.scheduledDate} onChange={(event) => { setSchedule({ scheduledDate: event.target.value, visitPeriod: "" }); setSamePeriodConfirmation(false); setErrorMessage(""); }} />
            </Field>
            <fieldset className="fieldset">
              <legend className="fieldset-legend text-sm font-semibold text-base-content">Visit Period</legend>
              <div className="grid grid-cols-2 gap-3">
                {["morning", "afternoon"].map((period) => {
                  const availability = availabilityByPeriod[period];
                  const selected = schedule.visitPeriod === period;
                  const label = period === "morning" ? "Morning" : "Afternoon";
                  return (
                    <button key={period} type="button" aria-label={label} aria-pressed={selected} disabled={busy || availability.disabled} onClick={() => { setSchedule({ ...schedule, visitPeriod: period }); setSamePeriodConfirmation(false); setErrorMessage(""); }} className={`min-h-16 rounded-xl border p-3 text-left ${selected ? "border-primary bg-primary/10 text-primary" : "border-base-300 bg-base-100 text-base-content"} disabled:cursor-not-allowed disabled:opacity-45`}>
                      <span className="flex items-center gap-2 font-bold"><Clock3 size={17} aria-hidden="true" /> {label}</span>
                      {availability.reason ? <span className="mt-1 block text-xs opacity-70">{availability.reason}</span> : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {samePeriodConfirmation ? (
              <div role="alert" className="alert alert-warning alert-soft items-start">
                <Clock3 size={18} aria-hidden="true" />
                <div>
                  <p className="font-bold">Schedule for the current period?</p>
                  <p className="mt-1 text-sm">Confirm that you still have enough time to travel to the farm and provide the service.</p>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!detailQuery.isLoading && view === "summary" && isScheduled ? (
          <section className="rounded-xl border border-base-300 bg-base-100 p-4">
            <div className="flex items-start gap-3">
              <CalendarDays size={20} className="mt-0.5 text-primary" aria-hidden="true" />
              <div>
                <h4 className="font-bold text-base-content">Scheduled Farm Visit</h4>
                <p className="mt-1 text-sm text-base-content/70">{formatHealthVisitSchedule(request.scheduledDate, request.visitPeriod)}</p>
              </div>
            </div>
          </section>
        ) : null}

        {!detailQuery.isLoading && view === "summary" && isInProgress ? (
          <section className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-base-content">Record Health Service</h4>
              <p className="mt-1 text-sm text-base-content/65">Complete the clinical visit against this original Health request.</p>
            </div>
            <Field label="Diagnosis" helper="Required">
              <input aria-label="Diagnosis" className="input w-full" value={clinical.diagnosis} onChange={(event) => { setClinical({ ...clinical, diagnosis: event.target.value }); setErrorMessage(""); }} />
            </Field>
            <Field label="Treatment" helper="Required">
              <input aria-label="Treatment" className="input w-full" value={clinical.treatment} onChange={(event) => { setClinical({ ...clinical, treatment: event.target.value }); setErrorMessage(""); }} />
            </Field>
            <Field label="Advice for Farmer" helper="Optional">
              <textarea aria-label="Clinical Advice for Farmer" className="textarea min-h-24 w-full" value={clinical.advice} onChange={(event) => setClinical({ ...clinical, advice: event.target.value })} />
            </Field>
            <Field label="Internal Note" helper="Optional. Only visible to technicians and administrators.">
              <textarea aria-label="Clinical Internal Note" className="textarea min-h-24 w-full" value={clinical.technicianNote} onChange={(event) => setClinical({ ...clinical, technicianNote: event.target.value })} />
            </Field>
          </section>
        ) : null}

        {!detailQuery.isLoading && view === "summary" && isTerminal ? (
          <div className="alert alert-success alert-soft">
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>This Health request is already {status.replaceAll("-", " ")}.</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
