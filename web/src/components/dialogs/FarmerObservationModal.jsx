import {
  CalendarDays,
  CheckCircle2,
  ImageOff,
  MessageSquareText,
} from "lucide-react";
import Modal from "../ui/Modal";
import {
  formatObservationValue,
  getBreedingObservationMeta,
  normalizeFarmerObservation,
} from "../../utils/breedingObservation";

const formatReportedAt = (value) => {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function FarmerObservationModal({ isOpen, onClose, request }) {
  const observation = normalizeFarmerObservation(request);
  const observationMeta = getBreedingObservationMeta(observation.reportType);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Farmer observation details"
      type="info"
      size="xl"
      actions={
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-5">
        <div className="alert alert-warning alert-soft" role="note">
          <span>
            This is a farmer observation for technician review. It is not an
            official pregnancy diagnosis or reproductive outcome.
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-box bg-base-200 p-4">
            <dt className="text-xs font-semibold text-base-content/60">
              Farmer
            </dt>
            <dd className="mt-1 font-bold text-base-content">
              {request?.farmer || "Farmer not available"}
            </dd>
          </div>
          <div className="rounded-box bg-base-200 p-4">
            <dt className="text-xs font-semibold text-base-content/60">
              Animal
            </dt>
            <dd className="mt-1 font-bold text-base-content">
              Tag #{request?.animalTag || "Not recorded"}
            </dd>
          </div>
          <div className="rounded-box bg-base-200 p-4">
            <dt className="text-xs font-semibold text-base-content/60">
              Farmer observation
            </dt>
            <dd className="mt-2">
              <span
                className={`badge badge-soft ${observationMeta.badgeClass}`}
              >
                {observationMeta.observationLabel}
              </span>
            </dd>
          </div>
          <div className="rounded-box bg-base-200 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-base-content/60">
              <CalendarDays size={14} aria-hidden="true" />
              Submitted
            </dt>
            <dd className="mt-1 font-semibold text-base-content/80">
              {formatReportedAt(observation.reportedAt)}
            </dd>
          </div>
        </dl>

        <section aria-labelledby="farmer-observation-signs">
          <h4
            id="farmer-observation-signs"
            className="flex items-center gap-2 font-bold text-base-content"
          >
            <CheckCircle2 size={17} className="text-primary" aria-hidden="true" />
            Signs observed
          </h4>
          {observation.signs.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {observation.signs.map((sign) => (
                <span key={sign} className="badge badge-outline">
                  {formatObservationValue(sign)}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-base-content/60">
              No signs were selected by the farmer.
            </p>
          )}
        </section>

        <section aria-labelledby="farmer-observation-notes">
          <h4
            id="farmer-observation-notes"
            className="flex items-center gap-2 font-bold text-base-content"
          >
            <MessageSquareText
              size={17}
              className="text-primary"
              aria-hidden="true"
            />
            Farmer notes
          </h4>
          <p className="mt-3 rounded-box bg-base-200 p-4 text-sm text-base-content/70 whitespace-pre-wrap">
            {observation.notes ||
              observation.taskNotes ||
              "No notes were submitted by the farmer."}
          </p>
        </section>

        <section aria-labelledby="farmer-observation-photos">
          <h4
            id="farmer-observation-photos"
            className="font-bold text-base-content"
          >
            Submitted photos
          </h4>
          {observation.evidencePhotos.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {observation.evidencePhotos.map((photo, index) => (
                <figure
                  key={`${photo}-${index}`}
                  className="overflow-hidden rounded-box bg-base-200"
                >
                  <img
                    src={photo}
                    alt={`Farmer-submitted breeding observation ${index + 1}`}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-box bg-base-200 p-4 text-sm text-base-content/60">
              <ImageOff size={20} aria-hidden="true" />
              No photos were submitted with this observation.
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
