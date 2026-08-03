import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Insemination } from "../models/insemination.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Notification } from "../models/notification.model.js";
import { AppError } from "../utils/app-error.js";
import {
  ANIMAL_REPRODUCTIVE_STATUS,
  reproductiveStatusForPregnancyResult,
} from "../domain/livestock-workflow.js";
import { assertPregnancyDiagnosisWindow } from "../domain/pregnancy-readiness.js";
import { PREGNANCY_TASK_STAGE } from "../domain/pregnancy-task-workflow.js";
import { loadPregnancyConfirmationPolicy } from "./pregnancy-policy.service.js";
import {
  getMethodThresholdForSpecies,
  LEGACY_PREGNANCY_POLICY_VERSION,
} from "../domain/pregnancy-confirmation-policy.js";
import { getAnimalAIEligibility } from "./ai-eligibility.service.js";
import {
  createAIRequestWithGuard,
  isVerifiedFailedAIAttempt,
} from "./ai-request-creation.service.js";
import {
  checkInseminationAgeEligibility,
  verifyPostpartumWindow,
} from "../utils/cattleCore.js";
import { createAuditLog } from "./audit.service.js";
import { normalizeAICompletionFields } from "../domain/ai-recording-fields.js";

const runTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const FINAL_PREGNANCY_RESULTS = new Set(["pregnant", "not_pregnant"]);
export const completeInsemination = async (
  {
    id,
    updateData,
    technicianId,
    farmerId,
    animalId,
    animalTag,
    requestFilter = {},
  },
  parentSession = null,
) => {
  updateData = {
    ...updateData,
    ...normalizeAICompletionFields(updateData),
  };
  const policyResolution = await loadPregnancyConfirmationPolicy({
    at: updateData.inseminationDate,
  });
  const policyVersion =
    policyResolution.mode === "method_based"
      ? policyResolution.policy.version
      : LEGACY_PREGNANCY_POLICY_VERSION;

  const executeWork = async (session) => {
    const request = await Insemination.findOneAndUpdate(
      {
        _id: id,
        status: { $nin: ["done", "rejected", "cancelled"] },
        deletedAt: null,
        ...requestFilter,
      },
      { $set: updateData, $unset: { activeRequestKey: 1 } },
      { returnDocument: "after", session },
    );
    if (!request)
      throw new AppError("AI request is no longer active.", {
        status: 409,
        code: "AI_REQUEST_NOT_ACTIVE",
      });
    const animalContext = await Animal.findById(animalId).session(session);
    const enabledThresholds =
      policyResolution.mode === "method_based"
        ? policyResolution.policy.methods
            .filter((method) => method.enabled)
            .map((method) =>
              getMethodThresholdForSpecies(method, animalContext?.species),
            )
            .filter((threshold) => threshold !== null)
        : [];
    const initialConfirmationDays = enabledThresholds.length
      ? Math.min(...enabledThresholds)
      : 60;

    await Animal.findByIdAndUpdate(
      animalId,
      {
        $set: {
          reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.INSEMINATED,
          lastInseminationDate: updateData.inseminationDate,
        },
        $push: {
          activityLogs: {
            event: "Artificial Insemination",
            date: updateData.inseminationDate,
            description: "Artificial insemination completed.",
          },
        },
      },
      { session },
    );

    const dueDate = new Date(updateData.inseminationDate);
    dueDate.setDate(dueDate.getDate() + initialConfirmationDays);
    await Task.updateOne(
      {
        sourceType: "automatic_pd_followup",
        "metadata.inseminationId": id,
        status: { $nin: ["Completed", "Cancelled"] },
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
          dueDate,
          sourceType: "automatic_pd_followup",
          metadata: {
            workflowStage: PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
            animalId,
            farmerId,
            inseminationId: id,
            policyVersion,
          },
        },
      },
      { upsert: true, session },
    );
    return request;
  };

  if (parentSession) {
    return executeWork(parentSession);
  }
  return runTransaction(executeWork);
};

