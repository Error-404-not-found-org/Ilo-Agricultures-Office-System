import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

import { Task } from "../src/models/task.model.js";
import { ensureBreedingObservationFollowUpTask } from "../src/services/breeding-observation-followup.service.js";
import { ensurePostAICompletionFollowUps } from "../src/services/post-ai-followup.service.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ids = {
  insemination: new mongoose.Types.ObjectId(),
  farmer: new mongoose.Types.ObjectId(),
  technician: new mongoose.Types.ObjectId(),
  animal: new mongoose.Types.ObjectId(),
};

const legacyPolicy = async () => ({ mode: "legacy" });

const makeMemoryModels = () => {
  const tasks = [];
  const inseminationUpdates = [];

  const TaskModel = {
    async findOneAndUpdate(filter, update) {
      let task = tasks.find(
        (candidate) =>
          candidate.taskType === filter.taskType &&
          String(candidate.metadata.inseminationId) === String(ids.insemination),
      );
      if (!task) {
        task = {
          _id: new mongoose.Types.ObjectId(),
          ...update.$setOnInsert,
        };
        tasks.push(task);
      }
      return task;
    },
  };

  const InseminationModel = {
    async updateOne(filter, update) {
      inseminationUpdates.push({ filter, update });
      return { matchedCount: 1 };
    },
  };

  return { tasks, inseminationUpdates, TaskModel, InseminationModel };
};

const invoke = ({
  models,
  inseminationDate = new Date("2026-09-01T02:00:00.000Z"),
  now = new Date("2026-09-01T03:00:00.000Z"),
} = {}) =>
  ensurePostAICompletionFollowUps({
    inseminationId: ids.insemination,
    inseminationDate,
    farmerId: ids.farmer,
    technicianId: ids.technician,
    animalId: ids.animal,
    animalTag: "COW-101",
    animalSpecies: "Cattle",
    now,
    policyLoader: legacyPolicy,
    TaskModel: models.TaskModel,
    InseminationModel: models.InseminationModel,
  });

test("automatic breeding follow-up source validates against the real Task schema", async () => {
  const task = new Task({
    technicianId: ids.technician,
    farmerId: ids.farmer,
    animalIds: [ids.animal],
    taskType: "BreedingFollowUp",
    category: "Follow-up",
    priority: 2,
    notes: "Check for return-to-heat signs.",
    status: "Pending",
    dueDate: new Date("2026-09-26T02:00:00.000Z"),
    sourceType: "automatic_breeding_followup",
    relatedRecordType: "insemination",
    relatedRecordId: ids.insemination,
    metadata: { inseminationId: ids.insemination },
  });

  await task.validate();
  assert.equal(task.sourceType, "automatic_breeding_followup");
});

test("post-AI helper creates canonical PD and Day-25 tasks and links PD", async () => {
  const models = makeMemoryModels();
  const serviceDate = new Date("2026-09-01T02:00:00.000Z");

  const result = await invoke({ models, inseminationDate: serviceDate });

  assert.equal(models.tasks.length, 2);
  assert.equal(result.pdTask.taskType, "PD");
  assert.equal(result.pdTask.sourceType, "automatic_pd_followup");
  assert.equal(
    result.pdTask.metadata.workflowStage,
    "initial_confirmation",
  );
  assert.equal(result.breedingFollowUpTask.taskType, "BreedingFollowUp");
  assert.equal(
    result.breedingFollowUpTask.sourceType,
    "automatic_breeding_followup",
  );
  assert.equal(
    result.breedingFollowUpTask.dueDate.toISOString(),
    "2026-09-26T02:00:00.000Z",
  );
  assert.equal(
    String(models.inseminationUpdates[0].update.$set.verificationTaskId),
    String(result.pdTask._id),
  );
});

test("repeated post-AI helper calls reuse both lifecycle tasks", async () => {
  const models = makeMemoryModels();

  const first = await invoke({ models });
  const second = await invoke({ models });

  assert.equal(models.tasks.length, 2);
  assert.equal(String(first.pdTask._id), String(second.pdTask._id));
  assert.equal(
    String(first.breedingFollowUpTask._id),
    String(second.breedingFollowUpTask._id),
  );
});

test("historical tracking skips a Day-25 task after its due date", async () => {
  const models = makeMemoryModels();

  const result = await invoke({
    models,
    inseminationDate: new Date("2026-06-01T02:00:00.000Z"),
    now: new Date("2026-09-01T02:00:00.000Z"),
  });

  assert.equal(result.breedingFollowUpTask, null);
  assert.deepEqual(models.tasks.map((task) => task.taskType), ["PD"]);
  assert.equal(models.inseminationUpdates.length, 1);
});

test("Farmer return-to-heat reuses the active automatic breeding follow-up", async () => {
  const automaticTask = {
    _id: new mongoose.Types.ObjectId(),
    taskType: "BreedingFollowUp",
    status: "Pending",
    sourceType: "automatic_breeding_followup",
  };
  const originals = {
    findOne: Task.findOne,
    findOneAndUpdate: Task.findOneAndUpdate,
    create: Task.create,
  };
  let createCalls = 0;

  Task.findOne = async () => automaticTask;
  Task.findOneAndUpdate = async (_filter, update) => ({
    ...automaticTask,
    ...update.$set,
  });
  Task.create = async () => {
    createCalls += 1;
    return null;
  };

  try {
    const result = await ensureBreedingObservationFollowUpTask({
      request: { _id: ids.insemination },
      farmerId: ids.farmer,
      animalId: ids.animal,
      technicianId: ids.technician,
      reportType: "return_to_heat",
      signs: ["standing_heat"],
      notes: "Observed today.",
      pregnancyReadiness: { isEligible: false },
      at: new Date("2026-09-22T02:00:00.000Z"),
    });

    assert.equal(String(result.task._id), String(automaticTask._id));
    assert.equal(result.task.sourceType, "automatic_breeding_followup");
    assert.equal(result.task.priority, 1);
    assert.equal(createCalls, 0);
  } finally {
    Task.findOne = originals.findOne;
    Task.findOneAndUpdate = originals.findOneAndUpdate;
    Task.create = originals.create;
  }
});

test("direct AI controller emits the canonical completion event after service commit", () => {
  const controller = fs.readFileSync(
    path.join(root, "backend/src/controllers/technician.controllers.js"),
    "utf8",
  );
  const start = controller.indexOf("export const walkInInsemination");
  const end = controller.indexOf("export const previousInsemination", start);
  const handler = controller.slice(start, end);

  assert.match(handler, /await recordTechnicianAIService\(\{/);
  assert.match(
    handler,
    /result\.postCompletionEventRequired[\s\S]*name: "insemination\/approved"/,
  );
  assert.match(
    handler,
    /inseminationId: result\.insemination\._id[\s\S]*animalId: animal\._id[\s\S]*farmerId: farmer\._id/,
  );
});
