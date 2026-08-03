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

  const status = String(animal.reproductiveStatus || "");
  if (status === "Pregnant") {
    return { isEligible: false, code: "ACTIVE_PREGNANCY", reason: "There is already an active pregnancy registered for this animal." };
  }
  if (["Inseminated", "Likely Pregnant"].includes(status)) {
    return { isEligible: false, code: "ACTIVE_REPRODUCTIVE_WORKFLOW", reason: "This animal is currently under reproductive monitoring." };
  }

  const inferredActiveRequest =
    activeRequest ||
    animal.inseminations?.find((item) =>
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
