export type BreedingObservationType =
  | "possible_pregnancy"
  | "return_to_heat"
  | "unsure";

export type BreedingObservationAttempt = {
  _id?: string;
  attemptNumber?: number;
  inseminationDate?: string;
  dateOfAI?: string;
  createdAt?: string;
  farmerOutcomeReport?: BreedingObservationType | null;
  farmerOutcomeReportedAt?: string;
  farmerObservationSigns?: string[];
  farmerObservationNotes?: string | null;
  evidencePhotos?: string[];
  verificationStatus?: string | null;
  outcomeVerificationStatus?: string | null;
  status?: string | null;
  isSuccess?: boolean | null;
  outcome?: string | null;
  outcomeConfirmationSource?: string | null;
  outcomeConfirmedAt?: string | null;
  failureReason?: string | null;
  pregnancyReadiness?: {
    isEligible?: boolean;
    reason?: string | null;
    availableDate?: string | null;
    daysPostAI?: number | null;
  } | null;
  pregnancyFollowUpTask?: {
    _id?: string;
    status?: string | null;
    dueDate?: string | null;
    sourceType?: string | null;
  } | null;
};

export const FARMER_BREEDING_OBSERVATION_MINIMUM_DAYS = 18;
export const FARMER_BREEDING_OBSERVATION_REMINDER_MAXIMUM_DAYS = 25;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const COMPLETED_AI_STATUSES = new Set(["done", "completed", "resolved"]);

export type FarmerBreedingObservationReadiness = {
  isAvailable: boolean;
  daysPostAI: number | null;
  state: "not_completed" | "missing_date" | "too_early" | "available";
  availableDate: Date | null;
  message: string;
};

export const isFarmerBreedingObservationDayAvailable = (daysPostAI: unknown) =>
  Number.isFinite(Number(daysPostAI)) &&
  Number(daysPostAI) >= FARMER_BREEDING_OBSERVATION_MINIMUM_DAYS;

export const isFarmerBreedingObservationReminderDay = (daysPostAI: unknown) =>
  isFarmerBreedingObservationDayAvailable(daysPostAI) &&
  Number(daysPostAI) <= FARMER_BREEDING_OBSERVATION_REMINDER_MAXIMUM_DAYS;

export const getFarmerBreedingObservationReadiness = (
  attempt?: BreedingObservationAttempt | null,
  at = new Date(),
): FarmerBreedingObservationReadiness => {
  const status = String(attempt?.status || "")
    .trim()
    .toLowerCase();
  if (!COMPLETED_AI_STATUSES.has(status)) {
    return {
      isAvailable: false,
      daysPostAI: null,
      state: "not_completed",
      availableDate: null,
      message:
        "Breeding observations are available after the AI service is completed.",
    };
  }

  const dateValue = attempt?.inseminationDate;
  const aiDate = dateValue ? new Date(dateValue) : null;
  if (!aiDate || Number.isNaN(aiDate.getTime())) {
    return {
      isAvailable: false,
      daysPostAI: null,
      state: "missing_date",
      availableDate: null,
      message: "The completed AI service date is unavailable.",
    };
  }

  const serverDays = attempt?.pregnancyReadiness?.daysPostAI;
  const daysPostAI = Number.isFinite(Number(serverDays))
    ? Math.max(0, Number(serverDays))
    : Math.max(
        0,
        Math.floor((at.getTime() - aiDate.getTime()) / MILLISECONDS_PER_DAY),
      );
  const availableDate = new Date(aiDate);
  availableDate.setUTCDate(
    availableDate.getUTCDate() + FARMER_BREEDING_OBSERVATION_MINIMUM_DAYS,
  );

  if (daysPostAI < FARMER_BREEDING_OBSERVATION_MINIMUM_DAYS) {
    return {
      isAvailable: false,
      daysPostAI,
      state: "too_early",
      availableDate,
      message: `Breeding update will be available on ${availableDate.toLocaleDateString(
        "en-PH",
        {
          month: "long",
          day: "numeric",
          year: "numeric",
        },
      )}.`,
    };
  }
  return {
    isAvailable: true,
    daysPostAI,
    state: "available",
    availableDate,
    message: "Share what you observed after insemination.",
  };
};