export const persistPregnancyDiagnosis = ({
  animal,
  insemination,
  result,
  technicianNote,
  diagnosisDate,
  taskId,
  actorId,
}) =>
  runTransaction(async (session) => {
    const existing = await Pregnancy.findOne({
      inseminationId: insemination._id,
      deletedAt: null,
    }).session(session);
    if (existing)
      throw new AppError(
        "Pregnancy diagnosis already recorded for this insemination attempt.",
        { status: 409, code: "PREGNANCY_DIAGNOSIS_EXISTS" },
      );

    const aiDate =
      insemination.inseminationDate ||
      insemination.scheduledDate ||
      insemination.preferredDate ||
      insemination.createdAt;
    const recordedDiagnosisDate = diagnosisDate
      ? new Date(diagnosisDate)
      : new Date();
    if (Number.isNaN(recordedDiagnosisDate.getTime()))
      throw new AppError("A valid diagnosis date is required.", {
        status: 400,
        code: "DIAGNOSIS_DATE_INVALID",
      });
    if (recordedDiagnosisDate.getTime() > Date.now() + 5 * 60 * 1000)
      throw new AppError("Diagnosis date cannot be in the future.", {
        status: 400,
        code: "DIAGNOSIS_DATE_IN_FUTURE",
      });
    if (aiDate && recordedDiagnosisDate < new Date(aiDate))
      throw new AppError(
        "Diagnosis date cannot be earlier than the AI service date.",
        { status: 400, code: "DIAGNOSIS_BEFORE_AI" },
      );
    assertPregnancyDiagnosisWindow({
      insemination,
      diagnosisDate: recordedDiagnosisDate,
    });
    const { calculateTargetCalvingDate } =
      await import("../utils/cattleCore.js");
    const [pregnancy] = await Pregnancy.create(
      [
        {
          animalId: animal._id,
          farmerId: animal.farmerId,
          inseminationId: insemination._id,
          technicianNote,
          pregnancyDiagnosis: { date: recordedDiagnosisDate, result },
          targetCalvingDate:
            result === "Pregnant"
              ? calculateTargetCalvingDate(
                  aiDate,
                  animal.species,
                  undefined,
                  animal.breed,
                )
              : undefined,
        },
      ],
      { session },
    );
    await Insemination.findByIdAndUpdate(
      insemination._id,
      {
        $set: {
          status: "done",
          outcome: result === "Pregnant" ? "Pregnant" : "Failed (Negative PD)",
          isSuccess: result === "Pregnant",
          pregnancyId: pregnancy._id,
          outcomeVerificationStatus: "verified",
          outcomeConfirmationSource:
            result === "Pregnant"
              ? "technician_pregnancy_diagnosis"
              : "technician_negative_pd",
          outcomeConfirmedBy: actorId,
          outcomeConfirmedAt: recordedDiagnosisDate,
          failureReason: result === "Pregnant" ? null : "negative_pd",
        },
        $unset: { activeRequestKey: 1 },
      },
      { session },
    );
    await Animal.findByIdAndUpdate(
      animal._id,
      {
        $set: {
          reproductiveStatus: reproductiveStatusForPregnancyResult(result),
          expectedCalvingDate: pregnancy.targetCalvingDate,
        },
      },
      { session },
    );
    if (taskId) {
      const task = await Task.findOneAndUpdate(
        {
          _id: taskId,
          farmerId: animal.farmerId,
          animalIds: animal._id,
          taskType: "PD",
          status: { $nin: ["Completed", "Cancelled"] },
          $or: [{ technicianId: actorId }, { technicianId: null }],
        },
        {
          $set: {
            status: "Completed",
            relatedRecordType: "pregnancy",
            relatedRecordId: pregnancy._id,
            completedAt: new Date(),
            technicianId: actorId,
          },
        },
        { returnDocument: "after", session },
      );
      if (!task)
        throw new AppError(
          "The pregnancy-check task is not active or does not belong to this animal.",
          { status: 409, code: "TASK_RECORD_MISMATCH" },
        );
    }
    return pregnancy;
  });

