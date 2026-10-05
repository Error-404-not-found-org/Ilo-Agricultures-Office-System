import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { FieldNote } from "../src/models/field-note.model.js";
import { getUserById } from "../src/controllers/user.controllers.js";
import { getTechnicianFieldNotes } from "../src/controllers/technician.controllers.js";

const query = (value) => ({
  select() { return this; }, sort() { return this; }, limit() { return this; },
  populate() { return this; }, lean: async () => value,
});

test("Field Notes list scopes profile navigation to Farmer ID, not Farmer name", async () => {
  const farmerId = "507f1f77bcf86cd799439012";
  const technicianId = "507f1f77bcf86cd799439013";
  const originalFind = FieldNote.find;
  const originalUserFind = User.findOne;
  let seenFilter;
  try {
    User.findOne = () => ({ select: async () => ({ _id: farmerId, role: "farmer" }) });
    FieldNote.find = (filter) => {
      seenFilter = filter;
      return query([{ _id: "note-a", farmerId: { _id: farmerId, name: "Same Name" }, technicianId: { name: "Tech" } }]);
    };
    let body;
    const res = { status() { return this; }, json(value) { body = value; return this; } };
    await getTechnicianFieldNotes({ user: { _id: technicianId, role: "technician" }, query: { farmerId } }, res);
    assert.deepEqual(seenFilter, { technicianId, farmerId, deletedAt: null });
    assert.equal(body.length, 1);
  } finally {
    FieldNote.find = originalFind;
    User.findOne = originalUserFind;
  }
});

test("Technician Farmer summary counts active requests globally but official records only for this Technician", async () => {
  const farmerId = "507f1f77bcf86cd799439012";
  const technicianId = "507f1f77bcf86cd799439013";
  const seen = {};
  const originals = [
    [User, "findById"], [Animal, "find"], [Animal, "countDocuments"],
    [Insemination, "countDocuments"], [Insemination, "find"], [Insemination, "findOne"],
    [HealthRequest, "countDocuments"], [HealthRequest, "find"],
    [MedicalRecord, "countDocuments"], [MedicalRecord, "findOne"],
    [Pregnancy, "countDocuments"], [Pregnancy, "findOne"],
    [Calving, "countDocuments"], [Calving, "findOne"],
    [Task, "find"], [FieldNote, "find"],
  ].map(([model, name]) => [model, name, model[name]]);
  try {
    User.findById = () => ({ select: async () => ({
      _id: farmerId, role: "farmer", name: "Same Name", deletedAt: null,
      clerkId: null, profileClaimStatus: "unclaimed",
      toObject() { return { _id: farmerId, role: "farmer", name: "Same Name", deletedAt: null }; },
    }) });
    Animal.find = () => query([]);
    Animal.countDocuments = async () => 0;
    for (const [model, label] of [
      [Insemination, "ai"], [HealthRequest, "health"],
      [MedicalRecord, "medical"], [Pregnancy, "pregnancy"], [Calving, "calving"],
    ]) {
      model.countDocuments = async (filter) => {
        (seen[label] ||= []).push(filter);
        return 1;
      };
    }
    Insemination.find = () => query([]);
    HealthRequest.find = () => query([]);
    Task.find = () => query([]);
    for (const model of [Insemination, MedicalRecord, Pregnancy, Calving]) {
      model.findOne = () => query(null);
    }
    FieldNote.find = (filter) => { seen.notes = filter; return query([]); };
    const req = { params: { id: farmerId }, user: { _id: technicianId, role: "technician" } };
    let body;
    const res = { status() { return this; }, json(value) { body = value; return this; } };
    await getUserById(req, res);
    assert.equal(body.profileSummary.activeRequests, 2);
    assert.deepEqual(body.profileSummary.serviceRecords, { ai: 1, health: 1, pregnancy: 1, calving: 1 });
    assert.equal(body.profileSummary.lastServiceDate, null);
    assert.deepEqual(seen.notes, { technicianId, farmerId, deletedAt: null });
    assert.equal(seen.ai.some((filter) => filter.status?.$in && !filter.technicianId && !filter.approvedBy && !filter.$or), true);
    assert.equal(seen.health.some((filter) => filter.status?.$in && !filter.handledBy && !filter.assignedTechnicianId && !filter.$or), true);
    assert.equal(seen.pregnancy.some((filter) => filter["confirmation.confirmedBy"] === technicianId), true);
    assert.equal(seen.calving.some((filter) => filter.technicianId === technicianId), true);
  } finally {
    for (const [model, name, value] of originals) model[name] = value;
  }
});