const attemptTimestamp = (attempt: BreedingObservationAttempt) => {
  const value =
    attempt.inseminationDate || attempt.dateOfAI || attempt.createdAt || "";
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function selectBreedingObservationAttempt<
  T extends BreedingObservationAttempt,
>(attempts?: T[] | null, requestId?: string): T | null {
  if (!attempts?.length) return null;

  if (requestId) {
    return (
      attempts.find((attempt) => String(attempt._id || "") === requestId) ||
      null
    );
  }

  return [...attempts].sort((first, second) => {
    const attemptDifference =
      Number(second.attemptNumber || 0) - Number(first.attemptNumber || 0);
    return (
      attemptDifference || attemptTimestamp(second) - attemptTimestamp(first)
    );
  })[0];
}

export const hasBreedingObservation = (
  attempt?: BreedingObservationAttempt | null,
) => Boolean(attempt?.farmerOutcomeReport);

export type BreedingObservationDraft = {
  mode: "create" | "existing";
  reportType: BreedingObservationType;
  signs: string[];
  notes: string;
  evidencePhotos: string[];
};

export const getBreedingObservationDraft = (
  attempt: BreedingObservationAttempt | null | undefined,
  fallbackReport: BreedingObservationType = "unsure",
): BreedingObservationDraft => {
  const existing = hasBreedingObservation(attempt);

  return {
    mode: existing ? "existing" : "create",
    reportType: attempt?.farmerOutcomeReport || fallbackReport,
    signs: existing ? [...(attempt?.farmerObservationSigns || [])] : [],
    notes: existing ? attempt?.farmerObservationNotes || "" : "",
    evidencePhotos: existing ? [...(attempt?.evidencePhotos || [])] : [],
  };
};

const OBSERVATION_LABELS: Record<BreedingObservationType, string> = {
  possible_pregnancy: "No signs observed",
  return_to_heat: "Showing signs of heat",
  unsure: "I'm not sure",
};

const SIGN_LABELS: Record<string, string> = {
  standing_heat: "Stands when mounted",
  mounting_behavior: "Mounting other cattle",
  restlessness: "Restless / more active than usual",
  mucus_discharge: "Clear mucus discharge",
  vulvar_swelling: "Vulva looks swollen or red",
  vocalization: "More vocal than usual",
};

export const getBreedingObservationLabel = (value?: string | null) =>
  value && value in OBSERVATION_LABELS
    ? OBSERVATION_LABELS[value as BreedingObservationType]
    : "Breeding observation";

export const getBreedingObservationSignLabel = (value: string) =>
  SIGN_LABELS[value] ||
  value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export type BreedingObservationPresentationStage =
  | "new"
  | "recorded"
  | "confirmation_not_ready"
  | "technician_follow_up"
  | "review_complete";

export type BreedingObservationPresentation = {
  stage: BreedingObservationPresentationStage;
  statusMessage: string;
  farmerMessage: string;
  badgeLabel?: string;
};

const ACTIVE_TASK_STATUSES = new Set(["pending", "in progress", "in_progress"]);

const hasActivePregnancyFollowUpTask = (
  attempt?: BreedingObservationAttempt | null,
) => {
  const status = String(attempt?.pregnancyFollowUpTask?.status || "")
    .trim()
    .toLowerCase();
  return (
    Boolean(attempt?.pregnancyFollowUpTask?._id) &&
    ACTIVE_TASK_STATUSES.has(status)
  );
};

export const isBreedingObservationAuthoritativelyReviewed = (
  attempt?: BreedingObservationAttempt | null,
) =>
  attempt?.verificationStatus === "verified" ||
  attempt?.verificationStatus === "rejected" ||
  attempt?.outcomeVerificationStatus === "verified";

export const isBreedingObservationTerminal = (
  attempt?: BreedingObservationAttempt | null,
) => {
  const outcome = attempt?.outcome;
  const isTerminalOutcome =
    outcome === "Pregnant" ||
    outcome === "Failed (Re-heat)" ||
    outcome === "Failed (Aborted)" ||
    outcome === "Failed (Negative PD)";

  return (
    (isTerminalOutcome && attempt?.outcomeVerificationStatus === "verified") ||
    attempt?.isSuccess === true ||
    attempt?.isSuccess === false
  );
};

export const isVerifiedReturnToHeatOutcome = (
  attempt?: BreedingObservationAttempt | null,
) =>
  String(attempt?.status || "").toLowerCase() === "done" &&
  attempt?.isSuccess === false &&
  attempt?.outcome === "Failed (Re-heat)" &&
  attempt?.outcomeVerificationStatus === "verified";

export const canOfferFarmerReInsemination = (
  attempt: BreedingObservationAttempt | null | undefined,
  eligibility: { eligible?: boolean } | null | undefined,
) => isVerifiedReturnToHeatOutcome(attempt) && eligibility?.eligible === true;

export const getBreedingObservationPresentation = (
  attempt?: BreedingObservationAttempt | null,
): BreedingObservationPresentation => {
  if (!hasBreedingObservation(attempt)) {
    return {
      stage: "new",
      statusMessage: "No breeding observation submitted",
      farmerMessage: "No breeding observation submitted",
    };
  }

  if (isVerifiedReturnToHeatOutcome(attempt)) {
    return {
      stage: "review_complete",
      statusMessage: "Return to heat confirmed",
      farmerMessage:
        "This insemination attempt was not successful because return to heat was confirmed.",
      badgeLabel: "Confirmed",
    };
  }

  if (isBreedingObservationAuthoritativelyReviewed(attempt)) {
    return {
      stage: "review_complete",
      statusMessage: "Technician review complete",
      farmerMessage: "Technician review complete",
      badgeLabel: "Reviewed",
    };
  }

  if (attempt?.farmerOutcomeReport === "return_to_heat") {
    return {
      stage: "technician_follow_up",
      statusMessage: "Return to heat reported",
      farmerMessage: "Observation submitted.",
      badgeLabel: "Verification required",
    };
  }

  if (attempt?.farmerOutcomeReport === "possible_pregnancy") {
    if (attempt.pregnancyReadiness?.isEligible === false) {
      return {
        stage: "confirmation_not_ready",
        statusMessage: "Animal did not return to heat",
        farmerMessage: "Insemination outcome not yet confirmed.",
        badgeLabel: "Recorded",
      };
    }

    if (
      attempt.pregnancyReadiness?.isEligible === true &&
      hasActivePregnancyFollowUpTask(attempt)
    ) {
      return {
        stage: "technician_follow_up",
        statusMessage: "Animal did not return to heat",
        farmerMessage: "Insemination outcome not yet confirmed.",
        badgeLabel: "Follow-up pending",
      };
    }

    return {
      stage: "recorded",
      statusMessage: "Animal did not return to heat",
      farmerMessage: "Insemination outcome not yet confirmed.",
      badgeLabel: "Recorded",
    };
  }

  return {
    stage: "recorded",
    statusMessage: "Breeding update submitted",
    farmerMessage: "Continue monitoring your animal.",
    badgeLabel: "Recorded",
  };
};
export const isBreedingObservationAwaitingReview = (
  status: string | null | undefined,
) => ["pending", "reported"].includes(String(status).toLowerCase());
