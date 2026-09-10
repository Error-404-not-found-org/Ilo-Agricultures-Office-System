import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Phone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "../../lib/axios";
import Modal from "../ui/Modal";
import ImagePreviewModal from "../ui/ImagePreviewModal";
import { imagePreviewUrl } from "../ui/imagePreviewUrl";

const formatDate = (val) => {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const isPlaceholder = (val) => {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.length === 0 ||
    [
      "na",
      "n/a",
      "none",
      "notset",
      "unknown",
      "null",
      "undefined",
      "not provided",
      "location not provided",
    ].includes(trimmed)
  );
};

const cleanString = (val) => (typeof val === "string" ? val.trim() : "");

const firstObject = (val) => {
  if (Array.isArray(val)) {
    const first = val[0];
    return first && typeof first === "object" ? first : {};
  }
  return val && typeof val === "object" ? val : {};
};

// eslint-disable-next-line react-refresh/only-export-components
export const formatFarmerLocation = (
  farmerOrLocation,
  fallback = "Location not provided",
) => {
  if (!farmerOrLocation) return fallback;

  if (typeof farmerOrLocation === "string") {
    return isPlaceholder(farmerOrLocation) ? fallback : farmerOrLocation.trim();
  }

  if (typeof farmerOrLocation !== "object") return fallback;

  const candidate = farmerOrLocation;
  const address = firstObject(
    candidate.address ||
      (candidate.street || candidate.barangay || candidate.city || candidate.province
        ? candidate
        : null),
  );
  const farmLocation = firstObject(
    candidate.farmLocation ||
      (candidate.detectedAddress || candidate.landmark ? candidate : null),
  );
  const addressArea = firstObject(address.administrativeArea);
  const farmArea = firstObject(farmLocation.administrativeArea);

  // Direct string labels
  const directLabel =
    cleanString(candidate.farmLocationLabel) ||
    cleanString(candidate.location) ||
    cleanString(typeof candidate.address === "string" ? candidate.address : null) ||
    cleanString(farmLocation.detectedAddress) ||
    cleanString(address.detectedAddress) ||
    cleanString(farmLocation.landmark) ||
    cleanString(address.landmark);

  // Structured address components
  const street = cleanString(address.street || address.houseNumber);
  const barangay = cleanString(
    addressArea.barangayName ||
      address.barangay ||
      farmArea.barangayName ||
      farmLocation.barangay,
  );
  const municipality = cleanString(
    addressArea.municipalityName ||
      address.municipality ||
      address.city ||
      farmArea.municipalityName ||
      farmLocation.municipality ||
      farmLocation.city,
  );
  const province = cleanString(
    addressArea.provinceName ||
      address.province ||
      farmArea.provinceName ||
      farmLocation.province,
  );

  const rawParts = [street, barangay, municipality, province].filter(
    (p) => !isPlaceholder(p),
  );

  const seen = new Set();
  const parts = [];
  for (const part of rawParts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      parts.push(part);
    }
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (directLabel && !isPlaceholder(directLabel)) {
    return directLabel;
  }

  return fallback;
};

