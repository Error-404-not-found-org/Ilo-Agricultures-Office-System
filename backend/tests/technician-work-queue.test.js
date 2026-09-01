import assert from "node:assert/strict";
import test from "node:test";

import {
  getTechnicianRequests,
  getWorkQueue,
} from "../src/controllers/technician.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Task } from "../src/models/task.model.js";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";

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
  pregnancy: "507f1f77bcf86cd799439021",
  calving: "507f1f77bcf86cd799439022",
  legacyAnimal: "507f1f77bcf86cd799439023",
  legacyFarmer: "507f1f77bcf86cd799439024",
  noLocationAnimal: "507f1f77bcf86cd799439025",
  noLocationFarmer: "507f1f77bcf86cd799439026",
};

const farmer = {
  _id: ids.farmer,
  role: "farmer",
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

const technicianUser = {
  _id: ids.technician,
  role: "technician",
  status: "active",
  deletedAt: null,
  isVerified: true,
  profileClaimStatus: "claimed",
  dispatchProfile: {
    acceptsNewRequests: true,
    availabilityStatus: "available",
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityCode: "063034000" }],
  },
};

const queryResult = (value, onLimit = () => {}) => {
  let result = [...value];
  const query = {
    populate() {
      return query;
    },
    select() {
      return query;
    },
    sort(specification = {}) {
      const entries = Object.entries(specification);
      result.sort((left, right) => {
        for (const [path, direction] of entries) {
          const leftValue = getPath(left, path);
          const rightValue = getPath(right, path);
          const leftComparable =
            leftValue instanceof Date ? leftValue.getTime() : leftValue;
          const rightComparable =
            rightValue instanceof Date ? rightValue.getTime() : rightValue;
          if (leftComparable == null && rightComparable == null) continue;
          if (leftComparable == null) return 1;
          if (rightComparable == null) return -1;
          if (leftComparable < rightComparable) return -1 * direction;
          if (leftComparable > rightComparable) return direction;
        }
        return 0;
      });
      return query;
    },
    limit(value) {
      onLimit(value);
      result = result.slice(0, value);
      return query;
    },
    lean() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
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
      const actualValues = Array.isArray(actual) ? actual : [actual];
      if (
        !actualValues.some((actualValue) =>
          expected.$in.some(
            (candidate) => idOf(candidate) === idOf(actualValue),
          ),
        )
      ) {
        return false;
      }
    }
    if (Array.isArray(expected.$nin)) {
      if (
        expected.$nin.some((candidate) => idOf(candidate) === idOf(actual))
      ) {
        return false;
      }
    }
    if (expected.$exists !== undefined) {
      if ((actual !== undefined) !== expected.$exists) return false;
    }
    if (expected.$ne !== undefined) {
      if (Array.isArray(actual)) {
        if (
          actual.some((candidate) => idOf(candidate) === idOf(expected.$ne))
        ) {
          return false;
        }
      } else if (idOf(actual) === idOf(expected.$ne)) {
        return false;
      }
    }
    if (expected.$lte !== undefined) {
      if (actual == null) return false;
      const actualVal = actual instanceof Date ? actual.getTime() : actual;
      const expectedVal = expected.$lte instanceof Date ? expected.$lte.getTime() : expected.$lte;
      if (actualVal > expectedVal) return false;
    }
    if (expected.$lt !== undefined) {
      if (actual == null) return false;
      const actualVal = actual instanceof Date ? actual.getTime() : actual;
      const expectedVal =
        expected.$lt instanceof Date
          ? expected.$lt.getTime()
          : expected.$lt;
      if (actualVal >= expectedVal) return false;
    }
    if (expected.$gte !== undefined) {
      if (actual == null) return false;
      const actualVal = actual instanceof Date ? actual.getTime() : actual;
      const expectedVal =
        expected.$gte instanceof Date
          ? expected.$gte.getTime()
          : expected.$gte;
      if (actualVal < expectedVal) return false;
    }
    if (expected.$regex !== undefined) {
      const expression = new RegExp(expected.$regex, expected.$options || "");
      if (!expression.test(String(actual || ""))) return false;
    }
    return true;
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
    if (key === "$nor") {
      return expected.every((candidate) => !matchesFilter(record, candidate));
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

const singleExecutionCountQuery = (value) => {
  let executionPromise = null;
  const query = {
    exec() {
      if (executionPromise) {
        throw new Error("Query was already executed");
      }
      executionPromise = Promise.resolve(value);
      return executionPromise;
    },
    then(resolve, reject) {
      return query.exec().then(resolve, reject);
    },
  };
  return query;
};

const installHarness = (t) => {
  const originals = {
    inseminationFind: Insemination.find,
    healthFind: HealthRequest.find,
    taskFind: Task.find,
    medicalRecordFind: MedicalRecord.find,
    userFind: User.find,
    animalFind: Animal.find,
    pregnancyFind: Pregnancy.find,
    calvingFind: Calving.find,
    inseminationCount: Insemination.countDocuments,
    healthCount: HealthRequest.countDocuments,
    taskCount: Task.countDocuments,
  };
  const state = {
    inseminations: [],
    healthRequests: [],
    tasks: [],
    medicalRecords: [],
    users: [farmer],
    animals: [animal],
    pregnancies: [],
    calvings: [],
    queries: { insemination: [], health: [], task: [] },
    limits: { insemination: [], health: [], task: [] },
  };

  Insemination.find = (filter) => {
    state.queries.insemination.push(filter);
    return queryResult(
      state.inseminations.filter((record) => matchesFilter(record, filter)),
      (value) => state.limits.insemination.push(value),
    );
  };
  HealthRequest.find = (filter) => {
    state.queries.health.push(filter);
    return queryResult(
      state.healthRequests.filter((record) => matchesFilter(record, filter)),
      (value) => state.limits.health.push(value),
    );
  };
  Task.find = (filter) => {
    state.queries.task.push(filter);
    return queryResult(
      state.tasks.filter((record) => matchesFilter(record, filter)),
      (value) => state.limits.task.push(value),
    );
  };
  MedicalRecord.find = (filter) =>
    queryResult(
      state.medicalRecords.filter((record) => matchesFilter(record, filter)),
    );
  User.find = (filter) =>
    queryResult(state.users.filter((record) => matchesFilter(record, filter)));
  Animal.find = (filter) =>
    queryResult(
      state.animals.filter((record) => matchesFilter(record, filter)),
    );
  Pregnancy.find = (filter) =>
    queryResult(
      state.pregnancies.filter((record) => matchesFilter(record, filter)),
    );
  Calving.find = (filter) =>
    queryResult(
      state.calvings.filter((record) => matchesFilter(record, filter)),
    );
  Insemination.countDocuments = (filter) =>
    singleExecutionCountQuery(
      state.inseminations.filter((record) => matchesFilter(record, filter))
        .length,
    );
  HealthRequest.countDocuments = (filter) =>
    singleExecutionCountQuery(
      state.healthRequests.filter((record) => matchesFilter(record, filter))
        .length,
    );
  Task.countDocuments = (filter) =>
    singleExecutionCountQuery(
      state.tasks.filter((record) => matchesFilter(record, filter)).length,
    );

  t.after(() => {
    Insemination.find = originals.inseminationFind;
    HealthRequest.find = originals.healthFind;
    Task.find = originals.taskFind;
    MedicalRecord.find = originals.medicalRecordFind;
    User.find = originals.userFind;
    Animal.find = originals.animalFind;
    Pregnancy.find = originals.pregnancyFind;
    Calving.find = originals.calvingFind;
    Insemination.countDocuments = originals.inseminationCount;
    HealthRequest.countDocuments = originals.healthCount;
    Task.countDocuments = originals.taskCount;
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
  dispatch: {
    stage: "local",
    location: { municipalityCode: "063034000" },
  },
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
    "empty work queue executes every count query once across supported count paths",
    async () => {
      state.inseminations = [];
      state.healthRequests = [];
      state.tasks = [];
      state.medicalRecords = [];

      const cases = [
        { workState: "active", type: "all" },
        { workState: "completed", type: "all" },
        { workState: "active", type: "ai" },
        { workState: "active", type: "health" },
        { workState: "active", type: "pregnancy" },
        { workState: "active", type: "calving" },
      ];

      for (const query of cases) {
        const recorder = responseRecorder();
        await getWorkQueue(
          {
            query: { ...query, page: "1", limit: "5" },
            user: { _id: ids.technician, role: "technician" },
          },
          recorder.response,
        );

        assert.equal(recorder.statusCode, 200, `${query.workState}/${query.type}`);
        assert.deepEqual(recorder.body.data, []);
        assert.deepEqual(recorder.body.counts, {
          all: 0,
          ai: 0,
          health: 0,
          pregnancy: 0,
          calving: 0,
        });
        assert.deepEqual(recorder.body.pagination, {
          total: 0,
          page: 1,
          limit: 5,
          totalPages: 1,
        });
        assert.ok(
          Object.values(recorder.body.counts).every(Number.isFinite),
        );
      }
    },
  );

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
          attemptNumber: 2,
          attemptSeriesId: ids.pendingAssigned,
          previousAttemptId: {
            _id: "completed-attempt-1",
            attemptNumber: 1,
            status: "done",
            isSuccess: false,
            outcome: "Failed (Re-heat)",
            outcomeVerificationStatus: "verified",
          },
        }),
      ];
      state.healthRequests = [];
      state.tasks = [];

      const requests = responseRecorder();
      await getTechnicianRequests(
        {
          query: { type: "ai", status: "pending", assignment: "available" },
          user: technicianUser,
        },
        requests.response,
      );

      assert.equal(requests.statusCode, 200);
      assert.equal(requests.body.requests.length, 1);
      const request = requests.body.requests[0];
      assert.equal(String(request.workflowId), ids.pending);
      assert.equal(request.allowedAction, "CLAIM_AND_SCHEDULE");
      assert.equal(request.actionLabel, "Accept & Set Visit");
      assert.equal(request.requestKind, "re_insemination");
      assert.equal(request.attemptNumber, 2);
      assert.equal(request.previousAttemptId._id, "completed-attempt-1");
      const expectedKeys = [
        "id", "workflowId", "workflowType", "type", "serviceType", "attachments",
        "status", "allowedAction", "actionLabel", "isReadyToday", "displayStatus",
        "urgency", "animal", "earTag", "breed", "species", "municipality", "barangay",
        "preferredDate", "scheduledDate", "visitPeriod", "heatSigns", "requestSubmissionDate", "createdAt", "farmer",
        "requestKind", "attemptNumber", "previousAttemptId", "previousAttemptOutcome", "previousAttemptVerified"
      ].sort();
      assert.deepEqual(Object.keys(request).sort(), expectedKeys);
      assert.equal(request.farmer, "Maria Santos");
      assert.deepEqual(request.heatSigns, ["standing heat"]);

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
    "Open Request counts are consolidated into the main response",
    async () => {
      state.inseminations = [
        aiRecord({
          _id: ids.pending,
          status: "pending",
          approvedBy: null,
          technicianId: null,
        }),
      ];
      state.healthRequests = [
        {
          _id: ids.health,
          farmerId: farmer,
          animalId: animal,
          handledBy: null,
          assignedTechnicianId: null,
          status: "pending",
          deletedAt: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063034000" },
          },
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        },
      ];
      state.tasks = [
        taskRecord({
          _id: ids.pdTask,
          taskType: "PD",
          technicianId: null,
          status: "Pending",
          sourceType: "farmer_requested_verification",
        }),
      ];

      const recorder = responseRecorder();
      await getTechnicianRequests(
        {
          query: {
            type: "all",
            assignment: "unassigned",
            includeCounts: "true",
          },
          user: technicianUser,
        },
        recorder.response,
      );

      assert.deepEqual(recorder.body.counts, {
        all: 3,
        ai: 1,
        health: 1,
        pregnancy: 1,
      });
    },
  );

  await t.test(
    "Admin can filter paginated AI and Health requests by assigned Technician",
    async () => {
      state.inseminations = [
        aiRecord({
          _id: ids.scheduled,
          approvedBy: ids.technician,
          technicianId: ids.technician,
        }),
        aiRecord({
          _id: ids.otherScheduled,
          approvedBy: ids.otherTechnician,
          technicianId: ids.otherTechnician,
        }),
      ];
      state.healthRequests = [
        {
          _id: ids.health,
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.technician,
          assignedTechnicianId: ids.technician,
          status: "scheduled",
          deletedAt: null,
          createdAt: new Date("2026-08-03T00:00:00.000Z"),
        },
        {
          _id: ids.otherHealth,
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.otherTechnician,
          assignedTechnicianId: ids.otherTechnician,
          status: "scheduled",
          deletedAt: null,
          createdAt: new Date("2026-08-04T00:00:00.000Z"),
        },
      ];
      state.tasks = [];

      const recorder = responseRecorder();
      await getTechnicianRequests(
        {
          query: {
            type: "all",
            status: "all",
            assignment: "all",
            assignedTechnicianId: ids.technician,
            includeOperationalTasks: "false",
            page: "1",
            limit: "6",
          },
          user: { _id: "507f1f77bcf86cd799439099", role: "admin" },
        },
        recorder.response,
      );

      assert.equal(recorder.statusCode, 200);
      assert.equal(recorder.body.pagination.total, 2);
      assert.deepEqual(
        recorder.body.requests.map((request) => String(request.id)).sort(),
        [ids.health, ids.scheduled].sort(),
      );

      const forbidden = responseRecorder();
      await getTechnicianRequests(
        {
          query: {
            assignment: "all",
            assignedTechnicianId: ids.otherTechnician,
          },
          user: technicianUser,
        },
        forbidden.response,
      );
      assert.equal(forbidden.statusCode, 403);
    },
  );

  await t.test(
    "Open Requests applies Field Area, capability, and Receive Requests eligibility",
    async () => {
      state.inseminations = [
        aiRecord({
          _id: "outside-area-ai",
          status: "pending",
          approvedBy: null,
          technicianId: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063022000" },
          },
        }),
      ];
      state.healthRequests = [
        {
          _id: "unsupported-health",
          farmerId: farmer,
          animalId: animal,
          handledBy: null,
          assignedTechnicianId: null,
          status: "pending",
          deletedAt: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063034000" },
          },
          createdAt: new Date(),
        },
      ];
      state.tasks = [];

      const recorder = responseRecorder();
      await getTechnicianRequests(
        {
          query: { type: "all", assignment: "unassigned" },
          user: {
            ...technicianUser,
            dispatchProfile: {
              ...technicianUser.dispatchProfile,
              serviceCapabilities: ["AI"],
            },
          },
        },
        recorder.response,
      );
      assert.deepEqual(recorder.body.requests, []);

      const offRecorder = responseRecorder();
      await getTechnicianRequests(
        {
          query: { type: "all", assignment: "unassigned" },
          user: {
            ...technicianUser,
            dispatchProfile: {
              ...technicianUser.dispatchProfile,
              acceptsNewRequests: false,
              availabilityStatus: "off_duty",
            },
          },
        },
        offRecorder.response,
      );
      assert.deepEqual(offRecorder.body.requests, []);
    },
  );

  await t.test(
    "Receive Requests OFF and Field Area changes do not hide existing My Work",
    async () => {
      state.inseminations = [
        aiRecord({
          _id: "owned-outside-current-area",
          approvedBy: ids.technician,
          technicianId: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063022000" },
          },
        }),
      ];
      state.healthRequests = [];
      state.tasks = [];

      const recorder = responseRecorder();
      await getTechnicianRequests(
        {
          query: { type: "ai", assignment: "mine" },
          user: {
            ...technicianUser,
            dispatchProfile: {
              ...technicianUser.dispatchProfile,
              acceptsNewRequests: false,
              availabilityStatus: "off_duty",
            },
          },
        },
        recorder.response,
      );
      assert.equal(recorder.body.requests.length, 1);
      assert.equal(recorder.body.requests[0].id, "owned-outside-current-area");
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
          attemptNumber: 2,
          attemptSeriesId: ids.pendingAssigned,
          previousAttemptId: {
            _id: ids.pending,
            attemptNumber: 1,
            status: "done",
            isSuccess: false,
            outcome: "Failed (Re-heat)",
            outcomeVerificationStatus: "verified",
          },
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
          completedAt: new Date("2026-08-03T03:00:00.000Z"),
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
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          metadata: { inseminationId: ids.scheduled },
        }),
        taskRecord({
          _id: ids.calvingTask,
          taskType: "Calving",
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
      ];

      const recorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "active", page: "1", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
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
      assert.equal(second.requestKind, "re_insemination");
      assert.equal(second.attemptNumber, 2);
      assert.equal(second.previousAttemptId, ids.pending);
      assert.equal(second.attemptSeriesId, ids.pendingAssigned);
      assert.equal(second.previousAttemptOutcome, "Failed (Re-heat)");
      assert.equal(second.previousAttemptVerified, true);

      assert.equal(scheduled.requestKind, "initial_ai");
      assert.equal(scheduled.attemptNumber, 1);
      assert.equal(scheduled.previousAttemptVerified, false);

      const legacy = byId.get(ids.inProgress);
      assert.equal(legacy.allowedAction, "RECORD_SERVICE");
      assert.equal(legacy.actionLabel, "Record Insemination");
      assert.equal(legacy.taskId, ids.linkedLegacyAiTask);
      assert.equal(legacy.schedule.visitPeriod, null);

      assert.equal(byId.has(ids.completed), false);

      const completedRecorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "completed", page: "1", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
        completedRecorder.response,
      );
      const completed = completedRecorder.body.data.find(
        (item) => item.id === ids.completed,
      );
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
        4,
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

      assert.ok(
        state.queries.insemination.some(
          (filter) =>
            Array.isArray(filter.$or) &&
            filter.$or.some(
              (condition) => condition.approvedBy === ids.technician,
            ),
        ),
      );
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
          handlingMethod: "farm_visit",
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          visitPeriod: "afternoon",
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
        taskRecord({
          _id: ids.pdTask,
          taskType: "PD",
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
        taskRecord({
          _id: ids.calvingTask,
          taskType: "Calving",
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        }),
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
      assert.equal(byId.get(ids.health).actionLabel, "Start Visit");
      assert.equal(byId.get(ids.health).schedule.visitPeriod, "afternoon");
      assert.equal(byId.get(ids.health).visitPeriod, "afternoon");
      assert.equal(byId.get(ids.pdTask).workflowType, "PD");
      assert.equal(byId.get(ids.pdTask).allowedAction, "RECORD_SERVICE");
      assert.equal(
        byId.get(ids.pdTask).actionLabel,
        "Record Pregnancy Check",
      );
      assert.equal(byId.get(ids.calvingTask).workflowType, "Calving");
      assert.equal(byId.get(ids.calvingTask).allowedAction, "RECORD_SERVICE");
      assert.equal(byId.get(ids.calvingTask).actionLabel, "Record Calving");

      state.healthRequests[0] = {
        ...state.healthRequests[0],
        handlingMethod: null,
        visitPeriod: null,
      };
      const inconsistentRecorder = responseRecorder();
      await getWorkQueue(
        { user: { _id: ids.technician, role: "technician" } },
        inconsistentRecorder.response,
      );
      const inconsistentHealth = inconsistentRecorder.body.data.find(
        (item) => item.id === ids.health,
      );
      assert.equal(inconsistentHealth.allowedAction, "VIEW_DETAILS");
      assert.equal(inconsistentHealth.actionLabel, "Review Request");
      assert.equal(
        inconsistentHealth.stateIssue,
        "INCOMPLETE_FARM_VISIT_SCHEDULE",
      );
    },
  );

  await t.test(
    "Pregnancy and Calving tasks follow canonical actionable-date visibility",
    async () => {
      state.inseminations = [];
      state.healthRequests = [];
      const now = Date.now();
      const futureDueDate = new Date(now + 24 * 60 * 60 * 1000);
      const dueDate = new Date(now);
      const overdueDate = new Date(now - 24 * 60 * 60 * 1000);
      state.tasks = [
        taskRecord({
          _id: "pd-future-pending",
          taskType: "PD",
          status: "Pending",
          dueDate: futureDueDate,
        }),
        taskRecord({
          _id: "pd-due-pending",
          taskType: "PD",
          status: "Pending",
          dueDate,
        }),
        taskRecord({
          _id: "pd-overdue-pending",
          taskType: "PD",
          status: "Pending",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "pd-in-progress",
          taskType: "PD",
          status: "In Progress",
          dueDate: futureDueDate,
        }),
        taskRecord({
          _id: "pd-completed",
          taskType: "PD",
          status: "Completed",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "pd-cancelled",
          taskType: "PD",
          status: "Cancelled",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "calving-future-pending",
          taskType: "CD",
          status: "Pending",
          dueDate: futureDueDate,
        }),
        taskRecord({
          _id: "calving-due-pending",
          taskType: "Calving",
          status: "Pending",
          dueDate,
        }),
        taskRecord({
          _id: "calving-overdue-pending",
          taskType: "CD",
          status: "Pending",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "calving-in-progress",
          taskType: "Calving",
          status: "In Progress",
          dueDate: futureDueDate,
        }),
        taskRecord({
          _id: "calving-completed",
          taskType: "CD",
          status: "Completed",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "calving-cancelled",
          taskType: "Calving",
          status: "Cancelled",
          dueDate: overdueDate,
        }),
        taskRecord({
          _id: "general-future-pending",
          taskType: "GeneralVisit",
          status: "Pending",
          dueDate: futureDueDate,
        }),
      ];

      const recorder = responseRecorder();
      await getWorkQueue(
        { user: { _id: ids.technician, role: "technician" } },
        recorder.response,
      );

      const visibleIds = new Set(recorder.body.data.map((item) => item.id));
      assert.equal(visibleIds.has("pd-future-pending"), false);
      assert.equal(visibleIds.has("pd-due-pending"), true);
      assert.equal(visibleIds.has("pd-overdue-pending"), true);
      assert.equal(visibleIds.has("pd-in-progress"), true);
      assert.equal(visibleIds.has("pd-completed"), false);
      assert.equal(visibleIds.has("pd-cancelled"), false);
      assert.equal(visibleIds.has("calving-future-pending"), false);
      assert.equal(visibleIds.has("calving-due-pending"), true);
      assert.equal(visibleIds.has("calving-overdue-pending"), true);
      assert.equal(visibleIds.has("calving-in-progress"), true);
      assert.equal(visibleIds.has("calving-completed"), false);
      assert.equal(visibleIds.has("calving-cancelled"), false);
      assert.equal(visibleIds.has("general-future-pending"), true);

      const completedRecorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "completed", type: "all" },
          user: { _id: ids.technician, role: "technician" },
        },
        completedRecorder.response,
      );
      const completedById = new Map(
        completedRecorder.body.data.map((item) => [item.id, item]),
      );
      assert.equal(completedById.get("pd-completed").allowedAction, "VIEW_DETAILS");
      assert.equal(
        completedById.get("calving-completed").allowedAction,
        "VIEW_DETAILS",
      );
    },
  );

  await t.test(
    "reproductive task state and legacy relationship context remain authoritative",
    async () => {
      const overdueDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const aiPerformedAt = new Date("2026-08-03T02:00:00.000Z");
      const followUpCompletedAt = new Date("2026-08-22T02:00:00.000Z");
      const pregnancyCompletedAt = new Date("2026-08-23T02:00:00.000Z");
      const calvingCompletedAt = new Date("2026-08-24T02:00:00.000Z");
      const legacyFarmer = {
        _id: ids.legacyFarmer,
        role: "farmer",
        name: "Legacy Farmer",
        address: { barangay: "Poblacion South", municipality: "Oton" },
      };
      const legacyAnimal = {
        _id: ids.legacyAnimal,
        farmerId: ids.legacyFarmer,
        name: "Legacy Cow",
        animalId: "02DP",
        earTag: "02DP",
        species: "Cattle",
        breed: "Native",
        gender: "Female",
      };
      const noLocationFarmer = {
        _id: ids.noLocationFarmer,
        role: "farmer",
        name: "Farmer Without Location",
      };
      const noLocationAnimal = {
        _id: ids.noLocationAnimal,
        farmerId: ids.noLocationFarmer,
        animalId: "NO-LOCATION",
        earTag: "NO-LOCATION",
        species: "Cattle",
        breed: "Native",
        gender: "Female",
      };

      state.users = [farmer, legacyFarmer, noLocationFarmer];
      state.animals = [animal, legacyAnimal, noLocationAnimal];
      state.inseminations = [
        aiRecord({
          _id: ids.completed,
          farmerId: legacyFarmer,
          animalId: legacyAnimal,
          status: "done",
          completedAt: null,
          inseminationDate: aiPerformedAt,
          outcomeConfirmedAt: followUpCompletedAt,
        }),
      ];
      state.pregnancies = [
        {
          _id: ids.pregnancy,
          animalId: ids.legacyAnimal,
          farmerId: ids.legacyFarmer,
          inseminationId: ids.completed,
          pregnancyDiagnosis: {
            date: pregnancyCompletedAt,
            result: "Pregnant",
          },
        },
      ];
      state.calvings = [
        {
          _id: ids.calving,
          animalId: ids.legacyAnimal,
          farmerId: ids.legacyFarmer,
          pregnancyId: ids.pregnancy,
          inseminationId: ids.completed,
          date: calvingCompletedAt,
        },
      ];
      state.healthRequests = [];
      state.tasks = [
        taskRecord({
          _id: "active-follow-up",
          taskType: "BreedingFollowUp",
          status: "Pending",
          dueDate: overdueDate,
          farmerId: undefined,
          animalIds: [],
          relatedRecordType: "insemination",
          relatedRecordId: ids.completed,
          metadata: {
            animalId: ids.legacyAnimal,
            inseminationId: ids.completed,
          },
        }),
        taskRecord({
          _id: "active-pregnancy",
          taskType: "PD",
          status: "Pending",
          dueDate: overdueDate,
          farmerId: undefined,
          animalIds: [ids.legacyAnimal],
          metadata: { pregnancyId: ids.pregnancy },
        }),
        taskRecord({
          _id: "active-calving",
          taskType: "Calving",
          status: "Pending",
          dueDate: overdueDate,
          farmerId: undefined,
          animalIds: [],
          metadata: { pregnancyId: ids.pregnancy },
        }),
        taskRecord({
          _id: "active-pregnancy-no-location",
          taskType: "PD",
          status: "Pending",
          dueDate: overdueDate,
          farmerId: undefined,
          animalIds: [],
          metadata: { animalId: ids.noLocationAnimal },
        }),
        taskRecord({
          _id: "completed-follow-up",
          taskType: "BreedingFollowUp",
          status: "Completed",
          dueDate: overdueDate,
          completedAt: null,
          farmerId: undefined,
          animalIds: [],
          relatedRecordType: "insemination",
          relatedRecordId: ids.completed,
          metadata: { inseminationId: ids.completed },
        }),
        taskRecord({
          _id: "completed-pregnancy",
          taskType: "PD",
          status: "Completed",
          dueDate: overdueDate,
          completedAt: null,
          farmerId: undefined,
          animalIds: [],
          metadata: { pregnancyId: ids.pregnancy },
        }),
        taskRecord({
          _id: "completed-calving",
          taskType: "CD",
          status: "Completed",
          dueDate: overdueDate,
          completedAt: null,
          farmerId: undefined,
          animalIds: [],
          relatedRecordType: "calving",
          relatedRecordId: ids.calving,
          metadata: {},
        }),
        taskRecord({
          _id: "completed-standalone",
          status: "Completed",
          dueDate: overdueDate,
          completedAt: null,
          updatedAt: new Date("2026-08-25T02:00:00.000Z"),
        }),
      ];

      const activeRecorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "active", type: "all", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
        activeRecorder.response,
      );
      assert.equal(activeRecorder.statusCode, 200);
      const activeById = new Map(
        activeRecorder.body.data.map((item) => [item.id, item]),
      );
      for (const taskId of [
        "active-follow-up",
        "active-pregnancy",
        "active-calving",
      ]) {
        const item = activeById.get(taskId);
        assert.ok(item, `${taskId} should remain active`);
        assert.equal(item.overdue, true);
        assert.equal(item.farmer.id, ids.legacyFarmer);
        assert.equal(item.farmer.name, "Legacy Farmer");
        assert.equal(item.farmer.location, "Poblacion South, Oton");
        assert.equal(item.animal.id, ids.legacyAnimal);
        assert.equal(item.animal.earTag, "02DP");
        assert.equal(item.animal.species, "Cattle");
      }
      assert.equal(activeById.has(ids.completed), false);
      assert.equal(activeById.has("completed-pregnancy"), false);
      assert.equal(
        activeById.get("active-pregnancy-no-location").farmer.name,
        "Farmer Without Location",
      );
      assert.equal(
        activeById.get("active-pregnancy-no-location").location,
        "Unknown Location",
      );

      const completedRecorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "completed", type: "all", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
        completedRecorder.response,
      );
      assert.equal(completedRecorder.statusCode, 200);
      const completedById = new Map(
        completedRecorder.body.data.map((item) => [item.id, item]),
      );
      assert.equal(completedById.has("active-follow-up"), false);
      assert.equal(completedById.has("active-pregnancy"), false);
      assert.equal(completedById.has("active-calving"), false);
      assert.equal(completedById.get(ids.completed).completedAt, aiPerformedAt);
      assert.equal(
        completedById.get("completed-follow-up").completedAt,
        followUpCompletedAt,
      );
      assert.equal(
        completedById.get("completed-pregnancy").completedAt,
        pregnancyCompletedAt,
      );
      assert.equal(
        completedById.get("completed-calving").completedAt,
        calvingCompletedAt,
      );
      assert.equal(completedById.get("completed-standalone").completedAt, null);
      for (const item of completedRecorder.body.data) {
        assert.equal(item.overdue, false);
        assert.ok(["VIEW_RECORD", "VIEW_DETAILS"].includes(item.allowedAction));
      }
      assert.equal(completedRecorder.body.pagination.total, 5);
      assert.equal(completedRecorder.body.counts.all, 5);
    },
  );

  await t.test(
    "Technician Requests uses bounded source windows with exact cross-domain pages",
    async () => {
      const createdAt = (hour) => new Date(`2026-08-20T${String(hour).padStart(2, "0")}:00:00.000Z`);
      state.inseminations = [
        aiRecord({
          _id: "request-ai-sixth",
          status: "pending",
          approvedBy: null,
          technicianId: null,
          createdAt: createdAt(1),
        }),
        aiRecord({
          _id: "request-ai-third",
          status: "pending",
          approvedBy: null,
          technicianId: null,
          createdAt: createdAt(4),
        }),
      ];
      state.healthRequests = [
        {
          _id: "request-health-fifth",
          farmerId: farmer,
          animalId: animal,
          handledBy: null,
          assignedTechnicianId: null,
          status: "pending",
          urgency: "medium",
          deletedAt: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063034000" },
          },
          createdAt: createdAt(2),
        },
        {
          _id: "request-health-second",
          farmerId: farmer,
          animalId: animal,
          handledBy: null,
          assignedTechnicianId: null,
          status: "pending",
          urgency: "medium",
          deletedAt: null,
          dispatch: {
            stage: "local",
            location: { municipalityCode: "063034000" },
          },
          createdAt: createdAt(5),
        },
      ];
      state.tasks = [
        taskRecord({
          _id: "request-pd-fourth",
          taskType: "PD",
          technicianId: null,
          status: "Pending",
          sourceType: "manual",
          createdAt: createdAt(3),
        }),
        taskRecord({
          _id: "request-pd-first",
          taskType: "PD",
          technicianId: null,
          status: "Pending",
          sourceType: "manual",
          createdAt: createdAt(6),
        }),
      ];
      state.limits.insemination = [];
      state.limits.health = [];
      state.limits.task = [];

      const firstPage = responseRecorder();
      await getTechnicianRequests(
        {
          query: {
            type: "all",
            assignment: "unassigned",
            sortBy: "newest",
            page: "1",
            limit: "2",
            includeCounts: "true",
          },
          user: technicianUser,
        },
        firstPage.response,
      );
      assert.deepEqual(
        firstPage.body.requests.map((item) => item.id),
        ["request-pd-first", "request-health-second"],
      );
      assert.deepEqual(firstPage.body.pagination, {
        total: 6,
        page: 1,
        limit: 2,
        totalPages: 3,
      });
      assert.deepEqual(firstPage.body.counts, {
        all: 6,
        ai: 2,
        health: 2,
        pregnancy: 2,
      });
      assert.ok(state.limits.insemination.every((value) => value === 2));
      assert.ok(state.limits.health.every((value) => value === 2));
      assert.ok(state.limits.task.every((value) => value === 2));

      state.limits.insemination = [];
      state.limits.health = [];
      state.limits.task = [];
      const secondPage = responseRecorder();
      await getTechnicianRequests(
        {
          query: {
            type: "all",
            assignment: "unassigned",
            sortBy: "newest",
            page: "2",
            limit: "2",
          },
          user: technicianUser,
        },
        secondPage.response,
      );
      assert.deepEqual(
        secondPage.body.requests.map((item) => item.id),
        ["request-ai-third", "request-pd-fourth"],
      );
      assert.equal(
        firstPage.body.requests.some((first) =>
          secondPage.body.requests.some((second) => second.id === first.id),
        ),
        false,
      );
      assert.ok(state.limits.insemination.every((value) => value === 4));
      assert.ok(state.limits.health.every((value) => value === 4));
      assert.ok(state.limits.task.every((value) => value === 4));
    },
  );

  await t.test(
    "My Work paginates an exact global merge with bounded source windows",
    async () => {
      const future = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);
      state.inseminations = [
        aiRecord({ _id: "ai-first", scheduledDate: future(2) }),
        aiRecord({ _id: "ai-fourth", scheduledDate: future(5) }),
      ];
      state.healthRequests = [
        {
          _id: "health-second",
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.technician,
          assignedTechnicianId: ids.technician,
          status: "scheduled",
          scheduledDate: future(3),
          requestType: "checkup",
          deletedAt: null,
          createdAt: future(-24),
        },
        {
          _id: "health-fifth",
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.technician,
          assignedTechnicianId: ids.technician,
          status: "scheduled",
          scheduledDate: future(6),
          requestType: "checkup",
          deletedAt: null,
          createdAt: future(-23),
        },
      ];
      state.tasks = [
        taskRecord({ _id: "task-third", dueDate: future(4) }),
        taskRecord({ _id: "task-sixth", dueDate: future(7) }),
      ];
      state.limits.insemination = [];
      state.limits.health = [];
      state.limits.task = [];

      const firstPage = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "active", page: "1", limit: "2" },
          user: { _id: ids.technician, role: "technician" },
        },
        firstPage.response,
      );
      assert.deepEqual(
        firstPage.body.data.map((item) => item.id),
        ["ai-first", "health-second"],
      );
      assert.deepEqual(firstPage.body.pagination, {
        total: 6,
        page: 1,
        limit: 2,
        totalPages: 3,
      });
      assert.deepEqual(firstPage.body.counts, {
        all: 6,
        ai: 2,
        health: 2,
        pregnancy: 0,
        calving: 0,
      });
      assert.ok(state.limits.insemination.every((value) => value === 2));
      assert.ok(state.limits.health.every((value) => value === 2));
      assert.ok(state.limits.task.every((value) => value === 2));

      state.limits.insemination = [];
      state.limits.health = [];
      state.limits.task = [];
      const secondPage = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "active", page: "2", limit: "2" },
          user: { _id: ids.technician, role: "technician" },
        },
        secondPage.response,
      );
      assert.deepEqual(
        secondPage.body.data.map((item) => item.id),
        ["task-third", "ai-fourth"],
      );
      assert.equal(
        firstPage.body.data.some((first) =>
          secondPage.body.data.some((second) => second.id === first.id),
        ),
        false,
      );
      assert.ok(state.limits.insemination.every((value) => value === 4));
      assert.ok(state.limits.health.every((value) => value === 4));
      assert.ok(state.limits.task.every((value) => value === 4));
    },
  );

  await t.test(
    "My Work applies service and search filters before pagination",
    async () => {
      state.inseminations = [aiRecord({ _id: "search-ai" })];
      state.healthRequests = [
        {
          _id: "search-health",
          farmerId: farmer,
          animalId: animal,
          handledBy: ids.technician,
          assignedTechnicianId: ids.technician,
          status: "scheduled",
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          requestType: "checkup",
          deletedAt: null,
          createdAt: new Date(),
        },
      ];
      state.tasks = [taskRecord({ _id: "search-task" })];

      const healthOnly = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "active", type: "health", page: "1", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
        healthOnly.response,
      );
      assert.deepEqual(
        healthOnly.body.data.map((item) => item.id),
        ["search-health"],
      );
      assert.equal(healthOnly.body.pagination.total, 1);
      assert.equal(healthOnly.body.counts.all, 3);

      const searched = responseRecorder();
      await getWorkQueue(
        {
          query: {
            workState: "active",
            type: "all",
            search: "Maria",
            page: "1",
            limit: "20",
          },
          user: { _id: ids.technician, role: "technician" },
        },
        searched.response,
      );
      assert.deepEqual(
        new Set(searched.body.data.map((item) => item.id)),
        new Set(["search-ai", "search-health", "search-task"]),
      );
      assert.equal(searched.body.pagination.total, 3);
    },
  );

  await t.test(
    "Completed Health keeps response and official-record action boundaries",
    async () => {
      const resolvedAt = new Date("2026-08-20T00:00:00.000Z");
      const completedHealth = (overrides) => ({
        _id: overrides._id,
        farmerId: farmer,
        animalId: animal,
        handledBy: ids.technician,
        assignedTechnicianId: ids.technician,
        status: "resolved",
        requestType: "checkup",
        deletedAt: null,
        createdAt: new Date("2026-08-18T00:00:00.000Z"),
        resolvedAt,
        ...overrides,
      });
      state.inseminations = [];
      state.tasks = [];
      state.healthRequests = [
        completedHealth({ _id: "advice-result", handlingMethod: "advice" }),
        completedHealth({
          _id: "pickup-result",
          handlingMethod: "office_pickup",
        }),
        completedHealth({ _id: "clinical-result", handlingMethod: "farm_visit" }),
      ];
      state.medicalRecords = [
        { _id: "medical-clinical", healthRequestId: "clinical-result" },
      ];

      const recorder = responseRecorder();
      await getWorkQueue(
        {
          query: { workState: "completed", type: "health", page: "1", limit: "20" },
          user: { _id: ids.technician, role: "technician" },
        },
        recorder.response,
      );
      const byId = new Map(recorder.body.data.map((item) => [item.id, item]));
      assert.equal(byId.get("advice-result").allowedAction, "VIEW_RESPONSE");
      assert.equal(byId.get("pickup-result").allowedAction, "VIEW_RESPONSE");
      assert.equal(byId.get("clinical-result").allowedAction, "VIEW_RECORD");
      assert.equal(
        byId.get("clinical-result").medicalRecordId,
        "medical-clinical",
      );
    },
  );
});
