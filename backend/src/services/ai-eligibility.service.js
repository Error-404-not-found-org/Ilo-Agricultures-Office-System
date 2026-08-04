import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { checkInseminationAgeEligibility } from "../utils/cattleCore.js";
import { findActiveAIRequest } from "./ai-request-creation.service.js";
import { getReproductionEligibility } from "../domain/reproduction-lifecycle.js";
import { TASK_STATUS } from "../domain/status-vocabulary.js";

export const getStaticAnimalAIEligibility = (animal) => {
  if (String(animal?.gender || "").toLowerCase() !== "female") {
    return {
      eligible: false,
      code: "FEMALE_REQUIRED",
      reason: "Artificial insemination is only available for female animals.",
    };
  }

  const age = checkInseminationAgeEligibility(animal.birthDate, animal.species);
  if (!age.isEligible) {
    return { eligible: false, code: age.code, reason: age.reason };
  }

  if (animal.reproductiveStatus === "Pregnant") {
    return {
      eligible: false,
      code: "ACTIVE_PREGNANCY",
      reason: "There is already an active pregnancy registered for this animal.",
    };
  }
  if (["Inseminated", "Likely Pregnant"].includes(animal.reproductiveStatus)) {
    return {
      eligible: false,
      code: "ACTIVE_REPRODUCTIVE_WORKFLOW",
      reason: "This animal is currently under reproductive monitoring.",
    };
  }

  return { eligible: true, code: "STATIC_CHECKS_PASSED" };
};

export const getAnimalAIEligibility = async ({ animal, at = new Date() }) => {
  const staticEligibility = getStaticAnimalAIEligibility(animal);
  if (!staticEligibility.eligible) return staticEligibility;

  const [activeRequest, activePregnancy, tasks] = await Promise.all([
    findActiveAIRequest(animal._id),
    Pregnancy.findOne({
      animalId: animal._id,
      deletedAt: null,
      "pregnancyDiagnosis.result": "Pregnant",
      cycleStatus: { $nin: ["completed", "lost"] },
    }).lean(),
    Task.find({
      animalIds: animal._id,
      taskType: { $in: ["AI", "PD", "Calving", "CD"] },
      status: { $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] },
    }).lean(),
  ]);

  const lifecycle = getReproductionEligibility({
    animal,
    activeRequest,
    activePregnancy,
    tasks,
    now: at,
  });
  return {
    ...lifecycle,
    activeRequest,
  };
};
