import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { AnimalTimelineEvent } from "../models/animal-timeline-event.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { ANIMAL_REPRODUCTIVE_STATUS } from "../domain/livestock-workflow.js";
import { assertPregnancyDiagnosisWindow } from "../domain/pregnancy-readiness.js";
import {
  LEGACY_PREGNANCY_DIAGNOSIS_DAYS,
  PREGNANCY_DIAGNOSIS_RESULTS,
} from "../domain/pregnancy-confirmation-policy.js";
import {
  getPregnancyTaskStage,
  PREGNANCY_TASK_STAGE,
} from "../domain/pregnancy-task-workflow.js";
import { loadPregnancyConfirmationPolicy } from "./pregnancy-policy.service.js";
import { calculateTargetCalvingDate } from "../utils/cattleCore.js";
import { AppError } from "../utils/app-error.js";
import {
  buildInseminationIdMatch,
  closeBreedingFollowUpTask,
} from "./breeding-observation-followup.service.js";
import {
  assertNoConflictingPregnancyTaskOwners,
  assertPregnancyClinicalActor,
  assertPregnancyMutationAuthority,
} from "../policies/pregnancy-mutation.policy.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const FINAL_RESULT_MAP = Object.freeze({
  pregnant: "Pregnant",
  Pregnant: "Pregnant",
  not_pregnant: "Empty",
  Empty: "Empty",
});

const runTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } finally {
    await session.endSession();
  }
};

const assertAuthorizedActor = (actor) => {
  assertPregnancyClinicalActor(actor);
};

const normalizeResult = (result) => {
  const normalized = FINAL_RESULT_MAP[result];
  if (!normalized || !PREGNANCY_DIAGNOSIS_RESULTS.includes(normalized)) {
    throw new AppError("Pregnancy diagnosis result must be Pregnant or Empty.", {
      status: 422,
      code: "INVALID_PREGNANCY_RESULT",
    });
  }
  return normalized;
};

const loadContext = async ({ animalId, inseminationId, session }) => {
  const animal = await Animal.findOne({ _id: animalId, deletedAt: null }).session(session);
  if (!animal) throw new AppError("Animal not found.", { status: 404, code: "ANIMAL_NOT_FOUND" });
  const insemination = await Insemination.findOne({
    _id: inseminationId,
    animalId: animal._id,
    deletedAt: null,
  }).session(session);
  if (!insemination) {
    throw new AppError("Insemination attempt not found for this animal.", {
      status: 404,
      code: "INSEMINATION_NOT_FOUND",
    });
  }
  if (String(insemination.farmerId) !== String(animal.farmerId)) {
    throw new AppError("The insemination owner does not match the animal owner.", {
      status: 409,
      code: "INSEMINATION_OWNER_MISMATCH",
    });
  }
  return { animal, insemination };
};

const findInitialConfirmationTask = async ({
  taskId,
  animal,
  insemination,
  includeCompleted = false,
  session,
}) => {
  const baseQuery = {
    farmerId: animal.farmerId,
    animalIds: animal._id,
    taskType: "PD",
    status: includeCompleted
      ? { $ne: "Cancelled" }
      : { $nin: ["Completed", "Cancelled"] },
  };
  const query = taskId
    ? {
        ...baseQuery,
        _id: taskId,
      }
    : {
        ...baseQuery,
        $and: [{ $or: [
          { "metadata.inseminationId": buildInseminationIdMatch(insemination._id) },
          ...(insemination.verificationTaskId
            ? [{ _id: insemination.verificationTaskId }]
            : []),
        ] }],
      };
  const candidates = taskId
    ? [await Task.findOne(query).session(session)]
    : await Task.find(query).sort({ createdAt: 1 }).session(session);
  const task = candidates.find(
    (candidate) => candidate && getPregnancyTaskStage(candidate) === PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
  );
  if (taskId && !task) {
    throw new AppError("The pregnancy-check task is not an active initial-confirmation task for this animal.", {
      status: 409,
      code: "TASK_RECORD_MISMATCH",
    });
  }
  return task || null;
};

const assertInitialRelatedTaskOwners = async ({
  actor,
  insemination,
  session,
}) => {
  const tasks = await Task.find({
    taskType: { $in: ["PD", "BreedingFollowUp"] },
    status: { $nin: ["Completed", "Cancelled", "Rejected"] },
    $or: [
      { "metadata.inseminationId": buildInseminationIdMatch(insemination._id) },
      ...(insemination.verificationTaskId
        ? [{ _id: insemination.verificationTaskId }]
        : []),
    ],
  }).session(session);
  assertNoConflictingPregnancyTaskOwners({ actor, tasks });
};

