import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Calving } from "../models/calving.model.js";
import { AppError } from "../utils/app-error.js";
import {
  normalizeAICompletionFields,
  normalizeTechnicianNoteInput,
} from "../domain/ai-recording-fields.js";
import {
  PREVIOUS_AI_ENTRY_MODE,
  assertPreviousAICanContinueTracking,
  normalizePreviousAIEntryMode,
  validatePreviousAIEventDate,
} from "../domain/previous-ai-entry.js";
import { ANIMAL_REPRODUCTIVE_STATUS } from "../domain/status-vocabulary.js";
import { combineManilaServiceDateTime } from "../domain/service-date-time.js";
import { createAIRequestWithGuard } from "./ai-request-creation.service.js";
import { getAnimalAIEligibility } from "./ai-eligibility.service.js";
import { createAuditLog } from "./audit.service.js";
import { ensurePostAICompletionFollowUps } from "./post-ai-followup.service.js";

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

const createHistoricalRecord = async ({
  farmerId,
  animal,
  eventDate,
  completionFields,
  estrus,
  technicianNote,
  actorId,
  now,
  session,
}) => {
  const [record] = await Insemination.create(
    [
      {
        farmerId,
        animalId: animal._id,
        inseminationDate: eventDate,
        sireBreed: completionFields.sireBreed,
        sireCode: completionFields.sireCode,
        semenDosesUsed: completionFields.semenDosesUsed,
        estrus: estrus || "Natural",
        technicianNote: technicianNote || "",
        status: "done",
        completedAt: eventDate,
        technicianId: actorId,
        approvedBy: actorId,
        entryMode: PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY,
        observationSource: "paper_record",
        outcome: "Pending",
        isSuccess: null,
        breedingCycleStatus: "completed",
        breedingCycleCompletedAt: now,
        statusHistory: [
          {
            status: "done",
            note: "Previous AI record added as history only.",
            actorId,
            createdAt: now,
          },
        ],
      },
    ],
    { session },
  );

  await createAuditLog(
    {
      action: "RECORD_PREVIOUS_AI_HISTORY",
      actorId,
      entityType: "Insemination",
      entityId: record._id,
      metadata: {
        animalId: animal._id,
        farmerId,
        entryMode: PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY,
        eventDate,
      },
    },
    { session },
  );

  return {
    outcome: "history_record_created",
    insemination: record,
    task: null,
    animal,
  };
};

const assertNoSupersedingReproductiveEvent = async ({
  animal,
  eventDate,
  session,
}) => {
  const [newerInsemination, activePregnancy, newerPregnancy, newerCalving] =
    await Promise.all([
      Insemination.findOne({
        animalId: animal._id,
        inseminationDate: { $gt: eventDate },
        deletedAt: null,
      }).session(session),
      Pregnancy.findOne({
        animalId: animal._id,
        deletedAt: null,
        "pregnancyDiagnosis.result": "Pregnant",
        cycleStatus: { $nin: ["completed", "lost"] },
      }).session(session),
      Pregnancy.findOne({
        animalId: animal._id,
        deletedAt: null,
        $or: [
          { "pregnancyDiagnosis.date": { $gt: eventDate } },
          { "confirmation.confirmedAt": { $gt: eventDate } },
        ],
      }).session(session),
      Calving.findOne({
        animalId: animal._id,
        date: { $gt: eventDate },
        deletedAt: null,
      }).session(session),
    ]);

  if (newerInsemination || activePregnancy || newerPregnancy || newerCalving) {
    throw new AppError(
      "A newer reproductive event already defines the current cycle. Save this AI as History Only instead.",
      { status: 409, code: "PREVIOUS_AI_TRACKING_SUPERSEDED" },
    );
  }
};

const createTrackingTasks = async ({
  insemination,
  animal,
  farmerId,
  actorId,
  eventDate,
  now,
  session,
}) => {
  const { pdTask, breedingFollowUpTask } =
    await ensurePostAICompletionFollowUps({
      inseminationId: insemination._id,
      inseminationDate: eventDate,
      farmerId,
      technicianId: actorId,
      animalId: animal._id,
      animalTag: animal.earTag || animal.animalId,
      animalSpecies: animal.species,
      now,
      previousRecordEntry: true,
      session,
    });

  return breedingFollowUpTask || pdTask;
};

