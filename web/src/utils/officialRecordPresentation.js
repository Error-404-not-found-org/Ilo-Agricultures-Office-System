// web/src/utils/officialRecordPresentation.js

export const formatRecordStatus = (status) => {
  const s = String(status || "").toLowerCase().trim();
  if (s === "completed" || s === "done") return "Completed";
  if (s === "resolved") return "Resolved";
  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "rejected") return "Rejected";
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Completed";
};

export const humanizeToken = (value) => {
  if (!value) return "";
  return String(value)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const isPlaceholderText = (val) =>
  !val ||
  /^(none|no specific diagnosis logged\.?|no treatment logged\.?|n\/a|\-)$/i.test(
    String(val).trim(),
  );

const isPureNumberOrDosage = (val) => {
  const trimmed = String(val || "").trim();
  return /^\d+(\s*(ml|mg|g|tab|tabs|dose|doses|cc|vial|vials))?$/i.test(trimmed);
};

/**
 * Derives a meaningful secondary Health summary from a canonical Health record.
 * Never leaks dosage or unlabeled numbers.
 * Returns { label: string | null, value: string | null }
 */
export const getHealthResultPresentation = (record) => {
  const source = record?.source || {};
  const details = source.details || {};

  // Closed HealthRequest (advice, office pickup, cancelled)
  if (record?.recordKind === "health_request") {
    if (source.handlingMethod === "advice") {
      return { label: null, value: "Advice provided" };
    }
    if (source.handlingMethod === "office_pickup") {
      return { label: null, value: "Pickup info provided" };
    }
    if (["cancelled", "rejected"].includes(String(record.status).toLowerCase())) {
      const reason =
        source.cancellationResponseReason || source.cancellationReason;
      return { label: "Reason", value: reason || "Request cancelled" };
    }
    return { label: null, value: null };
  }

  // MedicalRecord
  const rawDiagnosis = details.diagnosis?.trim();
  const rawTreatment = details.treatment?.trim();

  // Prefer Diagnosis if meaningful and not pure number/dosage
  if (
    rawDiagnosis &&
    !isPlaceholderText(rawDiagnosis) &&
    !isPureNumberOrDosage(rawDiagnosis)
  ) {
    return { label: "Diagnosis", value: rawDiagnosis };
  }

  // Prefer Treatment if meaningful and not pure number/dosage
  if (
    rawTreatment &&
    !isPlaceholderText(rawTreatment) &&
    !isPureNumberOrDosage(rawTreatment)
  ) {
    return { label: "Treatment", value: rawTreatment };
  }

  // Check record.summary if populated with real text (not fallback dosage or generic text)
  const summary = record?.summary?.trim();

  const isGeneralNote =
    record?.category === "General Note" || source.type === "General Note";
  if (isGeneralNote) {
    const note = (source.note || summary)?.trim();
    if (
      note &&
      !isPlaceholderText(note) &&
      !isPureNumberOrDosage(note) &&
      note.toLowerCase() !== "general animal note"
    ) {
      return { label: "Note", value: note };
    }
    return { label: null, value: null };
  }

  if (
    summary &&
    !isPlaceholderText(summary) &&
    !isPureNumberOrDosage(summary) &&
    ![
      "health record completed",
      "saved activity",
      "general animal note",
      "treatment completed",
    ].includes(summary.toLowerCase())
  ) {
    return { label: "Treatment", value: summary };
  }

  // Fallback to specific service type (e.g. Vaccination, Deworming) if not generic
  const type = source.type?.trim();
  if (
    type &&
    !["check-up", "checkup", "general note", "farm visit", "walk-in"].includes(
      type.toLowerCase(),
    )
  ) {
    return { label: null, value: type };
  }

  return { label: null, value: null };
};

/**
 * Derives a meaningful secondary AI summary.
 * Only returns confirmed outcomes (Pregnant, Return to heat, etc.).
 * Returns string | null.
 */
export const getAIResultPresentation = (record) => {
  const source = record?.source || {};
  if (record?.recordKind === "ai_request") {
    const reason =
      source.cancellationResponseReason || source.cancellationReason;
    return reason ? `Reason: ${reason}` : null;
  }
  const outcome = source.outcome;
  if (
    !outcome ||
    outcome === "Pending" ||
    outcome === "Artificial insemination completed"
  ) {
    return null;
  }
  if (outcome === "Failed (Re-heat)") return "Return to heat";
  if (outcome === "Failed (Negative PD)") return "Not pregnant (Negative PD)";
  if (outcome === "Failed (Aborted)") return "Aborted";
  return outcome;
};

/**
 * Derives a human-readable Pregnancy result without raw enums.
 * Returns string | null.
 */
export const getPregnancyResultPresentation = (record) => {
  const source = record?.source || {};
  const raw = source.pregnancyDiagnosis?.result || record?.summary;
  if (!raw || raw === "Pregnancy diagnosis recorded") return null;
  const lower = raw.toLowerCase().trim();
  if (lower === "pregnant") return "Pregnant";
  if (
    lower === "empty" ||
    lower === "not_pregnant" ||
    lower === "not pregnant"
  ) {
    return "Not pregnant";
  }
  if (lower === "needs_recheck" || lower === "recheck")
    return "Recheck required";
  if (lower === "return_to_heat") return "Returned to heat";
  return humanizeToken(raw);
};

/**
 * Derives a human-readable Calving result.
 * Returns string | null.
 */
export const getCalvingResultPresentation = (record) => {
  const source = record?.source || {};
  const count = source.numberOfCalves ?? source.calves?.length;
  const outcome = source.calvingOutcome || source.outcome;
  if (count != null && count > 0) {
    const calfText = `${count} ${count === 1 ? "calf" : "calves"}`;
    return outcome ? `${calfText} · ${humanizeToken(outcome)}` : calfText;
  }
  if (outcome) return humanizeToken(outcome);
  return null;
};

/**
 * Derives the secondary result text for the "All records" table view.
 * Returns { label: string | null, value: string | null } or null.
 */
export const getAllRecordsResultPresentation = (record) => {
  if (!record) return null;

  const category = String(record.category || "").toLowerCase();
  const kind = String(record.recordKind || "").toLowerCase();

  if (
    category === "health" ||
    category === "general note" ||
    kind === "medical_record" ||
    kind === "health_request"
  ) {
    const health = getHealthResultPresentation(record);
    return health?.value ? health : null;
  }

  if (category === "ai" || kind === "insemination" || kind === "ai_request") {
    const aiOutcome = getAIResultPresentation(record);
    return aiOutcome ? { label: null, value: aiOutcome } : null;
  }

  if (category === "pregnancy" || kind === "pregnancy") {
    const pregResult = getPregnancyResultPresentation(record);
    return pregResult ? { label: null, value: pregResult } : null;
  }

  if (category === "calving" || kind === "calving") {
    const calvingResult = getCalvingResultPresentation(record);
    return calvingResult ? { label: null, value: calvingResult } : null;
  }

  return null;
};
