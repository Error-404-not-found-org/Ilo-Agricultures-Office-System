import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { Calving } from "../models/calving.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { createAuditLog } from "./audit.service.js";
import { calculateTargetCalvingDate } from "../utils/cattleCore.js";
import { AppError } from "../utils/app-error.js";
import { CALVING_EASE } from "../domain/status-vocabulary.js";

const validDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} must be a valid date.`, {
      status: 400,
      code: "CORRECTION_DATE_INVALID",
    });
  }
  if (date.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError(`${label} cannot be in the future.`, {
      status: 400,
      code: "CORRECTION_DATE_IN_FUTURE",
    });
  }
  return date;
};

const requireReason = (reason) => {
  const normalized = String(reason || "").trim();
  if (normalized.length < 10) {
    throw new AppError("A correction reason of at least 10 characters is required.", {
      status: 400,
      code: "CORRECTION_REASON_REQUIRED",
    });
  }
  return normalized;
};

export const correctPregnancyRecord = async ({ id, changes, reason, actorId }) => {
  const correctionReason = requireReason(reason);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const pregnancy = await Pregnancy.findOne({ _id: id, deletedAt: null }).session(session);
      if (!pregnancy) {
        throw new AppError("Pregnancy diagnosis not found.", {
          status: 404,
          code: "PREGNANCY_NOT_FOUND",
        });
      }
      const insemination = await Insemination.findOne({
        _id: pregnancy.inseminationId,
        deletedAt: null,
      }).session(session);
      const animal = await Animal.findOne({ _id: pregnancy.animalId, deletedAt: null }).session(session);
      if (!insemination || !animal) {
        throw new AppError("The linked AI attempt or animal is unavailable.", {
          status: 409,
          code: "BREEDING_LINK_BROKEN",
        });
      }

      const nextResult = changes.result ?? pregnancy.pregnancyDiagnosis?.result;
      if (!['Pregnant', 'Empty'].includes(nextResult)) {
        throw new AppError("Pregnancy result must be Pregnant or Empty.", {
          status: 400,
          code: "PREGNANCY_RESULT_INVALID",
        });
      }
      if (nextResult === "Empty") {
        const linkedCalving = await Calving.exists({ pregnancyId: pregnancy._id, deletedAt: null }).session(session);
        if (linkedCalving) {
          throw new AppError("A diagnosis linked to a calving cannot be changed to Empty.", {
            status: 409,
            code: "PREGNANCY_HAS_CALVING",
          });
        }
      }

      const diagnosisDate = validDate(
        changes.date ?? pregnancy.pregnancyDiagnosis?.date,
        "Diagnosis date",
      );
      const aiDate = insemination.inseminationDate || insemination.scheduledDate || insemination.createdAt;
      if (aiDate && diagnosisDate < new Date(aiDate)) {
        throw new AppError("Diagnosis date cannot be earlier than the AI service date.", {
          status: 400,
          code: "DIAGNOSIS_BEFORE_AI",
        });
      }
      const targetCalvingDate = nextResult === "Pregnant"
        ? calculateTargetCalvingDate(aiDate, animal.species, undefined, animal.breed)
        : null;
      const before = {
        result: pregnancy.pregnancyDiagnosis?.result,
        date: pregnancy.pregnancyDiagnosis?.date,
        technicianNote: pregnancy.technicianNote,
      };

      result = await Pregnancy.findOneAndUpdate(
        { _id: pregnancy._id, deletedAt: null },
        {
          $set: {
            "pregnancyDiagnosis.result": nextResult,
            "pregnancyDiagnosis.date": diagnosisDate,
            targetCalvingDate,
            ...(changes.technicianNote !== undefined
              ? { technicianNote: String(changes.technicianNote).trim() }
              : {}),
          },
        },
        { returnDocument: "after", session },
      );
      if (!result) {
        throw new AppError("Pregnancy diagnosis changed during correction. Please retry.", {
          status: 409,
          code: "PREGNANCY_CORRECTION_CONFLICT",
        });
      }
      await Insemination.updateOne(
        { _id: insemination._id },
        {
          $set: {
            isSuccess: nextResult === "Pregnant",
            outcome: nextResult === "Pregnant" ? "Pregnant" : "Failed (Negative PD)",
            outcomeVerificationStatus: "verified",
            outcomeConfirmationSource:
              nextResult === "Pregnant"
                ? "technician_pregnancy_diagnosis"
                : "technician_negative_pd",
            outcomeConfirmedBy: actorId,
            outcomeConfirmedAt: diagnosisDate,
            failureReason: nextResult === "Pregnant" ? null : "negative_pd",
          },
          $push: {
            statusHistory: {
              status: "pregnancy_record_corrected",
              note: correctionReason,
              actorId,
              createdAt: new Date(),
            },
          },
        },
        { session },
      );
      await Animal.updateOne(
        { _id: animal._id },
        {
          $set: {
            reproductiveStatus: nextResult === "Pregnant" ? "Pregnant" : "Normal",
            expectedCalvingDate: targetCalvingDate,
          },
          $push: {
            activityLogs: {
              event: "Pregnancy Record Corrected",
              date: new Date(),
              description: correctionReason,
            },
          },
        },
        { session },
      );
      await createAuditLog(
        {
          entityType: "Pregnancy",
          entityId: pregnancy._id,
          action: "correct_pregnancy_record",
          actorId,
          before,
          after: {
            result: nextResult,
            date: diagnosisDate,
            technicianNote: result.technicianNote,
          },
          metadata: { reason: correctionReason, inseminationId: insemination._id },
        },
        { session },
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
};

export const correctCalvingRecord = async ({ id, changes, reason, actorId }) => {
  const correctionReason = requireReason(reason);
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const calving = await Calving.findOne({ _id: id, deletedAt: null }).session(session);
      if (!calving) {
        throw new AppError("Calving record not found.", {
          status: 404,
          code: "CALVING_NOT_FOUND",
        });
      }
      const nextDate = validDate(changes.date ?? calving.date, "Calving date");
      const pregnancy = await Pregnancy.findOne({ _id: calving.pregnancyId, deletedAt: null }).session(session);
      const diagnosisDate = pregnancy?.pregnancyDiagnosis?.date;
      if (diagnosisDate && nextDate < diagnosisDate) {
        throw new AppError("Calving date cannot be earlier than the pregnancy diagnosis.", {
          status: 400,
          code: "CALVING_BEFORE_DIAGNOSIS",
        });
      }
      const allowedEase = Object.values(CALVING_EASE);
      const nextEase = changes.calvingEase ?? calving.calvingEase;
      if (!allowedEase.includes(nextEase)) {
        throw new AppError("Invalid calving ease.", {
          status: 400,
          code: "CALVING_EASE_INVALID",
        });
      }
      const before = {
        date: calving.date,
        calvingEase: calving.calvingEase,
        technicianNote: calving.technicianNote,
        locationAddress: calving.locationAddress,
      };
      result = await Calving.findOneAndUpdate(
        { _id: calving._id, deletedAt: null },
        {
          $set: {
            date: nextDate,
            calvingEase: nextEase,
            ...(changes.technicianNote !== undefined
              ? { technicianNote: String(changes.technicianNote).trim() }
              : {}),
            ...(changes.locationAddress !== undefined
              ? { locationAddress: String(changes.locationAddress).trim() }
              : {}),
          },
        },
        { returnDocument: "after", session },
      );
      if (!result) {
        throw new AppError("Calving record changed during correction. Please retry.", {
          status: 409,
          code: "CALVING_CORRECTION_CONFLICT",
        });
      }
      const offspringIds = (calving.calves || []).map((calf) => calf.animalId).filter(Boolean);
      if (offspringIds.length) {
        await Animal.updateMany(
          { _id: { $in: offspringIds }, motherId: calving.animalId, deletedAt: null },
          { $set: { birthDate: nextDate } },
          { session },
        );
      }
      const latestCalving = await Calving.findOne({
        animalId: calving.animalId,
        deletedAt: null,
      })
        .sort({ date: -1 })
        .session(session);
      await Animal.updateOne(
        { _id: calving.animalId },
        {
          $set: { lastCalvingDate: latestCalving?.date || nextDate },
          $push: {
            activityLogs: {
              event: "Calving Record Corrected",
              date: new Date(),
              description: correctionReason,
            },
          },
        },
        { session },
      );
      await createAuditLog(
        {
          entityType: "Calving",
          entityId: calving._id,
          action: "correct_calving_record",
          actorId,
          before,
          after: {
            date: result.date,
            calvingEase: result.calvingEase,
            technicianNote: result.technicianNote,
            locationAddress: result.locationAddress,
          },
          metadata: { reason: correctionReason, offspringIds },
        },
        { session },
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
};