const createContinueTrackingRecord = async ({
  farmerId,
  animal,
  eventDate,
  completionFields,
  estrus,
  technicianNote,
  actorId,
  now,
  session,
}) => {
  assertPreviousAICanContinueTracking({
    eventDate,
    now,
    species: animal.species,
    breed: animal.breed,
  });
  await assertNoSupersedingReproductiveEvent({ animal, eventDate, session });

  const eligibility = await getAnimalAIEligibility({
    animal,
    at: eventDate,
    session,
  });
  if (!eligibility.eligible) {
    throw new AppError(eligibility.reason, {
      status: 409,
      code: eligibility.code,
    });
  }

  const insemination = await createAIRequestWithGuard(
    {
      farmerId,
      animalId: animal._id,
      inseminationDate: eventDate,
      scheduledDate: eventDate,
      preferredDate: eventDate,
      sireBreed: completionFields.sireBreed,
      sireCode: completionFields.sireCode,
      semenDosesUsed: completionFields.semenDosesUsed,
      estrus: estrus || "Natural",
      technicianNote: technicianNote || "",
      status: "done",
      technicianId: actorId,
      approvedBy: actorId,
      entryMode: PREVIOUS_AI_ENTRY_MODE.CONTINUE_TRACKING,
      observationSource: "paper_record",
      statusHistory: [
        {
          status: "done",
          note: "Previous AI record added and current tracking continued from its service date.",
          actorId,
          createdAt: now,
        },
      ],
    },
    { session, completedAt: eventDate },
  );

  const updatedAnimal = await Animal.findByIdAndUpdate(
    animal._id,
    {
      $set: {
        reproductiveStatus: ANIMAL_REPRODUCTIVE_STATUS.INSEMINATED,
        lastInseminationDate: eventDate,
      },
      $push: {
        activityLogs: {
          event: "Artificial Insemination",
          date: eventDate,
          description: "Previous AI record added; current tracking continued from the actual service date.",
        },
      },
    },
    { session, returnDocument: "after" },
  );

  const task = await createTrackingTasks({
    insemination,
    animal,
    farmerId,
    actorId,
    eventDate,
    now,
    session,
  });

  await createAuditLog(
    {
      action: "RECORD_PREVIOUS_AI_CONTINUE_TRACKING",
      actorId,
      entityType: "Insemination",
      entityId: insemination._id,
      metadata: {
        animalId: animal._id,
        farmerId,
        entryMode: PREVIOUS_AI_ENTRY_MODE.CONTINUE_TRACKING,
        eventDate,
        attemptNumber: insemination.attemptNumber,
      },
    },
    { session },
  );

  return {
    outcome: "tracking_record_created",
    insemination,
    task,
    animal: updatedAnimal,
  };
};

export const recordPreviousInsemination = async ({
  farmerId,
  animalId,
  inseminationDetails,
  entryMode,
  actorId,
  now = new Date(),
}) => {
  const normalizedEntryMode = normalizePreviousAIEntryMode(entryMode);
  const completionFields = normalizeAICompletionFields(
    inseminationDetails || {},
  );
  const technicianNote = normalizeTechnicianNoteInput(
    inseminationDetails || {},
  );

  return runTransaction(async (session) => {
    const animal = await Animal.findOne({
      _id: animalId,
      deletedAt: null,
    }).session(session);
    if (!animal) {
      throw new AppError("Animal not found.", {
        status: 404,
        code: "ANIMAL_NOT_FOUND",
      });
    }
    if (String(animal.farmerId) !== String(farmerId)) {
      throw new AppError(
        "The selected animal does not belong to the selected farmer.",
        { status: 400, code: "ANIMAL_FARMER_MISMATCH" },
      );
    }

    const eventTimestamp = combineManilaServiceDateTime({
      date: inseminationDetails?.inseminationDate,
      time: inseminationDetails?.time,
      fallback: now,
    });
    const eventDate = validatePreviousAIEventDate({
      eventDate: eventTimestamp,
      birthDate: animal.birthDate,
      species: animal.species,
      now,
    });
    const shared = {
      farmerId,
      animal,
      eventDate,
      completionFields,
      estrus: inseminationDetails?.estrus,
      technicianNote,
      actorId,
      now,
      session,
    };

    if (normalizedEntryMode === PREVIOUS_AI_ENTRY_MODE.HISTORY_ONLY) {
      return createHistoricalRecord(shared);
    }
    return createContinueTrackingRecord(shared);
  });
};
