import {
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "./cattleCore";

export const PREGNANCY_DIAGNOSIS_MINIMUM_DAYS = 60;
const ACTIVE_AI_STATUSES = new Set([
  "pending",
  "approved",
  "scheduled",
  "in-progress",
]);

export interface PregnancyCheckReadiness {
  isEligible: boolean;
  code: string;
  reason: string;
  daysPostAI: number | null;
  minimumDays: number;
  availableDate: string | null;
  availableDateLabel?: string;
}

export function getPregnancyCheckReadiness(
  insemination: any,
  at: Date = new Date(),
): PregnancyCheckReadiness {
  const status = String(insemination?.status || "").trim().toLowerCase();
  if (!["done", "resolved", "completed"].includes(status)) {
    return {
      isEligible: false,
      code: "AI_SERVICE_NOT_COMPLETED",
      reason: "Pregnancy diagnosis requires a completed AI service.",
      daysPostAI: null,
      minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
      availableDate: null,
    };
  }

  const aiDate = insemination?.inseminationDate
    ? new Date(insemination.inseminationDate)
    : null;
  if (!aiDate || Number.isNaN(aiDate.getTime())) {
    return {
      isEligible: false,
      code: "AI_SERVICE_DATE_REQUIRED",
      reason: "The completed AI service date is missing or invalid.",
      daysPostAI: null,
      minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
      availableDate: null,
    };
  }

  const availableDate = new Date(aiDate);
  availableDate.setUTCDate(
    availableDate.getUTCDate() + PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
  );
  const daysPostAI = Math.max(
    0,
    Math.floor((at.getTime() - aiDate.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const availableDateLabel = availableDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const isEligible = at.getTime() >= availableDate.getTime();

  return {
    isEligible,
    code: isEligible ? "PREGNANCY_CHECK_AVAILABLE" : "PREGNANCY_CHECK_TOO_EARLY",
    reason: isEligible
      ? "Pregnancy check is available."
      : `Pregnancy check not yet available. This animal is currently ${daysPostAI} days after insemination. The pregnancy check will be available on ${availableDateLabel}.`,
    daysPostAI,
    minimumDays: PREGNANCY_DIAGNOSIS_MINIMUM_DAYS,
    availableDate: availableDate.toISOString(),
    availableDateLabel,
  };
}

export function getAIEligibility({
  animal,
  activeRequest,
  at = new Date(),
}: {
  animal: any;
  activeRequest?: any;
  at?: Date;
}) {
  if (!animal) return { isEligible: false, code: "ANIMAL_REQUIRED", reason: "Select an animal first." };
  if (String(animal.gender || animal.sex || "").toLowerCase() !== "female") {
    return { isEligible: false, code: "FEMALE_REQUIRED", reason: "Artificial insemination is only available for female animals." };
  }

  const age = checkInseminationAgeEligibility(animal.birthDate, animal.species || "Cattle");
  if (!age.isEligible) return { isEligible: false, code: age.code || "AGE_INELIGIBLE", reason: age.reason };

  const status = String(animal.reproductiveStatus || "");
  if (status === "Pregnant") {
    return { isEligible: false, code: "ACTIVE_PREGNANCY", reason: "There is already an active pregnancy registered for this animal." };
  }
  if (["Inseminated", "Likely Pregnant"].includes(status)) {
    return { isEligible: false, code: "ACTIVE_REPRODUCTIVE_WORKFLOW", reason: "This animal is currently under reproductive monitoring." };
  }

  const inferredActiveRequest =
    activeRequest ||
    animal.inseminations?.find((item: any) =>
      ACTIVE_AI_STATUSES.has(String(item?.status || "").toLowerCase()),
    );
  if (inferredActiveRequest) {
    return { isEligible: false, code: "ACTIVE_AI_REQUEST_EXISTS", reason: "This animal already has an active AI service request." };
  }

  if (animal.lastCalvingDate) {
    const recovery = verifyPostpartumWindow(
      animal.lastCalvingDate,
      at,
      animal.species || "Cattle",
      animal.breed,
    );
    if (!recovery.isSafe) {
      return {
        isEligible: false,
        code: "POSTPARTUM_RECOVERY",
        reason: `Animal is in postpartum recovery. ${recovery.requiredDays} days are required; ${recovery.daysPassed} days have passed.`,
      };
    }
  }

  return { isEligible: true, code: "AVAILABLE", reason: "Animal is eligible for AI service." };
}

export function getReInseminationAvailability(animal: any) {
  const attempts = [...(animal?.inseminations || [])].sort(
    (a: any, b: any) =>
      (b.attemptNumber || 0) - (a.attemptNumber || 0) ||
      new Date(b.inseminationDate || b.createdAt || 0).getTime() -
        new Date(a.inseminationDate || a.createdAt || 0).getTime(),
  );
  const activeRequest = attempts.find((item: any) =>
    ACTIVE_AI_STATUSES.has(String(item?.status || "").toLowerCase()),
  );
  const latestAttempt = attempts.find(
    (item: any) =>
      String(item?.status || "").toLowerCase() === "done" &&
      item?.inseminationDate,
  );
  const failureAllowed = ["return_to_heat", "negative_pd"].includes(
    String(latestAttempt?.failureReason || ""),
  );
  const verifiedFailure =
    latestAttempt?.isSuccess === false &&
    String(latestAttempt?.outcome || "").startsWith("Failed") &&
    (latestAttempt?.outcomeVerificationStatus === "verified" ||
      latestAttempt?.farmerOutcomeReport === "return_to_heat" ||
      Boolean(latestAttempt?.reviewedBy) ||
      latestAttempt?.outcome === "Failed (Negative PD)");

  return {
    isAvailable: Boolean(
      latestAttempt &&
        verifiedFailure &&
        failureAllowed &&
        !activeRequest &&
        animal?.reproductiveStatus !== "Pregnant" &&
        animal?.reproductiveStatus !== "Inseminated",
    ),
    latestAttempt,
    activeRequest,
  };
}
