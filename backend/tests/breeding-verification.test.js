import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { User } from "../src/models/user.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import { Notification } from "../src/models/notification.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { inngest } from "../src/config/inngest.js";
import { verifyFarmerBreedingObservation } from "../src/controllers/ai-request.controllers.js";

function createMockRes() {
  let statusVal = 200;
  let jsonVal = null;
  return {
    status(code) {
      statusVal = code;
      return this;
    },
    json(data) {
      jsonVal = data;
      return this;
    },
    get statusVal() {
      return statusVal;
    },
    get jsonVal() {
      return jsonVal;
    },
  };
}

function installVerificationStubs({ result, hasTask = true }) {
  const originals = new Map();
  const replace = (target, key, value) => {
    originals.set(`${target.modelName || target.constructor?.name}:${key}`, [
      target,
      key,
      target[key],
    ]);
    target[key] = value;
  };

  const insemination = {
    _id: "insem-1",
    farmerId: "farmer-1",
    animalId: "animal-1",
    inseminationDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
    status: "done",
    verificationStatus: "pending",
    verificationTaskId: hasTask ? "task-1" : null,
    statusHistory: [],
  };
  const animal = {
    _id: "animal-1",
    farmerId: "farmer-1",
    animalId: "COW-1",
    earTag: "TAG-1",
    species: "Cattle",
    breed: "Brahman",
    reproductiveStatus: "Likely Pregnant",
    activityLogs: [],
  };
  const task = { _id: "task-1", status: "Pending", notes: "", metadata: {} };
  const followupTask = { _id: "task-2", taskType: "BreedingFollowUp", status: "Pending", notes: "" };
  let pregnancy = null;
  let tasksCreated = 0;
  let followUpTasksClosed = 0;

  replace(Insemination, "findOne", () => ({
    populate: () => Promise.resolve(insemination),
  }));
  replace(Animal, "findById", () => Promise.resolve(animal));
  replace(mongoose, "startSession", async () => ({
    withTransaction: async (work) => work(),
    endSession: async () => {},
  }));
  replace(Pregnancy, "findOne", () => ({
    session: async () => null,
  }));
  replace(Pregnancy, "create", async ([data]) => {
    pregnancy = { _id: "pregnancy-1", ...data };
    return [pregnancy];
  });
  replace(Insemination, "findOneAndUpdate", async (_query, update) => {
    Object.assign(insemination, update.$set || {});
    if (update.$push?.statusHistory) {
      insemination.statusHistory.push(update.$push.statusHistory);
    }
    return insemination;
  });
  replace(Insemination, "updateOne", async (_query, update) => {
    Object.assign(insemination, update.$set || {});
    return { modifiedCount: 1 };
  });
  replace(Animal, "findByIdAndUpdate", async (_id, update) => {
    Object.assign(animal, update.$set || {});
    if (update.$push?.activityLogs) {
      animal.activityLogs.push(update.$push.activityLogs);
    }
    return animal;
  });
  replace(Task, "findOneAndUpdate", async (_query, update) => {
    if (_query._id !== task._id) return null;
    for (const [key, value] of Object.entries(update.$set || {})) {
      if (key.includes(".")) {
        const parts = key.split(".");
        let obj = task;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        task[key] = value;
      }
    }
    return task;
  });
  replace(Task, "create", async ([data]) => {
    tasksCreated++;
    Object.assign(task, data);
    return [task];
  });
  replace(Task, "find", (query) => {
    return {
      session: async () => {
        if (query.taskType === "BreedingFollowUp") {
          return [followupTask];
        }
        return [];
      }
    };
  });
  replace(Task, "updateOne", async (_query, update) => {
    if (_query._id === "task-2" && update.$set?.status === "Cancelled") {
      followUpTasksClosed++;
    }
    return { modifiedCount: 1 };
  });
  replace(User, "findById", async () => ({ _id: "farmer-1" }));
  replace(Notification, "create", async () => ({}));
  replace(AuditLog, "create", async () => ({}));
  replace(AnimalTimelineEvent, "create", async () => ({}));
  replace(inngest, "send", async () => ({}));

  return {
    insemination,
    animal,
    task,
    get pregnancy() {
      return pregnancy;
    },
    get tasksCreated() {
      return tasksCreated;
    },
    get followUpTasksClosed() {
      return followUpTasksClosed;
    },
    restore() {
      for (const [, [target, key, original]] of originals) target[key] = original;
    },
    req: {
      params: { id: "insem-1" },
      user: { _id: "tech-1", role: "technician", name: "Tech Tom" },
      body: {
        verificationResult: result,
        checkMethod: result === "return_to_heat" ? "visual_observation" : "ultrasound",
        technicianNotes: "Field verification completed.",
        taskId: "task-1",
        ...(result === "needs_recheck"
          ? { nextCheckDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() }
          : {}),
      },
    },
  };
}