export const completeInitialConfirmationTask = async ({
  taskId,
  task: suppliedTask,
  animal,
  insemination,
  pregnancy,
  actor,
  methodCode,
  policyVersion,
  session,
}) => {
  const task = suppliedTask === undefined
    ? await findInitialConfirmationTask({ taskId, animal, insemination, session })
    : suppliedTask;
  assertPregnancyMutationAuthority({
    actor,
    task,
    pregnancy,
    insemination,
    allowUnassignedTaskClaim: Boolean(taskId),
  });
  if (!task) return null;

  task.status = "Completed";
  task.completedAt = new Date();
  task.technicianId ||= actor._id;
  task.relatedRecordType = "pregnancy";
  task.relatedRecordId = pregnancy._id;
  task.metadata = {
    ...(task.metadata || {}),
    workflowStage: PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
    animalId: animal._id,
    farmerId: animal.farmerId,
    inseminationId: insemination._id,
    pregnancyId: pregnancy._id,
    methodCode: methodCode || null,
    policyVersion,
  };
  await task.save({ session });
  return task;
};

const reconcileExistingDiagnosisTask = async ({
  task,
  animal,
  insemination,
  pregnancy,
  actor,
  methodCode,
  policyVersion,
  session,
}) => {
  const linkedToDiagnosis = Boolean(
    task &&
    getPregnancyTaskStage(task) === PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION &&
    (
      String(task.metadata?.inseminationId || "") === String(insemination._id) ||
      String(insemination.verificationTaskId || "") === String(task._id) ||
      (
        task.relatedRecordType === "pregnancy" &&
        String(task.relatedRecordId || "") === String(pregnancy._id)
      )
    )
  );
  if (!linkedToDiagnosis || task.status === "Cancelled") {
    throw new AppError("The pregnancy-check task does not match the existing diagnosis.", {
      status: 409,
      code: "TASK_RECORD_MISMATCH",
    });
  }
  assertPregnancyMutationAuthority({
    actor,
    task,
    pregnancy,
    insemination,
    allowUnassignedTaskClaim: true,
  });
  if (task.status === "Completed") return task;

  task.status = "Completed";
  task.completedAt = new Date();
  task.technicianId = actor._id;
  task.relatedRecordType = "pregnancy";
  task.relatedRecordId = pregnancy._id;
  task.metadata = {
    ...(task.metadata || {}),
    workflowStage: PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
    animalId: animal._id,
    farmerId: animal.farmerId,
    inseminationId: insemination._id,
    pregnancyId: pregnancy._id,
    methodCode: methodCode || null,
    policyVersion: policyVersion || null,
  };
  await task.save({ session });
  return task;
};

const ensureContinuationTask = async ({
  animal,
  insemination,
  pregnancy,
  actor,
  methodCode,
  policyVersion,
  dueDate,
  session,
}) => Task.findOneAndUpdate(
  {
    taskType: "PD",
    "metadata.workflowStage": PREGNANCY_TASK_STAGE.CONTINUATION_RECHECK,
    "metadata.pregnancyId": pregnancy._id,
  },
  {
    $setOnInsert: {
      technicianId: actor._id,
      farmerId: animal.farmerId,
      animalIds: [animal._id],
      taskType: "PD",
      category: "Follow-up",
      priority: 2,
      notes: `Pregnancy continuation recheck for Animal Tag #${animal.earTag || animal.animalId || "Unknown"}.`,
      status: "Pending",
      dueDate,
      sourceType: "automatic_pd_followup",
      relatedRecordType: "pregnancy",
      relatedRecordId: pregnancy._id,
      metadata: {
        workflowStage: PREGNANCY_TASK_STAGE.CONTINUATION_RECHECK,
        animalId: animal._id,
        farmerId: animal.farmerId,
        inseminationId: insemination._id,
        pregnancyId: pregnancy._id,
        methodCode: methodCode || null,
        policyVersion,
      },
    },
  },
  { upsert: true, returnDocument: "after", session },
);

