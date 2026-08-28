import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import {
  normalizeHealthOfficePickupPayload,
  provideHealthOfficePickup,
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

const defaultBody = {
  item: "Dewormer",
  availabilityConfirmed: true,
  instructions: "Available at the Municipal Agriculture Office.",
  dosageOrUseInstructions: "Follow the instructions provided at pickup.",
  withdrawalGuidance: "Observe the guidance provided by the technician.",
  farmerMessage: "You may collect the dewormer from the office.",
  technicianNote: "Internal stock confirmation reference.",
  followUpDate: "2026-08-30T00:00:00.000Z",
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
  technicianResponse: undefined,
  statusHistory: [],
  deletedAt: null,
  ...overrides,
});

const setPath = (target, path, value) => {
  const segments = path.split(".");
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    cursor[segment] ||= {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = value;
};

const unsetPath = (target, path) => {
  const segments = path.split(".");
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    cursor = cursor?.[segment];
    if (!cursor) return;
  }
  delete cursor[segments.at(-1)];
};

const applyMongoUpdate = (record, update) => {
  for (const [key, value] of Object.entries(update.$set || {})) {
    setPath(record, key, value);
  }
  for (const key of Object.keys(update.$unset || {})) unsetPath(record, key);
  for (const [key, value] of Object.entries(update.$push || {})) {
    record[key] = [...(record[key] || []), value];
  }
  return record;
};

const addPopulate = (record) => {
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
  return record;
};

