import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ClipboardCheck,
  Download,
  Eye,
  FileImage,
  FileText,
  HeartPulse,
  Paperclip,
  PawPrint,
} from "lucide-react";
import axiosInstance from "../../lib/axios";
import Modal from "../ui/Modal";
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
                {record.farmerId?.name || "Farmer not recorded"}
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

      <DetailSection title="Official service details">
        <Value label={details.serviceDateLabel || record.dateLabel || "Service date"}>
          {formatDate(details.serviceDate || record.date, record.datePrecision)}
        </Value>
        <Value label="Technician">
          {record.technician?.name || details.technician || "Not recorded"}
        </Value>
        {record.type === "ai" && (
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
              label={details.isDirectHealthService ? "Service type" : "Request type"}
            >
              {humanize(details.serviceType || details.requestType)}
            </Value>
            <Value label="Treatment or service">
              {details.treatment || details.advice || "Not recorded"}
            </Value>
            <Value label="Diagnosis">{valueOrRecorded(details.diagnosis)}</Value>
            <Value label="Medication">{valueOrRecorded(details.medicine)}</Value>
            <Value label="Dosage">{valueOrRecorded(details.dosage)}</Value>
            <Value label="Follow-up date">
              {formatDate(details.followUpDate)}
            </Value>
          </>
        )}
        {record.type === "pregnancy" && (
          <>
            <Value label="Diagnosis result">
              {valueOrRecorded(details.outcome)}
            </Value>
            <Value label="Check method">
              {humanize(details.diagnosticMethod)}
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
            <Value label="Outcome">
              {humanize(details.calvingOutcome)}
            </Value>
            <Value label="Calving ease">
              {valueOrRecorded(details.calvingEase)}
            </Value>
            <Value label="Number of calves">
              {valueOrRecorded(details.numberOfCalves)}
            </Value>
            <Value label="Living / stillborn">
              {details.livingCalfCount == null && details.stillbornCount == null
                ? "Not recorded"
                : String(details.livingCalfCount || 0) + " / " + String(details.stillbornCount || 0)}
            </Value>
          </>
        )}
      </DetailSection>

      {record.type === "calving" && Array.isArray(details.calves) && details.calves.length > 0 && (
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

      {(details.technicianNote || details.advice || details.farmerNotes) && (
        <DetailSection title="Notes">
          {details.technicianNote && (
            <Value label="Technician notes">{details.technicianNote}</Value>
          )}
          {details.advice && <Value label="Advice">{details.advice}</Value>}
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

      <div className="alert alert-info alert-soft text-sm">
        <FileText size={18} aria-hidden="true" />
        <span>
          Official record ID: <span className="font-mono">{record.sourceId}</span>
        </span>
      </div>
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

  const { animalId, recordKind, recordId } = recordIdentity || {};
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["technician", "official-record-detail", animalId, recordKind, recordId],
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
  const title = record?.title || "Official record";
  const icon =
    record?.type === "health" ? (
      <HeartPulse size={20} />
    ) : record?.type === "pregnancy" ? (
      <ClipboardCheck size={20} />
    ) : (
      <CalendarDays size={20} />
    );

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
        subtitle="Read-only official record"
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
            The official record could not be loaded. Please try again.
          </div>
        )}
        {!isLoading && !isError && record && (
          <RecordDetails
            record={record}
            attachments={attachments}
            onPreview={(attachment) => {
              setDownloadError("");
              setPreviewAttachment(attachment);
            }}
            onDownload={downloadAttachment}
            downloadingUrl={downloadingUrl}
            downloadError={downloadError}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment?.displayName || "Attachment preview"}
        subtitle="Attachment preview"
        icon={<Paperclip size={20} />}
        size="4xl"
        closeOnEscape
        closeOnBackdropClick
        actions={
          <>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => downloadAttachment(previewAttachment)}
              disabled={downloadingUrl === previewAttachment?.url}
            >
              {downloadingUrl === previewAttachment?.url ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              Download
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setPreviewAttachment(null)}
            >
              Close preview
            </button>
          </>
        }
      >
        {previewAttachment && (
          <div className="space-y-3">
            <figure className="flex min-h-48 items-center justify-center overflow-hidden rounded-box bg-base-200 p-2 sm:min-h-72">
              <img
                src={previewAttachment.url}
                alt={`Preview of ${previewAttachment.displayName}`}
                className="max-h-[58vh] max-w-full object-contain"
              />
            </figure>
            {downloadError && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                {downloadError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
