import mongoose from "mongoose";

import { Animal } from "../models/animal.model.js";
import { AnimalTimelineEvent } from "../models/animal-timeline-event.model.js";
import { Calving } from "../models/calving.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import {
  PregnancyLossReport,
  PREGNANCY_LOSS_REPORT_STATUS,
} from "../models/pregnancy-loss-report.model.js";
import { Task } from "../models/task.model.js";
import { User } from "../models/user.model.js";
import {
  cleanupUploadedAssets,
  uploadImages,
} from "./image-upload.service.js";
import { persistCalving } from "./calving.service.js";
import { AppError } from "../utils/app-error.js";
import { notifyUserBestEffort } from "./notification-delivery.service.js";

export const PREGNANCY_LOSS_REVIEW_OUTCOME = Object.freeze({
  CONFIRM_LOSS: "confirm_loss",
  NOT_CONFIRMED: "not_confirmed",
  NEEDS_VISIT: "needs_visit",
});

const ACTIVE_REPORT_STATUSES = [
  PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
  PREGNANCY_LOSS_REPORT_STATUS.NEEDS_VISIT,
];

const parseObservationDate = (value) => {
  if (!value) {
    throw new AppError("Observation date is required.", {
      status: 400,
      code: "PREGNANCY_LOSS_OBSERVATION_DATE_REQUIRED",
    });
  }
  const observationDate = new Date(value);
  if (Number.isNaN(observationDate.getTime())) {
    throw new AppError("Observation date is invalid.", {
      status: 400,
      code: "PREGNANCY_LOSS_OBSERVATION_DATE_INVALID",
    });
  }
  if (observationDate.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new AppError("Observation date cannot be in the future.", {
      status: 422,
      code: "PREGNANCY_LOSS_OBSERVATION_DATE_IN_FUTURE",
    });
  }
  return observationDate;
};

const normalizePhotos = (evidencePhotos) => {
  if (evidencePhotos === undefined) return [];
  if (
    !Array.isArray(evidencePhotos) ||
    !evidencePhotos.every((photo) => typeof photo === "string")
  ) {
    throw new AppError("Evidence photos must be an array of strings.", {
      status: 400,
      code: "INVALID_PHOTOS",
    });
  }
  const photos = evidencePhotos.map((photo) => photo.trim()).filter(Boolean);
  if (photos.length > 3) {
    throw new AppError("Maximum of 3 evidence photos allowed.", {
      status: 400,
      code: "TOO_MANY_PHOTOS",
    });
  }
  return photos;
};

const findActiveReport = (pregnancyId, session = null) =>
  PregnancyLossReport.findOne({
    pregnancyId,
    status: { $in: ACTIVE_REPORT_STATUSES },
  }).session(session);

