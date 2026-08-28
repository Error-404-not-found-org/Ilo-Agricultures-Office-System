import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { addMedicalRecord } from "../src/controllers/medical.controllers.js";
import { walkInHealthRequest } from "../src/controllers/health-request.controllers.js";
import { archiveAnimalLifecycle, restoreAnimalLifecycle } from "../src/services/animal-archive.service.js";
import { Animal } from "../src/models/animal.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { Calving } from "../src/models/calving.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Idempotency } from "../src/models/idempotency.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Notification } from "../src/models/notification.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

const queryResult = (value) => ({ session: async () => value });

const transactionSession = () => ({
  withTransaction: async (work) => work(),
  endSession: async () => {},
});

test("direct MedicalRecord commit still returns 201 when notification delivery fails", async () => {
  const originals = {
    animalFindById: Animal.findById,
    medicalCreate: MedicalRecord.create,
    userFindById: User.findById,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
    consoleError: console.error,
  };
  let createCount = 0;
  Animal.findById = async () => ({
    _id: "animal-1",
    farmerId: "farmer-1",
    earTag: "COW-001",
  });
  MedicalRecord.create = async (payload) => {
    createCount += 1;
    return { _id: "medical-1", ...payload };
  };
  User.findById = async () => ({ _id: "farmer-1", pushToken: null });
  Notification.findOneAndUpdate = async () => {
    throw new Error("notification store unavailable");
  };
  console.error = () => {};
  const recorder = responseRecorder();

  try {
    await addMedicalRecord({
      body: {
        animalId: "animal-1",
        type: "Treatment",
        details: { medicineName: "Vitamin B" },
        note: "Direct service",
      },
      user: { _id: "technician-1" },
    }, recorder.response);

    assert.equal(recorder.statusCode, 201);
    assert.equal(recorder.body.record._id, "medical-1");
    assert.equal(createCount, 1);
  } finally {
    Animal.findById = originals.animalFindById;
    MedicalRecord.create = originals.medicalCreate;
    User.findById = originals.userFindById;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
    console.error = originals.consoleError;
  }
});

test("walk-in Health notification failure succeeds and the durable operation key prevents duplicate retry", async () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindById: Animal.findById,
    healthFindOne: HealthRequest.findOne,
    healthCreate: HealthRequest.create,
    medicalCreate: MedicalRecord.create,
    auditCreate: AuditLog.create,
    timelineCreate: AnimalTimelineEvent.create,
    userFindById: User.findById,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
    consoleError: console.error,
  };
  const farmer = { _id: "farmer-1", address: {}, pushToken: null };
  const animal = {
    _id: "animal-1",
    farmerId: farmer._id,
    earTag: "COW-001",
  };
  let storedRequest = null;
  let requestCreates = 0;
  let recordCreates = 0;
  mongoose.startSession = async () => transactionSession();
  User.findById = async () => farmer;
  Animal.findById = async () => animal;
  HealthRequest.findOne = async (query) =>
    query.sourceOperationKey && storedRequest?.sourceOperationKey === query.sourceOperationKey
      ? storedRequest
      : null;
  HealthRequest.create = async ([payload]) => {
    requestCreates += 1;
    storedRequest = { _id: "health-1", ...payload };
    return [storedRequest];
  };
  MedicalRecord.create = async ([payload]) => {
    recordCreates += 1;
    return [{ _id: "medical-1", ...payload }];
  };
  AuditLog.create = async () => [];
  AnimalTimelineEvent.create = async () => [];
  Notification.findOneAndUpdate = async () => {
    throw new Error("notification store unavailable");
  };
  console.error = () => {};
  const request = {
    headers: { "idempotency-key": "walkin-operation-1" },
    body: {
      farmerId: farmer._id,
      animalId: animal._id,
      diagnosis: "Mild dehydration",
      treatment: "Oral fluids",
      status: "resolved",
      requestType: "disease",
    },
    user: { _id: "technician-1", name: "Technician" },
    app: { get: () => ({ emit: () => {} }) },
  };

  try {
    const first = responseRecorder();
    await walkInHealthRequest(request, first.response);
    assert.equal(first.statusCode, 201);
    assert.equal(first.body.request._id, "health-1");

    const retry = responseRecorder();
    await walkInHealthRequest(request, retry.response);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.code, "WALKIN_HEALTH_REPLAYED");
    assert.equal(retry.body.request._id, "health-1");
    assert.equal("sourceOperationKey" in first.body.request, false);
    assert.equal("sourceOperationKey" in retry.body.request, false);
    assert.equal(requestCreates, 1);
    assert.equal(recordCreates, 1);
  } finally {
    mongoose.startSession = originals.startSession;
    Animal.findById = originals.animalFindById;
    HealthRequest.findOne = originals.healthFindOne;
    HealthRequest.create = originals.healthCreate;
    MedicalRecord.create = originals.medicalCreate;
    AuditLog.create = originals.auditCreate;
    AnimalTimelineEvent.create = originals.timelineCreate;
    User.findById = originals.userFindById;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
    console.error = originals.consoleError;
  }
});

