import assert from "node:assert/strict";
import test from "node:test";

import { claimAndScheduleAIRequest } from "../src/controllers/ai-request.controllers.js";
import {
  normalizeAIScheduleDate,
  normalizeVisitPeriod,
} from "../src/domain/ai-recording-fields.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";

const ids = {
  request: "507f1f77bcf86cd799439001",
  farmer: "507f1f77bcf86cd799439002",
  animal: "507f1f77bcf86cd799439003",
  technician1: "507f1f77bcf86cd799439004",
  technician2: "507f1f77bcf86cd799439005",
};

const manilaDateString = (dayOffset = 1) => {
  const manila = new Date(Date.now() + 8 * 60 * 60 * 1000);
  manila.setUTCDate(manila.getUTCDate() + dayOffset);
  return [
    manila.getUTCFullYear(),
    String(manila.getUTCMonth() + 1).padStart(2, "0"),
    String(manila.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const createResponseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(payload) {
      recorder.body = payload;
      return this;
    },
  };
  return recorder;
};

const installHarness = (t, overrides = {}) => {
  const originals = {
    findOneAndUpdate: Insemination.findOneAndUpdate,
    findById: Insemination.findById,
    notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  };
  t.after(() => {
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    Insemination.findById = originals.findById;
    Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  });

  const state = {
    request:
      overrides.request === null
        ? null
        : {
            _id: ids.request,
            status: "pending",
            approvedBy: null,
            deletedAt: null,
            cancellationStatus: "none",
            farmerId: { _id: ids.farmer, name: "Farmer One" },
            animalId: { _id: ids.animal, earTag: "AI-001" },
            ...overrides.request,
          },
    filters: [],
    updates: [],
    notifications: [],
  };

  Insemination.findOneAndUpdate = (filter, update) => {
    state.filters.push(filter);
    state.updates.push(update);
    const request = state.request;
    const actorId = update.$set.approvedBy;
    const isAssignable =
      request &&
      request.deletedAt === null &&
      request.status === "pending" &&
      !["requested", "approved"].includes(request.cancellationStatus) &&
      (!request.approvedBy || String(request.approvedBy) === String(actorId));

    if (!isAssignable) return populatedQuery(null);

    Object.assign(request, update.$set);
    return populatedQuery(request);
  };
  Insemination.findById = () => populatedQuery(state.request);
  Notification.findOneAndUpdate = async (filter, update) => {
    state.notifications.push({ filter, update });
    return {
      value: { _id: `notification-${state.notifications.length}`, ...update.$setOnInsert },
      lastErrorObject: { updatedExisting: false },
    };
  };

  return state;
};

const createRequest = ({
  technicianId = ids.technician1,
  role = "technician",
  body = {},
} = {}) => ({
  params: { id: ids.request },
  body: {
    scheduledDate: manilaDateString(1),
    visitPeriod: "morning",
    ...body,
  },
  user: { _id: technicianId, role, name: `Technician ${technicianId.slice(-1)}` },
  app: { get: () => ({ emit() {} }) },
});

test("AI claim schedule date normalization preserves the Philippine calendar day", () => {
  const normalized = normalizeAIScheduleDate("2030-05-10");
  assert.equal(normalized.toISOString(), "2030-05-10T04:00:00.000Z");
  assert.equal(normalizeVisitPeriod("Morning"), "morning");
  assert.equal(normalizeVisitPeriod("AFTERNOON"), "afternoon");
});

test("AI claim schedule atomically assigns the authenticated technician and schedules morning", async (t) => {
  const state = installHarness(t);
  const recorder = createResponseRecorder();

  await claimAndScheduleAIRequest(createRequest(), recorder.response);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.request.status, "scheduled");
  assert.equal(recorder.body.request.approvedBy, ids.technician1);
  assert.equal(recorder.body.request.visitPeriod, "morning");
  assert.ok(Insemination.schema.path("scheduledAt"));
  assert.ok(recorder.body.request.claimedAt instanceof Date);
  assert.ok(recorder.body.request.scheduledAt instanceof Date);
  assert.deepEqual(state.filters[0].status, "pending");
  assert.equal(state.filters[0].deletedAt, null);
  assert.equal(state.updates[0].$set.status, "scheduled");
  assert.equal(state.notifications.length, 1);
  assert.equal(
    state.notifications[0].update.$setOnInsert.metadata.visitPeriod,
    "morning",
  );
  assert.ok(state.notifications[0].update.$setOnInsert.metadata.scheduledDate);
});

