import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  Download,
  Eye,
  FileImage,
  HeartPulse,
  PawPrint,
  Phone,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Modal from "../ui/Modal";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { formatFarmerLocation } from "../dialogs/PregnancyLossReviewModal";
import {
  downloadRecordAttachment,
  normalizeRecordAttachments,
} from "./officialRecordAttachments";

const formatDate = (value, precision = "date") => {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: precision === "datetime" ? "medium" : "long",
    ...(precision === "datetime" ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Manila",
  }).format(date);
};

const valueOrRecorded = (value) =>
  value === null || value === undefined || value === ""
    ? "Not recorded"
    : String(value);

const humanize = (value) =>
  valueOrRecorded(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDiagnosticMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["palpation", "rectal_palpation"].includes(normalized)) {
    return "Manual Palpation";
  }
  if (["visual_observation", "clinical_examination"].includes(normalized)) {
    return "Visual Assessment";
  }
  if (normalized === "farmer_interview") return "Farmer Interview";
  if (["other", "other_approved"].includes(normalized)) return "Other";
  return humanize(value);
};

const Value = ({ label, children, className = "" }) => (
  <div className={`bg-base-100 border border-base-200 rounded-xl p-3 ${className}`}>
    <dt className="text-[10px] font-semibold uppercase text-base-content/60 block">
      {label}
    </dt>
    <dd className="text-xs font-bold text-base-content mt-0.5 break-words">
      {children}
    </dd>
  </div>
);

const DetailSection = ({ title, children, className = "" }) => (
  <section className={`border border-base-300 rounded-2xl p-4 space-y-3 bg-base-200/50 ${className}`}>
    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
      {title}
    </h4>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {children}
    </dl>
  </section>
);

const AttachmentsSection = ({
  attachments,
  onPreview,
  onDownload,
  downloadingUrl,
  downloadError,
}) => (
  <section
    aria-labelledby="record-attachments-title"
    className="border border-base-300 rounded-2xl p-4 space-y-3 bg-base-200/50"
  >
    <div className="flex items-center justify-between">
      <h4
        id="record-attachments-title"
        className="text-[10px] font-extrabold uppercase tracking-widest text-primary block"
      >
        Attachments
      </h4>
      <span className="text-[11px] text-base-content/60">
        {attachments.length} saved {attachments.length === 1 ? "photo" : "photos"}
      </span>
    </div>
    <ul className="overflow-hidden rounded-xl border border-base-200 bg-base-100 divide-y divide-base-200">
      {attachments.map((attachment) => (
        <li
          key={attachment.url}
          className="flex items-center gap-2 px-3 py-2.5 sm:gap-3"
        >
          <FileImage
            size={18}
            className="shrink-0 text-base-content/50"
            aria-hidden="true"
          />
          <button
            type="button"
            className="flex-1 min-w-0 truncate text-left text-xs font-semibold text-base-content hover:underline focus-visible:underline"
            onClick={() => onPreview(attachment)}
          >
            {attachment.displayName}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => onPreview(attachment)}
            aria-label={`View ${attachment.displayName}`}
          >
            <Eye size={14} aria-hidden="true" />
            <span className="hidden sm:inline text-xs">View</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-xs"
            onClick={() => onDownload(attachment)}
            disabled={downloadingUrl === attachment.url}
            aria-label={`Download ${attachment.displayName}`}
          >
            {downloadingUrl === attachment.url ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Download size={14} aria-hidden="true" />
            )}
          </button>
        </li>
      ))}
    </ul>
    {downloadError && (
      <div role="alert" className="alert alert-error alert-soft mt-2 text-xs">
        {downloadError}
      </div>
    )}
  </section>
);