test("animal archive is blocked when an actionable Task exists", async () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    aiExists: Insemination.exists,
    healthExists: HealthRequest.exists,
    pregnancyExists: Pregnancy.exists,
    taskExists: Task.exists,
    aiUpdateMany: Insemination.updateMany,
  };
  let updates = 0;
  mongoose.startSession = async () => transactionSession();
  Animal.findOne = () => queryResult({
    _id: "animal-1",
    farmerId: "farmer-1",
  });
  Insemination.exists = () => queryResult(null);
  HealthRequest.exists = () => queryResult(null);
  Pregnancy.exists = () => queryResult(null);
  Task.exists = () => queryResult({ _id: "task-1" });
  Insemination.updateMany = async () => { updates += 1; };

  try {
    await assert.rejects(
      archiveAnimalLifecycle({
        animalId: "animal-1",
        actor: { _id: "farmer-1", role: "farmer" },
      }),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, "ANIMAL_ARCHIVE_ACTIVE_WORK");
        assert.deepEqual(error.details.conflicts, ["task"]);
        return true;
      },
    );
    assert.equal(updates, 0);
  } finally {
    mongoose.startSession = originals.startSession;
    Animal.findOne = originals.animalFindOne;
    Insemination.exists = originals.aiExists;
    HealthRequest.exists = originals.healthExists;
    Pregnancy.exists = originals.pregnancyExists;
    Task.exists = originals.taskExists;
    Insemination.updateMany = originals.aiUpdateMany;
  }
});

test("animal archive is blocked when active official work exists", async () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    aiExists: Insemination.exists,
    healthExists: HealthRequest.exists,
    pregnancyExists: Pregnancy.exists,
    taskExists: Task.exists,
  };
  let pregnancyQuery = null;
  mongoose.startSession = async () => transactionSession();
  Animal.findOne = () => queryResult({ _id: "animal-1", farmerId: "farmer-1" });
  Insemination.exists = () => queryResult({ _id: "ai-1" });
  HealthRequest.exists = () => queryResult(null);
  Pregnancy.exists = (query) => {
    pregnancyQuery = query;
    return queryResult(null);
  };
  Task.exists = () => queryResult(null);

  try {
    await assert.rejects(
      archiveAnimalLifecycle({
        animalId: "animal-1",
        actor: { _id: "farmer-1", role: "farmer" },
      }),
      (error) => error.code === "ANIMAL_ARCHIVE_ACTIVE_WORK" &&
        error.details.conflicts.includes("ai"),
    );
    assert.deepEqual(pregnancyQuery.cycleStatus, {
      $nin: ["completed", "lost"],
    });
  } finally {
    mongoose.startSession = originals.startSession;
    Animal.findOne = originals.animalFindOne;
    Insemination.exists = originals.aiExists;
    HealthRequest.exists = originals.healthExists;
    Pregnancy.exists = originals.pregnancyExists;
    Task.exists = originals.taskExists;
  }
});

