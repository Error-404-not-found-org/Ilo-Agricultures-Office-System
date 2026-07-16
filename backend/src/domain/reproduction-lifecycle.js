import { verifyPostpartumWindow } from "../utils/cattleCore.js";
import { ANIMAL_REPRODUCTIVE_STATUS } from "./status-vocabulary.js";
import { resolveReproductionNextAction } from "./reproduction-next-action.js";

export const getReproductionEligibility = ({
  animal,
  activeRequest = null,
  activePregnancy = null,
  tasks = [],
  now = new Date(),
}) => {
  const nextAction = resolveReproductionNextAction({
    animal,
    activeRequest,
    activePregnancy,
    tasks,
    now,
  });

  // A confirmed pregnancy always blocks another AI request.
  if (
    activePregnancy ||
    animal.reproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
  ) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason:
        "There is already an active pregnancy registered for this animal.",
      nextAction,
      nextActionAt: nextAction?.at || undefined,
    };
  }

  // Postpartum recovery should return its specific code and recovery details
  // instead of being handled as a generic active reproductive workflow.
  if (animal.lastCalvingDate) {
    const recovery = verifyPostpartumWindow(
      animal.lastCalvingDate,
      now,
      animal.species,
      animal.breed,
    );

    if (!recovery.isSafe) {
      let nextActionAt = nextAction?.at || null;

      // Keep a safe fallback in case the resolver cannot produce the date.
      if (!nextActionAt) {
        nextActionAt = new Date(animal.lastCalvingDate);
        nextActionAt.setDate(nextActionAt.getDate() + recovery.requiredDays);
      }

      return {
        eligible: false,
        code: "POSTPARTUM_RECOVERY",
        reason: `The animal is still within the postpartum recovery period. Rebreeding is allowed after ${recovery.requiredDays} days post-calving.`,
        nextAction,
        nextActionAt,
        requiredRecoveryDays: recovery.requiredDays,
        daysSinceCalving: recovery.daysPassed,
      };
    }
  }

  // Block AI while another request or reproductive follow-up is active.
  if (activeRequest || nextAction) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: nextAction
        ? `A new AI request cannot be created while the animal is in the "${nextAction.phase}" reproductive workflow.`
        : "A new AI request cannot be created while another AI request is active.",
      nextAction,
      nextActionAt: nextAction?.at || undefined,
    };
  }

  return {
    eligible: true,
    code: "AVAILABLE",
    reason: "Animal is available for an AI service request.",
    nextAction: null,
  };
};
