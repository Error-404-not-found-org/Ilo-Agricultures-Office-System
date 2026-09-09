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
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Modal from "../ui/Modal";
import ImagePreviewModal from "../ui/ImagePreviewModal";
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

const Value = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-base-content/55">{label}</dt>
    <dd className="mt-1 font-semibold text-base-content">{children}</dd>
  </div>
);

const DetailSection = ({ title, children }) => (
  <section>
    <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/55">
      {title}
    </h4>
    <dl className="grid gap-x-5 gap-y-4 rounded-box border border-base-300 bg-base-100 p-4 sm:grid-cols-2">
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
  <section aria-labelledby="record-attachments-title">
    <h4
      id="record-attachments-title"
      className="mb-2 text-xs font-bold uppercase tracking-wider text-base-content/55"
    >
      Attachments
    </h4>
    <p className="mb-2 text-sm text-base-content/60">
      {attachments.length} saved {attachments.length === 1 ? "photo" : "photos"}
    </p>
    <ul className="list overflow-hidden rounded-box border border-base-300 bg-base-100">
      {attachments.map((attachment) => (
        <li
          key={attachment.url}
          className="list-row items-center gap-2 border-b border-base-300 px-3 py-2.5 last:border-b-0 sm:gap-3"
        >
          <FileImage
            size={18}
            className="shrink-0 text-base-content/50"
            aria-hidden="true"
          />
          <button
            type="button"
            className="list-col-grow min-w-0 truncate text-left text-sm font-semibold text-base-content hover:underline focus-visible:underline"
            onClick={() => onPreview(attachment)}
          >
            {attachment.displayName}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-1"
            onClick={() => onPreview(attachment)}
            aria-label={`View ${attachment.displayName}`}
          >
            <Eye size={16} aria-hidden="true" />
            <span className="hidden sm:inline">View</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square btn-sm"
            onClick={() => onDownload(attachment)}
            disabled={downloadingUrl === attachment.url}
            aria-label={`Download ${attachment.displayName}`}
          >
            {downloadingUrl === attachment.url ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Download size={16} aria-hidden="true" />
            )}
          </button>
        </li>
      ))}
    </ul>
    {downloadError && (
      <div role="alert" className="alert alert-error alert-soft mt-2 text-sm">
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
  const isRequestBacked = ["health_request", "ai_request"].includes(
    record.sourceKind,
  );
  const isHealthRequest = record.sourceKind === "health_request";

  return (
    <div className="space-y-6">
      <section className="card card-border bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-box bg-primary/10 p-3 text-primary">
              <PawPrint size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h4 className="card-title text-base">
                {animal.animalId || animal.earTag || "Animal not recorded"}
              </h4>
              <p className="text-sm text-base-content/65">
                {record.farmerId?.name || record.farmer?.name || "Farmer not recorded"}
              </p>
            </div>
          </div>
          <dl className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-3">
            <Value label="Ear tag">{valueOrRecorded(animal.earTag)}</Value>
            <Value label="Species">{valueOrRecorded(animal.species)}</Value>
            <Value label="Breed">{valueOrRecorded(animal.breed)}</Value>
          </dl>
        </div>
      </section>

      <DetailSection
        title={isRequestBacked ? "Request details" : "Official service details"}
      >
        <Value
          label={details.serviceDateLabel || record.dateLabel || "Service date"}
        >
          {formatDate(details.serviceDate || record.date, record.datePrecision)}
        </Value>
        <Value label="Performed by">
          {record.technician?.name || details.technician || "Not recorded"}
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
            <Value label="Sire">
              {[details.sireBreed, details.sireCode]
                .filter(Boolean)
                .join(" · ") || "Not recorded"}
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
                  .join(" � ") || "Details not recorded"}
              </Value>
            ))}
          </DetailSection>
        )}

      {((!isRequestBacked && (details.technicianNote || details.advice)) ||
        details.farmerNotes) && (
        <DetailSection title="Notes">
          {!isRequestBacked && details.technicianNote && (
            <Value label="Technician notes">{details.technicianNote}</Value>
          )}
          {!isRequestBacked && details.advice && (
            <Value label="Advice">{details.advice}</Value>
          )}
          {details.farmerNotes && (
            <Value label="Farmer notes">{details.farmerNotes}</Value>
          )}
        </DetailSection>
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
  <div className="space-y-6 animate-pulse">
    <section className="card card-border bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-box bg-base-200" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-4 w-32 rounded bg-base-300" />
            <div className="h-3 w-40 rounded bg-base-200" />
          </div>
        </div>
        <div className="grid gap-x-5 gap-y-3 sm:grid-cols-3 mt-1">
          <div>
            <div className="mb-1.5 h-3 w-12 rounded bg-base-200" />
            <div className="h-4 w-20 rounded bg-base-300" />
          </div>
          <div>
            <div className="mb-1.5 h-3 w-14 rounded bg-base-200" />
            <div className="h-4 w-24 rounded bg-base-300" />
          </div>
          <div>
            <div className="mb-1.5 h-3 w-12 rounded bg-base-200" />
            <div className="h-4 w-16 rounded bg-base-300" />
          </div>
        </div>
      </div>
    </section>

    <section>
      <div className="mb-2.5 h-3 w-32 rounded bg-base-300/60" />
      <div className="grid gap-x-5 gap-y-4 rounded-box border border-base-300 bg-base-100 p-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="mb-1.5 h-3 w-20 rounded bg-base-200" />
            <div className="h-4 w-32 rounded bg-base-300" />
          </div>
        ))}
      </div>
    </section>
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