const loadReportContext = async ({ animalId, farmerId, observationDate, session = null }) => {
  const animal = await Animal.findOne({
    _id: animalId,
    farmerId,
    deletedAt: null,
  }).session(session);
  if (!animal) {
    throw new AppError("Animal not found or does not belong to this Farmer.", {
      status: 404,
      code: "ANIMAL_NOT_FOUND",
    });
  }
  if (String(animal.gender || "").toLowerCase() !== "female") {
    throw new AppError("Pregnancy loss can only be reported for a female animal.", {
      status: 422,
      code: "PREGNANCY_LOSS_FEMALE_REQUIRED",
    });
  }

  const pregnancy = await Pregnancy.findOne({
    animalId: animal._id,
    farmerId,
    cycleStatus: "active",
    "pregnancyDiagnosis.result": "Pregnant",
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .session(session);
  if (!pregnancy) {
    throw new AppError("An active Technician-confirmed pregnancy is required.", {
      status: 409,
      code: "PREGNANCY_NOT_CONFIRMED",
    });
  }

  const insemination = await Insemination.findOne({
    _id: pregnancy.inseminationId,
    animalId: animal._id,
    deletedAt: null,
  }).session(session);
  if (!insemination) {
    throw new AppError("The pregnancy's insemination record was not found.", {
      status: 409,
      code: "INSEMINATION_NOT_FOUND",
    });
  }

  const diagnosisDate = new Date(pregnancy.pregnancyDiagnosis?.date);
  const inseminationDate = new Date(insemination.inseminationDate);
  if (
    Number.isNaN(diagnosisDate.getTime()) ||
    observationDate < diagnosisDate ||
    Number.isNaN(inseminationDate.getTime()) ||
    observationDate < inseminationDate
  ) {
    throw new AppError(
      "Observation date must be after the insemination and pregnancy diagnosis.",
      {
        status: 422,
        code: "PREGNANCY_LOSS_OBSERVATION_CHRONOLOGY_INVALID",
      },
    );
  }

  const calving = await Calving.findOne({
    pregnancyId: pregnancy._id,
    deletedAt: null,
  }).session(session);
  if (calving) {
    throw new AppError("This pregnancy already has a completed outcome.", {
      status: 409,
      code: "PREGNANCY_ALREADY_CLOSED",
    });
  }

  return { animal, pregnancy, insemination };
};

const findReviewTask = (reportId, session = null) =>
  Task.findOne({
    taskType: "BreedingFollowUp",
    sourceType: "farmer_pregnancy_loss_report",
    "metadata.reportId": reportId,
    status: { $in: ["Pending", "In Progress"] },
  }).session(session);

const resolveConfirmingTechnician = async (pregnancy, session = null) => {
  const confirmedBy = pregnancy?.confirmation?.confirmedBy;
  if (!confirmedBy) return null;

  return User.findOne({
    _id: confirmedBy,
    role: "technician",
    deletedAt: null,
    status: { $nin: ["suspended", "deleted"] },
  })
    .select("_id")
    .session(session);
};

const assignUnownedReviewTask = async ({ task, technician, session = null }) => {
  if (!task || task.technicianId || !technician) return task;

  const assignedTask = await Task.findOneAndUpdate(
    {
      _id: task._id,
      taskType: "BreedingFollowUp",
      sourceType: "farmer_pregnancy_loss_report",
      status: { $in: ["Pending", "In Progress"] },
      $or: [
        { technicianId: null },
        { technicianId: { $exists: false } },
      ],
    },
    { $set: { technicianId: technician._id } },
    { returnDocument: "after", session },
  );
  return assignedTask || task;
};

const reuseActiveReport = async ({ report, pregnancy, session = null }) => {
  const task = await findReviewTask(report._id, session);
  const confirmingTechnician = await resolveConfirmingTechnician(
    pregnancy,
    session,
  );
  return {
    report,
    task: await assignUnownedReviewTask({
      task,
      technician: confirmingTechnician,
      session,
    }),
    alreadyReported: true,
  };
};

export const submitPregnancyLossReport = async ({
  animalId,
  farmer,
  observationDate: submittedObservationDate,
  notes = "",
  evidencePhotos,
}) => {
  const observationDate = parseObservationDate(submittedObservationDate);
  const candidatePhotos = normalizePhotos(evidencePhotos);
  const context = await loadReportContext({
    animalId,
    farmerId: farmer._id,
    observationDate,
  });
  const existingReport = await findActiveReport(context.pregnancy._id);
  if (existingReport) {
    return reuseActiveReport({
      report: existingReport,
      pregnancy: context.pregnancy,
    });
  }

  const uploadedAssets = candidatePhotos.length
    ? await uploadImages(candidatePhotos, { folder: "breeding_evidence" })
    : [];
  let session;
  let result;
  let retainUploadedImages = false;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const current = await loadReportContext({
        animalId,
        farmerId: farmer._id,
        observationDate,
        session,
      });
      const duplicate = await findActiveReport(current.pregnancy._id, session);
      if (duplicate) {
        result = await reuseActiveReport({
          report: duplicate,
          pregnancy: current.pregnancy,
          session,
        });
        return;
      }

      const confirmingTechnician = await resolveConfirmingTechnician(
        current.pregnancy,
        session,
      );
      const reportedAt = new Date();
      const [report] = await PregnancyLossReport.create([{
        animalId: current.animal._id,
        farmerId: farmer._id,
        pregnancyId: current.pregnancy._id,
        inseminationId: current.insemination._id,
        reportedAt,
        observationDate,
        notes: String(notes || "").trim(),
        evidencePhotos: uploadedAssets.map((asset) => asset.url),
      }], { session });

      const [task] = await Task.create([{
        technicianId: confirmingTechnician?._id || null,
        farmerId: farmer._id,
        animalIds: [current.animal._id],
        taskType: "BreedingFollowUp",
        category: "Follow-up",
        priority: 2,
        notes: "Review the Farmer's possible pregnancy-loss report.",
        status: "Pending",
        dueDate: reportedAt,
        sourceType: "farmer_pregnancy_loss_report",
        relatedRecordType: "pregnancy",
        relatedRecordId: current.pregnancy._id,
        metadata: {
          workflowStage: "pregnancy_loss_review",
          reportId: report._id,
          pregnancyId: current.pregnancy._id,
          inseminationId: current.insemination._id,
          animalId: current.animal._id,
          farmerId: farmer._id,
          reportType: "pregnancy_loss",
          reportedAt,
          observationDate,
          notes: String(notes || "").trim(),
          evidencePhotos: uploadedAssets.map((asset) => asset.url),
          reportStatus: PREGNANCY_LOSS_REPORT_STATUS.PENDING_REVIEW,
        },
      }], { session });

      await AnimalTimelineEvent.create([{
        animalId: current.animal._id,
        eventType: "pregnancy_loss_reported",
        occurredAt: reportedAt,
        actorId: farmer._id,
        sourceType: "PregnancyLossReport",
        sourceId: report._id,
        title: "Pregnancy loss reported",
        summary: "Possible pregnancy loss reported. Awaiting Technician review.",
        attachments: report.evidencePhotos,
        metadata: {
          pregnancyId: current.pregnancy._id,
          inseminationId: current.insemination._id,
          reportStatus: report.status,
        },
      }], { session });

      result = { report, task, alreadyReported: false };
    });
    if (result?.alreadyReported && uploadedAssets.length) {
      await cleanupUploadedAssets(uploadedAssets);
    } else {
      retainUploadedImages = true;
    }

    if (!result?.alreadyReported && result?.task?.technicianId) {
      const animal = await Animal.findOne({ _id: animalId })
        .select("earTag animalId")
        .lean();
      const animalTag = animal?.earTag || animal?.animalId || "Animal";
      const farmerName =
        farmer.name ||
        `${farmer.firstName || ""} ${farmer.lastName || ""}`.trim() ||
        "Farmer";

      await notifyUserBestEffort({
        recipientId: result.task.technicianId,
        senderId: farmer._id,
        type: "system",
        category: "pregnancy",
        eventType: "pregnancy_loss_reported",
        relatedId: result.report._id,
        linkType: "task",
        metadata: {
          taskId: result.task._id,
          animalId,
          animalTag,
          pregnancyId: result.report.pregnancyId,
          inseminationId: result.report.inseminationId,
          farmerName,
        },
      });
    }

    return result;
  } catch (error) {
    if (!retainUploadedImages) await cleanupUploadedAssets(uploadedAssets);
    throw error;
  } finally {
    if (session) await session.endSession();
  }
};

