import {
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "./cattleCore";

const ACTIVE_AI_STATUSES = new Set([
  "pending",
  "approved",
  "scheduled",
  "in-progress",
]);

export function getAIEligibility({
  animal,
  activeRequest,
  at = new Date(),
}) {
  if (!animal) return { isEligible: false, code: "ANIMAL_REQUIRED", reason: "Select an animal first." };
  
  if (String(animal.gender || animal.sex || "").toLowerCase() !== "female") {
    return { isEligible: false, code: "FEMALE_REQUIRED", reason: "Artificial insemination is only available for female animals." };
  }

  const age = checkInseminationAgeEligibility(animal.birthDate, animal.species || "Cattle");
  if (!age.isEligible) return { isEligible: false, code: age.code || "AGE_INELIGIBLE", reason: age.reason };

  const status = String(
    animal.effectiveReproductiveStatus || animal.reproductiveStatus || "",
  );
  if (status === "Pregnant") {
    return {
      isEligible: false,
      code: "ACTIVE_PREGNANCY",
      reason: "This animal is currently pregnant.",
    };
  }

  const inferredActiveRequest =
    activeRequest ||
    animal.inseminations?.find((item) =>
      ACTIVE_AI_STATUSES.has(String(item?.status || "").toLowerCase()),
    );
  
  if (inferredActiveRequest) {
    return { isEligible: false, code: "ACTIVE_AI_REQUEST_EXISTS", reason: "This animal already has an active AI service request." };
  }

  const currentAttempt = animal.inseminations?.find(
    (item) => item?.entryMode !== "history_only",
  );
  const isRecheck =
    currentAttempt?.pregnancyFollowUpTask?.metadata?.workflowStage ===
    "diagnostic_follow_up";

  if (
    status === "Post-partum" ||
    animal.nextAction?.type === "WAIT_FOR_POSTPARTUM_RECOVERY" ||
    animal.nextAction?.phase === "RECOVERY_PERIOD"
  ) {
    return {
      isEligible: false,
      code: "POSTPARTUM_RECOVERY",
      reason: "This animal is still in postpartum recovery.",
    };
  }

  if (
    ["PREGNANCY_CHECK_DUE", "PREGNANCY_MONITORING"].includes(
      animal.nextAction?.phase,
    ) ||
    animal.nextAction?.type === "PERFORM_PREGNANCY_DIAGNOSIS"
  ) {
    return {
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: isRecheck
        ? "Pregnancy recheck is still pending."
        : "Pregnancy check is still pending.",
    };
  }

  if (
    ["HEAT_RETURN_MONITORING", "CALVING_DUE"].includes(
      animal.nextAction?.phase,
    ) ||
    animal.nextAction?.type === "MONITOR_RETURN_TO_HEAT"
  ) {
    return {
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "Waiting for the current breeding cycle result.",
    };
  }

  if (["Inseminated", "Likely Pregnant"].includes(status)) {
    return {
      isEligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: isRecheck
        ? "Pregnancy recheck is still pending."
        : status === "Likely Pregnant"
          ? "Pregnancy check is still pending."
          : "Waiting for the current breeding cycle result.",
    };
  }

  const hasAuthoritativeRecoveryState = Boolean(
    animal.effectiveReproductiveStatus || animal.nextAction,
  );
  if (!hasAuthoritativeRecoveryState && animal.lastCalvingDate) {
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
