import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/models/task.model.js";
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
});

test("Tasks Phase 3: getTasks queries by scope=available", async () => {
  const originalFind = Task.find;

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
  assert.ok(capturedQuery.taskType && capturedQuery.taskType.$nin);

  // Restore
  Task.find = originalFind;
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
    user: { _id: "tech-1" }
  };
  const res = createMockRes();

  await claimTask(req, res);

  assert.equal(res.statusVal, 200);
  assert.equal(capturedQuery._id, "task-1");
  assert.deepEqual(capturedQuery.technicianId, { $in: [null, undefined] });
  assert.equal(capturedQuery.status, "Pending");
  assert.equal(capturedUpdate.$set.technicianId, "tech-1");

  // Restore
  Task.findOneAndUpdate = originalFindOneAndUpdate;
});

test("Tasks Phase 3: claimTask returns 409 conflict if already claimed", async () => {
  const originalFindOneAndUpdate = Task.findOneAndUpdate;

  Task.findOneAndUpdate = () => Promise.resolve(null);

  const req = {
    params: { id: "task-1" },
    user: { _id: "tech-1" }
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
    user: { _id: "tech-1" },
    body: {}
  };
  const res = createMockRes();

  await completeTask(req, res);

  assert.equal(res.statusVal, 400);
  assert.match(res.jsonVal.message, /must be completed through its official service form/);

  // Restore
  Task.findOne = originalFindOne;
});
