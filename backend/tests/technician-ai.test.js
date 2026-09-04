import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Animal } from "../src/models/animal.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";
import { Task } from "../src/models/task.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Config } from "../src/models/config.model.js";
import {
  completeInsemination,
  recordTechnicianAIService,
} from "../src/services/livestock-transaction.service.js";
import { AppError } from "../src/utils/app-error.js";

const ids = {
  farmer: "507f1f77bcf86cd799439001",
  animal: "507f1f77bcf86cd799439002",
  technician: "507f1f77bcf86cd799439003",
  task: "507f1f77bcf86cd799439004",
  request: "507f1f77bcf86cd799439005",
  newInsemination: "507f1f77bcf86cd799439006",
};

const baseAnimal = {
  _id: ids.animal,
  farmerId: ids.farmer,
  gender: "Female",
  birthDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000), // 3 years old
  species: "Cattle",
  breed: "Brahman",
  reproductiveStatus: "Normal",
};

const baseTask = {
  _id: ids.task,
  farmerId: ids.farmer,
  animalIds: [ids.animal],
  taskType: "AI",
  status: "Pending",
  technicianId: null,
  metadata: {},
};

const baseInsemination = {
  _id: ids.request,
  farmerId: ids.farmer,
  animalId: ids.animal,
  status: "pending",
  approvedBy: ids.technician,
  technicianId: ids.technician,
  inseminationDate: null,
  technicianNote: "",
  attemptNumber: 3,
  previousAttemptId: "507f1f77bcf86cd799439007",
  attemptSeriesId: "507f1f77bcf86cd799439008",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
};

const query = (value) => {
  const result = {
    session() { return result; },
    select() { return result; },
    populate() { return result; },
    sort() { return result; },
    lean() { return result; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return result;
};

const installHarness = (overrides = {}) => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    animalFindById: Animal.findById,
    animalUpdate: Animal.findByIdAndUpdate,
    inseminationFindOne: Insemination.findOne,
    inseminationFindById: Insemination.findById,
    inseminationFindOneAndUpdate: Insemination.findOneAndUpdate,
    inseminationCreate: Insemination.create,
    inseminationUpdateOne: Insemination.updateOne,
    taskFindById: Task.findById,
    taskFindOne: Task.findOne,
    taskFind: Task.find,
    taskFindOneAndUpdate: Task.findOneAndUpdate,
    taskUpdateOne: Task.updateOne,
    pregnancyFindOne: Pregnancy.findOne,
    configFindOne: Config.findOne,
    notificationCreate: Notification.create,
    auditCreate: AuditLog.create,
  };

  let state = {
    animal: { ...baseAnimal, ...overrides.animal },
    task: overrides.task === false ? null : { ...baseTask, ...overrides.task },
    insemination: overrides.insemination === false ? null : { ...baseInsemination, ...overrides.insemination },
    lastAttempt: overrides.lastAttempt || null,
    inseminationUpdates: [],
    animalUpdates: [],
    taskUpdates: [],
    notifications: [],
    audits: [],
    createdInseminations: [],
    pdTasks: [],
  };

  const session = {
    async withTransaction(work) {
      try {
        await work();
      } catch (error) {
        throw error;
      }
    },
    async endSession() {},
  };

  mongoose.startSession = async () => session;

  Pregnancy.findOne = () => query(null);
  Config.findOne = () => query(null);
  Task.find = () => query([]);

  Animal.findById = (id) => {
    return query(String(id) === String(state.animal._id) ? state.animal : null);
  };

  Animal.findByIdAndUpdate = async (id, update, options) => {
    state.animalUpdates.push({ id, update, options });
    return state.animal;
  };

  Insemination.findById = (id) => {
    return query(state.insemination && String(id) === String(state.insemination._id) ? state.insemination : null);
  };

  Insemination.findOne = (filter) => {
    // Attempt resolution mock
    if (filter?.status === "done") {
      return query(state.lastAttempt);
    }
    // Active request mock
    if (filter?.status?.$in) {
      return query(state.insemination && state.insemination.status === "pending" ? state.insemination : null);
    }
    return query(null);
  };

  Insemination.findOneAndUpdate = async (filter, update, options) => {
    state.inseminationUpdates.push({ filter, update, options });
    if (state.insemination) {
      Object.assign(state.insemination, update.$set);
    }
    return state.insemination;
  };

  Insemination.create = async (documents, options) => {
    assert.equal(options.session, session);
    const created = { ...documents[0], _id: ids.newInsemination, attemptNumber: state.lastAttempt ? state.lastAttempt.attemptNumber + 1 : 1 };
    state.createdInseminations.push(created);
    return [created];
  };
  Insemination.updateOne = async (filter, update, options) => {
    if (state.insemination) Object.assign(state.insemination, update.$set);
    return { matchedCount: state.insemination ? 1 : 0 };
  };


  Task.findById = (id) => {
    return query(state.task && String(id) === String(state.task._id) ? state.task : null);
  };

  Task.findOneAndUpdate = async (filter, update, options) => {
    state.taskUpdates.push({ filter, update, options });
    if (state.task && ["Pending", "In Progress"].includes(state.task.status)) {
      if (filter.status?.$in && !filter.status.$in.includes(state.task.status)) {
        return null;
      }
      state.task.status = "Completed";
      state.task.relatedRecordId = ids.newInsemination;
      state.task.relatedRecordType = "insemination";
      return state.task;
    }
    return null;
  };

  Task.updateOne = async (filter, update, options) => {
    state.pdTasks.push({ filter, update, options });
    return { upsertedCount: 1 };
  };

  Notification.create = async (documents, options) => {
    state.notifications.push({ documents, options });
    return documents;
  };

  AuditLog.create = async (documents, options) => {
    state.audits.push({ documents, options });
    return documents;
  };

  return {
    state,
    uninstall() {
      mongoose.startSession = originals.startSession;
      Animal.findOne = originals.animalFindOne;
      Animal.findById = originals.animalFindById;
      Animal.findByIdAndUpdate = originals.animalUpdate;
      Insemination.findOne = originals.inseminationFindOne;
      Insemination.findById = originals.inseminationFindById;
      Insemination.findOneAndUpdate = originals.inseminationFindOneAndUpdate;
      Insemination.create = originals.inseminationCreate;
      Insemination.updateOne = originals.inseminationUpdateOne;
      Task.findById = originals.taskFindById;
      Task.findOne = originals.taskFindOne;
      Task.find = originals.taskFind;
      Task.findOneAndUpdate = originals.taskFindOneAndUpdate;
      Task.updateOne = originals.taskUpdateOne;
      Pregnancy.findOne = originals.pregnancyFindOne;
      Config.findOne = originals.configFindOne;
      Notification.create = originals.notificationCreate;
      AuditLog.create = originals.auditCreate;
    },
  };
};