test("animal archive transaction applies one operation timestamp to valid historical records", async () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    aiExists: Insemination.exists,
    healthExists: HealthRequest.exists,
    pregnancyExists: Pregnancy.exists,
    taskExists: Task.exists,
    aiUpdateMany: Insemination.updateMany,
    healthUpdateMany: HealthRequest.updateMany,
    pregnancyUpdateMany: Pregnancy.updateMany,
    calvingUpdateMany: Calving.updateMany,
  };
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    deletedAt: null,
    save: async () => {},
  };
  const updates = [];
  mongoose.startSession = async () => transactionSession();
  Animal.findOne = () => queryResult(animal);
  Insemination.exists = () => queryResult(null);
  HealthRequest.exists = () => queryResult(null);
  Pregnancy.exists = () => queryResult(null);
  Task.exists = () => queryResult(null);
  Insemination.updateMany = async (...args) => { updates.push(args); };
  HealthRequest.updateMany = async (...args) => { updates.push(args); };
  Pregnancy.updateMany = async (...args) => { updates.push(args); };
  Calving.updateMany = async (...args) => { updates.push(args); };

  try {
    const archived = await archiveAnimalLifecycle({
      animalId: animal._id,
      actor: { _id: "farmer-1", role: "farmer" },
    });
    assert.ok(archived.deletedAt instanceof Date);
    assert.equal(updates.length, 4);
    for (const [filter, update, options] of updates) {
      assert.deepEqual(filter, { animalId: animal._id, deletedAt: null });
      assert.equal(update.$set.deletedAt, archived.deletedAt);
      assert.ok(options.session);
    }
  } finally {
    mongoose.startSession = originals.startSession;
    Animal.findOne = originals.animalFindOne;
    Insemination.exists = originals.aiExists;
    HealthRequest.exists = originals.healthExists;
    Pregnancy.exists = originals.pregnancyExists;
    Task.exists = originals.taskExists;
    Insemination.updateMany = originals.aiUpdateMany;
    HealthRequest.updateMany = originals.healthUpdateMany;
    Pregnancy.updateMany = originals.pregnancyUpdateMany;
    Calving.updateMany = originals.calvingUpdateMany;
  }
});

test("restore revives only records archived in the same animal operation", async () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    aiExists: Insemination.exists,
    healthExists: HealthRequest.exists,
    pregnancyExists: Pregnancy.exists,
    taskExists: Task.exists,
    aiUpdateMany: Insemination.updateMany,
    healthUpdateMany: HealthRequest.updateMany,
    pregnancyUpdateMany: Pregnancy.updateMany,
    calvingUpdateMany: Calving.updateMany,
  };
  const archivedAt = new Date("2026-08-01T00:00:00.000Z");
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    deletedAt: archivedAt,
    save: async () => {},
  };
  const filters = [];
  mongoose.startSession = async () => transactionSession();
  Animal.findOne = () => queryResult(animal);
  Insemination.exists = () => queryResult(null);
  HealthRequest.exists = () => queryResult(null);
  Pregnancy.exists = () => queryResult(null);
  Task.exists = () => queryResult(null);
  Insemination.updateMany = async (filter) => { filters.push(filter); };
  HealthRequest.updateMany = async (filter) => { filters.push(filter); };
  Pregnancy.updateMany = async (filter) => { filters.push(filter); };
  Calving.updateMany = async (filter) => { filters.push(filter); };

  try {
    const restored = await restoreAnimalLifecycle({
      animalId: animal._id,
      actor: { _id: "farmer-1", role: "farmer" },
    });
    assert.equal(restored.deletedAt, null);
    assert.equal(filters.length, 4);
    for (const filter of filters) {
      assert.equal(filter.animalId, animal._id);
      assert.equal(filter.deletedAt, archivedAt);
    }
  } finally {
    mongoose.startSession = originals.startSession;
    Animal.findOne = originals.animalFindOne;
    Insemination.exists = originals.aiExists;
    HealthRequest.exists = originals.healthExists;
    Pregnancy.exists = originals.pregnancyExists;
    Task.exists = originals.taskExists;
    Insemination.updateMany = originals.aiUpdateMany;
    HealthRequest.updateMany = originals.healthUpdateMany;
    Pregnancy.updateMany = originals.pregnancyUpdateMany;
    Calving.updateMany = originals.calvingUpdateMany;
  }
});

const findIndex = (model, predicate) =>
  model.schema.indexes().find(([fields, options]) => predicate(fields, options));

