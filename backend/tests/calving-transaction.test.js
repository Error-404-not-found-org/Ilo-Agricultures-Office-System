import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Animal } from "../src/models/animal.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Notification } from "../src/models/notification.model.js";
import { persistCalving } from "../src/services/calving.service.js";

const mother = {
  _id: "507f1f77bcf86cd799439021",
  farmerId: "507f1f77bcf86cd799439011",
  animalId: "MOTHER-1",
  earTag: "M-1",
  species: "Cattle",
  breed: "Native",
  color: "Brown",
  brand: "",
  barangay: "Poblacion",
};

const pregnancy = {
  _id: "507f1f77bcf86cd799439022",
  animalId: mother._id,
  inseminationId: { sireBreed: "Brahman" },
};

test("Calving transaction: all related writes share one session", async () => {
  const originals = {
    startSession: mongoose.startSession,
    calvingFindOne: Calving.findOne,
    animalFindOne: Animal.findOne,
    animalInsertMany: Animal.insertMany,
    calvingCreate: Calving.create,
    animalFindByIdAndUpdate: Animal.findByIdAndUpdate,
    notificationCreate: Notification.create,
  };

  const session = {
    async withTransaction(work) {
      await work();
    },
    async endSession() {},
  };
  mongoose.startSession = async () => session;

  Calving.findOne = () => ({ session: async () => null });
  Animal.findOne = () => ({
    session() {
      return {
        select: async () => null,
      };
    },
  });

  let insertSession = null;
  Animal.insertMany = async (_documents, options) => {
    insertSession = options.session;
    return [
      {
        _id: "507f1f77bcf86cd799439023",
        earTag: "C-1",
      },
    ];
  };

  let calvingSession = null;
  Calving.create = async (_documents, options) => {
    calvingSession = options.session;
    return [{ _id: "507f1f77bcf86cd799439024" }];
  };

  let motherSession = null;
  Animal.findByIdAndUpdate = async (_id, _update, options) => {
    motherSession = options.session;
  };

  let notificationSession = null;
  Notification.create = async (_documents, options) => {
    notificationSession = options.session;
  };

  try {
    const result = await persistCalving({
      mother,
      pregnancy,
      calves: [{ earTag: "C-1", sex: "F", color: "Brown" }],
      date: new Date("2026-07-10T08:00:00.000Z"),
      calvingEase: "Normal",
      numberOfCalves: 1,
      technicianNote: "Healthy calf",
      actor: {
        _id: "507f1f77bcf86cd799439025",
        role: "technician",
      },
    });

    assert.equal(result.offspring.length, 1);
    assert.equal(insertSession, session);
    assert.equal(calvingSession, session);
    assert.equal(motherSession, session);
    assert.equal(notificationSession, session);
  } finally {
    mongoose.startSession = originals.startSession;
    Calving.findOne = originals.calvingFindOne;
    Animal.findOne = originals.animalFindOne;
    Animal.insertMany = originals.animalInsertMany;
    Calving.create = originals.calvingCreate;
    Animal.findByIdAndUpdate = originals.animalFindByIdAndUpdate;
    Notification.create = originals.notificationCreate;
  }
});

test("Calving transaction: rejects mismatched calf counts before writing", async () => {
  await assert.rejects(
    persistCalving({
      mother,
      pregnancy,
      calves: [{ earTag: "C-1", sex: "F" }],
      numberOfCalves: 2,
      actor: { _id: "507f1f77bcf86cd799439025", role: "technician" },
    }),
    (error) => error.code === "CALF_COUNT_MISMATCH" && error.status === 400,
  );
});

test("Calving transaction: rejects pregnancy records for another mother", async () => {
  await assert.rejects(
    persistCalving({
      mother,
      pregnancy: { ...pregnancy, animalId: "507f1f77bcf86cd799439099" },
      calves: [{ earTag: "C-1", sex: "F" }],
      numberOfCalves: 1,
      actor: { _id: "507f1f77bcf86cd799439025", role: "technician" },
    }),
    (error) =>
      error.code === "PREGNANCY_MOTHER_MISMATCH" && error.status === 409,
  );
});