export const persistBreedingObservationVerification = ({
  animal,
  insemination,
  verificationResult,
  checkMethod,
  checkedAt,
  technicianNotes = "",
  nextCheckDate,
  evidencePhotos = [],
  actorId,
}) =>
  runTransaction(async (session) => {
    const diagnosisDate = checkedAt ? new Date(checkedAt) : new Date();
    if (Number.isNaN(diagnosisDate.getTime())) {
      throw new AppError("A valid verification date is required.", {
        status: 400,
        code: "VERIFICATION_DATE_INVALID",
      });
    }
    if (diagnosisDate.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new AppError("Verification date cannot be in the future.", {
        status: 400,
        code: "VERIFICATION_DATE_IN_FUTURE",
      });
    }

    const aiDate =
      insemination.inseminationDate ||
      insemination.scheduledDate ||
      insemination.preferredDate ||
      insemination.createdAt;
    if (aiDate && diagnosisDate < new Date(aiDate)) {
      throw new AppError(
        "Verification date cannot be earlier than the AI service date.",
        { status: 400, code: "VERIFICATION_BEFORE_AI" },
      );
    }

    if (FINAL_PREGNANCY_RESULTS.has(verificationResult)) {
      assertPregnancyDiagnosisWindow({
        insemination,
        diagnosisDate,
      });
    }
    let recheckDate = null;
    if (verificationResult === "needs_recheck") {
      recheckDate = nextCheckDate ? new Date(nextCheckDate) : null;
      if (!recheckDate || Number.isNaN(recheckDate.getTime())) {
        throw new AppError(
          "A valid next check date is required for a recheck.",
          {
            status: 400,
            code: "RECHECK_DATE_REQUIRED",
          },
        );
      }
      if (recheckDate <= diagnosisDate) {
        throw new AppError(
          "The next check date must be after the verification date.",
          {
            status: 400,
            code: "RECHECK_DATE_INVALID",
          },
        );
      }
    }

    let pregnancy = null;
    if (["pregnant", "not_pregnant"].includes(verificationResult)) {
      const existing = await Pregnancy.findOne({
        inseminationId: insemination._id,
        deletedAt: null,
      }).session(session);
      if (existing) {
        throw new AppError(
          "A pregnancy diagnosis already exists for this AI attempt.",
          { status: 409, code: "PREGNANCY_DIAGNOSIS_EXISTS" },
        );
      }

      const result = verificationResult === "pregnant" ? "Pregnant" : "Empty";
      const { calculateTargetCalvingDate } =
        await import("../utils/cattleCore.js");
      [pregnancy] = await Pregnancy.create(
        [
          {
            animalId: animal._id,
            farmerId: insemination.farmerId || animal.farmerId,
            inseminationId: insemination._id,
            technicianNote: technicianNotes,
            pregnancyDiagnosis: { date: diagnosisDate, result },
            targetCalvingDate:
              result === "Pregnant"
                ? calculateTargetCalvingDate(
                    aiDate,
                    animal.species,
                    undefined,
                    animal.breed,
                  )
                : undefined,
          },
        ],
        { session },
      );
    }

    const outcomes = {
      pregnant: {
        isSuccess: true,
        outcome: "Pregnant",
        confirmationSource: "technician_pregnancy_diagnosis",
        failureReason: null,
        animalStatus: ANIMAL_REPRODUCTIVE_STATUS.PREGNANT,
        expectedCalvingDate: pregnancy?.targetCalvingDate,
        nextAction: "Pregnancy verified and recorded.",
      },
      not_pregnant: {
        isSuccess: false,
        outcome: "Failed (Negative PD)",
        confirmationSource: "technician_negative_pd",
        failureReason: "negative_pd",
        animalStatus: ANIMAL_REPRODUCTIVE_STATUS.NORMAL,
        expectedCalvingDate: null,
        nextAction: "Animal confirmed not pregnant. Status reset to Normal.",
      },
      return_to_heat: {
        isSuccess: false,
        outcome: "Failed (Re-heat)",
        confirmationSource: "technician_return_to_heat",
        failureReason: "return_to_heat",
        animalStatus: ANIMAL_REPRODUCTIVE_STATUS.IN_HEAT,
        expectedCalvingDate: null,
        nextAction: "Return-to-heat verified. Animal is marked In Heat.",
      },
      needs_recheck: {
        nextAction: "Recheck required. Follow-up task scheduled.",
      },
    };
    const outcome = outcomes[verificationResult];
    const finalResult = verificationResult !== "needs_recheck";
    const verificationNote =
      `Technician verified as: ${verificationResult.replaceAll("_", " ")} using ${checkMethod}. ${technicianNotes}`.trim();

    const requestSet = {
      verificationStatus: finalResult ? "verified" : "pending",
      reviewedBy: actorId,
      reviewedAt: new Date(),
      ...(finalResult
        ? {
            isSuccess: outcome.isSuccess,
            outcome: outcome.outcome,
            outcomeVerificationStatus: "verified",
            outcomeConfirmationSource: outcome.confirmationSource,
            outcomeConfirmedBy: actorId,
            outcomeConfirmedAt: diagnosisDate,
            failureReason: outcome.failureReason,
          }
        : {}),
      ...(pregnancy ? { pregnancyId: pregnancy._id } : {}),
    };
    const requestUpdate = {
      $set: requestSet,
      $push: {
        statusHistory: {
          status: "technician_verification",
          note: verificationNote,
          actorId,
          createdAt: new Date(),
        },
        ...(Array.isArray(evidencePhotos) && evidencePhotos.length
          ? { evidencePhotos: { $each: evidencePhotos } }
          : {}),
      },
      ...(finalResult ? { $unset: { activeRequestKey: 1 } } : {}),
    };
    const updatedRequest = await Insemination.findOneAndUpdate(
      { _id: insemination._id, deletedAt: null },
      requestUpdate,
      { returnDocument: "after", session },
    );
    if (!updatedRequest) {
      throw new AppError("AI request record is no longer available.", {
        status: 409,
        code: "AI_REQUEST_NOT_AVAILABLE",
      });
    }

    const animalSet = finalResult
      ? {
          reproductiveStatus: outcome.animalStatus,
          expectedCalvingDate: outcome.expectedCalvingDate,
        }
      : {};
    const updatedAnimal = await Animal.findByIdAndUpdate(
      animal._id,
      {
        ...(Object.keys(animalSet).length ? { $set: animalSet } : {}),
        $push: {
          activityLogs: {
            event: finalResult
              ? "Pregnancy Verification Completed"
              : "Pregnancy Recheck Scheduled",
            date: diagnosisDate,
            description:
              `Technician verified breeding observation outcome: ${verificationResult.replaceAll("_", " ")}. Method: ${checkMethod}. Notes: ${technicianNotes}`.trim(),
          },
        },
      },
      { returnDocument: "after", session },
    );
    if (!updatedAnimal) {
      throw new AppError("Animal is no longer available.", {
        status: 409,
        code: "ANIMAL_NOT_AVAILABLE",
      });
    }

    let task = null;
    const taskId = insemination.verificationTaskId;
    if (verificationResult === "needs_recheck") {
      const notes = `Pregnancy Check Recheck Required. Checked on: ${diagnosisDate.toLocaleDateString()}. Notes: ${technicianNotes || "None"}. Next check after: ${recheckDate.toLocaleDateString()}`;
      if (taskId) {
        task = await Task.findOneAndUpdate(
          {
            _id: taskId,
            farmerId: insemination.farmerId,
            animalIds: animal._id,
            taskType: "PD",
            status: { $ne: "Cancelled" },
          },
          {
            $set: {
              status: "Pending",
              notes,
              dueDate: recheckDate,
              technicianId: actorId,
              completedAt: null,
              relatedRecordType: null,
              relatedRecordId: null,
            },
          },
          { returnDocument: "after", session },
        );
        if (!task) {
          throw new AppError(
            "The pregnancy-check task does not match this animal or is cancelled.",
            { status: 409, code: "TASK_RECORD_MISMATCH" },
          );
        }
      } else {
        [task] = await Task.create(
          [
            {
              technicianId: actorId,
              farmerId: insemination.farmerId,
              animalIds: [animal._id],
              taskType: "PD",
              category: "Follow-up",
              priority: 2,
              notes,
              status: "Pending",
              dueDate: recheckDate,
              sourceType: "farmer_requested_verification",
              metadata: { inseminationId: insemination._id },
            },
          ],
          { session },
        );
        await Insemination.updateOne(
          { _id: insemination._id },
          { $set: { verificationTaskId: task._id } },
          { session },
        );
        updatedRequest.verificationTaskId = task._id;
      }
    } else if (taskId) {
      task = await Task.findOneAndUpdate(
        {
          _id: taskId,
          farmerId: insemination.farmerId,
          animalIds: animal._id,
          taskType: "PD",
          status: { $nin: ["Completed", "Cancelled"] },
        },
        {
          $set: {
            status: "Completed",
            notes: `Breeding outcome verified: ${verificationResult.replaceAll("_", " ")}. Checked method: ${checkMethod}. Notes: ${technicianNotes || "None"}`,
            relatedRecordType: pregnancy ? "pregnancy" : "insemination",
            relatedRecordId: pregnancy?._id || insemination._id,
            completedAt: new Date(),
            technicianId: actorId,
          },
        },
        { returnDocument: "after", session },
      );
      if (!task) {
        throw new AppError(
          "The pregnancy-check task is not active or does not belong to this animal.",
          { status: 409, code: "TASK_RECORD_MISMATCH" },
        );
      }
    }

    return {
      request: updatedRequest,
      animal: updatedAnimal,
      task,
      pregnancy,
      pregnancyRecordCreated: Boolean(pregnancy),
      nextAction: outcome.nextAction,
    };
  });