test("Breeding Verification: farmer cannot verify breeding observation", async () => {
  const req = {
    params: { id: "insem-1" },
    user: { _id: "farmer-1", role: "farmer" },
    body: { verificationResult: "pregnant", checkMethod: "palpation" },
  };
  const res = createMockRes();
  await verifyFarmerBreedingObservation(req, res);
  assert.equal(res.statusVal, 403);
  assert.equal(res.jsonVal.code, "UNAUTHORIZED_VERIFICATION");
});

test("Breeding Verification: pregnant routes through the unified official diagnosis service", () => {
  const source = verifyFarmerBreedingObservation.toString();
  assert.match(source, /officialDiagnosis/);
  assert.match(source, /confirmPregnancyDiagnosis\(\{/);
  assert.match(source, /result: verificationResult/);
  assert.match(source, /methodCode: normalizedMethodCode/);
  assert.match(source, /confirmation\.alreadyRecorded/);
  assert.match(source, /verificationResult === "pregnant" && !alreadyRecorded/);
  assert.match(source, /PREGNANCY_DIAGNOSIS_RECONCILED/);
});

test("Breeding Verification: negative diagnosis shares the official service and does not set heat", () => {
  const source = verifyFarmerBreedingObservation.toString();
  assert.match(source, /\["pregnant", "not_pregnant"\]/);
  assert.doesNotMatch(source, /not_pregnant[\s\S]{0,200}In Heat/);
});

test("Breeding Verification: return to heat closes the attempt without inventing a diagnosis", async () => {
  const state = installVerificationStubs({ result: "return_to_heat" });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    assert.equal(state.insemination.isSuccess, false);
    assert.equal(state.insemination.outcome, "Failed (Re-heat)");
    assert.equal(state.animal.reproductiveStatus, "In Heat");
    assert.equal(state.pregnancy, null);
    assert.equal(state.task.status, "Completed");
  } finally {
    state.restore();
  }
});

test("Breeding Verification: recheck stays pending and reschedules the task (explicit taskId)", async () => {
  const state = installVerificationStubs({ result: "needs_recheck", hasTask: true });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    // AI attempt remains pending
    assert.equal(state.insemination.verificationStatus, "pending");
    // Animal reproductive status remains unchanged
    assert.equal(state.animal.reproductiveStatus, "Likely Pregnant");
    // Task is mutated to stay Pending with a new due date
    assert.equal(state.task._id, "task-1");
    assert.equal(state.task.status, "Pending");
    assert.match(state.task.notes, /Recheck Required/);
    assert.equal(state.task.metadata.workflowStage, "diagnostic_follow_up");
    assert.ok(state.task.dueDate instanceof Date);
    assert.equal(state.task.dueDate.toISOString(), new Date(state.req.body.nextCheckDate).toISOString());
    // No duplicate tasks created
    assert.equal(state.tasksCreated, 0);
    // Associated BreedingFollowUp is closed
    assert.equal(state.followUpTasksClosed, 1);
  } finally {
    state.restore();
  }
});

test("Breeding Verification: Missing verificationTaskId + valid explicit taskId reuses task and heals link", async () => {
  const state = installVerificationStubs({ result: "needs_recheck", hasTask: false });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    assert.equal(state.task._id, "task-1");
    assert.equal(state.task.status, "Pending");
    assert.equal(state.task.metadata.workflowStage, "diagnostic_follow_up");
    assert.equal(state.tasksCreated, 0);
    assert.equal(state.followUpTasksClosed, 1);
    // Heals the missing link
    assert.equal(state.insemination.verificationTaskId, "task-1");
  } finally {
    state.restore();
  }
});

test("Breeding Verification: needs_recheck without checkMethod throws INVALID_CHECK_METHOD", async () => {
  const state = installVerificationStubs({ result: "needs_recheck" });
  state.req.body.checkMethod = "";
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 400);
    assert.equal(res.jsonVal.code, "INVALID_CHECK_METHOD");
  } finally {
    state.restore();
  }
});
