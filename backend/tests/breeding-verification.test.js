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
  const task = { _id: "task-1", status: "Pending", notes: "" };
  let pregnancy = null;

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
    Object.assign(task, update.$set || {});
    return task;
  });
  replace(Task, "create", async ([data]) => {
    Object.assign(task, data);
    return [task];
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

test("Breeding Verification: pregnant creates the official diagnosis atomically", async () => {
  const state = installVerificationStubs({ result: "pregnant" });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    assert.equal(state.insemination.verificationStatus, "verified");
    assert.equal(state.insemination.isSuccess, true);
    assert.equal(state.animal.reproductiveStatus, "Pregnant");
    assert.equal(state.pregnancy.pregnancyDiagnosis.result, "Pregnant");
    assert.equal(state.task.status, "Completed");
  } finally {
    state.restore();
  }
});

test("Breeding Verification: negative diagnosis creates an Empty record and closes the attempt", async () => {
  const state = installVerificationStubs({ result: "not_pregnant" });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    assert.equal(state.insemination.isSuccess, false);
    assert.equal(state.insemination.outcome, "Failed (Negative PD)");
    assert.equal(state.animal.reproductiveStatus, "Normal");
    assert.equal(state.pregnancy.pregnancyDiagnosis.result, "Empty");
    assert.equal(state.task.status, "Completed");
  } finally {
    state.restore();
  }
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

test("Breeding Verification: recheck stays pending and reschedules the task", async () => {
  const state = installVerificationStubs({ result: "needs_recheck" });
  const res = createMockRes();
  try {
    await verifyFarmerBreedingObservation(state.req, res);
    assert.equal(res.statusVal, 200);
    assert.equal(state.insemination.verificationStatus, "pending");
    assert.equal(state.animal.reproductiveStatus, "Likely Pregnant");
    assert.equal(state.task.status, "Pending");
    assert.match(state.task.notes, /Recheck Required/);
    assert.ok(state.task.dueDate instanceof Date);
  } finally {
    state.restore();
  }
});
