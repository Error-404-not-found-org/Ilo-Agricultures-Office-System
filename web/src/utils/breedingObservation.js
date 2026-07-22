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

export function normalizeFarmerObservation(request) {
  const safeRequest = request ?? {};
  const raw = safeRequest.raw || safeRequest;
  const source = safeRequest.farmerObservation || raw.farmerObservation || {};

  return {
    reportType: source.reportType || raw.metadata?.reportType || null,
    reportedAt:
      source.reportedAt || safeRequest.createdAt || raw.createdAt || null,
    signs: Array.isArray(source.signs) ? source.signs.filter(Boolean) : [],
    notes: source.notes || "",
    evidencePhotos: Array.isArray(source.evidencePhotos)
      ? source.evidencePhotos.filter(Boolean)
      : [],
    verificationRequested:
      source.verificationRequested ??
      raw.sourceType === "farmer_requested_verification",
    verificationStatus: source.verificationStatus || "pending",
    taskNotes: raw.notes || "",
  };
}

export function formatObservationValue(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
