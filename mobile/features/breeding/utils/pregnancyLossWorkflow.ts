/**
 * Pregnancy Loss Workflow Utilities
 *
 * Provides:
 * 1. Safe location formatting for technician review (handles strings, structured objects, missing data).
 * 2. Active pregnancy loss report detection and duplicate submission suppression.
 * 3. Idempotent submission reconciliation via canonical server state check.
 */

const isPlaceholder = (val?: string | null): boolean => {
  if (!val || typeof val !== "string") return true;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.length === 0 ||
    ["na", "n/a", "none", "notset", "unknown", "null", "undefined"].includes(trimmed)
  );
};

const cleanString = (val: unknown): string =>
  typeof val === "string" ? val.trim() : "";

const firstObject = (val: unknown): Record<string, any> => {
  if (Array.isArray(val)) {
    const first = val[0];
    return first && typeof first === "object" ? first : {};
  }
  return val && typeof val === "object" ? (val as Record<string, any>) : {};
};

/**
 * Formats farmer or animal location safely for technician review.
 * Prevents React child render crashes when given structured location objects.
 *
 * Supported inputs:
 * - String: "Bita Norte, Oton"
 * - Farmer object with address: { address: { street: "", barangay: "Bita Norte", city: "Oton" } }
 * - Farmer object with farmLocation: { farmLocation: { detectedAddress: "Bita Norte, Oton" } }
 * - Direct address object: { street, barangay, city, province, isDefault, administrativeArea, _id }
 * - Missing/null/empty: returns fallback ("Location not recorded")
 */
export function formatPregnancyLossLocation(
  farmerOrLocation: any,
  fallback = "Location not recorded",
): string {
  if (!farmerOrLocation) return fallback;

  // Case 1: direct string
  if (typeof farmerOrLocation === "string") {
    return isPlaceholder(farmerOrLocation) ? fallback : farmerOrLocation.trim();
  }

  if (typeof farmerOrLocation !== "object") return fallback;

  // Case 2: object (farmer, address, or farmLocation)
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

  const seen = new Set<string>();
  const parts: string[] = [];
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
}

/**
 * Finds an active pregnancy loss report for a specific pregnancy.
 * Only reports with status "pending_review" or "needs_visit" are considered active.
 */
export function findActivePregnancyLossReport(
  reports?: any[] | null,
  pregnancyId?: string | null,
): any | null {
  if (!Array.isArray(reports) || reports.length === 0) return null;

  return (
    reports.find((r: any) => {
      if (!r || typeof r !== "object") return false;
      const pId =
        typeof r.pregnancyId === "object" && r.pregnancyId !== null
          ? r.pregnancyId._id || r.pregnancyId.id
          : r.pregnancyId;

      const matchesPregnancy =
        pregnancyId && pId
          ? String(pId) === String(pregnancyId)
          : true;

      return (
        matchesPregnancy &&
        ["pending_review", "needs_visit"].includes(r.status)
      );
    }) || null
  );
}

/**
 * Checks whether duplicate pregnancy loss submission is blocked by an existing active report.
 */
export function isPregnancyLossDuplicateSubmissionBlocked(
  reports?: any[] | null,
  pregnancyId?: string | null,
): boolean {
  return findActivePregnancyLossReport(reports, pregnancyId) !== null;
}

/**
 * Reconciles pregnancy loss submission by checking canonical server state.
 */
export async function reconcilePregnancyLossSubmission({
  api,
  animalId,
  pregnancyId,
}: {
  api: any;
  animalId: string;
  pregnancyId?: string | null;
}): Promise<any | null> {
  if (!api || !animalId) return null;
  try {
    const response = await api.get(`/animals/${animalId}/pregnancy-loss-reports`);
    const reports = Array.isArray(response.data?.reports)
      ? response.data.reports
      : Array.isArray(response.data)
        ? response.data
        : [];
    return findActivePregnancyLossReport(reports, pregnancyId);
  } catch {
    return null;
  }
}

export interface PregnancyLossSubmissionRecoveryResult {
  recoveredAsSuccess: boolean;
  activeReport: any | null;
  message?: string;
  shouldKeepLocked?: boolean;
}

/**
 * Evaluates whether an ambiguous submission (network timeout, no-response, or 409 IDEMPOTENCY_IN_PROGRESS)
 * can be reconciled as a success from canonical server state without spamming duplicate POST requests.
 */
