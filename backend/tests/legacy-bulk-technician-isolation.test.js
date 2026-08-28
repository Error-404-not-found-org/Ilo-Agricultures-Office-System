import assert from "node:assert/strict";
import test from "node:test";

import { getAllRequests } from "../src/controllers/ai-request.controllers.js";
import { getAllHealthRequests } from "../src/controllers/health-request.controllers.js";
import { getTasks } from "../src/controllers/tasks.controllers.js";
import { getMyInseminations } from "../src/controllers/technician.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";

const idOf = (value) => String(value?._id || value || "");

const fieldValue = (record, path) =>
  path.split(".").reduce((value, segment) => value?.[segment], record);

const matchesCondition = (value, condition) => {
  if (
    condition &&
    typeof condition === "object" &&
    !Array.isArray(condition)
  ) {
    if ("$exists" in condition) {
      return condition.$exists ? value !== undefined : value === undefined;
    }
    if ("$in" in condition) {
      return condition.$in.some((candidate) =>
        candidate === null
          ? value == null
          : idOf(value) === idOf(candidate),
      );
    }
  }

  if (condition === null) return value == null;
  return idOf(value) === idOf(condition);
};

const matchesFilter = (record, filter = {}) => {
  if (filter.$and && !filter.$and.every((item) => matchesFilter(record, item))) {
    return false;
  }
  if (filter.$or && !filter.$or.some((item) => matchesFilter(record, item))) {
    return false;
  }

  return Object.entries(filter)
    .filter(([key]) => !key.startsWith("$"))
    .every(([key, condition]) =>
      matchesCondition(fieldValue(record, key), condition),
    );
};

const queryResult = (records) => {
  let offset = 0;
  let maximum = Number.POSITIVE_INFINITY;
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    skip(value) {
      offset = value;
      return query;
    },
    limit(value) {
      maximum = value;
      return query;
    },
    lean() {
      return Promise.resolve(records.slice(offset, offset + maximum));
    },
    then(resolve, reject) {
      return Promise.resolve(records.slice(offset, offset + maximum)).then(
        resolve,
        reject,
      );
    },
  };
  return query;
};

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: undefined };
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

const actor = (id, role = "technician") => ({ _id: id, role });

const ids = (records) => records.map((item) => item._id).sort();

