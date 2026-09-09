const OBSERVATION_META = {
  possible_pregnancy: {
    badge: "PREGNANCY CHECK",
    serviceLabel: "Pregnancy Check",
    observationLabel: "Possible pregnancy",
    badgeClass: "badge-warning",
    iconClass: "text-warning bg-warning/10 border-warning/20",
  },
  return_to_heat: {
    badge: "FOLLOW-UP",
    serviceLabel: "Return-to-Heat Review",
    observationLabel: "Returned to heat",
    badgeClass: "badge-info",
    iconClass: "text-info bg-info/10 border-info/20",
  },
  unsure: {
    badge: "BREEDING REVIEW",
    serviceLabel: "Breeding Review",
    observationLabel: "Unsure",
    badgeClass: "badge-secondary",
    iconClass: "text-secondary bg-secondary/10 border-secondary/20",
  },
};

export const BREEDING_OBSERVATION_LABELS = {
  return_to_heat: "Showing signs of heat",
  possible_pregnancy: "No signs observed",
  unsure: "I'm not sure",
};

export const BREEDING_OBSERVATION_SUMMARY_LABELS = {
  return_to_heat: "Return to heat",
  possible_pregnancy: "Possible pregnancy",
  unsure: "Unsure",
};

export const BREEDING_OBSERVATION_SIGN_LABELS = {
  standing_heat: "Stands when mounted",
  mounting_behavior: "Mounting other cattle",
  restlessness: "Restless / more active than usual",
  mucus_discharge: "Clear mucus discharge",
  vulvar_swelling: "Vulva looks swollen or red",
  vocalization: "More vocal than usual",
};

export function getBreedingObservationMeta(reportType) {
  return (
    OBSERVATION_META[String(reportType || "").toLowerCase()] || {
      badge: "BREEDING REVIEW",
      serviceLabel: "Breeding Review",
      observationLabel: "Observation not specified",
      badgeClass: "badge-secondary",
      iconClass: "text-secondary bg-secondary/10 border-secondary/20",
    }
  );
}

export function formatObservationValue(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getBreedingObservationLabel(reportType) {
  if (!reportType) return "Breeding observation";
  const key = String(reportType).toLowerCase().trim();
  return (
    BREEDING_OBSERVATION_LABELS[key] ||
    formatObservationValue(reportType) ||
    "Breeding observation"
  );
}

export function getBreedingObservationSignLabel(sign) {
  if (!sign) return "";
  const key = String(sign).toLowerCase().trim();
  return (
    BREEDING_OBSERVATION_SIGN_LABELS[key] ||
    formatObservationValue(sign)
  );
}

export function formatSubmittedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTaskSummary(summary) {
  if (!summary || typeof summary !== "string") return summary;

  let formatted = summary;

  // Replace report type tokens
  formatted = formatted
    .replace(/\breturn_to_heat\b/gi, "Return to heat")
    .replace(/\bpossible_pregnancy\b/gi, "Possible pregnancy")
    .replace(/\bunsure\b/gi, "Unsure");

  // Replace sign tokens
  for (const [token, label] of Object.entries(BREEDING_OBSERVATION_SIGN_LABELS)) {
    const regex = new RegExp(`\\b${token}\\b`, "gi");
    formatted = formatted.replace(regex, label);
  }

  return formatted;
}

export function normalizeFarmerObservation(request) {
  if (!request) {
    return {
      reportType: null,
      reportedAt: null,
      signs: [],
      notes: "",
      evidencePhotos: [],
      verificationRequested: false,
      verificationStatus: "pending",
      taskNotes: "",
      hasObservation: false,
    };
  }

  const safeRequest = request ?? {};
  const raw = safeRequest.raw || safeRequest;
  const insemination =
    safeRequest.insemination ||
    raw.insemination ||
    (raw.farmerOutcomeReport !== undefined ? raw : null);
  const source =
    safeRequest.farmerObservation ||
    raw.farmerObservation ||
    insemination?.farmerObservation ||
    {};

  const reportType =
    insemination?.farmerOutcomeReport ||
    source.reportType ||
    source.farmerOutcomeReport ||
    raw.farmerOutcomeReport ||
    raw.context?.reportType ||
    raw.metadata?.reportType ||
    null;

  const reportedAt =
    insemination?.farmerOutcomeReportedAt ||
    source.reportedAt ||
    source.farmerOutcomeReportedAt ||
    raw.farmerOutcomeReportedAt ||
    safeRequest.createdAt ||
    raw.createdAt ||
    null;

  const signsRaw =
    insemination?.farmerObservationSigns ||
    source.signs ||
    source.farmerObservationSigns ||
    raw.farmerObservationSigns ||
    [];
  const signs = Array.isArray(signsRaw) ? signsRaw.filter(Boolean) : [];

  const notesRaw =
    insemination?.farmerObservationNotes ||
    source.notes ||
    source.farmerObservationNotes ||
    raw.farmerObservationNotes ||
    "";
  const notes = typeof notesRaw === "string" ? notesRaw.trim() : "";

  const photosRaw =
    insemination?.evidencePhotos ||
    source.evidencePhotos ||
    source.photos ||
    raw.evidencePhotos ||
    [];
  const evidencePhotos = Array.isArray(photosRaw)
    ? photosRaw
        .filter((photo) => Boolean(typeof photo === "string" ? photo.trim() : photo))
        .map((photo) => (typeof photo === "string" ? photo.trim() : photo))
    : [];

  const verificationRequested = Boolean(
    insemination?.verificationRequested ??
      source.verificationRequested ??
      (raw.sourceType === "farmer_requested_verification" ||
        raw.taskType === "BreedingFollowUp" ||
        Boolean(reportType)),
  );

  const verificationStatus =
    insemination?.outcomeVerificationStatus ||
    insemination?.verificationStatus ||
    source.verificationStatus ||
    raw.verificationStatus ||
    "pending";

  const hasObservation = Boolean(
    reportType ||
      signs.length > 0 ||
      notes.length > 0 ||
      evidencePhotos.length > 0,
  );

  return {
    reportType,
    reportedAt,
    signs,
    notes,
    evidencePhotos,
    verificationRequested,
    verificationStatus,
    taskNotes: raw.notes || "",
    hasObservation,
  };
}

export function isFarmerBreedingObservationPendingReview(item) {
  if (!item) return false;
  const raw = item.raw || item;
  const status = String(item.status || item.displayStatus || raw.status || "").toLowerCase();
  if (["completed", "done", "resolved", "cancelled", "canceled", "rejected"].includes(status)) {
    return false;
  }

  const isBreedingFollowUp =
    item.workflowType === "BreedingFollowUp" ||
    raw.taskType === "BreedingFollowUp" ||
    item.taskType === "BreedingFollowUp" ||
    item.serviceType === "Breeding Follow-up" ||
    raw.serviceType === "Breeding Follow-up";

  if (!isBreedingFollowUp) return false;

  const hasFarmerReport = Boolean(
    item.context?.reportType ||
      raw.metadata?.reportType ||
      item.metadata?.reportType ||
      raw.sourceType === "farmer_requested_verification" ||
      item.sourceType === "farmer_requested_verification" ||
      raw.farmerOutcomeReport ||
      raw.insemination?.farmerOutcomeReport ||
      item.insemination?.farmerOutcomeReport ||
      (typeof item.summary === "string" && item.summary.includes("Breeding observation:"))
  );

  return hasFarmerReport;
}
