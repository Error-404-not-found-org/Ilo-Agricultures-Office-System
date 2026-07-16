import { verifyPostpartumWindow } from "../utils/cattleCore.js";
import { ANIMAL_REPRODUCTIVE_STATUS } from "./status-vocabulary.js";

export const ACTIVE_REPRODUCTION_PHASES = new Set([
  "AI Requested",
  "Scheduled",
  "Inseminated",
  "Heat Return Monitoring",
  "Pregnancy Check Due",
  "Pregnancy Monitoring",
  ANIMAL_REPRODUCTIVE_STATUS.PREGNANT,
  "Calving Due",
  "Recovery Period",
]);

export const getReproductionEligibility = ({
  animal,
  activeRequest,
  activePregnancy,
  now = new Date(),
}) => {
  if (
    activePregnancy ||
    animal.reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
  ) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason:
        "There is already an active pregnancy registered for this animal.",
    };
  }

  if (
    activeRequest ||
    ACTIVE_REPRODUCTION_PHASES.has(animal.reproductiveStatus)
  ) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: `A new AI request cannot be created while the animal is in the "${animal.reproductiveStatus}" reproductive workflow.`,
      nextActionAt:
        animal.nextReproductiveActionDate ||
        animal.expectedCalvingDate ||
        undefined,
    };
  }

  if (animal.lastCalvingDate) {
    const recovery = verifyPostpartumWindow(
      animal.lastCalvingDate,
      now,
      animal.species,
      animal.breed,
    );

    if (!recovery.isSafe) {
      const nextActionAt = new Date(animal.lastCalvingDate);
      nextActionAt.setDate(nextActionAt.getDate() + recovery.requiredDays);

      return {
        eligible: false,
        code: "POSTPARTUM_RECOVERY",
        reason: `The animal is still within the postpartum recovery period. Rebreeding is allowed after ${recovery.requiredDays} days post-calving.`,
        nextActionAt,
        requiredRecoveryDays: recovery.requiredDays,
        daysSinceCalving: recovery.daysPassed,
      };
    }
  }

  return {
    eligible: true,
    code: "AVAILABLE",
    reason: "Animal is available for an AI service request.",
  };
};
