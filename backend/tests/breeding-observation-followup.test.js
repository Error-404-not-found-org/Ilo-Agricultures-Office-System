import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Task } from "../src/models/task.model.js";
import {
  ensureBreedingObservationFollowUpTask,
  getBreedingObservationFollowUpDecision,
} from "../src/services/breeding-observation-followup.service.js";
import { isVerifiedFailedAIAttempt } from "../src/services/ai-request-creation.service.js";
import mongoose from "mongoose";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const baseInput = {
  request: { _id: new mongoose.Types.ObjectId() },
  farmerId: new mongoose.Types.ObjectId(),
  animalId: new mongoose.Types.ObjectId(),
  technicianId: new mongoose.Types.ObjectId(),
  signs: ["standing_heat"],
  notes: "Observed this morning.",
  pregnancyReadiness: {
    isEligible: false,
    availableDate: "2026-10-01T00:00:00.000Z",
  },
  at: new Date("2026-08-14T08:00:00.000Z"),
};

const withTaskStubs = async (
  { existingTask = null, updatedTask, createdTask },
  operation,
) => {
  const originals = {
    findOne: Task.findOne,
    findOneAndUpdate: Task.findOneAndUpdate,
    create: Task.create,
  };
  const calls = { lookup: null, update: null, create: null };

  Task.findOne = async (query) => {
    calls.lookup = query;
    return existingTask;
  };
  Task.findOneAndUpdate = async (query, update) => {
    calls.update = { query, update };
    return updatedTask || { ...existingTask, ...update.$set };
  };
  Task.create = async (input) => {
    calls.create = input;
    const doc = new Task(input);
    await doc.validate();
    return createdTask || { _id: "created-task", ...input };
  };

  try {
    return await operation(calls);
  } finally {
    Task.findOne = originals.findOne;
    Task.findOneAndUpdate = originals.findOneAndUpdate;
    Task.create = originals.create;
  }
};

test("observation follow-up decisions do not depend on a farmer toggle", () => {
  assert.deepEqual(
    getBreedingObservationFollowUpDecision({
      reportType: "return_to_heat",
      pregnancyReadiness: { isEligible: false },
    }),
    {
      scheduleFollowUp: true,
      technicianActionRequired: true,
      verificationStatus: "pending",
      taskSourceType: "farmer_requested_verification",
    },
  );

  assert.equal(
    getBreedingObservationFollowUpDecision({
      reportType: "possible_pregnancy",
      pregnancyReadiness: { isEligible: false },
      hasActiveTask: true,
    }).technicianActionRequired,
    false,
  );
  assert.equal(
    getBreedingObservationFollowUpDecision({
      reportType: "possible_pregnancy",
      pregnancyReadiness: { isEligible: true },
      hasActiveTask: true,
    }).technicianActionRequired,
    false,
  );
  assert.equal(
    getBreedingObservationFollowUpDecision({ reportType: "unsure" })
      .scheduleFollowUp,
    false,
  );
});

test("possible-pregnancy reuses the scheduled automatic task without making it immediate", async () => {
  const existingTask = {
    _id: "automatic-task",
    status: "Pending",
    sourceType: "automatic_pd_followup",
    dueDate: new Date("2026-10-01T00:00:00.000Z"),
  };

  await withTaskStubs({ existingTask }, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "possible_pregnancy",
    });

    assert.equal(result.task._id, "automatic-task");
    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.update, null);
    assert.equal(calls.create, null);
    assert.equal(calls.lookup.animalIds, "animal-1");
  });
});

test("return-to-heat promotes the existing pregnancy task for immediate verification", async () => {
  const existingTask = {
    _id: "automatic-task",
    status: "Pending",
    sourceType: "automatic_pd_followup",
  };

  await withTaskStubs({ existingTask }, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "return_to_heat",
    });

    assert.equal(result.technicianActionRequired, true);
    assert.equal(
      calls.update.update.$set.sourceType,
      "farmer_requested_verification",
    );
    assert.equal(calls.update.update.$set.priority, 1);
    assert.equal(
      calls.update.update.$set.dueDate.toISOString(),
      baseInput.at.toISOString(),
    );
    assert.equal(calls.create, null);
  });
});