export const resolveHealthRequest = ({
  id,
  updateFields,
  technicianId,
  medicalRecord,
}) =>
  runTransaction(async (session) => {
    const request = await HealthRequest.findOneAndUpdate(
      {
        _id: id,
        status: { $nin: ["resolved", "rejected", "cancelled"] },
        deletedAt: null,
      },
      { $set: updateFields, $unset: { activeCaseKey: 1 } },
      { returnDocument: "after", session },
    );
    if (!request)
      throw new AppError("Health request is no longer active.", {
        status: 409,
        code: "HEALTH_REQUEST_NOT_ACTIVE",
      });
    await MedicalRecord.updateOne(
      { healthRequestId: request._id },
      {
        $setOnInsert: {
          ...medicalRecord,
          healthRequestId: request._id,
          technicianId,
        },
      },
      { upsert: true, session },
    );
    return request;
  });

export const createResolvedWalkInHealth = ({ requestData, medicalRecord }) =>
  runTransaction(async (session) => {
    const [request] = await HealthRequest.create([requestData], { session });
    const [record] = await MedicalRecord.create(
      [
        {
          ...medicalRecord,
          healthRequestId: request._id,
        },
      ],
      { session },
    );
    return { request, medicalRecord: record };
  });

export const recordTechnicianAIService = async ({
  taskId,
  requestId,
  farmerId,
  animalId,
  inseminationDate,
  sireBreed,
  sireCode,
  semenDosesUsed,
  estrus,
  actorId,
  isAdmin,
}) => {
  const completionFields = normalizeAICompletionFields({
    sireBreed,
    sireCode,
    semenDosesUsed,
  });

  return runTransaction(async (session) => {
    let task = null;

    // 1. Authoritative Task Acquisition & Reservation
    if (taskId) {
      task = await Task.findOneAndUpdate(
        {
          _id: taskId,
          taskType: "AI",
          status: { $in: ["Pending", "In Progress"] },
          $or: [
            { technicianId: actorId },
            { technicianId: null },
            { technicianId: { $exists: false } },
          ],
        },
        {
          $set: {
            status: "Completed",
            completedAt: new Date(),
            technicianId: actorId,
          },
        },
        { session, new: true },
      );

      if (!task) {
        // Acquisition failed, reload the task to resolve the scenario
        const currentTask = await Task.findById(taskId).session(session);
        if (!currentTask) {
          throw new AppError("Task not found.", {
            status: 404,
            code: "TASK_NOT_FOUND",
          });
        }
        if (currentTask.taskType !== "AI") {
          throw new AppError("Invalid task type for AI recording.", {
            status: 400,
            code: "INVALID_TASK_TYPE",
          });
        }
        if (currentTask.status === "Completed") {
          const expectedRecordId = requestId || currentTask.relatedRecordId;
          if (
            currentTask.relatedRecordType === "insemination" &&
            String(currentTask.relatedRecordId) === String(expectedRecordId)
          ) {
            const existingAI = await Insemination.findById(
              currentTask.relatedRecordId,
            ).session(session);
            return {
              outcome: "existing_and_task_completed",
              insemination: existingAI,
              task: currentTask,
            };
          } else {
            throw new AppError(
              "This task is already completed and linked to another record.",
              {
                status: 409,
                code: "TASK_ALREADY_LINKED",
              },
            );
          }
        }
        if (currentTask.status === "Cancelled") {
          throw new AppError("This task has been cancelled.", {
            status: 400,
            code: "TASK_CANCELLED",
          });
        }
        const isClaimedByMe =
          currentTask.technicianId &&
          String(currentTask.technicianId) === String(actorId);
        const isClaimable = !currentTask.technicianId;
        if (!isClaimedByMe && !isClaimable && !isAdmin) {
          throw new AppError("This task is assigned to another technician.", {
            status: 403,
            code: "TASK_ASSIGNED_TO_OTHER",
          });
        }
        throw new AppError("A concurrency conflict occurred. Please retry.", {
          status: 409,
          code: "CONCURRENCY_CONFLICT",
        });
      }

      // Context matching & verification
      if (String(task.farmerId) !== String(farmerId)) {
        throw new AppError("Task farmer mismatch.", {
          status: 409,
          code: "TASK_FARMER_MISMATCH",
        });
      }
      if (
        !task.animalIds ||
        !task.animalIds.some((id) => String(id) === String(animalId))
      ) {
        throw new AppError("Task animal mismatch.", {
          status: 409,
          code: "TASK_ANIMAL_MISMATCH",
        });
      }
      if (requestId) {
        const metadataRequestId =
          task.metadata?.requestId || task.relatedRecordId;
        if (
          metadataRequestId &&
          String(metadataRequestId) !== String(requestId)
        ) {
          throw new AppError("Task request mismatch.", {
            status: 409,
            code: "TASK_REQUEST_MISMATCH",
          });
        }
      }
    }

    // 2. Resolve Animal and Farmer
    const animal = await Animal.findById(animalId).session(session);
    if (!animal) {
      throw new AppError("Animal not found.", {
        status: 404,
        code: "ANIMAL_NOT_FOUND",
      });
    }
    if (String(animal.farmerId) !== String(farmerId)) {
      throw new AppError(
        "The selected animal does not belong to the selected farmer.",
        {
          status: 400,
          code: "ANIMAL_FARMER_MISMATCH",
        },
      );
    }

    let insemination;
    let isCreated = false;

    if (requestId) {
      // Request-Linked Path
      insemination = await Insemination.findById(requestId).session(session);
      if (!insemination) {
        throw new AppError("Insemination request not found.", {
          status: 404,
          code: "AI_REQUEST_NOT_FOUND",
        });
      }

      // Check if the request is already complete
      if (insemination.status === "done") {
        if (taskId) {
          await Task.updateOne(
            { _id: taskId },
            {
              $set: {
                relatedRecordType: "insemination",
                relatedRecordId: insemination._id,
              },
            },
            { session },
          );
        }
        return {
          outcome: "existing_task_reconciled",
          insemination,
          task,
        };
      }

      // Validate age and species and postpartum window
      const ageCheck = checkInseminationAgeEligibility(
        animal.birthDate,
        animal.species,
      );
      if (!ageCheck.isEligible) {
        throw new AppError(ageCheck.reason, {
          status: 400,
          code: ageCheck.code,
        });
      }
      const recoveryAnchor =
        animal.lastCalvingDate || animal.lastPregnancyLossDate;
      if (recoveryAnchor) {
        const recovery = verifyPostpartumWindow(
          recoveryAnchor,
          inseminationDate,
          animal.species,
          animal.breed,
        );
        if (!recovery.isSafe) {
          throw new AppError(
            `The animal is still within the postpartum recovery period. Rebreeding is allowed after ${recovery.requiredDays} days post-calving.`,
            { status: 400, code: "POSTPARTUM_RECOVERY" },
          );
        }
      }

      const updateData = {
        status: "done",
        approvedBy: actorId,
        technicianId: actorId,
        technicianNote: insemination.technicianNote || "",
        sireBreed: completionFields.sireBreed,
        sireCode: completionFields.sireCode,
        semenDosesUsed: completionFields.semenDosesUsed,
        estrus,
        inseminationDate,
      };

      insemination = await completeInsemination(
        {
          id: requestId,
          updateData,
          technicianId: actorId,
          farmerId,
          animalId,
          animalTag: animal.earTag || animal.animalId,
        },
        session,
      );
    } else {
      // Manual Walk-In Path
      const eligibility = await getAnimalAIEligibility({
        animal,
        at: inseminationDate,
      });
      if (!eligibility.eligible) {
        throw new AppError(eligibility.reason, {
          status: 400,
          code: eligibility.code,
        });
      }

      // Verify the last performed attempt was a failure
      const lastPerformedAttempt = await Insemination.findOne({
        animalId,
        status: "done",
        inseminationDate: { $exists: true, $ne: null },
        deletedAt: null,
      })
        .sort({ attemptNumber: -1, inseminationDate: -1 })
        .session(session);

      if (
        lastPerformedAttempt &&
        !isVerifiedFailedAIAttempt(lastPerformedAttempt)
      ) {
        throw new AppError(
          "The previous AI attempt is not a verified failure.",
          {
            status: 400,
            code: "PREVIOUS_AI_ATTEMPT_NOT_FAILED",
          },
        );
      }

      insemination = await createAIRequestWithGuard(
        {
          farmerId,
          animalId,
          inseminationDate,
          scheduledDate: inseminationDate,
          preferredDate: inseminationDate,
          sireBreed: completionFields.sireBreed,
          sireCode: completionFields.sireCode,
          semenDosesUsed: completionFields.semenDosesUsed,
          estrus: estrus || "Natural",
          status: "done",
          technicianId: actorId,
          approvedBy: actorId,
        },
        { session },
      );

      isCreated = true;

      // Sync Animal reproductiveStatus
      await Animal.findByIdAndUpdate(
        animalId,
        {
          $set: {
            reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.INSEMINATED,
            lastInseminationDate: inseminationDate,
          },
          $push: {
            activityLogs: {
              event: "Artificial Insemination",
              date: inseminationDate,
              description: "Artificial insemination completed.",
            },
          },
        },
        { session },
      );

      // Create automatic PD follow-up task
      const policyResolution = await loadPregnancyConfirmationPolicy({
        at: inseminationDate,
      });
      const policyVersion =
        policyResolution.mode === "method_based"
          ? policyResolution.policy.version
          : LEGACY_PREGNANCY_POLICY_VERSION;
      const enabledThresholds =
        policyResolution.mode === "method_based"
          ? policyResolution.policy.methods
              .filter((method) => method.enabled)
              .map((method) =>
                getMethodThresholdForSpecies(method, animal?.species),
              )
              .filter((threshold) => threshold !== null)
          : [];
      const initialConfirmationDays = enabledThresholds.length
        ? Math.min(...enabledThresholds)
        : 60;
      const pdDueDate = new Date(inseminationDate);
      pdDueDate.setDate(pdDueDate.getDate() + initialConfirmationDays);

      await Task.updateOne(
        {
          sourceType: "automatic_pd_followup",
          "metadata.inseminationId": insemination._id,
          status: { $nin: ["Completed", "Cancelled"] },
        },
        {
          $setOnInsert: {
            technicianId: actorId,
            farmerId,
            animalIds: [animalId],
            taskType: "PD",
            category: "Follow-up",
            priority: 2,
            notes: `Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #${animal.earTag || "Unknown"}.`,
            status: "Pending",
            dueDate: pdDueDate,
            sourceType: "automatic_pd_followup",
            metadata: {
              workflowStage: PREGNANCY_TASK_STAGE.INITIAL_CONFIRMATION,
              animalId,
              farmerId,
              inseminationId: insemination._id,
              policyVersion,
            },
          },
        },
        { upsert: true, session },
      );
    }

    // 3. Link completed record back to task
    if (taskId) {
      await Task.updateOne(
        { _id: taskId },
        {
          $set: {
            relatedRecordType: "insemination",
            relatedRecordId: insemination._id,
          },
        },
        { session },
      );
    }

    // 4. Create Audit Log
    await createAuditLog(
      {
        action: "RECORD_AI_SERVICE",
        actorId,
        entityType: "Insemination",
        entityId: insemination._id,
        details: {
          taskId,
          requestId,
          animalId,
          attemptNumber: insemination.attemptNumber,
        },
      },
      { session },
    );

    // 5. Create Notification
    await Notification.create(
      [
        {
          recipientId: farmerId,
          senderId: actorId,
          type: "ai-request",
          relatedId: insemination._id,
          category: "ai",
          eventType: "field_ai_recorded",
          title: "AI service recorded",
          message: `A field insemination has been recorded for your animal (${animal.earTag || animal.animalId}) by the technician.`,
          linkType: "record",
          metadata: {
            animalId: animal._id,
            animalTag: animal.earTag || animal.animalId,
            recordId: insemination._id,
            serviceType: "ai",
          },
        },
      ],
      { session },
    );

    return {
      outcome: isCreated
        ? "created_and_task_completed"
        : "existing_and_task_completed",
      insemination,
      task: taskId ? await Task.findById(taskId).session(session) : null,
    };
  });
};