const RecordDetails = ({
  record,
  attachments = [],
  onPreview,
  onDownload,
  downloadingUrl,
  downloadError,
}) => {
  const details = record.details || {};
  const animal = record.animalId || {};
  const farmer = record.farmerId || record.farmer || {};
  const farmerPhone =
    farmer.contactNumber ||
    farmer.phone ||
    farmer.phoneNumber ||
    "";
  const isRequestBacked = ["health_request", "ai_request"].includes(
    record.sourceKind,
  );
  const isHealthRequest = record.sourceKind === "health_request";

  return (
    <div className="space-y-5 py-1">
      {/* Animal & Farmer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Animal Details */}
        <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
            Animal Details
          </span>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-bold text-sm text-base-content">
                {animal.animalId || animal.earTag || "Animal not recorded"}
              </h4>
              <p className="text-xs text-base-content/70 mt-0.5">
                {[animal.breed, animal.species].filter(Boolean).join(" · ") ||
                  "Breed not recorded"}
              </p>
            </div>
            {animal.status && (
              <span className="badge badge-success badge-sm font-semibold">
                {humanize(animal.status)}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-base-300/60">
            <div>
              <dt className="text-[10px] font-semibold uppercase text-base-content/60 block">
                Ear tag
              </dt>
              <dd className="text-xs font-bold text-base-content block truncate">
                {valueOrRecorded(animal.earTag)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase text-base-content/60 block">
                Species
              </dt>
              <dd className="text-xs font-bold text-base-content block truncate">
                {valueOrRecorded(animal.species)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase text-base-content/60 block">
                Breed
              </dt>
              <dd className="text-xs font-bold text-base-content block truncate">
                {valueOrRecorded(animal.breed)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Farmer Information */}
        <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
            Farmer
          </span>
          <h4 className="font-bold text-sm text-base-content">
            {farmer.name || "Farmer not recorded"}
          </h4>
          <p className="text-xs text-base-content/70 mt-0.5">
            {formatFarmerLocation(farmer)}
          </p>
          {farmerPhone ? (
            <a
              href={`tel:${farmerPhone}`}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold mt-2 hover:underline"
            >
              <Phone className="h-3 w-3" />
              {farmerPhone}
            </a>
          ) : null}
        </div>
      </div>

      <DetailSection
        title={isRequestBacked ? "Request details" : "Official service details"}
      >
        <Value
          label={details.serviceDateLabel || record.dateLabel || "Service date"}
        >
          {formatDate(details.serviceDate || record.date, record.datePrecision)}
        </Value>
        {isRequestBacked && (
          <Value label="Status">{humanize(details.status)}</Value>
        )}
        {isRequestBacked && details.cancellationReason && (
          <Value label="Cancellation reason">{details.cancellationReason}</Value>
        )}
        {isRequestBacked && details.cancellationResponseReason && (
          <Value label="Closure note">{details.cancellationResponseReason}</Value>
        )}
        {record.type === "ai" && !isRequestBacked && (
          <>
            <Value label="Attempt">
              {details.attemptNumber == null
                ? "Not recorded"
                : "#" + details.attemptNumber}
            </Value>
            <Value label="Sire breed">
              {valueOrRecorded(details.sireBreed)}
            </Value>
            <Value label="Sire code">
              {valueOrRecorded(details.sireCode)}
            </Value>
            <Value label="Estrus">{valueOrRecorded(details.estrus)}</Value>
            <Value label="Semen doses used">
              {valueOrRecorded(details.semenDosesUsed)}
            </Value>
            <Value label="Outcome">{humanize(details.outcome)}</Value>
            <Value label="Record status">{humanize(details.status)}</Value>
          </>
        )}
        {record.type === "health" && (
          <>
            <Value
              label={
                details.isDirectHealthService ? "Service type" : "Request type"
              }
            >
              {humanize(details.serviceType || details.requestType)}
            </Value>
            {Array.isArray(details.requestDetails?.observedSigns) &&
              details.requestDetails.observedSigns.length > 0 && (
                <Value label="Observed signs">
                  {details.requestDetails.observedSigns
                    .map((sign) => humanize(sign))
                    .join(", ")}
                </Value>
              )}
            {details.requestDetails?.farmerDescription && (
              <Value label="Farmer description">
                {details.requestDetails.farmerDescription}
              </Value>
            )}
            {details.advice && <Value label="Advice">{details.advice}</Value>}
            {details.pickupItem && (
              <Value label="Item available for pickup">{details.pickupItem}</Value>
            )}
            {details.pickupAvailable === true && (
              <Value label="Availability">Available for pickup</Value>
            )}
            {details.pickupInstructions && (
              <Value label="Pickup instructions">{details.pickupInstructions}</Value>
            )}
            {details.dosageOrUseInstructions && (
              <Value label="Dosage / Use instructions">
                {details.dosageOrUseInstructions}
              </Value>
            )}
            {details.withdrawalGuidance && (
              <Value label="Withdrawal guidance">{details.withdrawalGuidance}</Value>
            )}
            {(details.withdrawalPeriod || details.withdrawalPeriodDays !== undefined) && (
              <Value label="Withdrawal period">
                {details.withdrawalPeriod ||
                  (details.withdrawalPeriodDays !== undefined ? `${details.withdrawalPeriodDays} ${details.withdrawalPeriodDays === 1 ? "day" : "days"}` : "")}
              </Value>
            )}
            {details.withdrawalEndDate && (
              <Value label="Withdrawal ends">
                {formatDate(details.withdrawalEndDate)}
              </Value>
            )}
            {!isRequestBacked && details.cancellationReason && (
              <Value label="Cancellation reason">{details.cancellationReason}</Value>
            )}
            {!isRequestBacked && details.cancellationResponseReason && (
              <Value label="Closure note">{details.cancellationResponseReason}</Value>
            )}
            {!isHealthRequest && (
              <>
                <Value label="Treatment or service">
                  {details.treatment || "Not recorded"}
                </Value>
                <Value label="Diagnosis">{valueOrRecorded(details.diagnosis)}</Value>
                <Value label="Medication">{valueOrRecorded(details.medicine)}</Value>
                <Value label="Dosage">{valueOrRecorded(details.dosage)}</Value>
              </>
            )}
            {details.followUpDate && (
              <Value label="Follow-up date">{formatDate(details.followUpDate)}</Value>
            )}
          </>
        )}
        {record.type === "pregnancy" && (
          <>
            <Value label="Diagnosis result">
              {valueOrRecorded(details.outcome)}
            </Value>
            <Value label="Check method">
              {formatDiagnosticMethod(details.diagnosticMethod)}
            </Value>
            <Value label="Linked AI attempt">
              {details.relatedAttempt == null
                ? "Not recorded"
                : "#" + details.relatedAttempt}
            </Value>
            <Value label="Target calving date">
              {formatDate(details.targetCalvingDate)}
            </Value>
          </>
        )}
        {record.type === "calving" && (
          <>
            <Value label="Outcome">{humanize(details.calvingOutcome)}</Value>
            <Value label="Calving ease">
              {details.calvingOutcome === "abortion"
                ? "Not applicable"
                : valueOrRecorded(details.calvingEase)}
            </Value>
            <Value label="Number of calves">
              {valueOrRecorded(details.numberOfCalves)}
            </Value>
            <Value label="Living / stillborn">
              {details.livingCalfCount == null && details.stillbornCount == null
                ? "Not recorded"
                : String(details.livingCalfCount || 0) +
                  " / " +
                  String(details.stillbornCount || 0)}
            </Value>
          </>
        )}
      </DetailSection>

      {record.type === "calving" &&
        Array.isArray(details.calves) &&
        details.calves.length > 0 && (
          <DetailSection title="Calves">
            {details.calves.map((calf, index) => (
              <Value
                key={calf.animalId || calf.earTag || index}
                label={"Calf " + String(index + 1)}
              >
                {[calf.earTag ? "Tag " + calf.earTag : null, calf.sex]
                  .filter(Boolean)
                  .join(" · ") || "Details not recorded"}
              </Value>
            ))}
          </DetailSection>
        )}

      {((!isRequestBacked && (details.technicianNote || details.advice)) ||
        details.farmerNotes) && (
        <section className="border border-base-300 rounded-2xl p-4 space-y-3 bg-base-200/50">
          <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
            Notes & Observations
          </h4>
          <div className="space-y-2.5">
            {!isRequestBacked && details.technicianNote && (
              <div>
                <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                  Technician notes
                </span>
                <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium">
                  {details.technicianNote}
                </p>
              </div>
            )}
            {!isRequestBacked && details.advice && (
              <div>
                <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                  Advice
                </span>
                <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium">
                  {details.advice}
                </p>
              </div>
            )}
            {details.farmerNotes && (
              <div>
                <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                  Farmer notes
                </span>
                <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium">
                  {details.farmerNotes}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {attachments.length > 0 && (
        <AttachmentsSection
          attachments={attachments}
          onPreview={onPreview}
          onDownload={onDownload}
          downloadingUrl={downloadingUrl}
          downloadError={downloadError}
        />
      )}
    </div>
  );
};

const RecordSkeleton = () => (
  <div className="space-y-5 py-1 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4 space-y-3">
        <div className="h-3 w-24 rounded bg-base-300" />
        <div className="h-4 w-36 rounded bg-base-300" />
        <div className="h-3 w-28 rounded bg-base-200" />
      </div>
      <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4 space-y-3">
        <div className="h-3 w-24 rounded bg-base-300" />
        <div className="h-4 w-36 rounded bg-base-300" />
        <div className="h-3 w-28 rounded bg-base-200" />
      </div>
    </div>
    <div className="border border-base-300 rounded-2xl p-4 space-y-3 bg-base-200/50">
      <div className="h-3 w-32 rounded bg-base-300" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-base-100 border border-base-200 rounded-xl p-3 space-y-2">
            <div className="h-2.5 w-16 rounded bg-base-200" />
            <div className="h-3.5 w-24 rounded bg-base-300" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default function OfficialRecordDetailModal({ recordIdentity, onClose }) {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [downloadingUrl, setDownloadingUrl] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [retainedRecordIdentity, setRetainedRecordIdentity] =
    useState(recordIdentity);
  if (
    recordIdentity &&
    (recordIdentity.animalId !== retainedRecordIdentity?.animalId ||
      recordIdentity.recordKind !== retainedRecordIdentity?.recordKind ||
      recordIdentity.recordId !== retainedRecordIdentity?.recordId)
  ) {
    setRetainedRecordIdentity(recordIdentity);
  }

  // Keep the selected record rendered while the native dialog finishes its
  // exit transition. Clearing the query identity here collapses the body first.
  const visibleRecordIdentity = recordIdentity || retainedRecordIdentity;
  const { animalId, recordKind, recordId } = visibleRecordIdentity || {};
  const {
    data: response,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "technician",
      "official-record-detail",
      animalId,
      recordKind,
      recordId,
    ],
    queryFn: async () => {
      const res = await axiosInstance.get(
        "/animals/" + animalId + "/records/" + recordKind + "/" + recordId,
      );
      return res.data?.data || res.data;
    },
    enabled: Boolean(animalId && recordKind && recordId),
  });

  const record = response || null;
  const attachments = record ? normalizeRecordAttachments(record) : [];
  const title = record?.title || "Record details";
  const icon =
    record?.type === "health" ? (
      <HeartPulse size={20} />
    ) : record?.type === "pregnancy" ? (
      <ClipboardCheck size={20} />
    ) : (
      <CalendarDays size={20} />
    );
  const openAttachmentPreview = (attachment) => {
    setDownloadError("");
    setPreviewAttachment(attachment);
  };

  const closeRecord = () => {
    setPreviewAttachment(null);
    setDownloadError("");
    onClose?.();
  };

  const downloadAttachment = async (attachment) => {
    if (!attachment) return;
    setDownloadingUrl(attachment.url);
    setDownloadError("");
    try {
      await downloadRecordAttachment(attachment);
    } catch {
      setDownloadError(
        "This attachment could not be downloaded. Please check your connection and try again.",
      );
    } finally {
      setDownloadingUrl("");
    }
  };

  return (
    <>
      <Modal
        isOpen={Boolean(recordIdentity)}
        onClose={closeRecord}
        title={title}
        subtitle="Read-only saved activity"
        icon={icon}
        size="xl"
        closeOnEscape
        closeOnBackdropClick
        actions={
          <button type="button" className="btn btn-sm" onClick={closeRecord}>
            Close
          </button>
        }
      >
        {isLoading && <RecordSkeleton />}
        {isError && (
          <div role="alert" className="alert alert-error alert-soft">
            This saved activity could not be loaded. Please try again.
          </div>
        )}
        {!isLoading && !isError && record && (
          <RecordDetails
            record={record}
            attachments={attachments}
            onPreview={openAttachmentPreview}
            onDownload={downloadAttachment}
            downloadingUrl={downloadingUrl}
            downloadError={downloadError}
          />
        )}
      </Modal>

      <ImagePreviewModal
        images={attachments}
        selectedImage={previewAttachment}
        onSelectImage={setPreviewAttachment}
        onClose={() => setPreviewAttachment(null)}
        title="Attachment preview"
        onDownload={downloadAttachment}
        downloadingUrl={downloadingUrl}
        errorMessage={downloadError}
      />
    </>
  );
}
