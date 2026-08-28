import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import {
  normalizeHealthAdvicePayload,
  provideHealthAdvice,
} from "../src/controllers/health-workflow.controllers.js";
import { buildFarmerHealthRequest } from "../src/domain/health-request-presentation.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Notification } from "../src/models/notification.model.js";
import { Task } from "../src/models/task.model.js";

const ids = {
  request: new mongoose.Types.ObjectId(),
  farmer: new mongoose.Types.ObjectId(),
  animal: new mongoose.Types.ObjectId(),
  technician: new mongoose.Types.ObjectId(),
  otherTechnician: new mongoose.Types.ObjectId(),
};

const makeResponse = () => ({
  statusCode: 0,
  payload: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const makeRequestRecord = (overrides = {}) => ({
  _id: ids.request,
  farmerId: ids.farmer,
  animalId: ids.animal,
  requestType: "disease",
  status: "pending",
  activeCaseKey: `${ids.animal}:disease`,
  handledBy: null,
  assignedTechnicianId: null,
  claimedAt: null,
  scheduledDate: undefined,
  visitPeriod: undefined,
  handlingMethod: undefined,
  statusHistory: [],
  deletedAt: null,
  ...overrides,
});

const applyMongoUpdate = (record, update) => {
  Object.assign(record, update.$set || {});
  for (const key of Object.keys(update.$unset || {})) delete record[key];
  for (const [key, value] of Object.entries(update.$push || {})) {
    record[key] = [...(record[key] || []), value];
  }
  return record;
};

const createHarness = ({ record = makeRequestRecord(), atomicResult = true } = {}) => {
  const originals = {
    findOne: HealthRequest.findOne,
    findOneAndUpdate: HealthRequest.findOneAndUpdate,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
    auditCreate: AuditLog.create,
    medicalCreate: MedicalRecord.create,
    taskCreate: Task.create,
  };
  const calls = {
    atomicUpdates: 0,
    notificationAttempts: 0,
    notificationsCreated: 0,
    notificationPayloads: [],
    audits: [],
    medicalRecords: 0,
    tasks: 0,
    socketEvents: [],
  };
  const notificationKeys = new Set();

  record.populate = async function populate(path) {
    if (path === "farmerId" && !this.farmerId?._id) {
      this.farmerId = {
        _id: this.farmerId,
        name: "Test Farmer",
        pushToken: null,
      };
    }
    if (path === "animalId" && !this.animalId?._id) {
      this.animalId = {
        _id: this.animalId,
        animalId: "COW-101",
        earTag: "COW-101",
        species: "Cattle",
      };
    }
    return this;
  };

  HealthRequest.findOne = async () => record;
  HealthRequest.findOneAndUpdate = async (_filter, update) => {
    calls.atomicUpdates += 1;
    if (!atomicResult) return null;
    return applyMongoUpdate(record, update);
  };
  Notification.findOneAndUpdate = async (filter, update) => {
    calls.notificationAttempts += 1;
    calls.notificationPayloads.push(update.$setOnInsert);
    const existed = notificationKeys.has(filter.dedupeKey);
    notificationKeys.add(filter.dedupeKey);
    if (!existed) calls.notificationsCreated += 1;
    return {
      value: { _id: new mongoose.Types.ObjectId(), ...update.$setOnInsert },
      lastErrorObject: { updatedExisting: existed },
    };
  };
  AuditLog.create = async (entry) => {
    calls.audits.push(entry);
    return entry;
  };
  MedicalRecord.create = async () => {
    calls.medicalRecords += 1;
  };
  Task.create = async () => {
    calls.tasks += 1;
  };

  const invoke = async ({
    body = { advice: "Keep the animal hydrated." },
    technicianId = ids.technician,
    role = "technician",
  } = {}) => {
    const res = makeResponse();
    await provideHealthAdvice(
      {
        params: { id: ids.request.toString() },
        body,
        user: { _id: technicianId, role, name: "Test Technician" },
        app: {
          get: () => ({
            emit: (...args) => calls.socketEvents.push(args),
          }),
        },
      },
      res,
    );
    return res;
  };

  const restore = () => {
    HealthRequest.findOne = originals.findOne;
    HealthRequest.findOneAndUpdate = originals.findOneAndUpdate;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
    AuditLog.create = originals.auditCreate;
    MedicalRecord.create = originals.medicalCreate;
    Task.create = originals.taskCreate;
  };

  return { record, calls, invoke, restore };
};

test("pending request is atomically claimed and resolved through Advice", async () => {
  const harness = createHarness();
  try {
    const followUpDate = "2026-09-30T00:00:00.000Z";
    const response = await harness.invoke({
      body: {
        advice: "  Keep the animal hydrated and monitor appetite.  ",
        technicianNote: "  Internal assessment only.  ",
        followUpDate,
        status: "cancelled",
        handlingMethod: "farm_visit",
        handledBy: ids.otherTechnician,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.data.idempotent, false);
    assert.equal(harness.calls.atomicUpdates, 1);
    assert.equal(harness.record.status, "resolved");
    assert.equal(harness.record.handlingMethod, "advice");
    assert.equal(
      harness.record.advice,
      "Keep the animal hydrated and monitor appetite.",
    );
    assert.equal(harness.record.technicianNote, "Internal assessment only.");
    assert.deepEqual(harness.record.followUpDate, new Date(followUpDate));
    assert.equal(harness.record.handledBy.toString(), ids.technician.toString());
    assert.equal(
      harness.record.assignedTechnicianId.toString(),
      ids.technician.toString(),
    );
    assert.ok(harness.record.claimedAt instanceof Date);
    assert.ok(harness.record.resolvedAt instanceof Date);
    assert.equal("activeCaseKey" in harness.record, false);
    assert.equal(harness.record.statusHistory.length, 1);
    assert.equal(harness.record.statusHistory[0].status, "resolved");
    assert.equal(harness.calls.medicalRecords, 0);
    assert.equal(harness.calls.tasks, 0);
    assert.equal(harness.calls.audits.length, 1);
    assert.equal(harness.calls.notificationsCreated, 1);
    assert.equal(harness.calls.socketEvents.length, 1);

    const notification = harness.calls.notificationPayloads[0];
    assert.equal(notification.eventType, "health_advice_available");
    assert.equal(notification.linkType, "request");
    assert.equal(notification.relatedId.toString(), ids.request.toString());
    assert.equal(notification.metadata.requestId.toString(), ids.request.toString());
    assert.equal(notification.metadata.handlingMethod, "advice");
    assert.doesNotMatch(JSON.stringify(notification), /Internal assessment only/);

    const farmer = buildFarmerHealthRequest(harness.record);
    assert.equal(farmer.handlingMethod, "advice");
    assert.equal(farmer.advice, harness.record.advice);
    assert.deepEqual(farmer.followUpDate, new Date(followUpDate));
    assert.equal("technicianNote" in farmer, false);
  } finally {
    harness.restore();
  }
});

test("Advice validation rejects missing, blank, oversized, or malformed input", () => {
  for (const body of [{}, { advice: "   " }]) {
    assert.throws(
      () => normalizeHealthAdvicePayload(body),
      (error) =>
        error.status === 400 && error.code === "HEALTH_ADVICE_REQUIRED",
    );
  }
  assert.throws(
    () => normalizeHealthAdvicePayload({ advice: "a".repeat(2001) }),
    (error) => error.code === "HEALTH_ADVICE_TOO_LONG",
  );
  assert.throws(
    () =>
      normalizeHealthAdvicePayload({
        advice: "Monitor the animal.",
        followUpDate: "not-a-date",
      }),
    (error) => error.code === "HEALTH_FOLLOW_UP_DATE_INVALID",
  );
  assert.throws(
    () =>
      normalizeHealthAdvicePayload({
        advice: "Monitor the animal.",
        technicianNote: 42,
      }),
    (error) => error.code === "HEALTH_TECHNICIAN_NOTE_INVALID",
  );
});

test("optional null follow-up remains informational and clears no other fields", async () => {
  const record = makeRequestRecord({
    handledBy: ids.technician,
    assignedTechnicianId: ids.technician,
    status: "approved",
    followUpDate: new Date("2026-09-01T00:00:00.000Z"),
  });
  const harness = createHarness({ record });
  try {
    const response = await harness.invoke({
      body: { advice: "Continue monitoring.", followUpDate: null },
    });
    assert.equal(response.statusCode, 200);
    assert.equal("followUpDate" in record, false);
    assert.equal(harness.calls.tasks, 0);
    assert.equal(harness.calls.medicalRecords, 0);
  } finally {
    harness.restore();
  }
});

test("retry is idempotent and does not duplicate history, audit, or notification", async () => {
  const harness = createHarness();
  try {
    const first = await harness.invoke();
    const second = await harness.invoke();

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(second.payload.data.idempotent, true);
    assert.equal(harness.calls.atomicUpdates, 1);
    assert.equal(harness.record.statusHistory.length, 1);
    assert.equal(harness.calls.audits.length, 1);
    assert.equal(harness.calls.notificationAttempts, 2);
    assert.equal(harness.calls.notificationsCreated, 1);
  } finally {
    harness.restore();
  }
});

test("another technician cannot overwrite an owned request", async () => {
  const harness = createHarness({
    record: makeRequestRecord({
      status: "approved",
      handledBy: ids.otherTechnician,
      assignedTechnicianId: ids.otherTechnician,
    }),
  });
  try {
    const response = await harness.invoke();
    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.code, "HEALTH_REQUEST_ASSIGNED_TO_OTHER");
    assert.equal(harness.calls.atomicUpdates, 0);
    assert.equal(harness.calls.notificationsCreated, 0);
  } finally {
    harness.restore();
  }
});

test("terminal and in-progress requests cannot receive Advice", async () => {
  for (const status of ["resolved", "cancelled", "rejected", "in-progress", "in_progress"]) {
    const harness = createHarness({ record: makeRequestRecord({ status }) });
    try {
      const response = await harness.invoke();
      assert.equal(response.statusCode, 409, status);
      assert.equal(harness.calls.atomicUpdates, 0, status);
    } finally {
      harness.restore();
    }
  }
});

test("scheduled or Farm Visit requests are not silently converted to Advice", async () => {
  const cases = [
    { status: "scheduled" },
    { status: "approved", scheduledDate: new Date() },
    { status: "approved", visitPeriod: "morning" },
    { status: "approved", handlingMethod: "farm_visit" },
  ];

  for (const overrides of cases) {
    const harness = createHarness({
      record: makeRequestRecord({
        handledBy: ids.technician,
        assignedTechnicianId: ids.technician,
        ...overrides,
      }),
    });
    try {
      const response = await harness.invoke();
      assert.equal(response.statusCode, 409);
      assert.equal(
        response.payload.code,
        "HEALTH_ADVICE_VISIT_ALREADY_SCHEDULED",
      );
      assert.equal(harness.calls.atomicUpdates, 0);
    } finally {
      harness.restore();
    }
  }
});

test("owned legacy pre-visit statuses may resolve as Advice", async () => {
  for (const status of ["triaged", "assigned", "approved"]) {
    const harness = createHarness({
      record: makeRequestRecord({
        status,
        handledBy: ids.technician,
        assignedTechnicianId: ids.technician,
      }),
    });
    try {
      const response = await harness.invoke();
      assert.equal(response.statusCode, 200, status);
      assert.equal(harness.record.status, "resolved", status);
      assert.equal(harness.record.handlingMethod, "advice", status);
    } finally {
      harness.restore();
    }
  }
});

test("non-technician roles cannot invoke the Advice action", async () => {
  const harness = createHarness();
  try {
    const response = await harness.invoke({ role: "admin" });
    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.code, "HEALTH_ADVICE_FORBIDDEN");
    assert.equal(harness.calls.atomicUpdates, 0);
  } finally {
    harness.restore();
  }
});