test("Technician AI Service Suite", async (t) => {
  await t.test("completes manual walk-in AI task successfully", async () => {
    const harness = installHarness({
      task: { ...baseTask, status: "Pending" },
      insemination: false,
    });
    const serviceOccurredAt = new Date("2026-08-13T01:00:00.000Z");

    try {
      const result = await recordTechnicianAIService({
        taskId: ids.task,
        farmerId: ids.farmer,
        animalId: ids.animal,
        inseminationDate: serviceOccurredAt,
        sireBreed: "  Jersey  ",
        sireCode: "  JER-101  ",
        technicianNote: "  Calm animal\nNo complications.  ",
        estrus: "Natural",
        actorId: ids.technician,
        isAdmin: false,
      });

      assert.equal(result.outcome, "created_and_task_completed");
      assert.equal(harness.state.createdInseminations.length, 1);
      assert.equal(harness.state.createdInseminations[0].sireBreed, "Jersey");
      assert.equal(harness.state.createdInseminations[0].sireCode, "JER-101");
      assert.equal(harness.state.createdInseminations[0].semenDosesUsed, 1);
      assert.equal(
        harness.state.createdInseminations[0].inseminationDate,
        serviceOccurredAt,
      );
      assert.ok(
        harness.state.createdInseminations[0].completedAt instanceof Date,
      );
      assert.ok(
        harness.state.createdInseminations[0].completedAt > serviceOccurredAt,
      );
      assert.equal(
        harness.state.createdInseminations[0].technicianNote,
        "Calm animal\nNo complications.",
      );
      assert.equal(harness.state.taskUpdates.length, 1);
      assert.equal(harness.state.notifications.length, 1);
      assert.equal(harness.state.audits.length, 1);
      assert.equal(harness.state.pdTasks.length, 2);
    } finally {
      harness.uninstall();
    }
  });

  await t.test("completes an overdue request-linked AI task successfully", async () => {
    const harness = installHarness({
      task: { ...baseTask, status: "In Progress", metadata: { requestId: ids.request } },
      insemination: { ...baseInsemination, status: "in-progress" },
    });

    try {
      const result = await recordTechnicianAIService({
        taskId: ids.task,
        requestId: ids.request,
        farmerId: ids.farmer,
        animalId: ids.animal,
        inseminationDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        sireBreed: "Holstein",
        sireCode: "HOL-202",
        semenDosesUsed: "2",
        technicianNote: "  Service completed normally.  ",
        estrus: "Synchronized",
        actorId: ids.technician,
        isAdmin: false,
      });

      assert.equal(result.outcome, "existing_and_task_completed");
      assert.equal(harness.state.inseminationUpdates.length, 1);
      assert.deepEqual(
        harness.state.inseminationUpdates[0].filter.$and[1],
        {
          farmerId: ids.farmer,
          animalId: ids.animal,
          approvedBy: ids.technician,
          technicianId: ids.technician,
        },
      );
      assert.ok(
        harness.state.inseminationUpdates[0].update.$set.completedAt instanceof
          Date,
      );
      assert.equal(
        result.insemination.completedAt,
        harness.state.inseminationUpdates[0].update.$set.completedAt,
      );
      assert.equal(result.insemination.createdAt, baseInsemination.createdAt);
      assert.equal(
        harness.state.inseminationUpdates[0].update.$set.semenDosesUsed,
        2,
      );
      assert.equal(
        harness.state.inseminationUpdates[0].update.$set.technicianNote,
        "Service completed normally.",
      );
      assert.equal(
        result.insemination.technicianNote,
        "Service completed normally.",
      );
      assert.equal(result.insemination._id, ids.request);
      assert.equal(result.insemination.attemptNumber, 3);
      assert.equal(
        result.insemination.previousAttemptId,
        baseInsemination.previousAttemptId,
      );
      assert.equal(
        result.insemination.attemptSeriesId,
        baseInsemination.attemptSeriesId,
      );
      assert.equal(harness.state.createdInseminations.length, 0);
      assert.equal(harness.state.taskUpdates.length, 2);
      assert.equal(harness.state.pdTasks.length, 2);
    } finally {
      harness.uninstall();
    }
  });

  await t.test("enforces context validation", async () => {
    const harness = installHarness({
      task: { ...baseTask, farmerId: "mismatched-farmer" },
      insemination: false,
    });

    try {
      await assert.rejects(
        recordTechnicianAIService({
          taskId: ids.task,
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Jersey",
          sireCode: "JER-101",
          actorId: ids.technician,
        }),
        (err) => {
          assert.equal(err.code, "TASK_FARMER_MISMATCH");
          return true;
        }
      );
    } finally {
      harness.uninstall();
    }
  });

  await t.test("enforces verified unsuccessful previous attempt check", async () => {
    const harness = installHarness({
      task: { ...baseTask },
      insemination: false,
      lastAttempt: {
        status: "done",
        inseminationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        attemptNumber: 1,
        outcome: "Pending Diagnosis", // Not a verified failure!
        isSuccess: false,
      },
    });

    try {
      await assert.rejects(
        recordTechnicianAIService({
          taskId: ids.task,
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Jersey",
          sireCode: "JER-101",
          actorId: ids.technician,
        }),
        (err) => {
          assert.equal(err.code, "PREVIOUS_AI_ATTEMPT_NOT_FAILED");
          return true;
        }
      );
    } finally {
      harness.uninstall();
    }
  });

  await t.test("handles duplicate retry with identical task/record replay", async () => {
    const originalCompletedAt = new Date("2026-07-02T03:04:05.000Z");
    const harness = installHarness({
      task: { ...baseTask, status: "Completed", technicianId: ids.technician, relatedRecordType: "insemination", relatedRecordId: ids.request },
      insemination: {
        ...baseInsemination,
        status: "done",
        _id: ids.request,
        completedAt: originalCompletedAt,
      },
    });

    try {
      const result = await recordTechnicianAIService({
        taskId: ids.task,
        requestId: ids.request,
        farmerId: ids.farmer,
        animalId: ids.animal,
        inseminationDate: new Date(),
        sireBreed: "Holstein",
        sireCode: "HOL-202",
        actorId: ids.technician,
      });

      assert.equal(result.outcome, "existing_and_task_completed");
      assert.equal(result.insemination.completedAt, originalCompletedAt);
      assert.equal(harness.state.inseminationUpdates.length, 0);
      assert.equal(harness.state.createdInseminations.length, 0);
      assert.equal(harness.state.notifications.length, 0);
      assert.equal(harness.state.audits.length, 0);
    } finally {
      harness.uninstall();
    }
  });

  await t.test("handles duplicate retry conflict with different record", async () => {
    const harness = installHarness({
      task: { ...baseTask, status: "Completed", technicianId: ids.technician, relatedRecordType: "insemination", relatedRecordId: "other-insem" },
      insemination: { ...baseInsemination, status: "done", _id: ids.request },
    });

    try {
      await assert.rejects(
        recordTechnicianAIService({
          taskId: ids.task,
          requestId: ids.request,
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Holstein",
          sireCode: "HOL-202",
          actorId: ids.technician,
        }),
        (err) => {
          assert.equal(err.code, "TASK_ALREADY_LINKED");
          return true;
        }
      );
    } finally {
      harness.uninstall();
    }
  });

  await t.test("rejects invalid semen doses before recording", async () => {
    for (const semenDosesUsed of [0, -1, 1.5, "many"]) {
      await assert.rejects(
        recordTechnicianAIService({
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Holstein",
          sireCode: "HOL-202",
          semenDosesUsed,
          actorId: ids.technician,
        }),
        (error) => error.code === "INVALID_SEMEN_DOSES_USED",
      );
    }
  });

  await t.test("requires a non-empty sire code before recording", async () => {
    for (const sireCode of [undefined, "", "   "]) {
      await assert.rejects(
        recordTechnicianAIService({
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Holstein",
          sireCode,
          actorId: ids.technician,
        }),
        (error) => error.code === "SIRE_CODE_REQUIRED",
      );
    }
  });

  await t.test("supports legacy note aliases and an optional task", async () => {
    const harness = installHarness({ insemination: false, task: false });

    try {
      const result = await recordTechnicianAIService({
        farmerId: ids.farmer,
        animalId: ids.animal,
        inseminationDate: new Date(),
        sireBreed: "Jersey",
        sireCode: "JER-103",
        notes: "  Sent by legacy mobile  ",
        actorId: ids.technician,
        isAdmin: false,
      });

      assert.equal(result.task, null);
      assert.equal(
        harness.state.createdInseminations[0].technicianNote,
        "Sent by legacy mobile",
      );
    } finally {
      harness.uninstall();
    }
  });

  await t.test("keeps a missing or whitespace-only technician note optional", async () => {
    for (const note of [undefined, "  \n  "]) {
      const harness = installHarness({ insemination: false, task: false });
      try {
        await recordTechnicianAIService({
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Jersey",
          sireCode: "JER-104",
          technicianNote: note,
          actorId: ids.technician,
          isAdmin: false,
        });

        assert.equal(
          Object.hasOwn(
            harness.state.createdInseminations[0],
            "technicianNote",
          ),
          false,
        );
      } finally {
        harness.uninstall();
      }
    }
  });

  await t.test("rejects invalid and oversized technician notes before mutation", async () => {
    for (const technicianNote of [42, "N".repeat(2001)]) {
      await assert.rejects(
        recordTechnicianAIService({
          farmerId: ids.farmer,
          animalId: ids.animal,
          inseminationDate: new Date(),
          sireBreed: "Jersey",
          sireCode: "JER-105",
          technicianNote,
          actorId: ids.technician,
        }),
        (error) =>
          ["INVALID_TECHNICIAN_NOTE", "TECHNICIAN_NOTE_TOO_LONG"].includes(
            error.code,
          ),
      );
    }
  });

  await t.test("normalizes note aliases at the canonical completion boundary", async () => {
    const harness = installHarness({
      insemination: { ...baseInsemination, technicianNote: "" },
    });

    try {
      const clientSuppliedCompletedAt = new Date("2000-01-01T00:00:00.000Z");
      const result = await completeInsemination({
        id: ids.request,
        updateData: {
          status: "done",
          inseminationDate: new Date(),
          sireBreed: "Jersey",
          sireCode: "JER-106",
          notes: "  Canonical boundary note  ",
          completedAt: clientSuppliedCompletedAt,
        },
        technicianId: ids.technician,
        farmerId: ids.farmer,
        animalId: ids.animal,
        animalTag: "AI-106",
      });

      assert.equal(result.technicianNote, "Canonical boundary note");
      assert.ok(result.completedAt instanceof Date);
      assert.notEqual(
        result.completedAt.getTime(),
        clientSuppliedCompletedAt.getTime(),
      );
      assert.equal(
        Object.hasOwn(harness.state.inseminationUpdates[0].update.$set, "notes"),
        false,
      );
    } finally {
      harness.uninstall();
    }
  });
});
