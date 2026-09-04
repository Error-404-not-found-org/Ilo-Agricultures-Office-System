import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Phone,
  Tag,
  Activity,
  MessageSquareText,
  Image as ImageIcon,
} from "lucide-react";

import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../ui/Modal";
import UserAvatar from "../ui/UserAvatar";
import {
  getHealthVisitPeriodAvailability,
  getManilaDateKey,
} from "../../utils/healthRequestWorkflow";

const dateKeyWithOffset = (dayOffset = 0) => {
  const [year, month, day] = getManilaDateKey().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + dayOffset))
    .toISOString()
    .slice(0, 10);
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

const humanizeObservation = (value) =>
  humanizeStatus(String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2"));

const formatRequestDate = (dateString) => {
  if (!dateString) return "Not specified";
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(d);
  } catch {
    return "Invalid date";
  }
};

const AIRequestSummary = ({ request, compact = false, onPreviewImage }) => {
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
  const heatSigns = Array.isArray(request.raw?.requestDetails?.heatSigns)
    ? request.raw.requestDetails.heatSigns
    : Array.isArray(request.heatSigns)
      ? request.heatSigns
      : [];
  const submittedAt = request.requestSubmissionDate || request.createdAt;

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

  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const displayedPhotos = showAllPhotos
    ? attachmentUrls
    : attachmentUrls.slice(0, 4);
  const hasMorePhotos = attachmentUrls.length > 4;

  const requestNotes =
    request.taskDetails ||
    request.raw?.farmerDescription ||
    request.raw?.farmerNotes ||
    request.raw?.notes ||
    null;

  return (
    <div className="space-y-5">
      {/* Farmer Information Section */}
      <section className="rounded-xl border border-base-300 bg-base-200 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={farmerName}
              imageUrl={
                request.farmerImageUrl || request.raw?.farmerId?.imageUrl
              }
              size={48}
              sizeClass="h-12 w-12"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/55">
                Farmer
              </p>
              <p className="truncate font-bold text-base-content">
                {farmerName}
              </p>
            </div>
          </div>
          {submittedAt && (
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/55">
                Submitted
              </p>
              <p className="text-xs text-base-content/70">
                {formatRequestDate(submittedAt)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Request Details Section */}
      <section className="rounded-xl border border-base-300 bg-base-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/60">
            Request Details
          </h4>
          <span className="badge badge-sm badge-primary">
            {humanizeStatus(request.status)}
          </span>
        </div>

        <div className="space-y-4">
          {/* Location and Contact */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm bg-base-100 rounded-lg p-3 border border-base-300">
              <MapPin size={16} className="shrink-0 text-primary" />
              <span className="truncate text-base-content/70">
                {request.locationLabel ||
                  request.location ||
                  request.farmerDetails?.location ||
                  "Location unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-base-100 rounded-lg p-3 border border-base-300">
              <Phone size={16} className="shrink-0 text-primary" />
              <span className="truncate text-base-content/70">{phone}</span>
            </div>
          </div>

          {/* Animal */}
          <div className="grid gap-3 sm:grid-cols-1">
            <div className="flex items-center gap-2 text-sm bg-base-100 rounded-lg p-3 border border-base-300">
              <Tag size={16} className="shrink-0 text-primary" />
              <span className="truncate text-base-content/70">
                Animal Ear tag:{" "}
                <strong className="text-base-content">{animalTag}</strong>
              </span>
            </div>
          </div>

          {/* Farmer Notes */}
          {requestNotes && (
            <div className="bg-base-100 rounded-lg p-4 border border-base-300">
              <div className="flex items-start gap-2">
                <MessageSquareText
                  size={16}
                  className="shrink-0 mt-0.5 text-primary"
                />
                <div className="flex-1">
                  <strong className="text-base-content block mb-2 text-sm">
                    Farmer Notes:
                  </strong>
                  <p className="text-sm text-base-content/80 leading-relaxed whitespace-pre-wrap">
                    {requestNotes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Observed Signs */}
          {heatSigns.length > 0 && (
            <div className="bg-base-100 rounded-lg p-4 border border-base-300">
              <div className="flex items-start gap-2">
                <Activity size={16} className="shrink-0 mt-0.5 text-primary" />
                <div className="flex-1">
                  <strong className="text-base-content block mb-3 text-sm">
                    Observed Heat Signs:
                  </strong>
                  <div className="flex flex-wrap gap-2">
                    {heatSigns.map((sign, index) => (
                      <div
                        key={index}
                        className="badge badge-primary badge-lg gap-1.5 px-3 py-2.5 text-xs font-medium capitalize"
                      >
                        {humanizeObservation(sign)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Photos Section - Enhanced for multiple photos */}
      {!compact && attachmentUrls.length > 0 && (
        <section className="rounded-xl border border-base-300 bg-base-200 p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon
                size={16}
                className="text-primary"
                aria-hidden="true"
              />
              <h4 className="text-sm font-semibold text-base-content">
                Farmer Request Photos ({attachmentUrls.length})
              </h4>
            </div>
            {hasMorePhotos && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setShowAllPhotos(!showAllPhotos)}
              >
                {showAllPhotos
                  ? "Show Less"
                  : `Show All (${attachmentUrls.length})`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {displayedPhotos.map((url, index) => (
              <button
                type="button"
                key={url}
                className="group relative aspect-video overflow-hidden rounded-xl border border-base-300 bg-base-100 transition-all hover:scale-105 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Enlarge request image ${index + 1}`}
                onClick={() => onPreviewImage?.(url)}
              >
                <img
                  src={url}
                  alt={`Farmer-submitted AI request photo ${index + 1}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />

                {/* Photo counter overlay for photos beyond 4 when not showing all */}
                {!showAllPhotos && index === 3 && hasMorePhotos && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-lg font-bold text-white">
                      +{attachmentUrls.length - 4}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
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
  const [samePeriodConfirmed, setSamePeriodConfirmed] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const request = modalState?.request || null;
  const view = modalState?.view === "schedule" ? "schedule" : "details";
  const isOpen = Boolean(request?.workflowType === "AI");
  const canClaimAndSchedule = request?.allowedAction === "CLAIM_AND_SCHEDULE";

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
  const selectedPeriodAvailability = getHealthVisitPeriodAvailability(
    selectedDate,
    visitPeriod,
  );

  const validate = () => {
    const nextErrors = {};
    if (!selectedDate) {
      nextErrors.date = "Choose Today, Tomorrow, or a custom date.";
    } else if (selectedDate < dateKeyWithOffset(0)) {
      nextErrors.date = "Choose today or a future date.";
    }
    if (!visitPeriod) {
      nextErrors.visitPeriod = "Choose Morning or Afternoon.";
    } else if (selectedPeriodAvailability.disabled) {
      nextErrors.visitPeriod = selectedPeriodAvailability.reason;
    } else if (
      selectedPeriodAvailability.requiresConfirmation &&
      !samePeriodConfirmed
    ) {
      nextErrors.visitPeriod =
        "Confirm that you can still attend during this current service period.";
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
          ...(selectedPeriodAvailability.requiresConfirmation
            ? { samePeriodConfirmed: true }
            : {}),
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
      if (details.code === "VISIT_PERIOD_CONFIRMATION_REQUIRED") {
        setErrors({
          visitPeriod:
            "Confirm that you can still attend during this current service period.",
        });
        return;
      }
      if (details.code === "VISIT_PERIOD_IN_PAST") {
        setErrors({
          visitPeriod: details.message || "That service period has passed.",
        });
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
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={closeModal}
        >
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
    <>
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={
          view === "schedule"
            ? request.actionLabel || "Claim & Set Visit"
            : "Insemination Request Details"
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
          <AIRequestSummary
            request={request}
            onPreviewImage={setPreviewImage}
          />
        ) : (
          <div className="space-y-5">
            <AIRequestSummary request={request} compact />

            {errors.form && (
              <div
                role="alert"
                className="alert alert-error alert-soft text-sm"
              >
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
                        setSamePeriodConfirmed(false);
                        setErrors((current) => ({ ...current, date: null }));
                      }}
                      className="radio radio-sm"
                    />
                    <span className="font-medium text-base-content">
                      {label}
                    </span>
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
                    setSamePeriodConfirmed(false);
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
                ].map(([value, label]) => {
                  const availability = getHealthVisitPeriodAvailability(
                    selectedDate,
                    value,
                  );
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2.5 ${availability.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                    >
                      <input
                        type="radio"
                        name={`ai-visit-period-${fieldId}`}
                        value={value}
                        checked={visitPeriod === value}
                        disabled={availability.disabled}
                        onChange={() => {
                          setVisitPeriod(value);
                          setSamePeriodConfirmed(false);
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
                      <span className="font-medium text-base-content">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedPeriodAvailability.requiresConfirmation &&
              visitPeriod ? (
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-box border border-warning/40 bg-warning/10 p-3 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-warning checkbox-sm mt-0.5"
                    checked={samePeriodConfirmed}
                    onChange={(event) => {
                      setSamePeriodConfirmed(event.target.checked);
                      setErrors((current) => ({
                        ...current,
                        visitPeriod: null,
                      }));
                    }}
                  />
                  <span>
                    I confirm I can still attend during this current service
                    period.
                  </span>
                </label>
              ) : null}
              {errors.visitPeriod && (
                <p role="alert" className="label text-error">
                  {errors.visitPeriod}
                </p>
              )}
            </fieldset>
          </div>
        )}
      </Modal>
      <Modal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title="Farmer request photo"
        size="lg"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPreviewImage(null)}
          >
            Close
          </button>
        }
      >
        {previewImage ? (
          <img
            src={previewImage}
            alt="Enlarged Farmer-submitted AI request"
            className="max-h-[70vh] w-full rounded-box object-contain"
          />
        ) : null}
      </Modal>
    </>
  );
}