export default function PregnancyLossReviewModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState("");
  const [confirmLossPending, setConfirmLossPending] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Extract reference IDs
  const reportId =
    task?.context?.reportId ||
    task?.metadata?.reportId ||
    task?.pregnancyLossReport?._id ||
    task?.reportId;

  // Query full report details from backend
  const { data: reportData, isLoading: isReportLoading } = useQuery({
    queryKey: ["technician", "pregnancy-loss-report", reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const res = await axiosInstance.get(
        `/technician/pregnancy-loss-reports/${encodeURIComponent(reportId)}`,
      );
      return res.data?.report || null;
    },
    enabled: Boolean(isOpen && reportId),
  });

  const report = reportData || task?.pregnancyLossReport || task?.context || {};
  const animal =
    (typeof report?.animal === "object" ? report.animal : null) ||
    (typeof report?.animalId === "object" ? report.animalId : null) ||
    task?.animal ||
    task?.context?.animal ||
    (Array.isArray(task?.animalIds) ? task?.animalIds[0] : null);
  const farmer =
    (typeof report?.farmer === "object" ? report.farmer : null) ||
    (typeof report?.farmerId === "object" ? report.farmerId : null) ||
    task?.farmer ||
    task?.context?.farmer ||
    task?.farmerId;
  const pregnancy =
    (typeof report?.pregnancy === "object" ? report.pregnancy : null) ||
    (typeof report?.pregnancyId === "object" ? report.pregnancyId : null) ||
    task?.pregnancy ||
    task?.context?.pregnancy;

  const farmerPhone =
    typeof farmer?.phoneNumber === "string" && farmer.phoneNumber.trim()
      ? farmer.phoneNumber.trim()
      : typeof farmer?.phone === "string" && farmer.phone.trim()
        ? farmer.phone.trim()
        : typeof farmer?.contactNumber === "string" && farmer.contactNumber.trim()
          ? farmer.contactNumber.trim()
          : null;

  const farmerLocation = formatFarmerLocation(farmer, "Location not provided");

  const farmerName =
    (typeof farmer?.name === "string" && farmer.name.trim()) ||
    (typeof farmer?.fullName === "string" && farmer.fullName.trim()) ||
    [farmer?.firstName, farmer?.lastName]
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .join(" ") ||
    "Farmer";

  const animalEarTag =
    (typeof animal?.earTag === "string" && animal.earTag.trim()) ||
    (typeof animal?.tag === "string" && animal.tag.trim()) ||
    "";
  const animalName =
    (typeof animal?.name === "string" && animal.name.trim()) || "";
  const animalDisplayName =
    animalName && animalEarTag
      ? `${animalName} (${animalEarTag})`
      : animalEarTag || animalName || "Ear Tag N/A";

  const animalBreed =
    (typeof animal?.breed === "string" && animal.breed.trim()) || "Crossbreed";
  const animalSpecies =
    (typeof animal?.species === "string" && animal.species.trim()) || "Cattle";
  const animalReproductiveStatus =
    (typeof animal?.reproductiveStatus === "string" &&
      animal.reproductiveStatus.trim()) ||
    "Pregnant";

  const observationDate = report?.observationDate || task?.context?.observationDate;
  const reportedAt = report?.reportedAt || task?.context?.reportedAt || task?.createdAt;
  const rawNotes = report?.notes || task?.context?.notes;
  const notes = typeof rawNotes === "string" ? rawNotes : "No notes provided by farmer.";
  const evidencePhotos = Array.isArray(report?.evidencePhotos)
    ? report.evidencePhotos
    : Array.isArray(task?.context?.evidencePhotos)
      ? task.context.evidencePhotos
      : [];

  const isResolved =
    ["confirmed", "not_confirmed"].includes(report?.status) ||
    task?.status === "Completed";
  const isNeedsFollowUp = report?.status === "needs_visit";

  const reviewMutation = useMutation({
    mutationFn: async ({ outcome, notes }) => {
      const res = await axiosInstance.post(
        `/technician/pregnancy-loss-reports/${encodeURIComponent(reportId)}/review`,
        {
          outcome,
          reviewNotes: notes,
        },
      );
      return res.data;
    },
    onSuccess: (_, variables) => {
      if (variables.outcome === "confirm_loss") {
        toast.success("Pregnancy loss confirmed.");
      } else if (variables.outcome === "needs_visit") {
        toast.success("Pregnancy loss report kept open for follow-up.");
      } else {
        toast.success(
          "Pregnancy loss not confirmed. Pregnancy monitoring will continue.",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["technician", "workQueue"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["technician", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["animals"] });
      queryClient.invalidateQueries({ queryKey: ["animal-records"] });

      if (onSuccess) onSuccess();
      handleClose();
    },
    onError: (err) => {
      toast.error(
        err.response?.data?.message || "Failed to submit pregnancy loss review.",
      );
    },
  });

  const handleClose = () => {
    setReviewNotes("");
    setConfirmLossPending(false);
    setSelectedPhoto(null);
    onClose();
  };

  const executeReview = (outcome) => {
    reviewMutation.mutate({
      outcome,
      notes: reviewNotes.trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Pregnancy Loss Review"
        subtitle="Review reported signs and record the outcome"
        size="xl"
        icon={<AlertTriangle className="text-warning h-5 w-5" />}
      >
        {isReportLoading ? (
          <div className="flex h-48 items-center justify-center">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : (
          <div className="space-y-5 py-1">
            {/* Guidance Banner */}
            <div className="alert alert-warning/15 border-warning/30 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
              <Info className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <div>
                <p className="font-bold text-base-content">
                  Pregnancy remains active until the loss is confirmed.
                </p>
                <p className="mt-0.5 leading-relaxed text-base-content/75">
                  If the report is not confirmed or needs follow-up, pregnancy monitoring will continue.
                </p>
              </div>
            </div>

            {/* Animal & Farmer Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mother Animal */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Mother Animal (Dam)
                </span>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-base-content">
                      {animalDisplayName}
                    </h4>
                    <p className="text-xs text-base-content/70 mt-0.5">
                      {animalBreed} · {animalSpecies}
                    </p>
                  </div>
                  <span className="badge badge-success badge-sm font-semibold">
                    {animalReproductiveStatus}
                  </span>
                </div>
                {pregnancy?.expectedCalvingDate ? (
                  <p className="text-[11px] text-base-content/60 mt-2">
                    Expected Calving: <strong>{formatDate(pregnancy.expectedCalvingDate)}</strong>
                  </p>
                ) : null}
              </div>

              {/* Farmer Info */}
              <div className="bg-base-200/50 border border-base-300 rounded-2xl p-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block mb-2">
                  Reporting Farmer
                </span>
                <h4 className="font-bold text-sm text-base-content">
                  {farmerName}
                </h4>
                <p className="text-xs text-base-content/70 mt-0.5">
                  {farmerLocation}
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

            {/* Farmer Observation Section */}
            <div className="border border-base-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  Farmer Observation Report
                </span>
                <span className="text-[11px] text-base-content/60 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Reported {formatDate(reportedAt)}
                </span>
              </div>

              <div className="bg-base-100 border border-base-200 rounded-xl p-3 flex items-center gap-3">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-[10px] font-semibold uppercase text-base-content/60 block">
                    Observed Date
                  </span>
                  <span className="text-xs font-bold text-base-content">
                    {formatDate(observationDate)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                  Farmer Notes / Description
                </span>
                <p className="bg-base-100 border border-base-200 rounded-xl p-3 text-xs leading-relaxed text-base-content font-medium">
                  {notes}
                </p>
              </div>

              {/* Evidence Photos */}
              <div>
                <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1.5">
                  Evidence Photos ({evidencePhotos.length})
                </span>
                {evidencePhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">
                    {evidencePhotos.map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedPhoto(photo)}
                        className="relative h-20 w-20 rounded-xl overflow-hidden border border-base-300 hover:opacity-90 transition-opacity focus:outline-none"
                      >
                        <img
                          src={photo}
                          alt={`Evidence ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-base-content/50 italic">
                    No evidence photos were attached to this report.
                  </p>
                )}
              </div>
            </div>

            {/* Existing Review Outcome or Action Form */}
            {isNeedsFollowUp ? (
              <div className="alert alert-warning/20 border-warning/40 text-xs text-base-content/80 flex items-start gap-3 rounded-2xl py-3 px-4">
                <Clock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-xs uppercase tracking-wider text-warning">
                    Follow-up Needed
                  </p>
                  <p className="text-xs text-base-content/90 font-medium">
                    More information is needed before confirming this report. Pregnancy monitoring will continue.
                  </p>
                  <p className="text-[11px] text-base-content/60">
                    No visit has been scheduled.
                  </p>
                </div>
              </div>
            ) : null}

            {isResolved ? (
              <div className="border border-base-300 rounded-2xl p-4 bg-base-200/30">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-base-content/60 block mb-2">
                  Review Status
                </span>
                <div className="flex items-center gap-2">
                  {report?.technicianOutcome === "confirm_loss" ? (
                    <span className="badge badge-error gap-1.5 font-bold">
                      <XCircle className="h-3 w-3" /> Loss Confirmed
                    </span>
                  ) : (
                    <span className="badge badge-info gap-1.5 font-bold">
                      <CheckCircle2 className="h-3 w-3" /> Loss Not Confirmed
                    </span>
                  )}
                  {report?.reviewedAt ? (
                    <span className="text-xs text-base-content/60">
                      Reviewed on {formatDate(report.reviewedAt)}
                    </span>
                  ) : null}
                </div>
                {report?.reviewNotes ? (
                  <p className="text-xs text-base-content/80 mt-2">
                    <strong>Technician Notes:</strong> {report.reviewNotes}
                  </p>
                ) : null}
              </div>
            ) : confirmLossPending ? (
              /* Confirmation Guard for Confirm Loss */
              <div className="alert alert-error/15 border-error/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-error shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-sm text-error">
                      Confirm pregnancy loss?
                    </h5>
                    <p className="text-xs text-base-content/80 mt-1 leading-relaxed">
                      This will confirm the pregnancy loss, close the current pregnancy, and begin post-pregnancy recovery.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/70"
                    onClick={() => setConfirmLossPending(false)}
                    disabled={reviewMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-error btn-sm font-bold gap-1.5"
                    onClick={() => executeReview("confirm_loss")}
                    disabled={reviewMutation.isPending}
                  >
                    {reviewMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Confirm Pregnancy Loss
                  </button>
                </div>
              </div>
            ) : (
              /* Review Actions Form */
              <div className="border border-base-300 rounded-2xl p-4 space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary block">
                  Review Decision
                </span>

                <div>
                  <label className="label-text text-xs font-semibold text-base-content/80 block mb-1">
                    Review Notes (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Enter your observations, examination findings, or follow-up notes..."
                    className="textarea textarea-bordered w-full text-xs font-medium placeholder:text-base-content/40 focus:outline-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* 1. Confirm Loss */}
                  <button
                    type="button"
                    onClick={() => setConfirmLossPending(true)}
                    disabled={reviewMutation.isPending}
                    className="btn btn-outline btn-error btn-sm h-auto py-2.5 flex flex-col items-center text-center gap-1 normal-case group"
                  >
                    <span className="font-bold flex items-center gap-1 text-xs">
                      <XCircle className="h-3.5 w-3.5" /> Confirm Loss
                    </span>
                    <span className="text-[10px] text-error/80 font-normal leading-tight group-hover:text-white transition-colors">
                      Begins recovery
                    </span>
                  </button>

                  {/* 2. Loss Not Confirmed */}
                  <button
                    type="button"
                    onClick={() => executeReview("not_confirmed")}
                    disabled={reviewMutation.isPending}
                    className="btn btn-outline btn-info btn-sm h-auto py-2.5 flex flex-col items-center text-center gap-1 normal-case group"
                  >
                    {reviewMutation.isPending && reviewMutation.variables?.outcome === "not_confirmed" ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <span className="font-bold flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Not Confirmed
                      </span>
                    )}
                    <span className="text-[10px] text-info/80 font-normal leading-tight group-hover:text-white transition-colors">
                      Pregnancy continues
                    </span>
                  </button>

                  {/* 3. Needs Follow-up */}
                  <button
                    type="button"
                    onClick={() => executeReview("needs_visit")}
                    disabled={reviewMutation.isPending}
                    className="btn btn-outline btn-warning btn-sm h-auto py-2.5 flex flex-col items-center text-center gap-1 normal-case group"
                  >
                    {reviewMutation.isPending && reviewMutation.variables?.outcome === "needs_visit" ? (
                      <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                      <span className="font-bold flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5" /> Needs Follow-up
                      </span>
                    )}
                    <span className="text-[10px] text-warning/80 font-normal leading-tight group-hover:text-white transition-colors">
                      Keep report open
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Image Preview Modal */}
      {selectedPhoto ? (
        <ImagePreviewModal
          isOpen={Boolean(selectedPhoto)}
          onClose={() => setSelectedPhoto(null)}
          imageUrl={imagePreviewUrl(selectedPhoto)}
          title="Evidence Photo Preview"
        />
      ) : null}
    </>
  );
}