const loadReviewReport = async (reportId) => {
  const report = await PregnancyLossReport.findById(reportId);
  if (!report) {
    throw new AppError("Pregnancy loss report not found.", {
      status: 404,
      code: "PREGNANCY_LOSS_REPORT_NOT_FOUND",
    });
  }
  return report;
};

const claimReviewTask = async ({ report, technician }) => {
  const task = await Task.findOneAndUpdate(
    {
      taskType: "BreedingFollowUp",
      sourceType: "farmer_pregnancy_loss_report",
      "metadata.reportId": report._id,
      status: { $in: ["Pending", "In Progress"] },
      $or: [{ technicianId: null }, { technicianId: technician._id }],
    },
    {
      $set: {
        technicianId: technician._id,
        status: "In Progress",
        claimedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!task) {
    throw new AppError("This pregnancy-loss review is assigned to another Technician or is no longer active.", {
      status: 409,
      code: "PREGNANCY_LOSS_REVIEW_UNAVAILABLE",
    });
  }
  return task;
};

const finalizeNonTerminalReview = async ({ report, task, technician, outcome, reviewNotes }) => {
  let session;
  let updatedReport;
  let updatedTask;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const reviewedAt = new Date();
      const isNeedsVisit = outcome === PREGNANCY_LOSS_REVIEW_OUTCOME.NEEDS_VISIT;
      updatedReport = await PregnancyLossReport.findOneAndUpdate(
        { _id: report._id, status: { $in: ACTIVE_REPORT_STATUSES } },
        {
          $set: {
            status: isNeedsVisit
              ? PREGNANCY_LOSS_REPORT_STATUS.NEEDS_VISIT
              : PREGNANCY_LOSS_REPORT_STATUS.NOT_CONFIRMED,
            reviewedBy: technician._id,
            reviewedAt,
            reviewNotes,
          },
        },
        { returnDocument: "after", session },
      );
      if (!updatedReport) {
        throw new AppError("This pregnancy-loss report has already been resolved.", {
          status: 409,
          code: "PREGNANCY_LOSS_REPORT_ALREADY_REVIEWED",
        });
      }

      updatedTask = await Task.findOneAndUpdate(
        { _id: task._id },
        isNeedsVisit
          ? {
              $set: {
                status: "In Progress",
                "metadata.reviewOutcome": outcome,
                "metadata.reportStatus": updatedReport.status,
              },
            }
          : {
              $set: {
                status: "Completed",
                completedAt: reviewedAt,
                "metadata.reviewOutcome": outcome,
                "metadata.reportStatus": updatedReport.status,
              },
            },
        { returnDocument: "after", session },
      );

      await AnimalTimelineEvent.create([{
        animalId: report.animalId,
        eventType: isNeedsVisit
          ? "pregnancy_loss_follow_up_needed"
          : "pregnancy_loss_not_confirmed",
        occurredAt: reviewedAt,
        actorId: technician._id,
        sourceType: "PregnancyLossReport",
        sourceId: report._id,
        title: isNeedsVisit
          ? "Pregnancy loss report needs follow-up"
          : "Pregnancy loss not confirmed",
        summary: isNeedsVisit
          ? "The report remains open for Technician follow-up. No visit has been scheduled."
          : "Pregnancy monitoring continues.",
        metadata: {
          pregnancyId: report.pregnancyId,
          inseminationId: report.inseminationId,
          reportStatus: updatedReport.status,
        },
      }], { session });
    });
  } finally {
    if (session) await session.endSession();
  }

  if (updatedReport) {
    const isNeedsVisit = outcome === PREGNANCY_LOSS_REVIEW_OUTCOME.NEEDS_VISIT;
    const animal = await Animal.findOne({ _id: report.animalId })
      .select("earTag animalId")
      .lean();
    const animalTag = animal?.earTag || animal?.animalId || "Animal";
    const technicianName =
      technician.name ||
      `${technician.firstName || ""} ${technician.lastName || ""}`.trim() ||
      "Technician";

    await notifyUserBestEffort({
      recipientId: report.farmerId,
      senderId: technician._id,
      type: "system",
      category: "pregnancy",
      eventType: isNeedsVisit
        ? "pregnancy_loss_follow_up_needed"
        : "pregnancy_loss_not_confirmed",
      relatedId: updatedReport._id,
      linkType: "animal",
      metadata: {
        animalId: report.animalId,
        animalTag,
        pregnancyId: report.pregnancyId,
        inseminationId: report.inseminationId,
        technicianName,
        reviewNotes: reviewNotes || "",
      },
    });
  }

  return { report: updatedReport, task: updatedTask, calving: null };
};