export const executePregnancyFinalization = async ({
  animal,
  insemination,
  confirmedAt,
  actor,
  confirmationStage,
  thresholdSnapshot = null,
  methodCode = null,
  policyVersion = null,
  recheckRequired = false,
  recheckDueAt = null,
  technicianNote = "",
  sourceType,
  session,
}) => {
  const targetCalvingDate = calculateTargetCalvingDate(
    insemination.inseminationDate,
    animal.species,
    undefined,
    animal.breed,
  );

  const [pregnancy] = await Pregnancy.create([{
    animalId: animal._id,
    farmerId: animal.farmerId,
    inseminationId: insemination._id,
    pregnancyDiagnosis: { date: confirmedAt, result: "Pregnant" },
    confirmation: {
      methodCode,
      stage: confirmationStage,
      confirmedAt,
      confirmedBy: actor._id,
      policyVersion,
      earliestThresholdSnapshot: thresholdSnapshot,
      recheckRequired,
      recheckDueAt,
    },
    recheckStatus: recheckRequired ? "pending" : "not_required",
    targetCalvingDate,
    technicianNote,
  }], { session });

  await Insemination.updateOne(
    { _id: insemination._id },
    {
      $set: {
        status: "done",
        outcome: "Pregnant",
        isSuccess: true,
        pregnancyId: pregnancy._id,
        outcomeVerificationStatus: "verified",
        outcomeConfirmationSource: sourceType,
        outcomeConfirmedBy: actor._id,
        outcomeConfirmedAt: confirmedAt,
        failureReason: null,
      },
      $unset: { activeRequestKey: 1 },
    },
    { session },
  );

  await Animal.updateOne(
    { _id: animal._id },
    {
      $set: {
        reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.PREGNANT,
        expectedCalvingDate: targetCalvingDate,
      },
      $push: {
        activityLogs: {
          event: "Pregnancy Diagnosis",
          date: confirmedAt,
          description: `Pregnant diagnosis recorded${methodCode ? ` using ${methodCode}` : ""}.`,
        },
      },
    },
    { session },
  );

  await AnimalTimelineEvent.create([{
    animalId: animal._id,
    eventType: "pregnancy_confirmed",
    occurredAt: confirmedAt,
    actorId: actor._id,
    sourceType: "Pregnancy",
    sourceId: pregnancy._id,
    title: "Pregnancy confirmed",
    summary: `Pregnant${methodCode ? ` via ${methodCode}` : " via accepted farmer report"}.`,
    metadata: {
      inseminationId: insemination._id,
      methodCode: methodCode || null,
      policyVersion,
      confirmationStage,
      recheckRequired,
    },
  }], { session });

  await AuditLog.create([{
    entityType: "Pregnancy",
    entityId: pregnancy._id,
    action: "record_pregnancy_diagnosis",
    actorId: actor._id,
    after: {
      result: "Pregnant",
      animalStatus: "Pregnant",
      confirmationStage,
      recheckStatus: pregnancy.recheckStatus,
    },
    metadata: {
      inseminationId: insemination._id,
      methodCode: methodCode || null,
      policyVersion,
      earliestThresholdSnapshot: thresholdSnapshot,
    },
  }], { session });

  return pregnancy;
};

