import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Paperclip,
  Phone,
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
  const heatSigns = Array.isArray(request.heatSigns) ? request.heatSigns : [];
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
      [
        ...(Array.isArray(request.photos) ? request.photos : []),
        request.imageUrl,
        ...(Array.isArray(request.attachments?.urls)
          ? request.attachments.urls
          : []),
      ]
        .filter((url) => typeof url === "string" && url.trim())
        .map((url) => url.trim()),
    ),
  ];
  const attachmentCount = attachmentUrls.length;

  return (
    <section
      aria-label={compact ? "AI request summary" : "AI request details"}
      className="rounded-box border border-base-300 bg-base-200/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
          Artificial Insemination
        </p>
        <span className="badge badge-sm">
          {humanizeStatus(request.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-base-content/55">Farmer</p>
          <p className="font-semibold text-base-content">{farmerName}</p>
        </div>
        <div>
          <p className="text-xs text-base-content/55">Animal</p>
          <p className="font-semibold text-base-content">
            {animalName}
            {animalTag && animalTag !== animalName ? ` · Tag ${animalTag}` : ""}
          </p>
        </div>

        {!compact && (
          <div className="flex items-start gap-2">
            <Phone
              size={15}
              className="mt-0.5 shrink-0 text-base-content/55"
              aria-hidden="true"
            />
            <span>{phone}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <MapPin
            size={15}
            className="mt-0.5 shrink-0 text-base-content/55"
            aria-hidden="true"
          />
          <span>{request.location || "Location unavailable"}</span>
        </div>

        {!compact && (
          <>
            <div>
              <p className="text-xs text-base-content/55">Heat signs</p>
              <p>
                {heatSigns.length ? heatSigns.join(", ") : "None submitted"}
              </p>
            </div>
            <div>
              <p className="text-xs text-base-content/55">Submitted</p>
              <p>{submittedLabel}</p>
            </div>
          </>
        )}
      </div>

      {!compact && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium text-base-content/70">
            <Paperclip size={15} aria-hidden="true" />
            Farmer request photos ({attachmentCount})
          </p>
          {attachmentUrls.length > 0 && (
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              aria-label="Submitted request images"
            >
              {attachmentUrls.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="card card-border overflow-hidden bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`Open request image ${index + 1}`}
                >
                  <figure className="aspect-video bg-base-200">
                    <img
                      src={url}
                      alt={`Farmer-submitted AI request photo ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </figure>
                </a>
              ))}
            </div>
          )}
          {attachmentUrls.length === 0 && (
            <p className="text-sm text-base-content/60">
              No request photos submitted.
            </p>
          )}
        </div>
      )}
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
            className="btn btn-sm btn-primary"
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
          className="btn btn-sm btn-ghost mr-auto"
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
          className="btn btn-sm btn-primary"
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
      size="lg"
      actions={actions}
    >
      {view === "details" ? (
        <AIRequestSummary request={request} />
      ) : (
        <div className="space-y-5">
          <AIRequestSummary request={request} compact />

          {errors.form && (
            <div role="alert" className="alert alert-error alert-soft text-sm">
              <span>{errors.form}</span>
            </div>
          )}

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Visit date</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["today", "Today"],
                ["tomorrow", "Tomorrow"],
                ["custom", "Custom date"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2.5"
                >
                  <input
                    type="radio"
                    name={`ai-visit-date-choice-${fieldId}`}
                    value={value}
                    checked={dateChoice === value}
                    onChange={() => {
                      setDateChoice(value);
                      setErrors((current) => ({ ...current, date: null }));
                    }}
                    className="radio radio-sm"
                  />
                  <span className="font-medium text-base-content">{label}</span>
                </label>
              ))}
            </div>
            {dateChoice === "custom" && (
              <input
                type="date"
                aria-label="Custom visit date"
                className={`input input-sm mt-2 w-full ${errors.date ? "input-error" : ""}`}
                min={dateKeyWithOffset(0)}
                value={customDate}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setErrors((current) => ({ ...current, date: null }));
                }}
              />
            )}
            {errors.date && (
              <p role="alert" className="label text-error">
                {errors.date}
              </p>
            )}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Visit period</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["morning", "Morning"],
                ["afternoon", "Afternoon"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2.5"
                >
                  <input
                    type="radio"
                    name={`ai-visit-period-${fieldId}`}
                    value={value}
                    checked={visitPeriod === value}
                    onChange={() => {
                      setVisitPeriod(value);
                      setErrors((current) => ({
                        ...current,
                        visitPeriod: null,
                      }));
                    }}
                    className="radio radio-sm"
                  />
                  <Clock3
                    size={15}
                    className="text-base-content/55"
                    aria-hidden="true"
                  />
                  <span className="font-medium text-base-content">{label}</span>
                </label>
              ))}
            </div>
            {errors.visitPeriod && (
              <p role="alert" className="label text-error">
                {errors.visitPeriod}
              </p>
            )}
          </fieldset>
        </div>
      )}
    </Modal>
  );
}