const finalizeConfirmedLossReport = async ({
  report,
  task,
  technician,
  reviewNotes,
  persistCalvingImpl,
}) => {
  const existingCalving = await Calving.findOne({
    pregnancyId: report.pregnancyId,
    deletedAt: null,
  });
  let calving = existingCalving;
  if (existingCalving && existingCalving.outcome !== "abortion") {
    throw new AppError("This pregnancy already has a different completed outcome.", {
      status: 409,
      code: "PREGNANCY_ALREADY_CLOSED",
    });
  }

  if (!calving) {
    const [mother, pregnancy] = await Promise.all([
      Animal.findOne({ _id: report.animalId, deletedAt: null }),
      Pregnancy.findOne({
        _id: report.pregnancyId,
        cycleStatus: "active",
        "pregnancyDiagnosis.result": "Pregnant",
        deletedAt: null,
      }),
    ]);
    if (!mother || !pregnancy) {
      throw new AppError("The active confirmed pregnancy is no longer available for loss confirmation.", {
        status: 409,
        code: "PREGNANCY_NOT_CONFIRMED",
      });
    }
    const result = await persistCalvingImpl({
      mother,
      pregnancy,
      calves: [],
      nonLivingCalves: [],
      date: report.observationDate,
      outcome: "abortion",
      numberOfCalves: 0,
      technicianNote: reviewNotes,
      actor: technician,
    });
    calving = result.calving;
  }

  let session;
  let updatedReport;
  let updatedTask;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const reviewedAt = new Date();
      updatedReport = await PregnancyLossReport.findOneAndUpdate(
        { _id: report._id, status: { $in: ACTIVE_REPORT_STATUSES } },
        {
          $set: {
            status: PREGNANCY_LOSS_REPORT_STATUS.CONFIRMED,
            reviewedBy: technician._id,
            reviewedAt,
            reviewNotes,
            confirmedCalvingId: calving._id,
          },
        },
        { returnDocument: "after", session },
      );
      if (!updatedReport) {
        throw new AppError("This pregnancy-loss report has already been resolved.", {
          status: 409,
          code: "PREGNANCY_LOSS_REPORT_ALREADY_REVIEWED",
        });
      }
      updatedTask = await Task.findOneAndUpdate(
        { _id: task._id },
        {
          $set: {
            status: "Completed",
            completedAt: reviewedAt,
            relatedRecordType: "calving",
            relatedRecordId: calving._id,
            "metadata.reviewOutcome": PREGNANCY_LOSS_REVIEW_OUTCOME.CONFIRM_LOSS,
            "metadata.reportStatus": PREGNANCY_LOSS_REPORT_STATUS.CONFIRMED,
            "metadata.confirmedCalvingId": calving._id,
          },
        },
        { returnDocument: "after", session },
      );
      await AnimalTimelineEvent.create([{
        animalId: report.animalId,
        eventType: "pregnancy_loss_confirmed",
        occurredAt: reviewedAt,
        actorId: technician._id,
        sourceType: "PregnancyLossReport",
        sourceId: report._id,
        title: "Pregnancy loss confirmed",
        summary: "A Technician confirmed the reported pregnancy loss.",
        metadata: {
          pregnancyId: report.pregnancyId,
          inseminationId: report.inseminationId,
          calvingId: calving._id,
          reportStatus: PREGNANCY_LOSS_REPORT_STATUS.CONFIRMED,
        },
      }], { session });
    });

    const animalDoc = await Animal.findOne({ _id: report.animalId, deletedAt: null });
    const animalTag = animalDoc?.earTag || animalDoc?.animalId || animalDoc?.name || "Animal";
    const technicianName = technician?.name || "A technician";

    await notifyUserBestEffort({
      recipientId: report.farmerId,
      senderId: technician._id,
      type: "system",
      category: "pregnancy",
      eventType: "pregnancy_loss_confirmed",
      relatedId: updatedReport._id,
      linkType: "animal",
      metadata: {
        animalId: report.animalId,
        animalTag,
        pregnancyId: report.pregnancyId,
        inseminationId: report.inseminationId,
        technicianName,
        reviewNotes: reviewNotes || "",
      },
    });

    return { report: updatedReport, task: updatedTask, calving };
  } finally {
    if (session) await session.endSession();
  }
};

