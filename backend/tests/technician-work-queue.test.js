import assert from "node:assert/strict";
import test from "node:test";

import {
  getTechnicianRequests,
  getWorkQueue,
} from "../src/controllers/technician.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Task } from "../src/models/task.model.js";

const ids = {
  technician: "507f1f77bcf86cd799439001",
  otherTechnician: "507f1f77bcf86cd799439002",
  farmer: "507f1f77bcf86cd799439003",
  animal: "507f1f77bcf86cd799439004",
  pending: "507f1f77bcf86cd799439005",
  pendingAssigned: "507f1f77bcf86cd799439006",
  scheduled: "507f1f77bcf86cd799439007",
  inProgress: "507f1f77bcf86cd799439008",
  completed: "507f1f77bcf86cd799439009",
  otherScheduled: "507f1f77bcf86cd799439010",
  secondScheduled: "507f1f77bcf86cd799439011",
  linkedAiTask: "507f1f77bcf86cd799439012",
  linkedSecondAiTask: "507f1f77bcf86cd799439013",
  standaloneTask: "507f1f77bcf86cd799439014",
  pdTask: "507f1f77bcf86cd799439015",
  calvingTask: "507f1f77bcf86cd799439016",
  health: "507f1f77bcf86cd799439017",
  otherHealth: "507f1f77bcf86cd799439018",
  linkedHealthTask: "507f1f77bcf86cd799439019",
  linkedLegacyAiTask: "507f1f77bcf86cd799439020",
};

const farmer = {
  _id: ids.farmer,
  name: "Maria Santos",
  phoneNumber: "09171234567",
  address: { barangay: "San Roque", city: "Iloilo City" },
};

const animal = {
  _id: ids.animal,
  name: "Bessie",
  animalId: "COW-17",
  earTag: "EAR-17",
  species: "Cattle",
  breed: "Holstein",
};

const queryResult = (value) => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    lean() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const idOf = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && value._id !== undefined) {
    return idOf(value._id);
  }
  return String(value);
};

const getPath = (record, path) =>
  path.split(".").reduce((value, key) => value?.[key], record);

const matchesCondition = (actual, expected) => {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if (Array.isArray(expected.$in)) {
      return expected.$in.some((candidate) => idOf(candidate) === idOf(actual));
    }
    if (expected.$ne !== undefined) {
      if (Array.isArray(actual)) {
        return !actual.some(
          (candidate) => idOf(candidate) === idOf(expected.$ne),
        );
      }
      return idOf(actual) !== idOf(expected.$ne);
    }
  }
  return idOf(actual) === idOf(expected);
};

const matchesFilter = (record, filter) =>
  Object.entries(filter || {}).every(([key, expected]) => {
    if (key === "$or") {
      return expected.some((candidate) => matchesFilter(record, candidate));
    }
    if (key === "$and") {
      return expected.every((candidate) => matchesFilter(record, candidate));
    }
    return matchesCondition(getPath(record, key), expected);
  });