const createHarness = ({
  record = makeRequestRecord(),
  atomicResult = true,
  latestRecord,
} = {}) => {
  const originals = {
    findOne: HealthRequest.findOne,
    findOneAndUpdate: HealthRequest.findOneAndUpdate,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
    auditCreate: AuditLog.create,
    medicalCreate: MedicalRecord.create,
    taskCreate: Task.create,
  };
  const calls = {
    findOne: 0,
    atomicUpdates: 0,
    atomicFilters: [],
    notificationAttempts: 0,
    notificationsCreated: 0,
    notificationPayloads: [],
    audits: [],
    medicalRecords: 0,
    tasks: 0,
    socketEvents: [],
  };
  const notificationKeys = new Set();
  addPopulate(record);
  if (latestRecord) addPopulate(latestRecord);

  HealthRequest.findOne = async () => {
    calls.findOne += 1;
    return calls.findOne > 1 && latestRecord ? latestRecord : record;
  };
  HealthRequest.findOneAndUpdate = async (filter, update) => {
    calls.atomicUpdates += 1;
    calls.atomicFilters.push(filter);
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
    body = defaultBody,
    technicianId = ids.technician,
    role = "technician",
  } = {}) => {
    const res = makeResponse();
    await provideHealthOfficePickup(
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

test("pending request is atomically claimed and resolved through Office Pickup", async () => {
  const harness = createHarness();
  try {
    const response = await harness.invoke();

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.data.idempotent, false);
    assert.equal(harness.calls.atomicUpdates, 1);
    assert.equal(harness.record.status, "resolved");
    assert.equal(harness.record.handlingMethod, "office_pickup");
    assert.deepEqual(harness.record.technicianResponse.pickup, {
      item: "Dewormer",
      availabilityConfirmed: true,
      instructions: "Available at the Municipal Agriculture Office.",
      dosageOrUseInstructions: "Follow the instructions provided at pickup.",
      withdrawalGuidance: "Observe the guidance provided by the technician.",
    });
    assert.equal(
      harness.record.advice,
      "You may collect the dewormer from the office.",
    );
    assert.equal(
      harness.record.technicianNote,
      "Internal stock confirmation reference.",
    );
    assert.deepEqual(
      harness.record.followUpDate,
      new Date(defaultBody.followUpDate),
    );
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
    assert.equal(
      harness.record.statusHistory[0].note,
      "Resolved through Office Pickup.",
    );
    assert.equal("scheduledDate" in harness.record, true);
    assert.equal(harness.record.scheduledDate, undefined);
    assert.equal(harness.record.visitPeriod, undefined);
    assert.equal("diagnosis" in harness.record, false);
    assert.equal("treatment" in harness.record, false);
    assert.equal("medicineGiven" in harness.record, false);
    assert.equal("dosage" in harness.record, false);
    assert.equal("withdrawalPeriodDays" in harness.record, false);
    assert.equal("withdrawalEndDate" in harness.record, false);
    assert.equal(harness.calls.medicalRecords, 0);
    assert.equal(harness.calls.tasks, 0);
    assert.equal(harness.calls.audits.length, 1);
    assert.equal(harness.calls.notificationsCreated, 1);
    assert.equal(harness.calls.socketEvents.length, 1);

    const notification = harness.calls.notificationPayloads[0];
    assert.equal(notification.eventType, "health_office_pickup_available");
    assert.equal(notification.linkType, "request");
    assert.equal(notification.relatedId.toString(), ids.request.toString());
    assert.equal(notification.metadata.requestId.toString(), ids.request.toString());
    assert.equal(notification.metadata.handlingMethod, "office_pickup");
    assert.equal(notification.dedupeKey, `health-office-pickup:${ids.request}`);
    assert.match(notification.title, /Office pickup available/);
    assert.doesNotMatch(
      JSON.stringify(notification),
      /Internal stock confirmation reference/,
    );

    const farmer = buildFarmerHealthRequest(harness.record);
    assert.equal(farmer.handlingMethod, "office_pickup");
    assert.deepEqual(
      farmer.technicianResponse.pickup,
      harness.record.technicianResponse.pickup,
    );
    assert.equal(farmer.advice, harness.record.advice);
    assert.deepEqual(farmer.followUpDate, harness.record.followUpDate);
    assert.equal("technicianNote" in farmer, false);
    assert.equal("actorId" in farmer.statusHistory[0], false);
    assert.equal("note" in farmer.statusHistory[0], false);
  } finally {
    harness.restore();
  }
});

test("Office Pickup accepts either Farmer message field as the public advice", () => {
  const fromInstructions = normalizeHealthOfficePickupPayload({
    item: "Mineral supplement",
    availabilityConfirmed: true,
    instructions: "Collect it from the office counter.",
  });
  assert.equal(fromInstructions.advice, "Collect it from the office counter.");
  assert.equal(
    fromInstructions.pickup.instructions,
    "Collect it from the office counter.",
  );

  const fromFarmerMessage = normalizeHealthOfficePickupPayload({
    item: "Mineral supplement",
    availabilityConfirmed: true,
    farmerMessage: "The item is ready at the office.",
  });
  assert.equal(fromFarmerMessage.advice, "The item is ready at the office.");
  assert.equal(
    fromFarmerMessage.pickup.instructions,
    "The item is ready at the office.",
  );
});

test("Office Pickup validates item, confirmed availability, public instructions, and lengths", () => {
  const cases = [
    [{ ...defaultBody, item: " " }, "HEALTH_OFFICE_PICKUP_ITEM_REQUIRED"],
    [
      { ...defaultBody, availabilityConfirmed: false },
      "HEALTH_OFFICE_PICKUP_AVAILABILITY_REQUIRED",
    ],
    [
      { ...defaultBody, instructions: " ", farmerMessage: " " },
      "HEALTH_OFFICE_PICKUP_MESSAGE_REQUIRED",
    ],
    [
      { ...defaultBody, item: "a".repeat(201) },
      "HEALTH_OFFICE_PICKUP_ITEM_INVALID_TOO_LONG",
    ],
    [
      { ...defaultBody, dosageOrUseInstructions: "a".repeat(2001) },
      "HEALTH_OFFICE_PICKUP_DOSAGE_INVALID_TOO_LONG",
    ],
    [
      { ...defaultBody, withdrawalGuidance: "a".repeat(2001) },
      "HEALTH_OFFICE_PICKUP_WITHDRAWAL_INVALID_TOO_LONG",
    ],
  ];

  for (const [body, code] of cases) {
    assert.throws(
      () => normalizeHealthOfficePickupPayload(body),
      (error) => error.status === 400 && error.code === code,
      code,
    );
  }
});

test("Office Pickup retry is idempotent and notification is deduplicated", async () => {
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
    assert.equal(harness.calls.medicalRecords, 0);
    assert.equal(harness.calls.tasks, 0);
  } finally {
    harness.restore();
  }
});

