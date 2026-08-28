import mongoose from "mongoose";
import { Animal } from "../models/animal.model.js";
import { Calving } from "../models/calving.model.js";
import { HealthRequest } from "../models/health-request.model.js";
import { Insemination } from "../models/insemination.model.js";
import { Pregnancy } from "../models/pregnancy.model.js";
import { Task } from "../models/task.model.js";
import {
  ACTIVE_AI_REQUEST_STATUSES,
  ACTIVE_HEALTH_REQUEST_STATUSES,
  TASK_STATUS,
} from "../domain/status-vocabulary.js";
import { AppError } from "../utils/app-error.js";

const OPEN_TASK_STATUSES = [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS];

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

const assertAnimalManager = (animal, actor) => {
  if (!animal) {
    throw new AppError("Animal not found.", {
      status: 404,
      code: "ANIMAL_NOT_FOUND",
    });
  }
  if (
    actor?.role === "farmer" &&
    String(animal.farmerId) !== String(actor._id)
  ) {
    throw new AppError("Unauthorized to manage this animal.", {
      status: 403,
      code: "ANIMAL_ACCESS_DENIED",
    });
  }
};

const findActiveWork = async ({ animalId, deletedAt, session }) => {
  const deletionScope = deletedAt === null ? { deletedAt: null } : { deletedAt };
  // MongoDB does not support parallel operations on one transaction session.
  const ai = await Insemination.exists({
    animalId,
    status: { $in: ACTIVE_AI_REQUEST_STATUSES },
    ...deletionScope,
  }).session(session);
  const health = await HealthRequest.exists({
    animalId,
    status: { $in: ACTIVE_HEALTH_REQUEST_STATUSES },
    ...deletionScope,
  }).session(session);
  const pregnancy = await Pregnancy.exists({
    animalId,
    "pregnancyDiagnosis.result": "Pregnant",
    // Missing cycleStatus is a supported historical active Pregnancy.
    cycleStatus: { $nin: ["completed", "lost"] },
    ...deletionScope,
  }).session(session);
  const task = await Task.exists({
    animalIds: animalId,
    status: { $in: OPEN_TASK_STATUSES },
  }).session(session);
  return {
    ai: Boolean(ai),
    health: Boolean(health),
    pregnancy: Boolean(pregnancy),
    task: Boolean(task),
  };
};

const assertNoActiveWork = (activeWork, action) => {
  const conflicts = Object.entries(activeWork)
    .filter(([, exists]) => exists)
    .map(([kind]) => kind);
  if (conflicts.length) {
    throw new AppError(
      `Animal cannot be ${action} while active work exists. Complete or cancel the linked work first.`,
      {
        status: 409,
        code: action === "archived"
          ? "ANIMAL_ARCHIVE_ACTIVE_WORK"
          : "ANIMAL_RESTORE_ACTIVE_WORK",
        details: { conflicts },
      },
    );
  }
};

export const archiveAnimalLifecycle = ({ animalId, actor }) =>
  runTransaction(async (session) => {
    const animal = await Animal.findOne({
      _id: animalId,
      deletedAt: null,
    }).session(session);
    assertAnimalManager(animal, actor);

    const activeWork = await findActiveWork({
      animalId: animal._id,
      deletedAt: null,
      session,
    });
    assertNoActiveWork(activeWork, "archived");

    const archivedAt = new Date();
    await Insemination.updateMany(
      { animalId: animal._id, deletedAt: null },
      { $set: { deletedAt: archivedAt }, $unset: { activeRequestKey: 1 } },
      { session },
    );
    await HealthRequest.updateMany(
      { animalId: animal._id, deletedAt: null },
      { $set: { deletedAt: archivedAt }, $unset: { activeCaseKey: 1 } },
      { session },
    );
    await Pregnancy.updateMany(
      { animalId: animal._id, deletedAt: null },
      { $set: { deletedAt: archivedAt } },
      { session },
    );
    await Calving.updateMany(
      { animalId: animal._id, deletedAt: null },
      { $set: { deletedAt: archivedAt } },
      { session },
    );

    animal.deletedAt = archivedAt;
    await animal.save({ session });
    return animal;
  });

export const restoreAnimalLifecycle = ({ animalId, actor }) =>
  runTransaction(async (session) => {
    const animal = await Animal.findOne({
      _id: animalId,
      deletedAt: { $ne: null },
    }).session(session);
    assertAnimalManager(animal, actor);

    const archivedAt = animal.deletedAt;
    const activeWork = await findActiveWork({
      animalId: animal._id,
      deletedAt: archivedAt,
      session,
    });
    assertNoActiveWork(activeWork, "restored");

    await Insemination.updateMany(
      { animalId: animal._id, deletedAt: archivedAt },
      { $set: { deletedAt: null } },
      { session },
    );
    await HealthRequest.updateMany(
      { animalId: animal._id, deletedAt: archivedAt },
      { $set: { deletedAt: null } },
      { session },
    );
    await Pregnancy.updateMany(
      { animalId: animal._id, deletedAt: archivedAt },
      { $set: { deletedAt: null } },
      { session },
    );
    await Calving.updateMany(
      { animalId: animal._id, deletedAt: archivedAt },
      { $set: { deletedAt: null } },
      { session },
    );

    animal.deletedAt = null;
    await animal.save({ session });
    return animal;
  });
