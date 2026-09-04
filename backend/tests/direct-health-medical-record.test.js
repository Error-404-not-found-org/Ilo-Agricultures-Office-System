import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { addMedicalRecord } from "../src/controllers/medical.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Notification } from "../src/models/notification.model.js";
import { User } from "../src/models/user.model.js";
import {
  DIRECT_HEALTH_SERVICE_TYPES,
  medicalRecordTypeForHealthService,
} from "../src/domain/direct-health-record.js";

const responseRecorder = () => {
  const state = { statusCode: 200, body: null };
  return {
    state,
    response: {
      status(code) {
        state.statusCode = code;
        return this;
      },
      json(body) {
        state.body = body;
        return this;
      },
    },
  };
};

test("direct Health service vocabulary maps to canonical MedicalRecord types", () => {
  assert.deepEqual(DIRECT_HEALTH_SERVICE_TYPES, [
    "disease",
    "medicine",
    "checkup",
    "injury",
    "vaccination",
    "deworming",
    "other",
  ]);
  assert.equal(medicalRecordTypeForHealthService("vaccination"), "Vaccination");
  assert.equal(medicalRecordTypeForHealthService("deworming"), "Deworming");
  assert.equal(medicalRecordTypeForHealthService("medicine"), "Treatment");
  assert.equal(medicalRecordTypeForHealthService("injury"), "Treatment");
  assert.equal(medicalRecordTypeForHealthService("disease"), "Check-up");
});

test("direct Health endpoint persists one complete MedicalRecord without request or task linkage", async () => {
  const originals = {
    animalFindById: Animal.findById,
    medicalCreate: MedicalRecord.create,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
    userFindById: User.findById,
  };
  const animalId = new mongoose.Types.ObjectId();
  const farmerId = new mongoose.Types.ObjectId();
  const technicianId = new mongoose.Types.ObjectId();
  let createCount = 0;
  let persisted;

  Animal.findById = async () => ({
    _id: animalId,
    animalId: "ANM-001",
    earTag: "TAG-001",
    farmerId,
  });
  User.findById = async () => ({ _id: farmerId, pushToken: null });
  MedicalRecord.create = async (payload) => {
    createCount += 1;
    persisted = payload;
    return { _id: new mongoose.Types.ObjectId(), ...payload };
  };
  Notification.findOneAndUpdate = async () => ({
    value: { _id: new mongoose.Types.ObjectId() },
    lastErrorObject: { updatedExisting: false },
  });

  const { state, response } = responseRecorder();
  try {
    await addMedicalRecord(
      {
        user: { _id: technicianId },
        body: {
          animalId,
          type: "Check-up",
          serviceDate: "2026-09-03",
          details: {
            serviceType: "medicine",
            diagnosis: "Mild infection",
            treatment: "Cleaned affected area",
            medicineName: "Penicillin",
            dosage: "10 ml",
            withdrawalPeriodDays: 7,
            advice: "Keep the area dry",
          },
          withdrawalPeriodDays: 7,
          note: "Condition resolved",
          followUpDate: "2026-09-10",
        },
      },
      response,
    );

    assert.equal(state.statusCode, 201);
    assert.equal(createCount, 1);
    assert.equal(persisted.type, "Treatment");
    assert.equal(String(persisted.animalId), String(animalId));
    assert.equal(String(persisted.farmerId), String(farmerId));
    assert.equal(String(persisted.technicianId), String(technicianId));
    assert.equal(persisted.details.serviceType, "medicine");
    assert.equal(persisted.details.diagnosis, "Mild infection");
    assert.equal(persisted.details.treatment, "Cleaned affected area");
    assert.equal(persisted.details.medicineName, "Penicillin");
    assert.equal(persisted.details.dosage, "10 ml");
    assert.equal(persisted.details.withdrawalPeriodDays, 7);
    assert.equal(persisted.details.advice, "Keep the area dry");
    assert.equal(persisted.note, "Condition resolved");
    assert.equal(persisted.healthRequestId, undefined);
    assert.equal(persisted.taskId, undefined);
  } finally {
    Animal.findById = originals.animalFindById;
    MedicalRecord.create = originals.medicalCreate;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
    User.findById = originals.userFindById;
  }
});

test("MedicalRecord schema retains direct Health service details", () => {
  const record = new MedicalRecord({
    animalId: new mongoose.Types.ObjectId(),
    farmerId: new mongoose.Types.ObjectId(),
    technicianId: new mongoose.Types.ObjectId(),
    type: "Treatment",
    details: {
      serviceType: "injury",
      diagnosis: "Laceration",
      treatment: "Wound care",
      medicineName: "Antibiotic",
      dosage: "5 ml",
      advice: "Keep clean",
    },
  }).toObject();

  assert.equal(record.details.serviceType, "injury");
  assert.equal(record.details.advice, "Keep clean");
});
