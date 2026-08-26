import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";
import { getTasks, claimTask, completeTask } from "../src/controllers/tasks.controllers.js";

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

test("Tasks Phase 3: getTasks queries by scope=mine", async () => {
  const originalFind = Task.find;
  const originalConfigFindOne = Config.findOne;
  Config.findOne = () => Promise.resolve(null);

  let capturedQuery = null;
  Task.find = (query) => {
    capturedQuery = query;
    return {
      populate() {
        return {
          populate() {
            return {
              sort() {
                return Promise.resolve([]);
              }
            };
          }
        };
      }
    };
  };

  const req = {
    user: { _id: "tech-1" },
    query: { scope: "mine" }
  };
  const res = createMockRes();

  await getTasks(req, res);

  assert.deepEqual(capturedQuery, {
    technicianId: "tech-1",
    status: "Pending"
  });

  // Restore
  Task.find = originalFind;
  Config.findOne = originalConfigFindOne;
});

test("Tasks Phase 3: getTasks queries by scope=available", async () => {
  const originalFind = Task.find;
  const originalConfigFindOne = Config.findOne;
  Config.findOne = () => Promise.resolve(null);

  let capturedQuery = null;
  Task.find = (query) => {
    capturedQuery = query;
    return {
      populate() {
        return {
          populate() {
            return {
              sort() {
                return Promise.resolve([]);
              }
            };
          }
        };
      }
    };
  };

  const req = {
    user: { _id: "tech-1" },
    query: { scope: "available" }
  };
  const res = createMockRes();

  await getTasks(req, res);

  assert.equal(capturedQuery.status, "Pending");
  assert.deepEqual(capturedQuery.technicianId, { $in: [null, undefined] });
  assert.ok(Array.isArray(capturedQuery.$or));
  assert.ok(capturedQuery.$or[0].taskType.$nin.includes("AI"));
  assert.deepEqual(capturedQuery.$or[1], {
    taskType: "PD",
    sourceType: "farmer_requested_verification"
  });

  // Restore
  Task.find = originalFind;
  Config.findOne = originalConfigFindOne;
});

test("Tasks Phase 3: claimTask atomically updates and claims unassigned task", async () => {
  const originalFindOneAndUpdate = Task.findOneAndUpdate;

  let capturedQuery = null;
  let capturedUpdate = null;

  Task.findOneAndUpdate = (query, update, options) => {
    capturedQuery = query;
    capturedUpdate = update;
    return Promise.resolve({ _id: "task-1", technicianId: "tech-1" });
  };

  const req = {
    params: { id: "task-1" },
    user: { _id: "tech-1", role: "technician" }
  };
  const res = createMockRes();

  await claimTask(req, res);

  assert.equal(res.statusVal, 200);
  assert.equal(capturedQuery._id, "task-1");
  assert.deepEqual(capturedQuery.technicianId, { $in: [null, undefined] });
  assert.equal(capturedQuery.status, "Pending");
  assert.deepEqual(capturedQuery.taskType, { $in: ["GeneralVisit", "FarmInspection", "Registration", "Other"] });
  assert.deepEqual(capturedQuery.sourceType, { $in: ["manual", "client_profile", "task_scheduler"] });
  assert.equal(capturedUpdate.$set.technicianId, "tech-1");

  // Restore
  Task.findOneAndUpdate = originalFindOneAndUpdate;
});

test("Tasks Phase 3: claimTask returns 409 conflict if already claimed", async () => {
  const originalFindOneAndUpdate = Task.findOneAndUpdate;

  Task.findOneAndUpdate = () => Promise.resolve(null);

  const req = {
    params: { id: "task-1" },
    user: { _id: "tech-1", role: "technician" }
  };
  const res = createMockRes();

  await claimTask(req, res);

  assert.equal(res.statusVal, 409);
  assert.equal(res.jsonVal.code, "TASK_ALREADY_CLAIMED");

  // Restore
  Task.findOneAndUpdate = originalFindOneAndUpdate;
});

test("Tasks Phase 3: completeTask rejects official service task completion without related record", async () => {
  const originalFindOne = Task.findOne;

  Task.findOne = () => Promise.resolve({
    _id: "task-1",
    taskType: "AI",
    status: "Pending"
  });

  const req = {
    params: { id: "task-1" },
    user: { _id: "tech-1", role: "technician" },
    body: {}
  };
  const res = createMockRes();

  await completeTask(req, res);

  assert.equal(res.statusVal, 400);
  assert.equal(res.jsonVal.code, "OFFICIAL_SERVICE_WORKFLOW_REQUIRED");
  assert.match(res.jsonVal.message, /dedicated workflow/);

  // Restore
  Task.findOne = originalFindOne;
});

test("Tasks Phase 3: PD task cannot bypass the pregnancy workflow with supplied record IDs", async () => {
  const originalFindOne = Task.findOne;
  const originalFindOneAndUpdate = Task.findOneAndUpdate;
  let updateCalled = false;

  Task.findOne = () => Promise.resolve({
    _id: "task-pd-1",
    taskType: "PD",
    status: "Pending",
    technicianId: "tech-1",
  });
  Task.findOneAndUpdate = async () => {
    updateCalled = true;
    return null;
  };

  try {
    const req = {
      params: { id: "task-pd-1" },
      user: { _id: "tech-1", role: "technician" },
      body: {
        relatedRecordType: "pregnancy",
        relatedRecordId: "507f1f77bcf86cd799439001",
      },
    };
    const res = createMockRes();

    await completeTask(req, res);

    assert.equal(res.statusVal, 400);
    assert.equal(res.jsonVal.code, "OFFICIAL_SERVICE_WORKFLOW_REQUIRED");
    assert.equal(updateCalled, false);
  } finally {
    Task.findOne = originalFindOne;
    Task.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
