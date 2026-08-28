import {
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "./cattleCore";
import {
  getAuthoritativeReproductiveStatus,
  isBackendPostpartumRecovery,
  shouldUseLegacyPostpartumFallback,
} from "./reproductionAuthority";

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
  minimumDays: number | null;
  availableDate: string | null;
  availableDateLabel?: string;
  policyVersion?: string;
  policyMode?: "legacy_day_60" | "method_based";
  methods?: {
    methodCode: string;
    label: string;
    enabled: boolean;
    isEligible: boolean;
    earliestDaysPostAI: number | null;
    availableDate: string | null;
    availableDateLabel?: string | null;
    daysRemaining: number | null;
    reasonCode: string;
    reason: string;
  }[];
  earliestAvailableMethod?: unknown;
  continuationRecheck?: unknown;
}

export function getPregnancyCheckReadiness(
  insemination: any,
  _at: Date = new Date(),
): PregnancyCheckReadiness {
  const serverReadiness = insemination?.pregnancyReadiness;
  if (serverReadiness) return serverReadiness as PregnancyCheckReadiness;
  return {
    isEligible: false,
    code: "PREGNANCY_READINESS_REQUIRED",
    reason: "Authoritative pregnancy readiness is unavailable. Refresh this record before continuing.",
    daysPostAI: null,
    minimumDays: null,
    availableDate: null,
    policyMode: "legacy_day_60",
    methods: [],
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

  const status = getAuthoritativeReproductiveStatus(animal);
  if (status === "Pregnant") {
    return { isEligible: false, code: "ACTIVE_PREGNANCY", reason: "This animal is currently pregnant." };
  }

  const inferredActiveRequest =
    activeRequest ||
    animal.inseminations?.find((item: any) =>
      ACTIVE_AI_STATUSES.has(String(item?.status || "").toLowerCase()),
    );
  if (inferredActiveRequest) {
    const isScheduled = ["scheduled", "in-progress", "in_progress"].includes(String(inferredActiveRequest.status).toLowerCase());
    return {
      isEligible: false,
      code: "ACTIVE_AI_REQUEST_EXISTS",
      reason: isScheduled ? "AI service is already in progress." : "An AI request is already active."
    };
  }

  const isRecheck = animal.inseminations?.[0]?.pregnancyFollowUpTask?.metadata?.workflowStage === "diagnostic_follow_up";

  if (isBackendPostpartumRecovery(animal)) {
    return {
      isEligible: false,
      code: "POSTPARTUM_RECOVERY",
      reason: "This animal is still in postpartum recovery.",
    };
  }

  if (animal.nextAction) {
    if (animal.nextAction.phase === "PREGNANCY_CHECK_DUE" || animal.nextAction.phase === "PREGNANCY_MONITORING") {
      return {
        isEligible: false,
        code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
        reason: isRecheck ? "Pregnancy recheck is still pending." : "Pregnancy check is still pending."
      };
    }
    if (animal.nextAction.phase === "HEAT_RETURN_MONITORING" || animal.nextAction.phase === "CALVING_DUE") {
      return {
        isEligible: false,
        code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
        reason: "Waiting for the current breeding cycle result."
      };
    }
  }

  // Fallback if nextAction is not provided by the current context
  if (["Inseminated", "Likely Pregnant"].includes(status)) {
    return {
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: isRecheck ? "Pregnancy recheck is still pending." : (status === "Likely Pregnant" ? "Pregnancy check is still pending." : "Waiting for the current breeding cycle result.")
    };
  }

  if (shouldUseLegacyPostpartumFallback(animal) && animal.lastCalvingDate) {
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
        reason: `This animal is still in postpartum recovery.`,
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
