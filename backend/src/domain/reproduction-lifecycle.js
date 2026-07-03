import { verifyPostpartumWindow } from "../utils/cattleCore.js";

export const ACTIVE_REPRODUCTION_PHASES = new Set([
  "AI Requested", "Scheduled", "Inseminated", "Heat Return Monitoring", "Pregnancy Check Due",
  "Pregnancy Monitoring", "Pregnant", "Calving Due", "Recovery Period",
]);

export const getReproductionEligibility = ({ animal, activeRequest, activePregnancy, now = new Date() }) => {
  if (activePregnancy || animal.reproductiveStatus === "Pregnant") {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "There is already an active pregnancy registered for this animal.",
    };
  }

  if (activeRequest || ACTIVE_REPRODUCTION_PHASES.has(animal.reproductiveStatus)) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "AI request is not available yet. This animal is currently under reproductive monitoring.",
      nextActionAt: animal.expectedCalvingDate || undefined,
    };
  }

  if (animal.lastCalvingDate) {
    const recovery = verifyPostpartumWindow(animal.lastCalvingDate, now, animal.species, animal.breed);
    if (!recovery.isSafe) {
      const nextActionAt = new Date(animal.lastCalvingDate);
      nextActionAt.setDate(nextActionAt.getDate() + recovery.requiredDays);
      return {
        eligible: false,
        code: "POSTPARTUM_RECOVERY",
        reason: "The animal is in the postpartum recovery lockout window (45 days post-calving).",
        nextActionAt,
      };
    }
  }

  return { eligible: true, code: "AVAILABLE", reason: "Animal is available for an AI service request." };
};