export const reviewPregnancyLossReport = async ({
  reportId,
  technician,
  outcome,
  reviewNotes = "",
  persistCalvingImpl = persistCalving,
}) => {
  if (!Object.values(PREGNANCY_LOSS_REVIEW_OUTCOME).includes(outcome)) {
    throw new AppError("Select a valid pregnancy-loss review outcome.", {
      status: 400,
      code: "PREGNANCY_LOSS_REVIEW_OUTCOME_INVALID",
    });
  }
  const report = await loadReviewReport(reportId);
  if (!ACTIVE_REPORT_STATUSES.includes(report.status)) {
    throw new AppError("This pregnancy-loss report has already been resolved.", {
      status: 409,
      code: "PREGNANCY_LOSS_REPORT_ALREADY_REVIEWED",
    });
  }
  const task = await claimReviewTask({ report, technician });
  const normalizedNotes = String(reviewNotes || "").trim();
  if (outcome === PREGNANCY_LOSS_REVIEW_OUTCOME.CONFIRM_LOSS) {
    return finalizeConfirmedLossReport({
      report,
      task,
      technician,
      reviewNotes: normalizedNotes,
      persistCalvingImpl,
    });
  }
  return finalizeNonTerminalReview({
    report,
    task,
    technician,
    outcome,
    reviewNotes: normalizedNotes,
  });
};

export const getFarmerPregnancyLossReports = ({ animalId, farmerId }) =>
  PregnancyLossReport.find({ animalId, farmerId })
    .sort({ reportedAt: -1 })
    .populate("reviewedBy", "name")
    .lean();

export const getPregnancyLossReportForTechnician = (reportId) =>
  PregnancyLossReport.findById(reportId)
    .populate("animalId", "name animalId earTag imageUrl breed species gender reproductiveStatus expectedCalvingDate")
    .populate("farmerId", "name phoneNumber address farmLocation imageUrl")
    .populate("pregnancyId")
    .populate("inseminationId", "inseminationDate attemptNumber sireBreed sireCode")
    .populate("reviewedBy", "name")
    .populate("confirmedCalvingId")
    .lean();
