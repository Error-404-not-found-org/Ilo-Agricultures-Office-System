import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { getUpcomingVisits } from "../src/controllers/ai-request.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";
import { getTasks } from "../src/controllers/tasks.controllers.js";

const responseRecorder = () => {
  const state = { statusCode: 200, body: null };
  state.response = {
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
  return state;
};

const populatedResult = (items) => ({
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  populate() {
    return this;
  },
  lean: async () => items,
});

test("Farmer upcoming visits uses canonical scheduled filters in one combined handler", async () => {
  const originals = {
    aiFind: Insemination.find,
    healthFind: HealthRequest.find,
  };
  let aiFilter;
  let healthFilter;
  const scheduledDate = new Date("2026-08-24T00:00:00.000Z");
  Insemination.find = (filter) => {
    aiFilter = filter;
    return populatedResult([
      {
        _id: "ai-visit",
        status: "scheduled",
        scheduledDate,
        visitPeriod: "morning",
        approvedBy: { name: "Tech One" },
        createdAt: new Date("2026-08-20T00:00:00.000Z"),
      },
    ]);
  };
  HealthRequest.find = (filter) => {
    healthFilter = filter;
    return populatedResult([
      {
        _id: "health-visit",
        status: "in-progress",
        scheduledDate,
        visitPeriod: "afternoon",
        handledBy: { name: "Tech Two" },
        createdAt: new Date("2026-08-21T00:00:00.000Z"),
      },
    ]);
  };

  const recorder = responseRecorder();
  try {
    await getUpcomingVisits(
      { user: { _id: "farmer-1", role: "farmer" } },
      recorder.response,
    );

    assert.deepEqual(aiFilter.status.$in, ["scheduled", "in-progress"]);
    assert.deepEqual(healthFilter.status.$in, [
      "scheduled",
      "in-progress",
      "in_progress",
    ]);
    assert.deepEqual(healthFilter.handlingMethod.$nin, [
      "advice",
      "office_pickup",
    ]);
    assert.equal(recorder.body.total, 2);
    assert.equal(recorder.body.data[0].scheduledDate, scheduledDate);
    assert.equal(recorder.body.data[1].visitPeriod, "afternoon");
  } finally {
    Insemination.find = originals.aiFind;
    HealthRequest.find = originals.healthFind;
  }
});

test("Task list bulk-loads linked Inseminations for all pregnancy tasks", async () => {
  const originals = {
    taskFind: Task.find,
    aiFind: Insemination.find,
    configFindOne: Config.findOne,
  };
  const tasks = [
    {
      _id: "task-one",
      taskType: "PD",
      metadata: { inseminationId: "ai-one" },
      animalIds: [{ species: "Cattle" }],
    },
    {
      _id: "task-two",
      taskType: "PD",
      metadata: { inseminationId: "ai-two" },
      animalIds: [{ species: "Cattle" }],
    },
  ];
  Task.find = () => {
    const query = {
      populate() {
        return query;
      },
      sort() {
        return query;
      },
      skip() {
        return query;
      },
      limit() {
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve(tasks).then(resolve, reject);
      },
    };
    return query;
  };
  let inseminationFindCalls = 0;
  let bulkFilter;
  Insemination.find = (filter) => {
    inseminationFindCalls += 1;
    bulkFilter = filter;
    return {
      lean: async () => [
        { _id: "ai-one", status: "done" },
        { _id: "ai-two", status: "done" },
      ],
    };
  };
  Config.findOne = async () => null;

  const recorder = responseRecorder();
  try {
    await getTasks(
      { user: { _id: "tech-1" }, query: { scope: "mine" } },
      recorder.response,
    );

    assert.equal(inseminationFindCalls, 1);
    assert.deepEqual(bulkFilter.$or[0]._id.$in, ["ai-one", "ai-two"]);
    assert.equal(recorder.body.length, 2);
    assert.ok(recorder.body.every((task) => task.pregnancyReadiness));
  } finally {
    Task.find = originals.taskFind;
    Insemination.find = originals.aiFind;
    Config.findOne = originals.configFindOne;
  }
});

test("Technician Requests polling uses one list request with consolidated counts", () => {
  const hookSource = readFileSync(
    new URL(
      "../../mobile/features/technician-requests/hooks/useTechnicianRequests.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal((hookSource.match(/useQuery\s*\(\s*\{/g) || []).length, 1);
  assert.match(hookSource, /includeCounts:\s*true/);
  assert.doesNotMatch(hookSource, /Promise\.all\s*\(/);
  assert.doesNotMatch(hookSource, /countQueries|openCountQuery|mineCountQuery/);
});
