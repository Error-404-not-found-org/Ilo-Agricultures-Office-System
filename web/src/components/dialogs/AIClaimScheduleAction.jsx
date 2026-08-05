import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Eye,
  Flame,
  MapPin,
  Paperclip,
  Phone,
  Sparkles,
  Tag,
  User,
} from "lucide-react";

import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../ui/Modal";

const dateKeyWithOffset = (dayOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const backendErrorDetails = (error) => ({
  code: error?.response?.data?.code || null,
  message: error?.response?.data?.message || error?.message || "",
  status: error?.response?.status || null,
});

const humanizeStatus = (status) =>
  String(status || "Pending")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const getStatusBadgeClass = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("pending")) {
    return "badge-warning bg-warning/15 text-warning border-warning/30";
  }
  if (s.includes("schedule")) {
    return "badge-info bg-info/15 text-info border-info/30";
  }
  if (s.includes("completed") || s.includes("done") || s.includes("resolved")) {
    return "badge-success bg-success/15 text-success border-success/30";
  }
  return "badge-ghost";
};

const AIRequestSummary = ({ request, compact = false }) => {
  const farmerName =
    request.farmerDetails?.name || request.farmer || "Unknown farmer";
  const phone =
    request.phone ||
    request.farmerPhone ||
    request.farmerDetails?.phone ||
    "Not provided";
  const animalName =
    request.animalName || request.animal || request.animalTag || "Unknown";
  const animalTag = request.animalTag || request.earTag || null;
  const heatSigns = (
    Array.isArray(request.heatSigns) ? request.heatSigns : []
  )
    .map((sign) =>
      String(sign || "")
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .replaceAll(",", "")
        .trim(),
    )
    .filter(Boolean);
  const submittedAt = request.requestSubmissionDate || request.createdAt;
  const submittedDate = submittedAt ? new Date(submittedAt) : null;
  const submittedLabel =
    submittedDate && !Number.isNaN(submittedDate.getTime())
      ? submittedDate.toLocaleDateString("en-PH", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Not recorded";

  const attachmentUrls = [
    ...new Set(
      (Array.isArray(request.attachments?.urls)
        ? request.attachments.urls
        : []
      ).filter((url) => typeof url === "string" && url.trim()),
    ),
  ];
  const attachmentCount = Math.max(
    Number(request.attachments?.count || 0),
    attachmentUrls.length,
  );

  const statusLabel = humanizeStatus(request.status);
  const statusBadge = getStatusBadgeClass(request.status);

  if (compact) {
    return (
      <section
        aria-label="AI request summary"
        className="rounded-xl border border-base-300 bg-base-200/40 p-4 space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles size={14} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-base-content/60">
                Artificial Insemination
              </p>
            </div>
          </div>
          <span className={`badge badge-sm font-medium ${statusBadge}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2.5">
            <User size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <span className="text-xs text-base-content/60 block">Farmer</span>
              <span className="font-semibold text-base-content">{farmerName}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Tag size={16} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
            <div>
              <span className="text-xs text-base-content/60 block">Animal</span>
              <span className="font-semibold text-base-content">
                {animalName}
                {animalTag && animalTag !== animalName ? ` · Tag ${animalTag}` : ""}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Phone size={15} className="mt-0.5 shrink-0 text-base-content/55" aria-hidden="true" />
            <div>
              <span className="text-xs text-base-content/60 block">Contact</span>
              <span className="font-medium text-base-content">{phone}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CalendarDays size={15} className="mt-0.5 shrink-0 text-base-content/55" aria-hidden="true" />
            <div>
              <span className="text-xs text-base-content/60 block">Submitted</span>
              <span className="font-medium text-base-content">{submittedLabel}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 sm:col-span-2">
            <MapPin size={16} className="mt-0.5 shrink-0 text-error" aria-hidden="true" />
            <div>
              <span className="text-xs text-base-content/60 block">Location</span>
              <span className="font-medium text-base-content/90">{request.location || "Location unavailable"}</span>
            </div>
          </div>

          {heatSigns.length > 0 && (
            <div className="sm:col-span-2 pt-1">
              <span className="text-xs text-base-content/60 block mb-1">Heat Signs</span>
              <div className="flex flex-wrap gap-1">
                {heatSigns.map((sign, idx) => (
                  <span key={idx} className="badge badge-warning badge-soft text-[11px] px-2 py-0.5">
                    {sign}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="AI request details"
      className="space-y-4"
    >
      {/* Top Banner Bar (Horizontal Full Width) */}
      <div className="rounded-xl border border-base-300 bg-gradient-to-r from-primary/10 via-base-200/60 to-base-200/30 p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Artificial Insemination
              </p>
              <h4 className="text-sm font-semibold text-base-content/90">
                {request.serviceLabel || "AI Service Request"}
              </h4>
            </div>
          </div>
          <span className={`badge badge-md font-semibold ${statusBadge}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Main 2-Column Horizontal Layout (Left-to-Right Redistribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left Column: Farmer & Animal Info Cards */}
        <div className="space-y-4">
          {/* Farmer Card */}
          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-base-200 pb-2.5">
              <User size={16} className="text-primary" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                Farmer Information
              </h5>
            </div>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-base-content/55">Farmer</p>
                <p className="font-semibold text-base-content">{farmerName}</p>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <Phone size={15} className="mt-0.5 shrink-0 text-base-content/55" aria-hidden="true" />
                <div>
                  <p className="text-xs text-base-content/55">Contact</p>
                  <p className="font-medium text-base-content">{phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <MapPin size={15} className="mt-0.5 shrink-0 text-base-content/55" aria-hidden="true" />
                <div>
                  <p className="text-xs text-base-content/55">Location</p>
                  <p className="font-medium text-base-content">{request.location || "Location unavailable"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Animal Details Card */}
          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-base-200 pb-2.5">
              <Tag size={16} className="text-secondary" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                Animal & Request Info
              </h5>
            </div>
            <div className="space-y-2.5 text-sm">
              <div>
                <p className="text-xs text-base-content/55">Animal</p>
                <p className="font-semibold text-base-content">
                  {animalName}
                  {animalTag && animalTag !== animalName ? ` · Tag ${animalTag}` : ""}
                </p>
              </div>
              <div className="flex items-start gap-2 pt-0.5">
                <CalendarDays size={15} className="mt-0.5 shrink-0 text-base-content/55" aria-hidden="true" />
                <div>
                  <p className="text-xs text-base-content/55">Submitted</p>
                  <p className="font-medium text-base-content">{submittedLabel}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Heat Signs & Attachments Cards */}
        <div className="space-y-4">
          {/* Heat Signs Card */}
          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-base-200 pb-2.5">
              <Flame size={16} className="text-warning" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
                Clinical Observations
              </h5>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-xs text-base-content/55">Heat signs</p>
              {heatSigns.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {heatSigns.map((sign, idx) => (
                    <span
                      key={idx}
                      className="badge badge-warning badge-soft text-xs font-medium px-2.5 py-1"
                    >
                      {sign}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-medium text-base-content">None submitted</p>
              )}
            </div>
          </div>

          {/* Attachment Gallery Section */}
          <div className="rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xs space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium text-base-content/70">
              <Paperclip size={15} aria-hidden="true" />
              {attachmentCount} attachment{attachmentCount === 1 ? "" : "s"}
            </p>
            {attachmentUrls.length > 0 && (
              <div
                className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                aria-label="Submitted request images"
              >
                {attachmentUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative card card-border overflow-hidden bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all hover:border-primary/50 hover:shadow-md"
                    aria-label={`Open request image ${index + 1}`}
                  >
                    <figure className="aspect-video bg-base-200 overflow-hidden">
                      <img
                        src={url}
                        alt={`AI request attachment ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </figure>
                    <div className="absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center text-white">
                      <Eye size={18} />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default function AIRequestModal({
  modalState,
  requestQueryKey,
  onClose,
  onViewChange,
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fieldId = useId().replaceAll(":", "");
  const submittingRef = useRef(false);
  const [dateChoice, setDateChoice] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [visitPeriod, setVisitPeriod] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const request = modalState?.request || null;
  const view = modalState?.view === "schedule" ? "schedule" : "details";
  const isOpen = Boolean(request?.workflowType === "AI");
  const canClaimAndSchedule =
    request?.allowedAction === "CLAIM_AND_SCHEDULE";

  if (!request) return null;

  const closeModal = () => {
    if (submittingRef.current) return;
    setErrors({});
    onClose();
  };

  const selectedDate =
    dateChoice === "today"
      ? dateKeyWithOffset(0)
      : dateChoice === "tomorrow"
        ? dateKeyWithOffset(1)
        : dateChoice === "custom"
          ? customDate
          : "";

  const validate = () => {
    const nextErrors = {};
    if (!selectedDate) {
      nextErrors.date = "Choose Today, Tomorrow, or a custom date.";
    } else if (selectedDate < dateKeyWithOffset(0)) {
      nextErrors.date = "Choose today or a future date.";
    }
    if (!visitPeriod) {
      nextErrors.visitPeriod = "Choose Morning or Afternoon.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const confirmSchedule = async () => {
    if (submittingRef.current || !canClaimAndSchedule || !validate()) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});

    try {
      await axiosInstance.patch(
        `/ai-request/${encodeURIComponent(request.workflowId)}/claim-and-schedule`,
        {
          scheduledDate: selectedDate,
          visitPeriod,
        },
      );
    } catch (error) {
      const details = backendErrorDetails(error);
      submittingRef.current = false;
      setIsSubmitting(false);

      if (details.code === "INVALID_VISIT_PERIOD") {
        setErrors({ visitPeriod: "Choose Morning or Afternoon." });
        return;
      }
      if (
        [
          "SCHEDULE_DATE_REQUIRED",
          "INVALID_SCHEDULE_DATE",
          "SCHEDULE_DATE_IN_PAST",
        ].includes(details.code)
      ) {
        setErrors({ date: details.message || "Choose a valid future date." });
        return;
      }
      if (details.code === "REQUEST_ALREADY_CLAIMED") {
        setErrors({
          form: "This request was already claimed by another technician.",
        });
        return;
      }
      if (details.code === "REQUEST_NOT_CLAIMABLE") {
        setErrors({ form: "This request can no longer be scheduled." });
        return;
      }
      if ([401, 403].includes(details.status)) {
        setErrors({
          form: "You are not authorized to claim and schedule this request.",
        });
        return;
      }
      setErrors({
        form: details.message || "The visit could not be scheduled.",
      });
      return;
    }

    submittingRef.current = false;
    setIsSubmitting(false);
    toast.success("AI visit scheduled successfully.");
    onClose();

    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: requestQueryKey,
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: ["technician", "requests-stats-background"],
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: ["technician", "work-queue", "mine"],
        exact: true,
      }),
    ]);
  };

  const actions =
    view === "details" ? (
      <>
        <button type="button" className="btn btn-sm btn-ghost" onClick={closeModal}>
          Close
        </button>
        {canClaimAndSchedule && (
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1.5"
            onClick={() => onViewChange("schedule")}
          >
            <CalendarDays size={16} aria-hidden="true" />
            {request.actionLabel || "Claim & Set Visit"}
          </button>
        )}
      </>
    ) : (
      <>
        <button
          type="button"
          className="btn btn-sm btn-ghost mr-auto gap-1.5"
          disabled={isSubmitting}
          onClick={() => onViewChange("details")}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Details
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={isSubmitting}
          onClick={closeModal}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary gap-1.5"
          disabled={isSubmitting || !canClaimAndSchedule}
          onClick={confirmSchedule}
        >
          {isSubmitting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          {isSubmitting ? "Scheduling…" : "Confirm Schedule"}
        </button>
      </>
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title={
        view === "schedule"
          ? request.actionLabel || "Claim & Set Visit"
          : "AI Request Details"
      }
      subtitle={
        view === "schedule"
          ? "Choose the visit date and service period before assignment."
          : "Review the farmer's artificial insemination request."
      }
      size="4xl"
      actions={actions}
    >
      {view === "details" ? (
        <AIRequestSummary request={request} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Compact Summary */}
          <div className="lg:col-span-5">
            <AIRequestSummary request={request} compact />
          </div>

          {/* Right Column: Schedule Selection Form */}
          <div className="lg:col-span-7 space-y-5 rounded-xl border border-base-300 bg-base-100 p-4 shadow-2xs">
            <div className="border-b border-base-200 pb-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
                <CalendarDays size={16} className="text-primary" />
                Schedule Assignment
              </h5>
            </div>

            {errors.form && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                <span>{errors.form}</span>
              </div>
            )}

            <fieldset className="fieldset">
              <legend className="fieldset-legend font-semibold text-base-content/80 mb-2">Visit date</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["today", "Today"],
                  ["tomorrow", "Tomorrow"],
                  ["custom", "Custom date"],
                ].map(([value, label]) => {
                  const isChecked = dateChoice === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5 text-primary shadow-xs font-semibold"
                          : "border-base-300 bg-base-100 hover:bg-base-200/50 text-base-content"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`ai-visit-date-choice-${fieldId}`}
                        value={value}
                        checked={isChecked}
                        onChange={() => {
                          setDateChoice(value);
                          setErrors((current) => ({ ...current, date: null }));
                        }}
                        className="radio radio-primary radio-sm"
                      />
                      <span className="font-medium text-sm text-base-content">{label}</span>
                    </label>
                  );
                })}
              </div>
              {dateChoice === "custom" && (
                <input
                  type="date"
                  aria-label="Custom visit date"
                  className={`input input-sm mt-2.5 w-full ${errors.date ? "input-error" : ""}`}
                  min={dateKeyWithOffset(0)}
                  value={customDate}
                  onChange={(event) => {
                    setCustomDate(event.target.value);
                    setErrors((current) => ({ ...current, date: null }));
                  }}
                />
              )}
              {errors.date && (
                <p role="alert" className="label text-error text-xs mt-1">
                  {errors.date}
                </p>
              )}
            </fieldset>

            <fieldset className="fieldset">
              <legend className="fieldset-legend font-semibold text-base-content/80 mb-2">Visit period</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ["morning", "Morning"],
                  ["afternoon", "Afternoon"],
                ].map(([value, label]) => {
                  const isChecked = visitPeriod === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all ${
                        isChecked
                          ? "border-primary bg-primary/5 text-primary shadow-xs font-semibold"
                          : "border-base-300 bg-base-100 hover:bg-base-200/50 text-base-content"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`ai-visit-period-${fieldId}`}
                        value={value}
                        checked={isChecked}
                        onChange={() => {
                          setVisitPeriod(value);
                          setErrors((current) => ({
                            ...current,
                            visitPeriod: null,
                          }));
                        }}
                        className="radio radio-primary radio-sm"
                      />
                      <Clock3
                        size={15}
                        className={isChecked ? "text-primary" : "text-base-content/55"}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-sm text-base-content">{label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.visitPeriod && (
                <p role="alert" className="label text-error text-xs mt-1">
                  {errors.visitPeriod}
                </p>
              )}
            </fieldset>
          </div>
        </div>
      )}
    </Modal>
  );
}

