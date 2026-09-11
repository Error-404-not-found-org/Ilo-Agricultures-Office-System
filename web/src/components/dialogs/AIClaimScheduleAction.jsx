import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Info,
  MapPin,
  Phone,
  Syringe,
} from "lucide-react";

import axiosInstance from "../../lib/axios";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../ui/Modal";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import UserAvatar from "../ui/UserAvatar";
import {
  getHealthVisitPeriodAvailability,
  getManilaDateKey,
} from "../../utils/healthRequestWorkflow";
import { extractFarmerNote } from "../../utils/aiRequestNote";

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

const humanizeStatus = (status) => {
  const normalized = String(status || "pending").toLowerCase().trim();
  if (normalized === "pending") return "Available";
  return String(status || "Available")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const humanizeObservation = (val) =>
  String(val || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

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

const getAIRequestPhotos = (request) => [
  ...new Set(
    [
      ...(Array.isArray(request?.photos) ? request.photos : []),
      request?.imageUrl,
      ...(Array.isArray(request?.attachments?.urls)
        ? request.attachments.urls
        : []),
    ]
      .filter((url) => typeof url === "string" && url.trim())
      .map((url) => url.trim()),
  ),
];

const AIRequestSummary = ({ request, compact = false, onPreviewImage }) => {
  const farmerName =
    request.farmerDetails?.name || request.farmer || "Unknown farmer";
  const phone =
    request.phone ||
    request.farmerPhone ||
    request.farmerDetails?.phone ||
    "Not provided";
  const animalTag =
    request.animalTag || request.earTag || request.animalId?.earTag || null;
  const animalName = request.animalName || request.animalId?.name || null;
  const species = request.species || request.animalId?.species || "Cattle";
  const breed = request.breed || request.animalId?.breed || null;
  const submittedAt = request.requestSubmissionDate || request.createdAt;

  const heatSigns = Array.isArray(request.heatSigns)
    ? request.heatSigns
    : Array.isArray(request.raw?.heatSigns)
      ? request.raw.heatSigns
      : [];

  const location =
    request.locationLabel ||
    request.location ||
    request.farmerDetails?.location ||
    "Location not provided";

  const attachmentUrls = getAIRequestPhotos(request);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const displayedPhotos = showAllPhotos
    ? attachmentUrls
    : attachmentUrls.slice(0, 4);
  const hasMorePhotos = attachmentUrls.length > 4;

  const rawNotes =
    request.raw?.comment ||
    request.taskDetails ||
    request.raw?.farmerDescription ||
    request.raw?.farmerNotes ||
    request.raw?.notes ||
    request.comment ||
    null;

  const requestNotes = extractFarmerNote(rawNotes);

  const animalTitle = animalName
    ? `${animalName} · Tag ${animalTag || "Unrecorded"}`
    : animalTag
      ? `Tag ${animalTag}`
      : "Unrecorded Animal";

  const animalSubtitle = [species, breed].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5 py-1">
      {/* Guidance Banner when in details view */}
      {!compact && (
        <div className="alert alert-info/15 border-info/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
          <Info className="h-4 w-4 shrink-0 text-info mt-0.5" />
          <div>
            <p className="font-bold text-base-content">
              Reviewing Artificial Insemination Request
            </p>
            <p className="mt-0.5 leading-relaxed text-base-content/75">
              Review the target animal, owner details, and heat signs before
              setting a visit schedule.
            </p>
          </div>
        </div>
      )}

      {/* Animal & Farmer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Target Animal Card */}
        <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
            Target Animal
          </span>
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-bold text-sm text-base-content">
                {animalTitle}
              </h4>
              <p className="text-xs text-base-content/70 mt-0.5">
                {animalSubtitle}
              </p>
            </div>
            <span className="badge badge-primary badge-sm font-semibold capitalize">
              {humanizeStatus(request.status)}
            </span>
          </div>
          {animalTag && !animalName && (
            <p className="text-[11px] text-base-content/60 mt-2">
              Ear Tag:{" "}
              <strong className="text-base-content">{animalTag}</strong>
            </p>
          )}
        </div>

        {/* Requesting Farmer Card */}
        <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
            Requesting Farmer
          </span>
          <div className="flex items-start gap-3">
            <UserAvatar
              name={farmerName}
              imageUrl={
                request.farmerImageUrl || request.raw?.farmerId?.imageUrl
              }
              size={38}
              sizeClass="h-9.5 w-9.5"
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-sm text-base-content truncate">
                {farmerName}
              </h4>
              <p className="text-xs text-base-content/70 mt-0.5 truncate flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{location}</span>
              </p>
              {phone && phone !== "Not provided" ? (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-1.5 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {phone}
                </a>
              ) : (
                <span className="text-[11px] text-base-content/50 mt-1 block">
                  Phone not provided
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Request & Observations Section (when !compact) */}
      {!compact && (
        <div className="border border-base-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
              Request & Heat Observations
            </span>
            {submittedAt && (
              <span className="text-[11px] text-base-content/60 flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                Submitted {formatRequestDate(submittedAt)}
              </span>
            )}
          </div>

          {/* Observed Heat Signs */}
          {heatSigns.length > 0 && (
            <div className="bg-base-100 border border-base-200 rounded-xl p-3">
              <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1.5">
                Observed Heat Signs
              </span>
              <div className="flex flex-wrap gap-1.5">
                {heatSigns.map((sign, idx) => (
                  <span
                    key={idx}
                    className="badge badge-sm badge-outline border-primary/40 text-primary font-semibold capitalize"
                  >
                    {humanizeObservation(sign)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Farmer Note */}
          {requestNotes ? (
            <div>
              <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                Farmer Note
              </span>
              <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium whitespace-pre-wrap">
                {requestNotes}
              </p>
            </div>
          ) : null}

          {/* Farmer Request Photos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase text-base-content/60 block ">
                Farmer request photos ({attachmentUrls.length})
              </span>
              {hasMorePhotos && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-[11px] text-primary font-semibold"
                  onClick={() => setShowAllPhotos(!showAllPhotos)}
                >
                  {showAllPhotos
                    ? "Show Less"
                    : `Show All (${attachmentUrls.length})`}
                </button>
              )}
            </div>

            {attachmentUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {displayedPhotos.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onPreviewImage?.(url)}
                    className="group relative h-20 w-20 rounded-xl overflow-hidden border border-base-300 hover:opacity-90 transition-opacity focus:outline-none cursor-pointer"
                    aria-label={`Enlarge request image ${idx + 1}`}
                  >
                    <img
                      src={url}
                      alt={`Farmer-submitted AI request photo ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    {!showAllPhotos && idx === 3 && hasMorePhotos && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 font-bold text-white text-xs">
                        +{attachmentUrls.length - 4}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-base-content/50 italic">
                No request photos submitted.
              </p>
            )}
          </div>
        </div>
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
  const requestPhotos = getAIRequestPhotos(request);
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
          className="btn btn-sm btn-ghost text-base-content/70 rounded-xl"
          onClick={closeModal}
        >
          Close
        </button>
        {canClaimAndSchedule && (
          <button
            type="button"
            className="btn btn-sm btn-primary font-bold rounded-xl gap-1.5"
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
          className="btn btn-sm btn-ghost text-base-content/70 rounded-xl mr-auto"
          onClick={() => onViewChange("details")}
          disabled={isSubmitting}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Details
        </button>
        <button
          type="button"
          className="btn btn-sm btn-ghost text-base-content/70 rounded-xl"
          disabled={isSubmitting}
          onClick={closeModal}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary font-bold rounded-xl gap-1.5"
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
        size="xl"
        icon={<Syringe className="text-primary h-5 w-5" />}
        actions={actions}
      >
        {view === "details" ? (
          <AIRequestSummary
            request={request}
            onPreviewImage={setPreviewImage}
          />
        ) : (
          <div className="space-y-5 py-1">
            <AIRequestSummary request={request} compact />

            {errors.form && (
              <div
                role="alert"
                className="alert alert-error/15 border-error/30 text-xs text-error rounded-2xl py-3 px-4"
              >
                <span>{errors.form}</span>
              </div>
            )}

            <div className="border border-base-300 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                Visit Date
              </span>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["today", "Today"],
                  ["tomorrow", "Tomorrow"],
                  ["custom", "Custom date"],
                ].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-xs font-medium hover:bg-base-200/50 transition-colors"
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
                      className="radio radio-primary radio-sm"
                    />
                    <span className="font-semibold text-base-content">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              {dateChoice === "custom" && (
                <input
                  type="date"
                  aria-label="Custom visit date"
                  className={`input input-sm mt-2 w-full rounded-xl text-xs font-medium ${errors.date ? "input-error" : ""}`}
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
                <p role="alert" className="text-xs text-error font-medium">
                  {errors.date}
                </p>
              )}
            </div>

            <div className="border border-base-300 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                Service Period
              </span>
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
                      className={`flex items-center gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2.5 text-xs font-medium transition-colors ${availability.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-base-200/50"}`}
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
                        className="radio radio-primary radio-sm"
                      />
                      <Clock3
                        size={15}
                        className="text-base-content/55"
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-base-content">
                        {label}
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedPeriodAvailability.requiresConfirmation &&
              visitPeriod ? (
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-warning checkbox-xs mt-0.5"
                    checked={samePeriodConfirmed}
                    onChange={(event) => {
                      setSamePeriodConfirmed(event.target.checked);
                      setErrors((current) => ({
                        ...current,
                        visitPeriod: null,
                      }));
                    }}
                  />
                  <span className="text-base-content font-medium">
                    I confirm I can still attend during this current service
                    period.
                  </span>
                </label>
              ) : null}
              {errors.visitPeriod && (
                <p role="alert" className="text-xs text-error font-medium">
                  {errors.visitPeriod}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
      <ImagePreviewModal
        images={requestPhotos}
        selectedImage={previewImage}
        onSelectImage={setPreviewImage}
        onClose={() => setPreviewImage(null)}
        title="Farmer request photo"
      />
    </>
  );
}
