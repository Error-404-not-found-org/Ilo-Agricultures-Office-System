import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { assertStatusTransition, reproductiveStatusForPregnancyResult } from "../src/domain/livestock-workflow.js";
import {
  AI_STATUS,
  HEALTH_STATUS,
  ANIMAL_REPRODUCTIVE_STATUS,
  normalizeAIStatus,
  normalizeAnimalReproductiveStatus,
  normalizeHealthStatus,
  reproductiveStatusQuery,
} from "../src/domain/status-vocabulary.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { persistPregnancyDiagnosis } from "../src/services/livestock-transaction.service.js";

test("Livestock workflow permits the intended scheduled service path", () => {
  assert.doesNotThrow(() => assertStatusTransition("ai", "approved", "scheduled"));
  assert.doesNotThrow(() => assertStatusTransition("ai", "scheduled", "in-progress"));
  assert.doesNotThrow(() => assertStatusTransition("ai", "in-progress", "done"));
  assert.doesNotThrow(() => assertStatusTransition("health", "scheduled", "in-progress"));
  assert.doesNotThrow(() => assertStatusTransition("health", "in-progress", "resolved"));
});

test("Livestock workflow rejects completion shortcuts and terminal reopening", () => {
  assert.throws(() => assertStatusTransition("ai", "approved", "done"), (error) => error.code === "INVALID_STATUS_TRANSITION" && error.status === 409);
  assert.throws(() => assertStatusTransition("health", "approved", "resolved"), (error) => error.code === "INVALID_STATUS_TRANSITION");
  assert.throws(() => assertStatusTransition("ai", "done", "scheduled"), (error) => error.code === "INVALID_STATUS_TRANSITION");
});

test("Pregnancy result maps through the shared animal lifecycle vocabulary", () => {
  assert.equal(reproductiveStatusForPregnancyResult("Pregnant"), "Pregnant");
  assert.equal(reproductiveStatusForPregnancyResult("Empty"), "Normal");
});

test("Pregnancy diagnosis writes pregnancy, insemination, and animal in one transaction", async () => {
  const originals = {
    startSession: mongoose.startSession,
    pregnancyFindOne: Pregnancy.findOne,
    pregnancyCreate: Pregnancy.create,
    inseminationUpdate: Insemination.findByIdAndUpdate,
    animalUpdate: Animal.findByIdAndUpdate,
  };
  const session = { async withTransaction(work) { await work(); }, async endSession() {} };
  mongoose.startSession = async () => session;
  Pregnancy.findOne = () => ({ session: async () => null });
  let createSession;
  Pregnancy.create = async (_docs, options) => {
    createSession = options.session;
    return [{ _id: "507f1f77bcf86cd799439099", targetCalvingDate: new Date("2027-04-01") }];
  };
  let inseminationSession;
  Insemination.findByIdAndUpdate = async (_id, _update, options) => { inseminationSession = options.session; };
  let animalSession;
  Animal.findByIdAndUpdate = async (_id, _update, options) => { animalSession = options.session; };

  try {
    await persistPregnancyDiagnosis({
      animal: { _id: "507f1f77bcf86cd799439001", farmerId: "507f1f77bcf86cd799439002", species: "Cattle", breed: "Native" },
      insemination: {
        _id: "507f1f77bcf86cd799439003",
        status: "done",
        inseminationDate: new Date("2026-01-01T00:00:00.000Z"),
      },
      result: "Pregnant",
      technicianNote: "Confirmed",
      diagnosisDate: new Date("2026-03-02T00:00:00.000Z"),
    });
    assert.equal(createSession, session);
    assert.equal(inseminationSession, session);
    assert.equal(animalSession, session);
  } finally {
    mongoose.startSession = originals.startSession;
    Pregnancy.findOne = originals.pregnancyFindOne;
    Pregnancy.create = originals.pregnancyCreate;
    Insemination.findByIdAndUpdate = originals.inseminationUpdate;
    Animal.findByIdAndUpdate = originals.animalUpdate;
  }
});

