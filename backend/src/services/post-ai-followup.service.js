import { Insemination } from "../models/insemination.model.js";
import { Task } from "../models/task.model.js";
import { getHeatReturnMonitoringDates } from "../domain/reproduction-policy.js";
import { PREGNANCY_TASK_STAGE } from "../domain/pregnancy-task-workflow.js";
import {
  getMethodThresholdForSpecies,
  LEGACY_PREGNANCY_POLICY_VERSION,
} from "../domain/pregnancy-confirmation-policy.js";
import { loadPregnancyConfirmationPolicy } from "./pregnancy-policy.service.js";
import { buildInseminationIdMatch } from "./breeding-observation-followup.service.js";

const addUtcDays = (value, days) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

export const ensurePostAICompletionFollowUps = async ({
  inseminationId,
  inseminationDate,
  farmerId,
  technicianId,
  animalId,
  animalTag,
  animalSpecies,
  now = new Date(),
  skipExpiredBreedingFollowUp = true,
  previousRecordEntry = false,
  session = null,
  TaskModel = Task,
  InseminationModel = Insemination,
  policyLoader = loadPregnancyConfirmationPolicy,
}) => {
  const serviceDate = new Date(inseminationDate);
  if (Number.isNaN(serviceDate.getTime())) {
    throw new TypeError("A valid insemination date is required for post-AI follow-up.");
  }

  const policyResolution = await policyLoader({ at: serviceDate, session });
  const policyVersion =
    policyResolution.mode === "method_based"
      ? policyResolution.policy.version
      : LEGACY_PREGNANCY_POLICY_VERSION;
  const enabledThresholds =
    policyResolution.mode === "method_based"
      ? policyResolution.policy.methods
          .filter((method) => method.enabled)
          .map((method) =>
            getMethodThresholdForSpecies(method, animalSpecies),
          )
          .filter((threshold) => threshold !== null)
      : [];
  const initialConfirmationDays = enabledThresholds.length
    ? Math.min(...enabledThresholds)
    : 60;
  const inseminationIdMatch = buildInseminationIdMatch(inseminationId);

  const pdTask = await TaskModel.findOneAndUpdate(
    {
      taskType: "PD",
      sourceType: "automatic_pd_followup",
      "metadata.inseminationId": inseminationIdMatch,
    },
    {
      $setOnInsert: {
        technicianId,
        farmerId,
        animalIds: [animalId],
        taskType: "PD",
        category: "Follow-up",
        priority: 2,
        notes: `Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #${animalTag || "Unknown"}.`,
        status: "Pending",
        dueDate: addUtcDays(serviceDate, initialConfirmationDays),
        sourceType: "automatic_pd_followup",
        relatedRecordType: "insemination",
        relatedRecordId: inseminationId,
        metadata: {
          workflowStage: PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
          animalId,
          farmerId,
          inseminationId,
          policyVersion,
          ...(previousRecordEntry ? { previousRecordEntry: true } : {}),
        },
      },
    },
    { upsert: true, returnDocument: "after", session },
  );

  await InseminationModel.updateOne(
    { _id: inseminationId },
    { $set: { verificationTaskId: pdTask._id } },
    { session },
  );

  const { technicianFollowUpDate } =
    getHeatReturnMonitoringDates(serviceDate);
  const followUpStillRelevant =
    !skipExpiredBreedingFollowUp ||
    technicianFollowUpDate.getTime() >= new Date(now).getTime();
  let breedingFollowUpTask = null;

  if (followUpStillRelevant) {
    breedingFollowUpTask = await TaskModel.findOneAndUpdate(
      {
        taskType: "BreedingFollowUp",
        "metadata.inseminationId": inseminationIdMatch,
      },
      {
        $setOnInsert: {
          technicianId,
          farmerId,
          animalIds: [animalId],
          taskType: "BreedingFollowUp",
          category: "Follow-up",
          priority: 2,
          notes: `Scheduled Breeding Follow-up for Animal Tag #${animalTag || "Unknown"}. Contact the farmer to check if the animal returned to heat.`,
          status: "Pending",
          dueDate: technicianFollowUpDate,
          sourceType: "automatic_breeding_followup",
          relatedRecordType: "insemination",
          relatedRecordId: inseminationId,
          metadata: {
            animalId,
            farmerId,
            inseminationId,
            ...(previousRecordEntry ? { previousRecordEntry: true } : {}),
          },
        },
      },
      { upsert: true, returnDocument: "after", session },
    );
  }

  return { pdTask, breedingFollowUpTask };
};