export async function evaluatePregnancyLossSubmissionRecovery({
  api,
  animalId,
  pregnancyId,
  error,
}: {
  api: any;
  animalId: string;
  pregnancyId?: string | null;
  error?: any;
}): Promise<PregnancyLossSubmissionRecoveryResult> {
  const errorCode = error?.response?.data?.code;
  const isNetworkErr =
    !error?.response &&
    (Boolean(error?.request) ||
      error?.code === "ERR_NETWORK" ||
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "OFFLINE_FALLBACK_TIMEOUT");

  const isAmbiguous = isNetworkErr || errorCode === "IDEMPOTENCY_IN_PROGRESS";

  if (isAmbiguous) {
    const active = await reconcilePregnancyLossSubmission({
      api,
      animalId,
      pregnancyId,
    });
    if (active) {
      return {
        recoveredAsSuccess: true,
        activeReport: active,
        message: "Pregnancy loss report submitted. A technician will review your report.",
      };
    }

    if (errorCode === "IDEMPOTENCY_IN_PROGRESS") {
      return {
        recoveredAsSuccess: false,
        activeReport: null,
        message: "We're checking whether your report was received. Please wait a moment.",
        shouldKeepLocked: true,
      };
    }
  }

  return {
    recoveredAsSuccess: false,
    activeReport: null,
    message: error?.response?.data?.message || "Failed to submit pregnancy loss report",
    shouldKeepLocked: false,
  };
}

/**
 * Formats user-facing status for a pregnancy loss report.
 * Strictly maps backend enums to clean, non-technical labels:
 * - pending_review -> "Awaiting review"
 * - needs_visit -> "Follow-up needed"
 * - not_confirmed -> "Pregnancy loss not confirmed"
 * - confirmed -> "Pregnancy loss confirmed"
 */
export function formatPregnancyLossStatus(status?: string | null): string {
  switch (status) {
    case "pending_review":
      return "Awaiting review";
    case "needs_visit":
      return "Follow-up needed";
    case "not_confirmed":
      return "Pregnancy loss not confirmed";
    case "confirmed":
      return "Pregnancy loss confirmed";
    default:
      return "Under review";
  }
}

export interface FarmerPregnancyLossPresentation {
  badgeLabel: string;
  explanation: string;
  noticedDateLabel: string;
  noticedDate: string | null;
  reportSentLabel: string;
  reportSentDate: string | null;
  technicianNoteLabel: string;
  technicianNote: string | null;
  hasReviewedDateInSummary: boolean;
  rawStatus: string;
}

export function safeFormatDate(
  val?: string | Date | null,
  pattern: "short" | "full" = "short",
): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match && !val.includes("T")) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const m = months[monthIndex] || "";
      return pattern === "short" ? `${m} ${day}` : `${m} ${day}, ${year}`;
    }
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const m = months[d.getMonth()];
    const day = d.getDate();
    return pattern === "short" ? `${m} ${day}` : `${m} ${day}, ${d.getFullYear()}`;
  } catch {
    return null;
  }
}

export function getTechnicianActor(report: any): string {
  if (!report?.reviewedBy) return "The technician";
  let rawName = "";
  if (typeof report.reviewedBy === "object" && report.reviewedBy !== null) {
    rawName =
      report.reviewedBy.name ||
      [report.reviewedBy.firstName, report.reviewedBy.lastName]
        .filter(Boolean)
        .join(" ");
  } else if (typeof report.reviewedBy === "string") {
    rawName = report.reviewedBy;
  }
  rawName = rawName.trim();
  if (
    !rawName ||
    isPlaceholder(rawName) ||
    /^[0-9a-fA-F]{24}$/.test(rawName)
  ) {
    return "The technician";
  }
  if (/^technician\b/i.test(rawName)) {
    return rawName;
  }
  return `Technician ${rawName}`;
}

export function getFarmerPregnancyLossPresentation(
  report?: any | null,
): FarmerPregnancyLossPresentation {
  const status = report?.status || "";
  const actor = getTechnicianActor(report);

  const noticedDate = safeFormatDate(report?.observationDate, "full");
  const reportSentDate = safeFormatDate(
    report?.reportedAt || report?.createdAt,
    "full",
  );
  const reviewShortDate = safeFormatDate(report?.reviewedAt, "short");

  const badgeLabel = formatPregnancyLossStatus(status);
  const noticedDateLabel = "Date you noticed the signs";
  const reportSentLabel = "Report sent";
  const technicianNoteLabel = "Technician's note";
  const technicianNote = cleanString(report?.reviewNotes) || null;

  let explanation = "";
  let hasReviewedDateInSummary = false;

  switch (status) {
    case "pending_review":
      explanation =
        "Your report was sent to the technician for review. Pregnancy monitoring will continue while you wait for a decision.";
      break;

    case "needs_visit":
      if (reviewShortDate) {
        explanation = `${actor} reviewed your report on ${reviewShortDate} and needs more information before making a final decision. Pregnancy monitoring will continue.`;
        hasReviewedDateInSummary = true;
      } else {
        explanation = `${actor} reviewed your report and needs more information before making a final decision. Pregnancy monitoring will continue.`;
      }
      break;

    case "not_confirmed":
      if (reviewShortDate) {
        explanation = `${actor} reviewed your report on ${reviewShortDate} and did not confirm pregnancy loss. Pregnancy monitoring will continue.`;
        hasReviewedDateInSummary = true;
      } else {
        explanation = `${actor} reviewed your report and did not confirm pregnancy loss. Pregnancy monitoring will continue.`;
      }
      break;

    case "confirmed":
      if (reviewShortDate) {
        explanation = `${actor} reviewed your report on ${reviewShortDate} and confirmed the pregnancy loss. Pregnancy monitoring has ended and recovery monitoring has started.`;
        hasReviewedDateInSummary = true;
      } else {
        explanation = `${actor} reviewed your report and confirmed the pregnancy loss. Pregnancy monitoring has ended and recovery monitoring has started.`;
      }
      break;

    default:
      explanation =
        "Your report is being reviewed. Pregnancy monitoring will continue while you wait for a decision.";
      break;
  }

  return {
    badgeLabel,
    explanation,
    noticedDateLabel,
    noticedDate,
    reportSentLabel,
    reportSentDate,
    technicianNoteLabel,
    technicianNote,
    hasReviewedDateInSummary,
    rawStatus: status,
  };
}

