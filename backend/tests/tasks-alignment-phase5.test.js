import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { recordPregnancyCheck, recordCalving } from "../src/controllers/technician.controllers.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";

// Helper to create mock query object for Mongoose find/findOne
const mockQuery = (result) => {
  const query = Promise.resolve(result);
  query.session = () => query;
  query.select = () => query;
  query.populate = () => query;
  return query;
};

// Helper to create mock response object
function createMockRes() {
  let statusVal = 200;
  let jsonVal = null;
  const res = {
    status(code) {
      statusVal = code;
      return this;
    },
    json(data) {
      jsonVal = data;
      return this;
    },
    get statusVal() { return statusVal; },
    get jsonVal() { return jsonVal; }
  };
  return res;
}

test("Phase 5 Alignment: pregnancy endpoint delegates task completion to the unified transaction", () => {
  const handler = recordPregnancyCheck.toString();
  assert.match(handler, /confirmPregnancyDiagnosis\(\{/);
  assert.match(handler, /taskId/);
  assert.doesNotMatch(handler, /Pregnancy\.create/);
  assert.doesNotMatch(handler, /Task\.findOneAndUpdate/);
});

test("Phase 5 Alignment: recordCalving with taskId completes and links task", async () => {
  const originalStartSession = mongoose.startSession;
  const originalFindAnimalOne = Animal.findOne;
  const originalFindAnimalById = Animal.findById;
  const originalFindAnimalByIdAndUpdate = Animal.findByIdAndUpdate;
  const originalCreateAnimal = Animal.create;
  const originalInsertMany = Animal.insertMany;
  const originalFindPregnancyOne = Pregnancy.findOne;
  const originalUpdatePregnancy = Pregnancy.updateOne;
  const originalFindInsemination = Insemination.findOne;
  const originalUpdateInsemination = Insemination.updateOne;
  const originalFindCalving = Calving.findOne;
  const originalCreateCalving = Calving.create;
  const originalFindTask = Task.findOne;
  const originalFindTaskAndUpdate = Task.findOneAndUpdate;
  const originalNotificationCreate = Notification.create;
  const originalTimelineInsert = AnimalTimelineEvent.insertMany;
  const originalAuditCreate = AuditLog.create;

  let taskUpdated = false;
  let taskUpdateData = null;
  let calvingCreated = false;

  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {}
  });

  // Mock Mother lookup
  Animal.findOne = (query) => {
    if (query && (query.earTag || query.normalizedEarTag || query.$or)) {
      return mockQuery(null); // No duplicate calf tag exists
    }
    return mockQuery({ _id: "507f1f77bcf86cd799439011", reproductiveStatus: "Pregnant", lastCalvingDate: null, species: "Cattle", breed: "Angus", farmerId: "507f1f77bcf86cd799439016" });
  };
  Animal.findById = (id) => Promise.resolve({ _id: id, reproductiveStatus: "Pregnant", lastCalvingDate: null, species: "Cattle", breed: "Angus", farmerId: "507f1f77bcf86cd799439016" });
  Animal.findByIdAndUpdate = (id, update) => Promise.resolve({});
  Animal.create = (docs, options) => {
    const doc = Array.isArray(docs) ? docs[0] : docs;
    return Promise.resolve(Array.isArray(docs) ? [{ _id: "507f1f77bcf86cd799439018", ...doc }] : { _id: "507f1f77bcf86cd799439018", ...doc });
  };
  Animal.insertMany = (docs, options) => {
    return Promise.resolve(docs.map((doc, idx) => ({ _id: `507f1f77bcf86cd799439018${idx}`, ...doc })));
  };

  Pregnancy.findOne = (query) => mockQuery({
    _id: "507f1f77bcf86cd799439013",
    animalId: "507f1f77bcf86cd799439011",
    inseminationId: "507f1f77bcf86cd799439012",
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2025-12-01") },
    cycleStatus: "active",
  });
  Pregnancy.updateOne = () => Promise.resolve({});
  Insemination.findOne = () => mockQuery({
    _id: "507f1f77bcf86cd799439012",
    animalId: "507f1f77bcf86cd799439011",
    inseminationDate: new Date("2025-10-01"),
    sireBreed: "Angus",
  });
  Insemination.updateOne = () => Promise.resolve({});

  Calving.findOne = (query) => mockQuery(null); // No existing calving
  Calving.create = (docs, options) => {
    calvingCreated = true;
    const doc = Array.isArray(docs) ? docs[0] : docs;
    return Promise.resolve(Array.isArray(docs) ? [{ _id: "507f1f77bcf86cd799439019", ...doc }] : { _id: "507f1f77bcf86cd799439019", ...doc });
  };

  Notification.create = () => Promise.resolve({});
  AnimalTimelineEvent.insertMany = () => Promise.resolve([]);
  AuditLog.create = () => Promise.resolve([]);

  Task.findOne = () => mockQuery({
    _id: "507f1f77bcf86cd799439015",
    status: "Pending",
  });
  Task.findOneAndUpdate = async (query, update, options) => {
    taskUpdated = true;
    taskUpdateData = { query, update, options };
    return { _id: query._id };
  };

  const req = {
    body: {
      animalId: "507f1f77bcf86cd799439011",
      pregnancyId: "507f1f77bcf86cd799439013",
      date: new Date("2026-07-10"),
      calvingEase: "Natural",
      numberOfCalves: 1,
      calves: [{ sex: "F", earTag: "TAG-C1" }],
      technicianNote: "Healthy calf",
      taskId: "507f1f77bcf86cd799439015"
    },
    user: { _id: "507f1f77bcf86cd799439017", role: "technician", name: "Tech Tom" },
    app: { get: () => null }
  };
  const res = createMockRes();

  try {
    await recordCalving(req, res);
    assert.equal(res.statusVal, 201);
    assert.ok(calvingCreated);
    assert.ok(taskUpdated);
    assert.equal(taskUpdateData.query._id, "507f1f77bcf86cd799439015");
    assert.equal(taskUpdateData.options.session !== undefined, true);
    assert.equal(taskUpdateData.update.$set.status, "Completed");
    assert.equal(taskUpdateData.update.$set.relatedRecordType, "calving");
    assert.equal(taskUpdateData.update.$set.relatedRecordId, "507f1f77bcf86cd799439019");
  } finally {
    mongoose.startSession = originalStartSession;
    Animal.findOne = originalFindAnimalOne;
    Animal.findById = originalFindAnimalById;
    Animal.findByIdAndUpdate = originalFindAnimalByIdAndUpdate;
    Animal.create = originalCreateAnimal;
    Animal.insertMany = originalInsertMany;
    Pregnancy.findOne = originalFindPregnancyOne;
    Pregnancy.updateOne = originalUpdatePregnancy;
    Insemination.findOne = originalFindInsemination;
    Insemination.updateOne = originalUpdateInsemination;
    Calving.findOne = originalFindCalving;
    Calving.create = originalCreateCalving;
    Task.findOne = originalFindTask;
    Task.findOneAndUpdate = originalFindTaskAndUpdate;
    Notification.create = originalNotificationCreate;
    AnimalTimelineEvent.insertMany = originalTimelineInsert;
    AuditLog.create = originalAuditCreate;
  }
});