test("correctness-critical uniqueness and TTL indexes remain declared", () => {
  assert.ok(findIndex(Animal, (fields, options) =>
    fields.farmerId === 1 && fields.normalizedEarTag === 1 &&
    options.unique && options.name === "uniq_active_ear_tag_per_farmer"));
  assert.ok(findIndex(Insemination, (fields, options) =>
    fields.activeRequestKey === 1 && options.unique && options.sparse));
  assert.ok(findIndex(HealthRequest, (fields, options) =>
    fields.activeCaseKey === 1 && options.unique && options.sparse));
  assert.ok(findIndex(HealthRequest, (fields, options) =>
    fields.handledBy === 1 && fields.sourceOperationKey === 1 &&
    options.unique &&
    options.name === "uniq_walkin_health_operation_per_technician"));
  assert.equal(HealthRequest.schema.path("sourceOperationKey").options.select, false);
  assert.ok(findIndex(MedicalRecord, (fields, options) =>
    fields.healthRequestId === 1 && options.unique && options.sparse));
  assert.ok(findIndex(Pregnancy, (fields, options) =>
    fields.inseminationId === 1 && options.unique));
  assert.ok(findIndex(Calving, (fields, options) =>
    fields.pregnancyId === 1 && options.unique));
  assert.ok(findIndex(Task, (_fields, options) =>
    options.name === "uniq_pregnancy_continuation_task" && options.unique));
  assert.ok(findIndex(Task, (_fields, options) =>
    options.name === "uniq_open_pregnancy_follow_up_task" && options.unique));
  assert.ok(findIndex(Idempotency, (fields, options) =>
    fields.userId === 1 && fields.key === 1 && fields.method === 1 &&
    fields.path === 1 && options.unique));
  assert.ok(findIndex(Idempotency, (fields, options) =>
    fields.createdAt === 1 && options.expireAfterSeconds === 86400));
});

test("walk-in Health operation uniqueness applies only to typed durable operation keys", () => {
  const index = findIndex(
    HealthRequest,
    (_fields, options) =>
      options.name === "uniq_walkin_health_operation_per_technician",
  );
  assert.ok(index);
  const [fields, options] = index;
  assert.deepEqual(fields, { handledBy: 1, sourceOperationKey: 1 });
  assert.equal(options.unique, true);
  assert.equal(options.sparse, undefined);
  assert.deepEqual(options.partialFilterExpression, {
    handledBy: { $type: "objectId" },
    sourceOperationKey: { $type: "string" },
  });

  const technicianA = new mongoose.Types.ObjectId();
  const technicianB = new mongoose.Types.ObjectId();
  const isIndexed = (record) =>
    record.handledBy instanceof mongoose.Types.ObjectId &&
    typeof record.sourceOperationKey === "string";
  const keyFor = (record) =>
    `${record.handledBy}:${record.sourceOperationKey}`;

  const handledHistorical = { handledBy: technicianA };
  const unhandledHistorical = {};
  assert.equal(isIndexed(handledHistorical), false);
  assert.equal(isIndexed(unhandledHistorical), false);

  const duplicateWalkIns = [
    { handledBy: technicianA, sourceOperationKey: "walk-in-1" },
    { handledBy: technicianA, sourceOperationKey: "walk-in-1" },
  ];
  assert.equal(duplicateWalkIns.every(isIndexed), true);
  assert.equal(new Set(duplicateWalkIns.map(keyFor)).size, 1);

  const sameOperationAcrossTechnicians = [
    { handledBy: technicianA, sourceOperationKey: "walk-in-1" },
    { handledBy: technicianB, sourceOperationKey: "walk-in-1" },
  ];
  assert.equal(sameOperationAcrossTechnicians.every(isIndexed), true);
  assert.equal(new Set(sameOperationAcrossTechnicians.map(keyFor)).size, 2);
});

test("ordinary HealthRequests do not fabricate a walk-in source operation key", () => {
  const request = new HealthRequest({
    farmerId: new mongoose.Types.ObjectId(),
    animalId: new mongoose.Types.ObjectId(),
    requestType: "disease",
    symptoms: "Not eating normally",
    status: "pending",
  });

  assert.equal(request.validateSync(), undefined);
  assert.equal(request.sourceOperationKey, undefined);
});