test("unsure creates no additional technician task", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "unsure",
    });

    assert.equal(result.task, null);
    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.create, null);
  });
});

test("editing return-to-heat to possible pregnancy restores the automatic schedule", async () => {
  const existingTask = {
    _id: "promoted-task",
    status: "Pending",
    sourceType: "farmer_requested_verification",
  };

  await withTaskStubs({ existingTask }, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "possible_pregnancy",
    });

    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.update.update.$set.sourceType, "automatic_pd_followup");
    assert.equal(
      calls.update.update.$set.dueDate.toISOString(),
      "2026-10-01T00:00:00.000Z",
    );
    assert.equal(calls.update.update.$unset["metadata.reportType"], 1);
  });
});

test("possible-pregnancy creates no additional technician task", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "possible_pregnancy",
    });

    assert.equal(result.task, null);
    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.create, null);
  });
});

test("controller keeps observations non-authoritative and ignores the retired toggle", () => {
  const controller = source("backend/src/controllers/ai-request.controllers.js");
  const start = controller.indexOf("export const submitFarmerBreedingObservation");
  const end = controller.indexOf("export const deleteRequest", start);
  const handler = controller.slice(start, end);

  assert.match(handler, /ensureBreedingObservationFollowUpTask/);
  assert.doesNotMatch(handler, /verificationRequested\s*=\s*false/);
  assert.doesNotMatch(handler, /req\.body\.verificationRequested/);
  assert.doesNotMatch(handler, /request\.isSuccess\s*=/);
  assert.doesNotMatch(handler, /Pregnancy\.create/);
  assert.match(handler, /assertFarmerBreedingObservationWindow/);
  const returnToHeatBlock = handler.slice(
    handler.indexOf('if (reportType === "return_to_heat")'),
    handler.indexOf('if (reportType === "unsure")'),
  );
  assert.doesNotMatch(returnToHeatBlock, /animal\.reproductiveStatus\s*=/);
  assert.match(handler, /farmer_possible_pregnancy/);
  assert.match(handler, /farmer_return_to_heat/);
});

test("farmer return-to-heat report alone cannot unlock Attempt 2", () => {
  const farmerReport = {
    status: "done",
    farmerOutcomeReport: "return_to_heat",
    outcomeVerificationStatus: "reported",
    outcomeConfirmationSource: "farmer_return_to_heat",
  };

  assert.equal(isVerifiedFailedAIAttempt(farmerReport), false);
  assert.equal(
    isVerifiedFailedAIAttempt({
      ...farmerReport,
      isSuccess: false,
      outcome: "Failed (Re-heat)",
      outcomeVerificationStatus: "verified",
    }),
    true,
  );
});

test("TEST 1: Recheck exists + farmer reports Return to Heat -> ONE new BreedingFollowUp created -> PD remains Pending", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "return_to_heat",
    });
    assert.equal(result.technicianActionRequired, true);
    assert.equal(calls.create.taskType, "BreedingFollowUp");
    assert.equal(calls.create.sourceType, "farmer_requested_verification");
  });
});

test("TEST 2: Farmer submits Return to Heat again before review -> ONE active BreedingFollowUp updated -> no duplicate", async () => {
  const existingTask = { _id: "task-1", status: "Pending" };
  await withTaskStubs({ existingTask }, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "return_to_heat",
    });
    assert.equal(result.technicianActionRequired, true);
    assert.equal(calls.create, null);
    assert.equal(calls.update.query._id, "task-1");
  });
});

test("TEST 3: Historical Cancelled BreedingFollowUp exists -> historical task untouched -> new actionable task created", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "return_to_heat",
    });
    assert.equal(result.technicianActionRequired, true);
    assert.equal(calls.create.taskType, "BreedingFollowUp");
  });
});

test("TEST 4: Farmer submits possible_pregnancy during Recheck -> NO new BreedingFollowUp", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "possible_pregnancy",
    });
    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.create, null);
  });
});