test("Office Pickup rejects scheduled, in-progress, terminal, and incompatible requests", async () => {
  const cases = [
    { overrides: { status: "scheduled" }, code: "HEALTH_OFFICE_PICKUP_VISIT_ALREADY_SCHEDULED" },
    { overrides: { status: "approved", scheduledDate: new Date() }, code: "HEALTH_OFFICE_PICKUP_VISIT_ALREADY_SCHEDULED" },
    { overrides: { status: "approved", visitPeriod: "morning" }, code: "HEALTH_OFFICE_PICKUP_VISIT_ALREADY_SCHEDULED" },
    { overrides: { status: "approved", handlingMethod: "farm_visit" }, code: "HEALTH_OFFICE_PICKUP_VISIT_ALREADY_SCHEDULED" },
    { overrides: { status: "in-progress" }, code: "HEALTH_OFFICE_PICKUP_SERVICE_IN_PROGRESS" },
    { overrides: { status: "in_progress" }, code: "HEALTH_OFFICE_PICKUP_SERVICE_IN_PROGRESS" },
    { overrides: { status: "resolved", handlingMethod: "advice" }, code: "HEALTH_OFFICE_PICKUP_TERMINAL_REQUEST" },
    { overrides: { status: "cancelled" }, code: "HEALTH_OFFICE_PICKUP_TERMINAL_REQUEST" },
    { overrides: { status: "rejected" }, code: "HEALTH_OFFICE_PICKUP_TERMINAL_REQUEST" },
    { overrides: { status: "approved", handlingMethod: "advice" }, code: "HEALTH_OFFICE_PICKUP_HANDLING_CONFLICT" },
  ];

  for (const { overrides, code } of cases) {
    const harness = createHarness({
      record: makeRequestRecord({
        handledBy: ids.technician,
        assignedTechnicianId: ids.technician,
        ...overrides,
      }),
    });
    try {
      const response = await harness.invoke();
      assert.equal(response.statusCode, 409, JSON.stringify(overrides));
      assert.equal(response.payload.code, code, JSON.stringify(overrides));
      assert.equal(harness.calls.atomicUpdates, 0, JSON.stringify(overrides));
    } finally {
      harness.restore();
    }
  }
});

test("Office Pickup supports owned unscheduled triaged, assigned, and approved requests", async () => {
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
      assert.equal(harness.record.handlingMethod, "office_pickup", status);
    } finally {
      harness.restore();
    }
  }
});

test("Office Pickup rejects another Technician and preserves concurrent ownership", async () => {
  const owned = createHarness({
    record: makeRequestRecord({
      status: "approved",
      handledBy: ids.otherTechnician,
      assignedTechnicianId: ids.otherTechnician,
    }),
  });
  try {
    const response = await owned.invoke();
    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.code, "HEALTH_REQUEST_ASSIGNED_TO_OTHER");
    assert.equal(owned.calls.atomicUpdates, 0);
  } finally {
    owned.restore();
  }

  const latest = makeRequestRecord({
    status: "approved",
    handledBy: ids.otherTechnician,
    assignedTechnicianId: ids.otherTechnician,
  });
  const concurrent = createHarness({ atomicResult: false, latestRecord: latest });
  try {
    const response = await concurrent.invoke();
    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.code, "HEALTH_OFFICE_PICKUP_CONCURRENT_UPDATE");
    assert.equal(latest.handledBy.toString(), ids.otherTechnician.toString());
    assert.equal(concurrent.calls.audits.length, 0);
    assert.equal(concurrent.calls.notificationsCreated, 0);
  } finally {
    concurrent.restore();
  }
});

test("non-technician roles cannot invoke Office Pickup", async () => {
  const harness = createHarness();
  try {
    const response = await harness.invoke({ role: "admin" });
    assert.equal(response.statusCode, 403);
    assert.equal(response.payload.code, "HEALTH_OFFICE_PICKUP_FORBIDDEN");
    assert.equal(harness.calls.atomicUpdates, 0);
  } finally {
    harness.restore();
  }
});
