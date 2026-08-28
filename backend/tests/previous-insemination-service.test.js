import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Task } from "../src/models/task.model.js";
import { Config } from "../src/models/config.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { recordPreviousInsemination } from "../src/services/previous-insemination.service.js";

const ids = {
  farmer: "507f1f77bcf86cd799439001",
  animal: "507f1f77bcf86cd799439002",
  technician: "507f1f77bcf86cd799439003",
  record: "507f1f77bcf86cd799439004",
};

const query = (value) => {
  const result = {
    session() { return result; },
    sort() { return result; },
    lean() { return result; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
  return result;
};

const installHarness = () => {
  const originals = {
    startSession: mongoose.startSession,
    animalFindOne: Animal.findOne,
    animalUpdate: Animal.findByIdAndUpdate,
    inseminationFindOne: Insemination.findOne,
    inseminationCreate: Insemination.create,
    inseminationUpdate: Insemination.updateOne,
    pregnancyFindOne: Pregnancy.findOne,
    calvingFindOne: Calving.findOne,
    taskFind: Task.find,
    taskFindOneAndUpdate: Task.findOneAndUpdate,
    configFindOne: Config.findOne,
    auditCreate: AuditLog.create,
  };
  const session = {
    async withTransaction(work) { await work(); },
    async endSession() {},
  };
  const state = {
    animal: {
      _id: ids.animal,
      farmerId: ids.farmer,
      animalId: "COW-1",
      earTag: "COW-1",
      gender: "Female",
      birthDate: new Date("2022-01-01T00:00:00.000Z"),
      species: "Cattle",
      breed: "Brahman",
      reproductiveStatus: "Normal",
    },
    created: [],
    animalUpdates: [],
    tasks: [],
    audits: [],
    newerAI: null,
    newerPregnancy: null,
    newerCalving: null,
  };

  mongoose.startSession = async () => session;
  Animal.findOne = () => query(state.animal);
  Animal.findByIdAndUpdate = async (_id, update) => {
    state.animalUpdates.push(update);
    if (update.$set) Object.assign(state.animal, update.$set);
    return state.animal;
  };
  Insemination.findOne = (filter) =>
    query(filter?.inseminationDate?.$gt ? state.newerAI : null);
  Insemination.create = async (documents, options) => {
    assert.equal(options.session, session);
    const created = {
      ...documents[0],
      _id: ids.record,
      attemptNumber: documents[0].entryMode === "history_only" ? undefined : 1,
    };
    state.created.push(created);
    return [created];
  };
  Insemination.updateOne = async () => ({ matchedCount: 1 });
  Pregnancy.findOne = (filter) =>
    query(filter?.$or ? state.newerPregnancy : null);
  Calving.findOne = () => query(state.newerCalving);
  Task.find = () => query([]);
  Task.findOneAndUpdate = async (_filter, update) => {
    const task = {
      _id: `507f1f77bcf86cd79943900${state.tasks.length + 5}`,
      ...update.$setOnInsert,
    };
    state.tasks.push(task);
    return task;
  };
  Config.findOne = () => query(null);
  AuditLog.create = async (documents) => {
    state.audits.push(...(Array.isArray(documents) ? documents : [documents]));
    return documents;
  };

  return {
    state,
    uninstall() {
      mongoose.startSession = originals.startSession;
      Animal.findOne = originals.animalFindOne;
      Animal.findByIdAndUpdate = originals.animalUpdate;
      Insemination.findOne = originals.inseminationFindOne;
      Insemination.create = originals.inseminationCreate;
      Insemination.updateOne = originals.inseminationUpdate;
      Pregnancy.findOne = originals.pregnancyFindOne;
      Calving.findOne = originals.calvingFindOne;
      Task.find = originals.taskFind;
      Task.findOneAndUpdate = originals.taskFindOneAndUpdate;
      Config.findOne = originals.configFindOne;
      AuditLog.create = originals.auditCreate;
    },
  };
};

const invoke = ({ entryMode, inseminationDate, now }) =>
  recordPreviousInsemination({
    farmerId: ids.farmer,
    animalId: ids.animal,
    actorId: ids.technician,
    entryMode,
    now,
    inseminationDetails: {
      inseminationDate,
      sireBreed: "Brahman",
      sireCode: "SIRE-1",
      semenDosesUsed: 1,
      estrus: "Natural",
      technicianNote: "Paper record",
    },
  });

test("history-only saves an official record with no current-state or Task writes", async () => {
  const harness = installHarness();
  try {
    const result = await invoke({
      entryMode: "history_only",
      inseminationDate: "2024-08-20T08:00:00.000Z",
      now: new Date("2026-08-20T08:00:00.000Z"),
    });
    assert.equal(result.insemination.status, "done");
    assert.equal(result.insemination.entryMode, "history_only");
    assert.equal(result.insemination.outcome, "Pending");
    assert.equal(result.insemination.isSuccess, null);
    assert.equal(result.insemination.attemptNumber, undefined);
    assert.equal(harness.state.animal.reproductiveStatus, "Normal");
    assert.equal(harness.state.animalUpdates.length, 0);
    assert.equal(harness.state.tasks.length, 0);
    assert.equal(harness.state.audits[0].action, "RECORD_PREVIOUS_AI_HISTORY");
  } finally {
    harness.uninstall();
  }
});

test("history-only never overrides a newer Pregnancy or current-cycle anchor", async () => {
  const harness = installHarness();
  try {
    harness.state.animal.reproductiveStatus = "Pregnant";
    harness.state.animal.lastInseminationDate = new Date(
      "2026-07-01T08:00:00.000Z",
    );
    harness.state.newerPregnancy = { _id: "pregnancy-newer" };

    await invoke({
      entryMode: "history_only",
      inseminationDate: "2024-08-20T08:00:00.000Z",
      now: new Date("2026-08-20T08:00:00.000Z"),
    });

    assert.equal(harness.state.animal.reproductiveStatus, "Pregnant");
    assert.equal(
      harness.state.animal.lastInseminationDate.toISOString(),
      "2026-07-01T08:00:00.000Z",
    );
    assert.equal(harness.state.animalUpdates.length, 0);
    assert.equal(harness.state.tasks.length, 0);
  } finally {
    harness.uninstall();
  }
});

test("history-only never overrides a newer Calving or postpartum state", async () => {
  const harness = installHarness();
  try {
    harness.state.animal.reproductiveStatus = "Post-partum";
    harness.state.animal.lastCalvingDate = new Date(
      "2026-08-01T08:00:00.000Z",
    );
    harness.state.newerCalving = { _id: "calving-newer" };

    await invoke({
      entryMode: "history_only",
      inseminationDate: "2024-08-20T08:00:00.000Z",
      now: new Date("2026-08-20T08:00:00.000Z"),
    });

    assert.equal(harness.state.animal.reproductiveStatus, "Post-partum");
    assert.equal(
      harness.state.animal.lastCalvingDate.toISOString(),
      "2026-08-01T08:00:00.000Z",
    );
    assert.equal(harness.state.animalUpdates.length, 0);
    assert.equal(harness.state.tasks.length, 0);
  } finally {
    harness.uninstall();
  }
});

test("continue-tracking uses actual AI date and skips passed heat-return work", async () => {
  const harness = installHarness();
  try {
    const result = await invoke({
      entryMode: "continue_tracking",
      inseminationDate: "2026-06-20T08:00:00.000Z",
      now: new Date("2026-08-20T08:00:00.000Z"),
    });
    assert.equal(result.insemination.entryMode, "continue_tracking");
    assert.equal(harness.state.animal.reproductiveStatus, "Inseminated");
    assert.equal(
      new Date(harness.state.animal.lastInseminationDate).toISOString(),
      "2026-06-20T08:00:00.000Z",
    );
    assert.deepEqual(harness.state.tasks.map((task) => task.taskType), ["PD"]);
    assert.equal(harness.state.audits[0].action, "RECORD_PREVIOUS_AI_CONTINUE_TRACKING");
  } finally {
    harness.uninstall();
  }
});
for (const [label, stateKey] of [
  ["AI", "newerAI"],
  ["Pregnancy", "newerPregnancy"],
  ["Calving", "newerCalving"],
]) {
  test(`continue-tracking rejects a superseding newer ${label}`, async () => {
    const harness = installHarness();
    try {
      harness.state[stateKey] = { _id: `${label.toLowerCase()}-newer` };

      await assert.rejects(
        invoke({
          entryMode: "continue_tracking",
          inseminationDate: "2026-06-20T08:00:00.000Z",
          now: new Date("2026-08-20T08:00:00.000Z"),
        }),
        (error) => error.code === "PREVIOUS_AI_TRACKING_SUPERSEDED",
      );
      assert.equal(harness.state.created.length, 0);
      assert.equal(harness.state.animalUpdates.length, 0);
      assert.equal(harness.state.tasks.length, 0);
    } finally {
      harness.uninstall();
    }
  });
}
for (const entryMode of ["history_only", "continue_tracking"]) {
  test(`${entryMode} rejects an AI before minimum breeding age`, async () => {
    const harness = installHarness();
    try {
      harness.state.animal.birthDate = new Date("2026-01-01T00:00:00.000Z");

      await assert.rejects(
        invoke({
          entryMode,
          inseminationDate: "2026-08-20T08:00:00.000Z",
          now: new Date("2026-08-20T09:00:00.000Z"),
        }),
        (error) => error.code === "PREVIOUS_AI_BELOW_BREEDING_AGE",
      );
      assert.equal(harness.state.created.length, 0);
      assert.equal(harness.state.animalUpdates.length, 0);
      assert.equal(harness.state.tasks.length, 0);
    } finally {
      harness.uninstall();
    }
  });
}
