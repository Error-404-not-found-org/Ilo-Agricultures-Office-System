import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { recordTechnicianBreedingObservation, submitFarmerBreedingObservation } from "../src/controllers/ai-request.controllers.js";

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

  t.beforeEach(async () => {
    farmer = new User({ _id: new mongoose.Types.ObjectId(), role: "farmer", name: "F1" });
    technician = new User({ _id: new mongoose.Types.ObjectId(), role: "technician", name: "T1" });
    animal = new Animal({ _id: new mongoose.Types.ObjectId(), species: "Cattle", farmerId: farmer._id });
    insemination = new Insemination({
      _id: new mongoose.Types.ObjectId(),
      animalId: animal._id,
      farmerId: farmer._id,
      status: "done",
      inseminationDate: new Date(),
    });
  });

  await t.test("Scenario A: Farmer submits 'No heat noticed' (farmer_app provenance)", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const req = {
      params: { id: insemination._id },
      user: { _id: farmer._id },
      body: { reportType: "possible_pregnancy", notes: "No heat noticed" }
    };
    const res = createMockRes();

    // Mock DB queries inside controller
    mongoose.Model.findById = async function(id) {
      if (id.toString() === insemination._id.toString()) return insemination;
      if (id.toString() === animal._id.toString()) return animal;
      return null;
    };
    insemination.populate = function() { return this; };

    await submitFarmerBreedingObservation(req, res);

    assert.equal(res.statusVal, 200);
    assert.equal(insemination.farmerOutcomeReport, "possible_pregnancy");
    assert.equal(insemination.observationSource, "farmer_app");
    assert.equal(insemination.observationRecordedBy.toString(), farmer._id.toString());
  });

  await t.test("Scenario C: Technician calls farmer (technician_phone)", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const req = {
      params: { id: insemination._id },
      user: { _id: technician._id },
      body: { reportType: "possible_pregnancy", source: "technician_phone", notes: "Called farmer" }
    };
    const res = createMockRes();

    mongoose.Model.findById = async function(id) {
      if (id.toString() === insemination._id.toString()) return insemination;
      if (id.toString() === animal._id.toString()) return animal;
      return null;
    };
    insemination.populate = function() { return this; };

    await recordTechnicianBreedingObservation(req, res);

    assert.equal(res.statusVal, 200);
    assert.equal(insemination.farmerOutcomeReport, "possible_pregnancy");
    assert.equal(insemination.observationSource, "technician_phone");
    assert.equal(insemination.observationRecordedBy.toString(), technician._id.toString());
  });

  await t.test("Scenario D: Technician field observation (technician_field)", async () => {
    insemination.save = async () => {};
    animal.save = async () => {};
    const req = {
      params: { id: insemination._id },
      user: { _id: technician._id },
      body: { reportType: "return_to_heat", source: "technician_field", signs: ["Standing"] }
    };
    const res = createMockRes();

    mongoose.Model.findById = async function(id) {
      if (id.toString() === insemination._id.toString()) return insemination;
      if (id.toString() === animal._id.toString()) return animal;
      return null;
    };
    insemination.populate = function() { return this; };

    await recordTechnicianBreedingObservation(req, res);

    assert.equal(res.statusVal, 200);
    assert.equal(insemination.farmerOutcomeReport, "return_to_heat");
    assert.equal(insemination.observationSource, "technician_field");
    assert.equal(insemination.observationRecordedBy.toString(), technician._id.toString());
    assert.equal(insemination.failureReason, null); // AI not automatically failed
  });
});
