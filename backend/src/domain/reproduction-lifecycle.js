import { verifyPostpartumWindow } from "../utils/cattleCore.js";
import {
  ANIMAL_REPRODUCTIVE_STATUS,
  normalizeAnimalReproductiveStatus,
} from "./status-vocabulary.js";
import { resolveReproductionNextAction } from "./reproduction-next-action.js";

export const resolveEffectiveReproductiveStatus = ({
  animal,
  now = new Date(),
} = {}) => {
  const storedStatus = normalizeAnimalReproductiveStatus(
    animal?.reproductiveStatus,
  );
  if (storedStatus !== ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM) {
    return storedStatus;
  }

  const recoveryAnchor =
    animal?.lastCalvingDate || animal?.lastPregnancyLossDate;
  if (!recoveryAnchor) return storedStatus;

  const recovery = verifyPostpartumWindow(
    recoveryAnchor,
    now,
    animal?.species,
    animal?.breed,
  );
  return recovery.isSafe
    ? ANIMAL_REPRODUCTIVE_STATUS.NORMAL
    : storedStatus;
};

export const getReproductionEligibility = ({
  animal,
  activeRequest = null,
  activePregnancy = null,
  tasks = [],
  now = new Date(),
}) => {
  const effectiveReproductiveStatus = resolveEffectiveReproductiveStatus({
    animal,
    now,
  });
  const effectiveAnimal =
    effectiveReproductiveStatus === animal?.reproductiveStatus
      ? animal
      : {
          ...(typeof animal?.toObject === "function"
            ? animal.toObject()
            : animal),
          reproductiveStatus: effectiveReproductiveStatus,
        };
  const nextAction = resolveReproductionNextAction({
    animal: effectiveAnimal,
    activeRequest,
    activePregnancy,
    tasks,
    now,
  });

  // A confirmed pregnancy always blocks another AI request.
  if (
    activePregnancy ||
    effectiveReproductiveStatus === ANIMAL_REPRODUCTIVE_STATUS.PREGNANT
  ) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason:
        "There is already an active pregnancy registered for this animal.",
      effectiveReproductiveStatus,
      nextAction,
      nextActionAt: nextAction?.at || undefined,
    };
  }

  // Postpartum recovery should return its specific code and recovery details
  // instead of being handled as a generic active reproductive workflow.
  const recoveryAnchor = animal.lastCalvingDate || animal.lastPregnancyLossDate;
  if (recoveryAnchor) {
    const recovery = verifyPostpartumWindow(
      recoveryAnchor,
      now,
      animal.species,
      animal.breed,
    );

    if (!recovery.isSafe) {
      let nextActionAt = nextAction?.at || null;

      // Keep a safe fallback in case the resolver cannot produce the date.
      if (!nextActionAt) {
        nextActionAt = new Date(recoveryAnchor);
        nextActionAt.setDate(nextActionAt.getDate() + recovery.requiredDays);
      }

      return {
        eligible: false,
        code: "POSTPARTUM_RECOVERY",
        reason: `The animal is still within the postpartum recovery period. Rebreeding is allowed after ${recovery.requiredDays} days post-calving.`,
        effectiveReproductiveStatus,
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
        ? "An artificial insemination service has already been scheduled for this animal."
        : "A new AI request cannot be created while another AI request is active.",
      effectiveReproductiveStatus,
      nextAction,
      nextActionAt: nextAction?.at || undefined,
    };
  }

  return {
    eligible: true,
    code: "AVAILABLE",
    reason: "Animal is available for an AI service request.",
    effectiveReproductiveStatus,
    nextAction: null,
  };
};