const responseRecorder = () => {
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

const installHarness = (t) => {
  const originals = {
    inseminationFind: Insemination.find,
    healthFind: HealthRequest.find,
    taskFind: Task.find,
  };
  const state = {
    inseminations: [],
    healthRequests: [],
    tasks: [],
    queries: { insemination: [], health: [], task: [] },
  };

  Insemination.find = (filter) => {
    state.queries.insemination.push(filter);
    return queryResult(
      state.inseminations.filter((record) => matchesFilter(record, filter)),
    );
  };
  HealthRequest.find = (filter) => {
    state.queries.health.push(filter);
    return queryResult(
      state.healthRequests.filter((record) => matchesFilter(record, filter)),
    );
  };
  Task.find = (filter) => {
    state.queries.task.push(filter);
    return queryResult(
      state.tasks.filter((record) => matchesFilter(record, filter)),
    );
  };

  t.after(() => {
    Insemination.find = originals.inseminationFind;
    HealthRequest.find = originals.healthFind;
    Task.find = originals.taskFind;
  });

  return state;
};

const aiRecord = (overrides = {}) => ({
  _id: ids.scheduled,
  farmerId: farmer,
  animalId: animal,
  approvedBy: ids.technician,
  technicianId: ids.technician,
  status: "scheduled",
  scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  visitPeriod: "morning",
  preferredDate: new Date(0),
  heatSigns: ["standing heat"],
  imageUrl: "https://example.test/heat-sign.jpg",
  attemptNumber: 1,
  cancellationStatus: "none",
  deletedAt: null,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-02T00:00:00.000Z"),
  ...overrides,
});

const taskRecord = (overrides = {}) => ({
  _id: ids.standaloneTask,
  technicianId: ids.technician,
  farmerId: farmer,
  animalIds: [animal],
  taskType: "GeneralVisit",
  category: "Routine",
  status: "Pending",
  dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  metadata: {},
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  ...overrides,
});

test("Technician Work Queue backend contract", async (t) => {
  const state = installHarness(t);

  await t.test(
    "pending unassigned AI appears only in Requests with claim-and-schedule metadata",
    async () => {
      state.inseminations = [
        aiRecord({
          _id: ids.pending,
          status: "pending",
          approvedBy: null,
          technicianId: null,
          scheduledDate: undefined,
          visitPeriod: undefined,
        }),
      ];
      state.healthRequests = [];
      state.tasks = [];

      const requests = responseRecorder();
      await getTechnicianRequests(
        {
          query: { type: "ai", status: "pending", assignment: "available" },
          user: { _id: ids.technician, role: "technician" },
        },
        requests.response,
      );

      assert.equal(requests.statusCode, 200);
      assert.equal(requests.body.requests.length, 1);
      const request = requests.body.requests[0];
      assert.equal(String(request.workflowId), ids.pending);
      assert.equal(request.allowedAction, "CLAIM_AND_SCHEDULE");
      assert.equal(request.actionLabel, "Claim & Set Visit");
      assert.equal(request.farmer, farmer.name);
      assert.equal(request.farmerPhone, farmer.phoneNumber);
      assert.equal(request.phone, farmer.phoneNumber);
      assert.equal(request.animal, animal.animalId);
      assert.equal(request.location, "San Roque, Iloilo City");
      assert.deepEqual(request.heatSigns, ["standing heat"]);
      assert.equal(request.attachments.count, 1);
      assert.equal(request.requestSubmissionDate.toISOString(), "2026-08-01T00:00:00.000Z");

      const workQueue = responseRecorder();
      await getWorkQueue(
        {
          user: { _id: ids.technician, role: "technician" },
        },
        workQueue.response,
      );
      assert.equal(workQueue.statusCode, 200);
      assert.deepEqual(workQueue.body.data, []);
    },
  );

  await t.test(
    "AI My Work actions, assignment isolation, schedules, identifiers, and deduplication are canonical",
    async () => {
      const sharedSchedule = new Date(Date.now() + 24 * 60 * 60 * 1000);
      state.inseminations = [
        aiRecord({ _id: ids.scheduled, scheduledDate: sharedSchedule }),
        aiRecord({
          _id: ids.secondScheduled,
          scheduledDate: sharedSchedule,
          visitPeriod: "afternoon",
        }),
        aiRecord({
          _id: ids.inProgress,
          status: "in-progress",
          scheduledDate: sharedSchedule,
          visitPeriod: undefined,
        }),
        aiRecord({
          _id: ids.completed,
          status: "done",
          scheduledDate: sharedSchedule,
          inseminationDate: new Date("2026-08-03T02:00:00.000Z"),
        }),
        aiRecord({
          _id: ids.otherScheduled,
          approvedBy: ids.otherTechnician,
          technicianId: ids.otherTechnician,
        }),
        aiRecord({
          _id: ids.pendingAssigned,
          status: "pending",
          scheduledDate: undefined,
          visitPeriod: undefined,
          preferredDate: new Date(0),
        }),
      ];
      state.healthRequests = [];
      state.tasks = [
        taskRecord({
          _id: ids.linkedAiTask,
          taskType: "AI",
          metadata: { requestId: ids.scheduled },
        }),
        taskRecord({
          _id: ids.linkedSecondAiTask,
          taskType: "AI",
          metadata: { sourceId: ids.secondScheduled },
        }),
        taskRecord({
          _id: ids.linkedLegacyAiTask,
          taskType: "AI",
          metadata: { inseminationId: ids.inProgress },
        }),
        taskRecord(),
        taskRecord({
          _id: ids.pdTask,
          taskType: "PD",
          metadata: { inseminationId: ids.scheduled },
        }),
        taskRecord({
          _id: ids.calvingTask,
          taskType: "Calving",
        }),
      ];

      const recorder = responseRecorder();
      await getWorkQueue(
        { user: { _id: ids.technician, role: "technician" } },
        recorder.response,
      );

      assert.equal(recorder.statusCode, 200);
      const items = recorder.body.data;
      const byId = new Map(items.map((item) => [item.id, item]));

      assert.equal(byId.has(ids.otherScheduled), false);
      assert.equal(byId.has(ids.linkedAiTask), false);
      assert.equal(byId.has(ids.linkedSecondAiTask), false);
      assert.equal(byId.has(ids.linkedLegacyAiTask), false);
      assert.equal(byId.has(ids.standaloneTask), true);
      assert.equal(byId.has(ids.pdTask), true);
      assert.equal(byId.has(ids.calvingTask), true);

      const scheduled = byId.get(ids.scheduled);
      assert.equal(scheduled.allowedAction, "RECORD_SERVICE");
      assert.equal(scheduled.actionLabel, "Record Insemination");
      assert.equal(scheduled.workflowId, ids.scheduled);
      assert.equal(scheduled.taskId, ids.linkedAiTask);
      assert.notEqual(scheduled.workflowId, scheduled.taskId);
      assert.equal(scheduled.schedule.date, sharedSchedule);
      assert.equal(scheduled.schedule.visitPeriod, "morning");
      assert.equal(scheduled.farmer.id, ids.farmer);
      assert.equal(scheduled.animal.id, ids.animal);

      const second = byId.get(ids.secondScheduled);
      assert.equal(second.workflowId, ids.secondScheduled);
      assert.equal(second.taskId, ids.linkedSecondAiTask);
      assert.equal(second.schedule.visitPeriod, "afternoon");

      const legacy = byId.get(ids.inProgress);
      assert.equal(legacy.allowedAction, "RECORD_SERVICE");
      assert.equal(legacy.actionLabel, "Record Insemination");
      assert.equal(legacy.taskId, ids.linkedLegacyAiTask);
      assert.equal(legacy.schedule.visitPeriod, null);

      const completed = byId.get(ids.completed);
      assert.equal(completed.allowedAction, "VIEW_RECORD");
      assert.equal(completed.actionLabel, "View Record");
      assert.ok(completed.completedAt);

      const inconsistent = byId.get(ids.pendingAssigned);
      assert.equal(inconsistent.allowedAction, null);
      assert.equal(
        inconsistent.stateIssue,
        "PENDING_ASSIGNED_WITHOUT_SCHEDULE",
      );
      assert.equal(inconsistent.schedule.date, null);
      assert.equal(inconsistent.overdue, false);

      const standalone = byId.get(ids.standaloneTask);
      assert.equal(standalone.workflowId, null);
      assert.equal(standalone.taskId, ids.standaloneTask);
      assert.equal(standalone.id, ids.standaloneTask);
      assert.equal(standalone.allowedAction, "COMPLETE_TASK");

      assert.equal(
        items.filter((item) => item.workflowType === "AI").length,
        5,
      );
      assert.ok(
        items.every(
          (item) =>
            typeof item.id === "string" &&
            item.id.length > 0 &&
            item.workflowId !== undefined &&
            item.taskId !== undefined,
        ),
      );

      const aiFilter = state.queries.insemination.at(-1);
      assert.deepEqual(aiFilter.$or, [
        { approvedBy: ids.technician },
        { status: "done", technicianId: ids.technician },
      ]);
    },
  );

  await t.test(
    "Health assignment and duplicate filtering stay isolated while PD and Calving remain Task-backed",
    async () => {
      state.inseminations = [];
      state.healthRequests = [
        {
          _id: ids.health,
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.technician,
          assignedTechnicianId: ids.technician,
          status: "scheduled",
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          requestType: "checkup",
          urgency: "medium",
          deletedAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          _id: ids.otherHealth,
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.otherTechnician,
          assignedTechnicianId: ids.otherTechnician,
          status: "scheduled",
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          requestType: "injury",
          urgency: "high",
          deletedAt: null,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ];
      state.tasks = [
        taskRecord({
          _id: ids.linkedHealthTask,
          taskType: "Health",
          relatedRecordType: "health",
          relatedRecordId: ids.health,
        }),
        taskRecord({ _id: ids.pdTask, taskType: "PD" }),
        taskRecord({ _id: ids.calvingTask, taskType: "Calving" }),
      ];

      const recorder = responseRecorder();
      await getWorkQueue(
        { user: { _id: ids.technician, role: "technician" } },
        recorder.response,
      );

      const byId = new Map(recorder.body.data.map((item) => [item.id, item]));
      assert.equal(byId.has(ids.health), true);
      assert.equal(byId.has(ids.otherHealth), false);
      assert.equal(byId.has(ids.linkedHealthTask), false);
      assert.equal(byId.get(ids.health).taskId, ids.linkedHealthTask);
      assert.equal(byId.get(ids.health).allowedAction, "START_SERVICE");
      assert.equal(byId.get(ids.pdTask).workflowType, "PD");
      assert.equal(byId.get(ids.pdTask).allowedAction, "START_SERVICE");
      assert.equal(byId.get(ids.calvingTask).workflowType, "Calving");
      assert.equal(byId.get(ids.calvingTask).allowedAction, "START_SERVICE");
    },
  );
});
