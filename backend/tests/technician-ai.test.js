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
import { recordTechnicianAIService } from "../src/services/livestock-transaction.service.js";
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
  inseminationDate: null,
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
      state.insemination.status = "done";
    }
    return state.insemination;
  };

  Insemination.create = async (documents, options) => {
    assert.equal(options.session, session);
    const created = { ...documents[0], _id: ids.newInsemination, attemptNumber: state.lastAttempt ? state.lastAttempt.attemptNumber + 1 : 1 };
    state.createdInseminations.push(created);
    return [created];
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

    try {
      const result = await recordTechnicianAIService({
        taskId: ids.task,
        farmerId: ids.farmer,
        animalId: ids.animal,
        inseminationDate: new Date(),
        sireBreed: "Jersey",
        sireCode: "JER-101",
        estrus: "Natural",
        actorId: ids.technician,
        isAdmin: false,
      });

      assert.equal(result.outcome, "created_and_task_completed");
      assert.equal(harness.state.createdInseminations.length, 1);
      assert.equal(harness.state.createdInseminations[0].sireBreed, "Jersey");
      assert.equal(harness.state.taskUpdates.length, 1);
      assert.equal(harness.state.notifications.length, 1);
      assert.equal(harness.state.audits.length, 1);
      assert.equal(harness.state.pdTasks.length, 2);
    } finally {
      harness.uninstall();
    }
  });

  await t.test("completes request-linked AI task successfully", async () => {
    const harness = installHarness({
      task: { ...baseTask, status: "In Progress", metadata: { requestId: ids.request } },
      insemination: { ...baseInsemination },
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
        estrus: "Synchronized",
        actorId: ids.technician,
        isAdmin: false,
      });

      assert.equal(result.outcome, "existing_and_task_completed");
      assert.equal(harness.state.inseminationUpdates.length, 1);
      assert.equal(harness.state.taskUpdates.length, 1);
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
    const harness = installHarness({
      task: { ...baseTask, status: "Completed", relatedRecordType: "insemination", relatedRecordId: ids.request },
      insemination: { ...baseInsemination, status: "done", _id: ids.request },
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
      assert.equal(harness.state.createdInseminations.length, 0);
      assert.equal(harness.state.notifications.length, 0);
      assert.equal(harness.state.audits.length, 0);
    } finally {
      harness.uninstall();
    }
  });

  await t.test("handles duplicate retry conflict with different record", async () => {
    const harness = installHarness({
      task: { ...baseTask, status: "Completed", relatedRecordType: "insemination", relatedRecordId: "other-insem" },
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
});