export const confirmPregnancyDiagnosis = ({
  animalId,
  inseminationId,
  result,
  diagnosisDate,
  technicianNote = "",
  methodCode,
  policyVersion: clientPolicyVersion,
  taskId,
  actor,
}) => {
  assertAuthorizedActor(actor);
  const officialResult = normalizeResult(result);
  const confirmedAt = diagnosisDate ? new Date(diagnosisDate) : new Date();
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new AppError("A valid diagnosis date is required.", {
      status: 400,
      code: "DIAGNOSIS_DATE_INVALID",
    });
  }
  if (confirmedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError("Diagnosis date cannot be in the future.", {
      status: 400,
      code: "DIAGNOSIS_DATE_IN_FUTURE",
    });
  }

  return runTransaction(async (session) => {
    const { animal, insemination } = await loadContext({ animalId, inseminationId, session });
    const existing = await Pregnancy.findOne({ inseminationId: insemination._id, deletedAt: null }).session(session);
    if (existing) {
      if (!taskId) {
        throw new AppError("Pregnancy diagnosis already recorded for this insemination attempt.", {
          status: 409,
          code: "PREGNANCY_DIAGNOSIS_EXISTS",
        });
      }
      const existingResult = normalizeResult(existing.pregnancyDiagnosis?.result);
      if (existingResult !== officialResult) {
        throw new AppError(
          `This insemination already has an official ${existingResult} diagnosis. Use the audited correction workflow to change it.`,
          {
            status: 409,
            code: "PREGNANCY_DIAGNOSIS_CONFLICT",
          },
        );
      }
      const initialTask = await findInitialConfirmationTask({
        taskId,
        animal,
        insemination,
        includeCompleted: true,
        session,
      });
      await assertInitialRelatedTaskOwners({ actor, insemination, session });
      const completedTask = await reconcileExistingDiagnosisTask({
        task: initialTask,
        animal,
        insemination,
        pregnancy: existing,
        actor,
        methodCode: existing.confirmation?.methodCode || methodCode || null,
        policyVersion: existing.confirmation?.policyVersion || clientPolicyVersion || null,
        session,
      });
      return {
        pregnancy: existing,
        animal,
        insemination,
        completedTask,
        continuationTask: null,
        pregnancyReadiness: null,
        alreadyRecorded: true,
      };
    }
    const initialTask = await findInitialConfirmationTask({
      taskId,
      animal,
      insemination,
      session,
    });
    await assertInitialRelatedTaskOwners({ actor, insemination, session });
    assertPregnancyMutationAuthority({
      actor,
      task: initialTask,
      insemination,
      allowUnassignedTaskClaim: Boolean(taskId),
    });
    if (confirmedAt < new Date(insemination.inseminationDate)) {
      throw new AppError("Diagnosis date cannot be earlier than the AI service date.", {
        status: 400,
        code: "DIAGNOSIS_BEFORE_AI",
      });
    }

    const policyResolution = await loadPregnancyConfirmationPolicy({ at: confirmedAt, session });
    const readiness = assertPregnancyDiagnosisWindow({
      insemination,
      diagnosisDate: confirmedAt,
      policy: policyResolution.policy,
      species: animal.species,
      methodCode,
      clientPolicyVersion,
    });
    if (
      readiness.policyMode === "method_based" &&
      clientPolicyVersion &&
      clientPolicyVersion !== readiness.policyVersion
    ) {
      throw new AppError("The pregnancy confirmation policy changed. Refresh readiness before submitting.", {
        status: 409,
        code: "PREGNANCY_POLICY_CHANGED",
      });
    }
    if (
      readiness.selectedMethod &&
      !readiness.selectedMethod.isEligible
    ) {
      throw new AppError(readiness.selectedMethod.reason, {
        status: 422,
        code: "METHOD_NOT_YET_READY",
      });
    }
    const selectedPolicyMethod = policyResolution.policy?.methods?.find(
      (method) => method.methodCode === methodCode,
    );
    if (
      selectedPolicyMethod &&
      (!selectedPolicyMethod.technicianDiagnosisMayConfirm ||
        !selectedPolicyMethod.acceptedResults.includes(officialResult))
    ) {
      throw new AppError("The selected method cannot confirm this result under the active policy.", {
        status: 422,
        code: "INVALID_PREGNANCY_RESULT",
      });
    }

    const continuationDays = readiness.continuationRecheck?.milestoneDaysPostAI
      ?? LEGACY_PREGNANCY_DIAGNOSIS_DAYS;
    const recheckDueAt = new Date(insemination.inseminationDate);
    recheckDueAt.setUTCDate(recheckDueAt.getUTCDate() + continuationDays);
    const isEarly = officialResult === "Pregnant" && confirmedAt.getTime() < recheckDueAt.getTime();
    const recheckRequired = Boolean(
      isEarly && selectedPolicyMethod?.continuationRecheckRequired,
    );
    const confirmationStage = readiness.policyMode === "legacy_day_60"
      ? "legacy_unclassified"
      : isEarly
        ? "early"
        : "standard";
    const thresholdSnapshot = readiness.selectedMethod?.earliestDaysPostAI
      ?? LEGACY_PREGNANCY_DIAGNOSIS_DAYS;
    let pregnancy;
    if (officialResult === "Pregnant") {
      pregnancy = await executePregnancyFinalization({
        animal,
        insemination,
        confirmedAt,
        actor,
        confirmationStage,
        thresholdSnapshot,
        methodCode: readiness.policyMode === "method_based" ? methodCode : null,
        policyVersion: readiness.policyVersion,
        recheckRequired,
        recheckDueAt: recheckRequired ? recheckDueAt : null,
        technicianNote,
        sourceType: "technician_pregnancy_diagnosis",
        session,
      });
    } else {
      [pregnancy] = await Pregnancy.create([{
        animalId: animal._id,
        farmerId: animal.farmerId,
        inseminationId: insemination._id,
        pregnancyDiagnosis: { date: confirmedAt, result: officialResult },
        confirmation: {
          methodCode: readiness.policyMode === "method_based" ? methodCode : null,
          stage: confirmationStage,
          confirmedAt,
          confirmedBy: actor._id,
          policyVersion: readiness.policyVersion,
          earliestThresholdSnapshot: thresholdSnapshot,
          recheckRequired: false,
          recheckDueAt: null,
        },
        recheckStatus: "not_required",
        targetCalvingDate: undefined,
        technicianNote,
      }], { session });

      await Insemination.updateOne(
        { _id: insemination._id },
        {
          $set: {
            status: "done",
            outcome: "Failed (Negative PD)",
            isSuccess: false,
            pregnancyId: pregnancy._id,
            outcomeVerificationStatus: "verified",
            outcomeConfirmationSource: "technician_negative_pd",
            outcomeConfirmedBy: actor._id,
            outcomeConfirmedAt: confirmedAt,
            failureReason: "negative_pd",
          },
          $unset: { activeRequestKey: 1 },
        },
        { session },
      );
      await Animal.updateOne(
        { _id: animal._id },
        {
          $set: {
            reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.NORMAL,
            expectedCalvingDate: null,
          },
          $push: {
            activityLogs: {
              event: "Pregnancy Diagnosis",
              date: confirmedAt,
              description: `${officialResult} diagnosis recorded${methodCode ? ` using ${methodCode}` : " under legacy policy"}.`,
            },
          },
        },
        { session },
      );

      await AnimalTimelineEvent.create([{
        animalId: animal._id,
        eventType: "pregnancy_checked",
        occurredAt: confirmedAt,
        actorId: actor._id,
        sourceType: "Pregnancy",
        sourceId: pregnancy._id,
        title: "Pregnancy check recorded",
        summary: `${officialResult}${methodCode ? ` via ${methodCode}` : " under the legacy Day-60 policy"}.`,
        metadata: {
          inseminationId: insemination._id,
          methodCode: methodCode || null,
          policyVersion: readiness.policyVersion,
          confirmationStage,
          recheckRequired: false,
        },
      }], { session });
      await AuditLog.create([{
        entityType: "Pregnancy",
        entityId: pregnancy._id,
        action: "record_pregnancy_diagnosis",
        actorId: actor._id,
        after: {
          result: officialResult,
          animalStatus: "Normal",
          confirmationStage,
          recheckStatus: pregnancy.recheckStatus,
        },
        metadata: {
          inseminationId: insemination._id,
          methodCode: methodCode || null,
          policyVersion: readiness.policyVersion,
          earliestThresholdSnapshot: thresholdSnapshot,
        },
      }], { session });
    }

    const completedTask = await completeInitialConfirmationTask({
      taskId,
      task: initialTask,
      animal,
      insemination,
      pregnancy,
      actor,
      methodCode,
      policyVersion: readiness.policyVersion,
      session,
    });
    const continuationTask = recheckRequired
      ? await ensureContinuationTask({
          animal,
          insemination,
          pregnancy,
          actor,
          methodCode,
          policyVersion: readiness.policyVersion,
          dueDate: recheckDueAt,
          session,
        })
      : null;

    await closeBreedingFollowUpTask({
      inseminationId: insemination._id,
      reason: `Definitive pregnancy diagnosis recorded: ${officialResult}`,
      at: confirmedAt,
      actorId: actor._id,
      session,
    });

    return {
      pregnancy,
      animal,
      insemination,
      completedTask,
      continuationTask,
      pregnancyReadiness: readiness,
      alreadyRecorded: false,
    };
  }).catch((error) => {
    if (error?.code === 11000 && (error?.keyPattern?.inseminationId || error?.keyValue?.inseminationId)) {
      throw new AppError("Pregnancy diagnosis already recorded for this insemination attempt.", {
        status: 409,
        code: "PREGNANCY_DIAGNOSIS_EXISTS",
      });
    }
    throw error;
  });
};

