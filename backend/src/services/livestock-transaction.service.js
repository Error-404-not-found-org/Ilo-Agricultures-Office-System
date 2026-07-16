import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Insemination } from "../models/insemination.model.js";
import { MedicalRecord } from "../models/medical-record.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import { AppError } from "../utils/app-error.js";
import { ANIMAL_REPRODUCTIVE_STATUS, reproductiveStatusForPregnancyResult } from "../domain/livestock-workflow.js";

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

export const completeInsemination = ({ id, updateData, technicianId, farmerId, animalId, animalTag }) =>
  runTransaction(async (session) => {
    const request = await Insemination.findOneAndUpdate(
      { _id: id, status: { $nin: ["done", "rejected", "cancelled"] }, deletedAt: null },
      { $set: updateData, $unset: { activeRequestKey: 1 } },
      { returnDocument: "after", session },
    );
    if (!request) throw new AppError("AI request is no longer active.", { status: 409, code: "AI_REQUEST_NOT_ACTIVE" });

    await Animal.findByIdAndUpdate(animalId, {
      $set: { reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.INSEMINATED, lastInseminationDate: updateData.inseminationDate },
      $push: { activityLogs: { event: "Artificial Insemination", date: updateData.inseminationDate, description: "Artificial insemination completed." } },
    }, { session });

    const dueDate = new Date(updateData.inseminationDate);
    dueDate.setDate(dueDate.getDate() + 60);
    await Task.updateOne(
      { sourceType: "automatic_pd_followup", "metadata.inseminationId": id, status: { $nin: ["Completed", "Cancelled"] } },
      { $setOnInsert: { technicianId, farmerId, animalIds: [animalId], taskType: "PD", category: "Follow-up", priority: 2, notes: `Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #${animalTag || "Unknown"}.`, status: "Pending", dueDate, sourceType: "automatic_pd_followup", metadata: { inseminationId: id } } },
      { upsert: true, session },
    );
    return request;
  });

export const persistPregnancyDiagnosis = ({ animal, insemination, result, technicianNote, diagnosisDate, taskId, actorId }) =>
  runTransaction(async (session) => {
    const existing = await Pregnancy.findOne({ inseminationId: insemination._id, deletedAt: null }).session(session);
    if (existing) throw new AppError("Pregnancy diagnosis already recorded for this insemination attempt.", { status: 409, code: "PREGNANCY_DIAGNOSIS_EXISTS" });

    const aiDate = insemination.inseminationDate || insemination.scheduledDate || insemination.preferredDate || insemination.createdAt;
    const recordedDiagnosisDate = diagnosisDate ? new Date(diagnosisDate) : new Date();
    if (Number.isNaN(recordedDiagnosisDate.getTime())) throw new AppError("A valid diagnosis date is required.", { status: 400, code: "DIAGNOSIS_DATE_INVALID" });
    if (recordedDiagnosisDate.getTime() > Date.now() + 5 * 60 * 1000) throw new AppError("Diagnosis date cannot be in the future.", { status: 400, code: "DIAGNOSIS_DATE_IN_FUTURE" });
    if (aiDate && recordedDiagnosisDate < new Date(aiDate)) throw new AppError("Diagnosis date cannot be earlier than the AI service date.", { status: 400, code: "DIAGNOSIS_BEFORE_AI" });
    const { calculateTargetCalvingDate } = await import("../utils/cattleCore.js");
    const [pregnancy] = await Pregnancy.create([{
      animalId: animal._id, farmerId: animal.farmerId, inseminationId: insemination._id, technicianNote,
      pregnancyDiagnosis: { date: recordedDiagnosisDate, result },
      targetCalvingDate: result === "Pregnant" ? calculateTargetCalvingDate(aiDate, animal.species, undefined, animal.breed) : undefined,
    }], { session });
    await Insemination.findByIdAndUpdate(insemination._id, {
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
    }, { session });
    await Animal.findByIdAndUpdate(animal._id, { $set: { reproductiveStatus: reproductiveStatusForPregnancyResult(result), expectedCalvingDate: pregnancy.targetCalvingDate } }, { session });
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
        { $set: { status: "Completed", relatedRecordType: "pregnancy", relatedRecordId: pregnancy._id, completedAt: new Date(), technicianId: actorId } },
        { returnDocument: "after", session },
      );
      if (!task) throw new AppError("The pregnancy-check task is not active or does not belong to this animal.", { status: 409, code: "TASK_RECORD_MISMATCH" });
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

    let recheckDate = null;
    if (verificationResult === "needs_recheck") {
      recheckDate = nextCheckDate ? new Date(nextCheckDate) : null;
      if (!recheckDate || Number.isNaN(recheckDate.getTime())) {
        throw new AppError("A valid next check date is required for a recheck.", {
          status: 400,
          code: "RECHECK_DATE_REQUIRED",
        });
      }
      if (recheckDate <= diagnosisDate) {
        throw new AppError("The next check date must be after the verification date.", {
          status: 400,
          code: "RECHECK_DATE_INVALID",
        });
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
      const { calculateTargetCalvingDate } = await import("../utils/cattleCore.js");
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

export const resolveHealthRequest = ({ id, updateFields, technicianId, medicalRecord }) =>
  runTransaction(async (session) => {
    const request = await HealthRequest.findOneAndUpdate(
      { _id: id, status: { $nin: ["resolved", "rejected", "cancelled"] }, deletedAt: null },
      { $set: updateFields, $unset: { activeCaseKey: 1 } },
      { returnDocument: "after", session },
    );
    if (!request) throw new AppError("Health request is no longer active.", { status: 409, code: "HEALTH_REQUEST_NOT_ACTIVE" });
    await MedicalRecord.updateOne(
      { healthRequestId: request._id },
      { $setOnInsert: { ...medicalRecord, healthRequestId: request._id, technicianId } },
      { upsert: true, session },
    );
    return request;
  });

export const createResolvedWalkInHealth = ({ requestData, medicalRecord }) =>
  runTransaction(async (session) => {
    const [request] = await HealthRequest.create([requestData], { session });
    const [record] = await MedicalRecord.create([{
      ...medicalRecord,
      healthRequestId: request._id,
    }], { session });
    return { request, medicalRecord: record };
  });