test("Pregnancy diagnosis rejects incomplete AI, Day 0, and Day 59 before writes", async () => {
  const originals = {
    startSession: mongoose.startSession,
    pregnancyFindOne: Pregnancy.findOne,
    pregnancyCreate: Pregnancy.create,
    inseminationUpdate: Insemination.findByIdAndUpdate,
    animalUpdate: Animal.findByIdAndUpdate,
  };
  const session = {
    async withTransaction(work) {
      await work();
    },
    async endSession() {},
  };
  mongoose.startSession = async () => session;
  Pregnancy.findOne = () => ({
    session: async () => null,
  });
  let pregnancyWrites = 0;
  let inseminationWrites = 0;
  let animalWrites = 0;
  Pregnancy.create = async () => {
    pregnancyWrites += 1;
    return [];
  };
  Insemination.findByIdAndUpdate = async () => {
    inseminationWrites += 1;
  };
  Animal.findByIdAndUpdate = async () => {
    animalWrites += 1;
  };
  const animal = {
    _id: "507f1f77bcf86cd799439001",
    farmerId: "507f1f77bcf86cd799439002",
    species: "Cattle",
    breed: "Native",
  };
  const aiDate = new Date("2026-01-01T00:00:00.000Z");
  try {
    await assert.rejects(
      () =>
        persistPregnancyDiagnosis({
          animal,
          insemination: {
            _id: "507f1f77bcf86cd799439003",
            status: "in-progress",
            inseminationDate: aiDate,
          },
          result: "Pregnant",
          diagnosisDate: new Date("2026-03-02T00:00:00.000Z"),
        }),
      (error) =>
        error.code === "AI_SERVICE_NOT_COMPLETED" &&
        error.status === 409,
    );
    for (const diagnosisDate of [
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-03-01T00:00:00.000Z"),
    ]) {
      await assert.rejects(
        () =>
          persistPregnancyDiagnosis({
            animal,
            insemination: {
              _id: "507f1f77bcf86cd799439003",
              status: "done",
              inseminationDate: aiDate,
            },
            result: "Pregnant",
            diagnosisDate,
          }),
        (error) =>
          error.code === "PREGNANCY_CHECK_TOO_EARLY" &&
          error.status === 422,
      );
    }
    assert.equal(pregnancyWrites, 0);
    assert.equal(inseminationWrites, 0);
    assert.equal(animalWrites, 0);
  } finally {
    mongoose.startSession = originals.startSession;
    Pregnancy.findOne = originals.pregnancyFindOne;
    Pregnancy.create = originals.pregnancyCreate;
    Insemination.findByIdAndUpdate = originals.inseminationUpdate;
    Animal.findByIdAndUpdate = originals.animalUpdate;
  }
});
test("Vocabulary consolidation: verify shared status constants match transitions", () => {
  assert.equal(AI_STATUS.PENDING, "pending");
  assert.equal(HEALTH_STATUS.RESOLVED, "resolved");
  assert.equal(ANIMAL_REPRODUCTIVE_STATUS.PREGNANT, "Pregnant");

  // Valid status transitions
  assert.doesNotThrow(() => assertStatusTransition("ai", AI_STATUS.PENDING, AI_STATUS.APPROVED));
  assert.doesNotThrow(() => assertStatusTransition("health", HEALTH_STATUS.PENDING, HEALTH_STATUS.APPROVED));

  // Invalid transition throws AppError
  assert.throws(
    () => assertStatusTransition("ai", AI_STATUS.PENDING, AI_STATUS.DONE),
    (error) => error.code === "INVALID_STATUS_TRANSITION" && error.status === 409
  );
});

test("Legacy status spellings normalize without breaking existing clients", () => {
  assert.equal(normalizeAnimalReproductiveStatus("Open"), ANIMAL_REPRODUCTIVE_STATUS.NORMAL);
  assert.equal(normalizeAnimalReproductiveStatus("Postpartum"), ANIMAL_REPRODUCTIVE_STATUS.POST_PARTUM);
  assert.equal(normalizeHealthStatus("in_progress"), HEALTH_STATUS.IN_PROGRESS);
  assert.equal(normalizeAIStatus("in_progress"), AI_STATUS.IN_PROGRESS);
  assert.deepEqual(reproductiveStatusQuery("Open"), { $in: ["Normal", "Open"] });
  assert.doesNotThrow(() => assertStatusTransition("health", "in_progress", "resolved"));
  assert.doesNotThrow(() => assertStatusTransition("ai", "in_progress", "done"));
});

test("Animal model converts legacy reproductive status on new writes", () => {
  const animal = new Animal({
    animalId: "LEGACY-STATUS-TEST",
    farmerId: new mongoose.Types.ObjectId(),
    species: "Cattle",
    breed: "Native",
    sex: "Female",
    reproductiveStatus: "Open",
  });

  assert.equal(animal.reproductiveStatus, ANIMAL_REPRODUCTIVE_STATUS.NORMAL);
  assert.equal(animal.validateSync()?.errors?.reproductiveStatus, undefined);
});