export const recordPregnancyContinuationRecheck = ({
  pregnancyId,
  result,
  checkedAt = new Date(),
  notes = "",
  followUpDate,
  taskId,
  actor,
}) => {
  assertAuthorizedActor(actor);
  if (!["continuing", "loss_detected", "follow_up_required"].includes(result)) {
    throw new AppError("Invalid pregnancy continuation result.", {
      status: 422,
      code: "INVALID_PREGNANCY_RESULT",
    });
  }
  const recheckDate = new Date(checkedAt);
  if (Number.isNaN(recheckDate.getTime())) {
    throw new AppError("A valid continuation recheck date is required.", {
      status: 400,
      code: "DIAGNOSIS_DATE_INVALID",
    });
  }

  return runTransaction(async (session) => {
    const pregnancy = await Pregnancy.findOne({ _id: pregnancyId, deletedAt: null }).session(session);
    if (!pregnancy || pregnancy.pregnancyDiagnosis?.result !== "Pregnant") {
      throw new AppError("An active confirmed Pregnancy is required for continuation recheck.", {
        status: 409,
        code: "CONTINUATION_RECHECK_NOT_APPLICABLE",
      });
    }
    if (pregnancy.cycleStatus !== "active") {
      throw new AppError("This pregnancy lifecycle is no longer active.", {
        status: 409,
        code: "CONTINUATION_RECHECK_NOT_APPLICABLE",
      });
    }
    const animal = await Animal.findOne({ _id: pregnancy.animalId, deletedAt: null }).session(session);
    const insemination = await Insemination.findOne({ _id: pregnancy.inseminationId, deletedAt: null }).session(session);
    if (!animal || !insemination) {
      throw new AppError("Pregnancy lifecycle context is incomplete.", {
        status: 409,
        code: "CONTINUATION_RECHECK_NOT_APPLICABLE",
      });
    }

    let continuationTask = null;
    const taskQuery = {
      ...(taskId ? { _id: taskId } : {}),
      taskType: "PD",
      farmerId: animal.farmerId,
      animalIds: animal._id,
      "metadata.pregnancyId": buildInseminationIdMatch(pregnancy._id),
      status: { $nin: ["Completed", "Cancelled"] },
    };
    const tasks = taskId
      ? [await Task.findOne(taskQuery).session(session)]
      : await Task.find(taskQuery).sort({ dueDate: 1, createdAt: 1 }).session(session);
    continuationTask = tasks.find((task) => {
      if (!task) return false;
      const stage = getPregnancyTaskStage(task);
      return [
        PREGNANCY_TASK_STAGE.CONTINUATION_RECHECK,
        PREGNANCY_TASK_STAGE.DIAGNOSTIC_FOLLOW_UP,
      ].includes(stage);
    }) || null;
    assertNoConflictingPregnancyTaskOwners({ actor, tasks: tasks.filter(Boolean) });
    if (taskId && !continuationTask) {
      throw new AppError("The supplied task is not an active pregnancy follow-up.", {
        status: 409,
        code: "TASK_RECORD_MISMATCH",
      });
    }
    assertPregnancyMutationAuthority({
      actor,
      task: continuationTask,
      pregnancy,
      insemination,
      allowUnassignedTaskClaim: Boolean(taskId),
    });
    if (!pregnancy.confirmation?.recheckRequired && !continuationTask) {
      throw new AppError("This pregnancy does not require a continuation recheck.", {
        status: 409,
        code: "CONTINUATION_RECHECK_NOT_APPLICABLE",
      });
    }
    const configuredDueAt = pregnancy.confirmation?.recheckDueAt
      ? new Date(pregnancy.confirmation.recheckDueAt)
      : continuationTask?.dueDate
        ? new Date(continuationTask.dueDate)
        : null;
    if (configuredDueAt && recheckDate < configuredDueAt) {
      throw new AppError("The continuation recheck milestone has not been reached.", {
        status: 422,
        code: "CONTINUATION_RECHECK_NOT_APPLICABLE",
        details: { availableDate: configuredDueAt.toISOString() },
      });
    }

    const pregnancySet = {
      recheckStatus: result,
      "confirmation.recheckRequired": false,
    };
    const animalSet = {};
    const inseminationSet = {};
    if (result === "loss_detected") {
      pregnancySet.cycleStatus = "lost";
      pregnancySet.completedAt = recheckDate;
      animalSet.reproductiveStatus = ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM;
      animalSet.lastPregnancyLossDate = recheckDate;
      animalSet.expectedCalvingDate = null;
      inseminationSet.breedingCycleStatus = "lost";
      inseminationSet.breedingCycleCompletedAt = recheckDate;
      inseminationSet.outcome = "Failed (Aborted)";
      inseminationSet.failureReason = "aborted";
    }
    await Pregnancy.updateOne({ _id: pregnancy._id }, { $set: pregnancySet }, { session });
    if (Object.keys(animalSet).length) {
      await Animal.updateOne({ _id: animal._id }, { $set: animalSet }, { session });
    }
    if (Object.keys(inseminationSet).length) {
      await Insemination.updateOne({ _id: insemination._id }, { $set: inseminationSet }, { session });
    }

    if (continuationTask) {
      continuationTask.status = "Completed";
      continuationTask.completedAt = new Date();
      continuationTask.technicianId ||= actor._id;
      await continuationTask.save({ session });
    }
    if (result === "loss_detected") {
      await Task.updateMany(
        {
          taskType: "PD",
          "metadata.pregnancyId": pregnancy._id,
          "metadata.workflowStage": { $in: [
            PREGNANCY_TASK_STAGE.CONTINUATION_RECHECK,
            PREGNANCY_TASK_STAGE.DIAGNOSTIC_FOLLOW_UP,
          ] },
          status: { $nin: ["Completed", "Cancelled"] },
        },
        { $set: { status: "Cancelled", completedAt: new Date() } },
        { session },
      );
    }

    let followUpTask = null;
    if (result === "follow_up_required") {
      const dueDate = new Date(followUpDate);
      if (!followUpDate || Number.isNaN(dueDate.getTime()) || dueDate <= recheckDate) {
        throw new AppError("A future follow-up date is required.", {
          status: 422,
          code: "FOLLOW_UP_DATE_REQUIRED",
        });
      }
      followUpTask = await Task.findOneAndUpdate(
        {
          taskType: "PD",
          "metadata.workflowStage": PREGNANCY_TASK_STAGE.DIAGNOSTIC_FOLLOW_UP,
          "metadata.pregnancyId": pregnancy._id,
          status: { $nin: ["Completed", "Cancelled"] },
        },
        {
          $setOnInsert: {
            technicianId: actor._id,
            farmerId: animal.farmerId,
            animalIds: [animal._id],
            taskType: "PD",
            category: "Follow-up",
            priority: 2,
            notes: notes || "Additional pregnancy diagnostic follow-up required.",
            status: "Pending",
            dueDate,
            sourceType: "automatic_pd_followup",
            relatedRecordType: "pregnancy",
            relatedRecordId: pregnancy._id,
            metadata: {
              workflowStage: PREGNANCY_TASK_STAGE.DIAGNOSTIC_FOLLOW_UP,
              animalId: animal._id,
              farmerId: animal.farmerId,
              inseminationId: insemination._id,
              pregnancyId: pregnancy._id,
              methodCode: pregnancy.confirmation?.methodCode || null,
              policyVersion: pregnancy.confirmation?.policyVersion || null,
            },
          },
        },
        { upsert: true, returnDocument: "after", session },
      );
    }

    await AnimalTimelineEvent.create([{
      animalId: animal._id,
      eventType: result === "loss_detected" ? "pregnancy_loss_recorded" : "pregnancy_continuation_rechecked",
      occurredAt: recheckDate,
      actorId: actor._id,
      sourceType: "Pregnancy",
      sourceId: pregnancy._id,
      title: result === "continuing"
        ? "Pregnancy continuing"
        : result === "loss_detected"
          ? "Pregnancy loss detected"
          : "Pregnancy follow-up required",
      summary: notes,
      metadata: { result, followUpTaskId: followUpTask?._id || null },
    }], { session });
    await AuditLog.create([{
      entityType: "Pregnancy",
      entityId: pregnancy._id,
      action: "record_pregnancy_continuation_recheck",
      actorId: actor._id,
      before: { cycleStatus: pregnancy.cycleStatus, recheckStatus: pregnancy.recheckStatus },
      after: { cycleStatus: pregnancySet.cycleStatus || pregnancy.cycleStatus, recheckStatus: result },
      metadata: { notes, followUpTaskId: followUpTask?._id || null },
    }], { session });

    return {
      pregnancyId: pregnancy._id,
      recheckStatus: result,
      cycleStatus: pregnancySet.cycleStatus || pregnancy.cycleStatus,
      completedTask: continuationTask,
      followUpTask,
    };
  });
};