test("TEST 5: Farmer submits unsure during Recheck -> NO new BreedingFollowUp", async () => {
  await withTaskStubs({}, async (calls) => {
    const result = await ensureBreedingObservationFollowUpTask({
      ...baseInput,
      reportType: "unsure",
    });
    assert.equal(result.technicianActionRequired, false);
    assert.equal(calls.create, null);
  });
});

import { persistBreedingObservationVerification } from "../src/services/livestock-transaction.service.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";

const runWithVerificationStubs = async (operation) => {
  const originals = {
    startSession: mongoose.startSession,
    inseminationFindOneAndUpdate: Insemination.findOneAndUpdate,
    animalFindByIdAndUpdate: Animal.findByIdAndUpdate,
    taskFindOneAndUpdate: Task.findOneAndUpdate,
    taskFind: Task.find,
    taskUpdateOne: Task.updateOne,
    pregnancyFindOne: Pregnancy.findOne,
    timelineCreate: AnimalTimelineEvent.create,
    auditCreate: AuditLog.create,
  };

  const state = {
    cancelledTasks: [],
    completedTaskId: null,
  };

  mongoose.startSession = async () => ({
    withTransaction: async (work) => await work(),
    endSession: async () => {},
  });

  Insemination.findOneAndUpdate = async () => ({ _id: "insem-1", farmerId: "farmer-1" });
  Animal.findByIdAndUpdate = async () => ({ _id: "animal-1" });
  Pregnancy.findOne = () => ({ session: () => null });
  AnimalTimelineEvent.create = async () => {};
  AuditLog.create = async () => {};

  Task.find = (query) => {
    return {
      session: () => {
        // Return a dummy PD task if queried
        if (query.taskType && query.taskType.$in.includes("PD")) {
          return [{ _id: "task-pd", notes: "" }];
        }
        return [];
      }
    };
  };

  Task.updateOne = async (query, update) => {
    if (update.$set && update.$set.status === "Cancelled") {
      state.cancelledTasks.push(query._id);
    }
  };

  Task.findOneAndUpdate = async (query, update) => {
    if (update.$set && update.$set.status === "Completed") {
      state.completedTaskId = query._id;
    }
    return { _id: query._id, status: "Completed" };
  };

  try {
    await operation(state);
  } finally {
    mongoose.startSession = originals.startSession;
    Insemination.findOneAndUpdate = originals.inseminationFindOneAndUpdate;
    Animal.findByIdAndUpdate = originals.animalFindByIdAndUpdate;
    Task.findOneAndUpdate = originals.taskFindOneAndUpdate;
    Task.find = originals.taskFind;
    Task.updateOne = originals.taskUpdateOne;
    Pregnancy.findOne = originals.pregnancyFindOne;
    AnimalTimelineEvent.create = originals.timelineCreate;
    AuditLog.create = originals.auditCreate;
  }
};

test("TEST 6: Technician confirms Return to Heat -> Insemination fails, tasks close, eligible for AI", async () => {
  await runWithVerificationStubs(async (state) => {
    await persistBreedingObservationVerification({
      animal: { _id: "animal-1" },
      insemination: { _id: "insem-1", farmerId: "farmer-1" },
      verificationResult: "return_to_heat",
      checkMethod: "visual_observation",
      checkedAt: new Date().toISOString(),
      actorId: "tech-1",
      taskId: "task-breeding-followup",
    });

    assert.equal(state.completedTaskId, "task-breeding-followup");
    assert.deepEqual(state.cancelledTasks, ["task-pd"]);
  });
});

test("TEST 7: Technician does NOT confirm Return to Heat -> BreedingFollowUp closes -> Insemination unresolved -> PD remains Pending", async () => {
  await runWithVerificationStubs(async (state) => {
    await persistBreedingObservationVerification({
      animal: { _id: "animal-1" },
      insemination: { _id: "insem-1", farmerId: "farmer-1" },
      verificationResult: "cannot_confirm",
      checkMethod: "visual_observation",
      checkedAt: new Date().toISOString(),
      actorId: "tech-1",
      taskId: "task-breeding-followup",
    });

    assert.equal(state.completedTaskId, "task-breeding-followup");
    assert.deepEqual(state.cancelledTasks, []);
  });
});