export interface FindReviewedPregnancyLossReportOptions {
  pregnancyId?: string | null;
  inseminationId?: string | null;
  calvingId?: string | null;
  calving?: any | null;
}

/**
 * Finds the reviewed pregnancy loss report (not_confirmed or confirmed) matching a historical cycle.
 *
 * Matching priority (Refinement 2):
 * 1. report.pregnancyId === displayed historical Pregnancy._id
 * 2. report.inseminationId === displayed historical Insemination._id
 * 3. report linked to the associated pregnancy-loss Calving / closed cycle (confirmedCalvingId or calving.pregnancyLossReportId)
 * 4. only if there is exactly one unambiguous reviewed PregnancyLossReport for the animal may a compatibility fallback be used.
 * If multiple historical cycles/reports exist and no linkage can be resolved, does NOT guess.
 */
export function findLatestReviewedPregnancyLossReport(
  reports?: any[] | null,
  pregnancyIdOrOptions?: string | FindReviewedPregnancyLossReportOptions | null,
): any | null {
  if (!Array.isArray(reports) || reports.length === 0) return null;

  const options: FindReviewedPregnancyLossReportOptions =
    typeof pregnancyIdOrOptions === "string"
      ? { pregnancyId: pregnancyIdOrOptions }
      : pregnancyIdOrOptions || {};

  const reviewedReports = reports.filter(
    (r: any) =>
      r &&
      typeof r === "object" &&
      ["not_confirmed", "confirmed"].includes(r.status),
  );

  if (reviewedReports.length === 0) return null;

  const getEntityId = (entity: any): string => {
    if (!entity) return "";
    if (typeof entity === "string") return entity;
    return String(entity._id || entity.id || "");
  };

  const targetPregnancyId = getEntityId(options.pregnancyId);
  const targetInseminationId = getEntityId(options.inseminationId);
  const targetCalvingId =
    getEntityId(options.calvingId) ||
    getEntityId(options.calving?._id || options.calving?.id);
  const linkedReportIdFromCalving = getEntityId(
    options.calving?.pregnancyLossReportId,
  );

  // 1. report.pregnancyId === displayed historical Pregnancy._id
  if (targetPregnancyId) {
    const match = reviewedReports.find(
      (r: any) => getEntityId(r.pregnancyId) === targetPregnancyId,
    );
    if (match) return match;
  }

  // 2. report.inseminationId === displayed historical Insemination._id
  if (targetInseminationId) {
    const match = reviewedReports.find(
      (r: any) => getEntityId(r.inseminationId) === targetInseminationId,
    );
    if (match) return match;
  }

  // 3. report linked to the associated pregnancy-loss Calving / closed cycle
  if (linkedReportIdFromCalving) {
    const match = reviewedReports.find(
      (r: any) => getEntityId(r) === linkedReportIdFromCalving,
    );
    if (match) return match;
  }
  if (targetCalvingId) {
    const match = reviewedReports.find(
      (r: any) =>
        getEntityId(r.confirmedCalvingId) === targetCalvingId ||
        getEntityId(r.calvingId) === targetCalvingId,
    );
    if (match) return match;
  }

  // 4. only if there is exactly one unambiguous reviewed PregnancyLossReport for the animal
  const hasSpecificFilter = Boolean(
    targetPregnancyId ||
      targetInseminationId ||
      targetCalvingId ||
      linkedReportIdFromCalving,
  );
  if (!hasSpecificFilter && reviewedReports.length === 1) {
    return reviewedReports[0];
  }

  return null;
}