test("AI claim schedule accepts afternoon", async (t) => {
  installHarness(t);
  const recorder = createResponseRecorder();

  await claimAndScheduleAIRequest(
    createRequest({ body: { visitPeriod: "  AFTERNOON " } }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.request.visitPeriod, "afternoon");
});

test("AI claim schedule rejects invalid payloads before database or notification writes", async (t) => {
  const cases = [
    [{ scheduledDate: undefined }, "SCHEDULE_DATE_REQUIRED"],
    [{ scheduledDate: "not-a-date" }, "INVALID_SCHEDULE_DATE"],
    [{ scheduledDate: "2030-05-10Tnot-a-time" }, "INVALID_SCHEDULE_DATE"],
    [{ scheduledDate: "2020-01-01" }, "SCHEDULE_DATE_IN_PAST"],
    [{ visitPeriod: undefined }, "VISIT_PERIOD_REQUIRED"],
    [{ visitPeriod: "evening" }, "INVALID_VISIT_PERIOD"],
  ];

  for (const [body, expectedCode] of cases) {
    const state = installHarness(t);
    const recorder = createResponseRecorder();
    await claimAndScheduleAIRequest(createRequest({ body }), recorder.response);
    assert.equal(recorder.statusCode, 400);
    assert.equal(recorder.body.code, expectedCode);
    assert.equal(state.filters.length, 0);
    assert.equal(state.notifications.length, 0);
  }
});

test("AI claim schedule rejects frontend-supplied technician identifiers", async (t) => {
  for (const body of [
    { approvedBy: ids.technician2 },
    { technicianId: ids.technician2 },
  ]) {
    const state = installHarness(t);
    const recorder = createResponseRecorder();
    await claimAndScheduleAIRequest(createRequest({ body }), recorder.response);
    assert.equal(recorder.statusCode, 400);
    assert.equal(recorder.body.code, "TECHNICIAN_ASSIGNMENT_NOT_ALLOWED");
    assert.equal(state.filters.length, 0);
  }
});

test("AI claim schedule allows only one of two concurrent technicians to succeed", async (t) => {
  const state = installHarness(t);
  const first = createResponseRecorder();
  const second = createResponseRecorder();

  await Promise.all([
    claimAndScheduleAIRequest(
      createRequest({ technicianId: ids.technician1 }),
      first.response,
    ),
    claimAndScheduleAIRequest(
      createRequest({ technicianId: ids.technician2 }),
      second.response,
    ),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  const loser = first.statusCode === 409 ? first : second;
  assert.equal(loser.body.code, "REQUEST_ALREADY_CLAIMED");
  assert.equal(state.notifications.length, 1);
});

test("AI claim schedule rejects another technician, cancelled requests, and deleted requests", async (t) => {
  const cases = [
    [
      { approvedBy: ids.technician2 },
      "REQUEST_ALREADY_CLAIMED",
    ],
    [{ status: "cancelled" }, "REQUEST_NOT_CLAIMABLE"],
    [{ deletedAt: new Date() }, "REQUEST_NOT_CLAIMABLE"],
  ];

  for (const [requestOverride, expectedCode] of cases) {
    const state = installHarness(t, { request: requestOverride });
    const recorder = createResponseRecorder();
    await claimAndScheduleAIRequest(createRequest(), recorder.response);
    assert.equal(recorder.statusCode, 409);
    assert.equal(recorder.body.code, expectedCode);
    assert.equal(state.notifications.length, 0);
  }
});

test("AI claim schedule rejects unauthorized roles", async (t) => {
  const state = installHarness(t);
  for (const role of ["farmer", "veterinarian", "admin"]) {
    const recorder = createResponseRecorder();
    await claimAndScheduleAIRequest(createRequest({ role }), recorder.response);
    assert.equal(recorder.statusCode, 403);
    assert.equal(recorder.body.code, "AI_REQUEST_CLAIM_FORBIDDEN");
  }
  assert.equal(state.filters.length, 0);
  assert.equal(state.notifications.length, 0);
});

test("AI claim schedule retries are idempotent and do not duplicate notifications", async (t) => {
  const state = installHarness(t);
  const first = createResponseRecorder();
  const retry = createResponseRecorder();
  const request = createRequest();

  await claimAndScheduleAIRequest(request, first.response);
  await claimAndScheduleAIRequest(createRequest(), retry.response);

  assert.equal(first.statusCode, 200);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.idempotent, true);
  assert.equal(state.notifications.length, 1);
});

test("AI claim schedule returns not found without notification", async (t) => {
  const state = installHarness(t, { request: null });
  const recorder = createResponseRecorder();
  await claimAndScheduleAIRequest(createRequest(), recorder.response);
  assert.equal(recorder.statusCode, 404);
  assert.equal(recorder.body.code, "AI_REQUEST_NOT_FOUND");
  assert.equal(state.notifications.length, 0);
});