test("legacy bulk Technician reads preserve ownership isolation", async (t) => {
  const originals = {
    aiFind: Insemination.find,
    aiCount: Insemination.countDocuments,
    healthFind: HealthRequest.find,
    healthCount: HealthRequest.countDocuments,
    healthAggregate: HealthRequest.aggregate,
    taskFind: Task.find,
    configFindOne: Config.findOne,
  };

  t.after(() => {
    Insemination.find = originals.aiFind;
    Insemination.countDocuments = originals.aiCount;
    HealthRequest.find = originals.healthFind;
    HealthRequest.countDocuments = originals.healthCount;
    HealthRequest.aggregate = originals.healthAggregate;
    Task.find = originals.taskFind;
    Config.findOne = originals.configFindOne;
  });

  const aiRecords = [
    { _id: "ai-unclaimed", status: "pending", deletedAt: null },
    {
      _id: "ai-a-active",
      status: "scheduled",
      approvedBy: "tech-a",
      technicianId: "tech-a",
      deletedAt: null,
    },
    {
      _id: "ai-b-active",
      status: "scheduled",
      approvedBy: "tech-b",
      technicianId: "tech-b",
      deletedAt: null,
    },
    {
      _id: "ai-a-done",
      status: "done",
      approvedBy: "tech-a",
      technicianId: "tech-a",
      deletedAt: null,
    },
    {
      _id: "ai-conflicting-owner",
      status: "scheduled",
      approvedBy: "tech-a",
      technicianId: "tech-b",
      deletedAt: null,
    },
  ];
  const healthRecords = [
    { _id: "health-unclaimed", status: "pending", deletedAt: null },
    {
      _id: "health-a-active",
      status: "scheduled",
      handledBy: "tech-a",
      assignedTechnicianId: "tech-a",
      deletedAt: null,
    },
    {
      _id: "health-b-active",
      status: "in-progress",
      handledBy: "tech-b",
      assignedTechnicianId: "tech-b",
      deletedAt: null,
    },
    {
      _id: "health-a-resolved",
      status: "resolved",
      handledBy: "tech-a",
      assignedTechnicianId: "tech-a",
      deletedAt: null,
    },
  ];
  const taskRecords = [
    {
      _id: "task-a",
      technicianId: "tech-a",
      taskType: "GeneralVisit",
      status: "Pending",
    },
    {
      _id: "task-b",
      technicianId: "tech-b",
      taskType: "GeneralVisit",
      status: "Pending",
    },
    {
      _id: "task-unassigned",
      taskType: "GeneralVisit",
      status: "Pending",
    },
  ];

  const installAI = () => {
    Insemination.find = (filter) =>
      queryResult(aiRecords.filter((record) => matchesFilter(record, filter)));
    Insemination.countDocuments = async (filter) =>
      aiRecords.filter((record) => matchesFilter(record, filter)).length;
  };
  const installHealth = () => {
    HealthRequest.find = (filter) =>
      queryResult(
        healthRecords.filter((record) => matchesFilter(record, filter)),
      );
    HealthRequest.countDocuments = async (filter) =>
      healthRecords.filter((record) => matchesFilter(record, filter)).length;
    HealthRequest.aggregate = async ([{ $match }]) => {
      const records = healthRecords.filter((record) =>
        matchesFilter(record, $match),
      );
      return [{
        highUrgency: 0,
        resolved: records.filter((record) => record.status === "resolved")
          .length,
        active: records.filter((record) => record.status !== "resolved")
          .length,
      }];
    };
  };

  await t.test("GET /ai-request never returns another Technician's records", async () => {
    for (const [viewer, expected] of [
      [actor("tech-a"), ["ai-a-active", "ai-a-done"]],
      [actor("tech-b"), ["ai-b-active"]],
      [actor("admin-1", "admin"), aiRecords.map((item) => item._id)],
    ]) {
      installAI();
      const recorder = responseRecorder();
      await getAllRequests(
        { user: viewer, query: { page: "1", limit: "100" } },
        recorder.response,
      );
      assert.equal(recorder.statusCode, 200);
      assert.deepEqual(ids(recorder.body.data), expected.sort());
      assert.equal(recorder.body.total, expected.length);
    }
  });

  await t.test("GET /health-request never returns another Technician's records", async () => {
    for (const [viewer, expected] of [
      [actor("tech-a"), ["health-a-active", "health-a-resolved"]],
      [actor("tech-b"), ["health-b-active"]],
      [actor("admin-1", "admin"), healthRecords.map((item) => item._id)],
    ]) {
      installHealth();
      const recorder = responseRecorder();
      await getAllHealthRequests(
        { user: viewer, query: { page: "1", limit: "100" } },
        recorder.response,
      );
      assert.equal(recorder.statusCode, 200);
      assert.deepEqual(ids(recorder.body.data), expected.sort());
      assert.equal(recorder.body.total, expected.length);
    }
  });

  await t.test("Technician scope=all normalizes to mine while Admin retains all Tasks", async () => {
    Task.find = (filter) =>
      queryResult(
        taskRecords.filter((record) => matchesFilter(record, filter)),
      );
    Config.findOne = async () => null;

    const technician = responseRecorder();
    await getTasks(
      {
        user: actor("tech-a"),
        query: { scope: "all", status: "all" },
      },
      technician.response,
    );
    assert.deepEqual(ids(technician.body), ["task-a"]);

    const admin = responseRecorder();
    await getTasks(
      {
        user: actor("admin-1", "admin"),
        query: { scope: "all", status: "all" },
      },
      admin.response,
    );
    assert.deepEqual(ids(admin.body), [
      "task-a",
      "task-b",
      "task-unassigned",
    ]);
  });

  await t.test("GET /technician/inseminations means current Technician-owned AI work/history", async () => {
    for (const [viewer, expected] of [
      [actor("tech-a"), ["ai-a-active", "ai-a-done"]],
      [actor("tech-b"), ["ai-b-active"]],
      [actor("admin-1", "admin"), aiRecords.map((item) => item._id)],
    ]) {
      installAI();
      const recorder = responseRecorder();
      await getMyInseminations(
        { user: viewer, query: { page: "1", limit: "100" } },
        recorder.response,
      );
      assert.equal(recorder.statusCode, 200);
      assert.deepEqual(ids(recorder.body.inseminations), expected.sort());
      assert.equal(recorder.body.pagination.total, expected.length);
      assert.equal(recorder.body.summary.totalCycles, expected.length);
    }
  });
});
