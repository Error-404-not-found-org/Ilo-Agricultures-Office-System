import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { recordTechnicianBreedingObservation, submitFarmerBreedingObservation } from "../src/controllers/ai-request.controllers.js";

const populatedQuery = (value) => {
  const query = {
    populate() { return query; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return query;
};

function createMockRes() {
  let statusVal = 200;
  let jsonVal = null;
  return {
    status(code) {
      statusVal = code;
      return this;
    },
    json(data) {
      jsonVal = data;
      return this;
    },
    get statusVal() { return statusVal; },
    get jsonVal() { return jsonVal; },
  };
}

test("Technician Breeding Observation API", async (t) => {
  let farmer, technician, animal, insemination;
  const originals = {
    inseminationFindOne: Insemination.findOne,
    inseminationFindById: Insemination.findById,
    animalFindById: Animal.findById,
    taskFindOne: Task.findOne,
    configFindOne: Config.findOne,
    timelineCreate: AnimalTimelineEvent.create,
    auditCreate: AuditLog.create,
    userFindOne: User.findOne,
  };
  t.after(() => {
    Insemination.findOne = originals.inseminationFindOne;
    Insemination.findById = originals.inseminationFindById;
    Animal.findById = originals.animalFindById;
    Task.findOne = originals.taskFindOne;
    Config.findOne = originals.configFindOne;
    AnimalTimelineEvent.create = originals.timelineCreate;
    AuditLog.create = originals.auditCreate;
    User.findOne = originals.userFindOne;
  });

  t.beforeEach(async () => {
    farmer = new User({ _id: new mongoose.Types.ObjectId(), role: "farmer", name: "F1" });
    technician = new User({ _id: new mongoose.Types.ObjectId(), role: "technician", name: "T1" });
    animal = new Animal({ _id: new mongoose.Types.ObjectId(), species: "Cattle", farmerId: farmer._id });
    insemination = new Insemination({
      _id: new mongoose.Types.ObjectId(),
      animalId: animal._id,
      farmerId: farmer._id,
      approvedBy: technician._id,
      technicianId: technician._id,
      status: "done",
      inseminationDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    Insemination.findOne = () => populatedQuery(insemination);
    Insemination.findById = () => populatedQuery(insemination);
    Animal.findById = async () => animal;
    Task.findOne = async () => null;
    Config.findOne = async () => null;
    AnimalTimelineEvent.create = async () => ({});
    AuditLog.create = async () => ({});
    User.findOne = () => ({ select: async () => null });
  });

  await t.test("Scenario A: Farmer submits 'No heat noticed' (farmer_app provenance)", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const req = {
      params: { id: insemination._id },
      user: { _id: farmer._id, role: "farmer" },
      body: { reportType: "possible_pregnancy", notes: "No heat noticed" }
    };
    const res = createMockRes();

    await submitFarmerBreedingObservation(req, res);

    assert.equal(res.statusVal, 200);
    assert.equal(insemination.farmerOutcomeReport, "possible_pregnancy");
    assert.equal(insemination.observationSource, "farmer");
    assert.equal(insemination.observationRecordedBy.toString(), farmer._id.toString());
  });

  await t.test("Scenario C: Technician calls farmer (technician_phone)", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const req = {
      params: { id: insemination._id },
      user: { _id: technician._id, role: "technician" },
      body: { reportType: "possible_pregnancy", source: "technician_phone", notes: "Called farmer" }
    };
    const res = createMockRes();

    await recordTechnicianBreedingObservation(req, res);

    assert.equal(res.statusVal, 200);
    assert.equal(insemination.farmerOutcomeReport, "possible_pregnancy");
    assert.equal(insemination.observationSource, "technician");
    assert.match(insemination.statusHistory.at(-1).note, /technician_phone/);
    assert.equal(insemination.observationRecordedBy.toString(), technician._id.toString());
  });

  await t.test("Scenario D: Technician field return-to-heat is professionally verified", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const originalsForVerification = {
      startSession: mongoose.startSession,
      taskFind: Task.find,
      inseminationFindOneAndUpdate: Insemination.findOneAndUpdate,
      animalFindByIdAndUpdate: Animal.findByIdAndUpdate,
    };
    mongoose.startSession = async () => ({
      withTransaction: async (work) => work(),
      endSession: async () => {},
    });
    Task.find = () => ({ session: async () => [] });
    Insemination.findOneAndUpdate = async (_query, update) => {
      Object.assign(insemination, update.$set);
      return insemination;
    };
    Animal.findByIdAndUpdate = async (_id, update) => {
      Object.assign(animal, update.$set);
      return animal;
    };
    const req = {
      params: { id: insemination._id },
      user: { _id: technician._id, role: "technician" },
      body: { reportType: "return_to_heat", source: "technician_field", signs: ["Standing"] }
    };
    const res = createMockRes();

    try {
      await recordTechnicianBreedingObservation(req, res);

      assert.equal(res.statusVal, 200);
      assert.equal(insemination.outcome, "Failed (Re-heat)");
      assert.equal(insemination.failureReason, "return_to_heat");
      assert.equal(insemination.outcomeConfirmationSource, "technician_return_to_heat");
      assert.equal(insemination.outcomeConfirmedBy.toString(), technician._id.toString());
    } finally {
      mongoose.startSession = originalsForVerification.startSession;
      Task.find = originalsForVerification.taskFind;
      Insemination.findOneAndUpdate = originalsForVerification.inseminationFindOneAndUpdate;
      Animal.findByIdAndUpdate = originalsForVerification.animalFindByIdAndUpdate;
    }
  });
});
