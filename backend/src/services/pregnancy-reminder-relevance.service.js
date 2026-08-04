import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { getPregnancyTaskStage, PREGNANCY_TASK_STAGE } from "../domain/pregnancy-task-workflow.js";
import { loadPregnancyConfirmationPolicy } from "./pregnancy-policy.service.js";

export const getLegacyPregnancyReminderRelevance = async ({ inseminationId }) => {
  const [insemination, pregnancy, task, policyResolution] = await Promise.all([
    Insemination.findOne({ _id: inseminationId, deletedAt: null }),
    Pregnancy.findOne({ inseminationId, deletedAt: null }),
    Task.findOne({
      taskType: "PD",
      "metadata.inseminationId": inseminationId,
      status: { $nin: ["Completed", "Cancelled"] },
    }).sort({ createdAt: -1 }),
    loadPregnancyConfirmationPolicy(),
  ]);

  if (!insemination) return { isRelevant: false, reason: "INSEMINATION_NOT_FOUND" };
  if (pregnancy) return { isRelevant: false, reason: "OFFICIAL_PREGNANCY_EXISTS" };
  if (policyResolution.mode !== "legacy_day_60") {
    return { isRelevant: false, reason: "POLICY_CHANGED" };
  }
  if (
    insemination.status !== "done" ||
    insemination.isSuccess !== null ||
    ["completed", "lost"].includes(insemination.breedingCycleStatus)
  ) {
    return { isRelevant: false, reason: "LIFECYCLE_NOT_PENDING" };
  }
  if (task && getPregnancyTaskStage(task) !== PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION) {
    return { isRelevant: false, reason: "TASK_STAGE_CHANGED" };
  }
  return { isRelevant: true, reason: "LEGACY_INITIAL_CONFIRMATION_PENDING", insemination, task };
};

