import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import { Animal } from "../src/models/animal.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Config } from "../src/models/config.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import {
  completeInitialConfirmationTask,
  confirmPregnancyDiagnosis,
  recordPregnancyContinuationRecheck,
} from "../src/services/pregnancy-confirmation.service.js";
import { PREGNANCY_METHOD_CODES } from "../src/domain/pregnancy-confirmation-policy.js";

const ids = {
  animal: "507f1f77bcf86cd799439001",
  farmer: "507f1f77bcf86cd799439002",
  insemination: "507f1f77bcf86cd799439003",
  pregnancy: "507f1f77bcf86cd799439004",
  task: "507f1f77bcf86cd799439005",
  continuation: "507f1f77bcf86cd799439006",
  actor: "507f1f77bcf86cd799439007",
};
const method = (methodCode, overrides = {}) => ({
  methodCode,
  label: methodCode.replaceAll("_", " "),
  enabled: false,
  earliestDaysPostAI: null,
  acceptedResults: ["Pregnant", "Empty"],
  technicianDiagnosisMayConfirm: true,
  acceptedExternalEvidenceMayConfirm: false,
  continuationRecheckRequired: true,
  speciesOverrides: {},
  ...overrides,
});
const activePolicy = {
  version: "approved-test-policy-v1",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
  enabled: true,
  continuationRecheckDaysPostAI: 60,
  methods: PREGNANCY_METHOD_CODES.map((code) =>
    code === "ultrasound"
      ? method(code, { enabled: true, earliestDaysPostAI: 30 })
      : method(code),
  ),
};
const query = (value) => {
  const promise = Promise.resolve(value);
  promise.session = () => promise;
  promise.sort = () => promise;
  return promise;
};

function installDiagnosisStubs({
  daysPostAI = 35,
  existingPregnancy = null,
  failAudit = false,
  configuredPolicy = activePolicy,
} = {}) {
  const originals = [];
  const replace = (target, key, value) => {
    originals.push([target, key, target[key]]);
    target[key] = value;
  };
  const now = new Date("2026-07-18T00:00:00.000Z");
  const completedAt = new Date("2026-06-13T08:30:00.000Z");
  const animal = {
    _id: ids.animal,
    farmerId: ids.farmer,
    species: "Cattle",
    breed: "Angus",
    earTag: "POLICY-TEST",
    reproductiveStatus: "Inseminated",
  };
  const insemination = {
    _id: ids.insemination,
    farmerId: ids.farmer,
    animalId: ids.animal,
    status: "done",
    outcome: "Pending",
    isSuccess: null,
    technicianId: ids.actor,
    approvedBy: ids.actor,
    completedAt,
    inseminationDate: new Date(now.getTime() - daysPostAI * 24 * 60 * 60 * 1000),
  };
  const initialTask = {
    _id: ids.task,
    farmerId: ids.farmer,
    animalIds: [ids.animal],
    taskType: "PD",
    status: "Pending",
    metadata: { inseminationId: ids.insemination },
    async save(options) {
      assert.ok(options.session);
      return this;
    },
  };
  const state = {
    animal,
    insemination,
    pregnancy: existingPregnancy,
    initialTask,
    continuationTasks: [],
    timelineWrites: 0,
    auditWrites: 0,
  };

  replace(mongoose, "startSession", async () => ({
    withTransaction: async (work) => {
      const before = {
        pregnancy: state.pregnancy,
        animal: { ...animal },
        insemination: { ...insemination },
        initialTask: { ...initialTask, metadata: { ...initialTask.metadata } },
      };
      try {
        return await work();
      } catch (error) {
        if (failAudit) {
          state.pregnancy = before.pregnancy;
          Object.assign(animal, before.animal);
          Object.assign(insemination, before.insemination);
          Object.assign(initialTask, before.initialTask);
          state.continuationTasks = [];
          state.timelineWrites = 0;
          state.auditWrites = 0;
        }
        throw error;
      }
    },
    endSession: async () => {},
  }));
  replace(Config, "findOne", () => query(configuredPolicy ? { value: configuredPolicy } : null));
  replace(Animal, "findOne", () => query(animal));
  replace(Insemination, "findOne", () => query(insemination));
  replace(Pregnancy, "findOne", () => query(state.pregnancy));
  replace(Pregnancy, "create", async ([data], options) => {
    assert.ok(options.session);
    if (state.pregnancy) {
      const error = new Error("duplicate");
      error.code = 11000;
      error.keyPattern = { inseminationId: 1 };
      throw error;
    }
    state.pregnancy = { _id: ids.pregnancy, cycleStatus: "active", ...data };
    return [state.pregnancy];
  });
  replace(Pregnancy, "updateOne", async (_filter, update) => {
    if (state.pregnancy) Object.assign(state.pregnancy, update.$set || {});
    return { modifiedCount: state.pregnancy ? 1 : 0 };
  });
  replace(Insemination, "updateOne", async (_filter, update) => {
    Object.assign(insemination, update.$set || {});
    return { modifiedCount: 1 };
  });
  replace(Animal, "updateOne", async (_filter, update) => {
    Object.assign(animal, update.$set || {});
    return { modifiedCount: 1 };
  });
  replace(Task, "findOne", () => query(initialTask));
  replace(Task, "find", () => query([initialTask]));
  replace(Task, "findOneAndUpdate", async (_filter, update, options) => {
    assert.ok(options.session);
    const created = { _id: ids.continuation, ...update.$setOnInsert };
    state.continuationTasks = state.continuationTasks.length
      ? state.continuationTasks
      : [created];
    return state.continuationTasks[0];
  });
  replace(Task, "updateOne", async () => ({ matchedCount: 0, modifiedCount: 0 }));
  replace(Task, "updateMany", async () => ({ modifiedCount: 0 }));
  replace(AnimalTimelineEvent, "create", async (_entries, options) => {
    assert.ok(options.session);
    state.timelineWrites += 1;
    return [{}];
  });
  replace(AuditLog, "create", async (_entries, options) => {
    assert.ok(options.session);
    if (failAudit) throw new Error("late audit failure");
    state.auditWrites += 1;
    return [{}];
  });

  return {
    state,
    now,
    completedAt,
    restore() {
      for (const [target, key, original] of originals.reverse()) target[key] = original;
    },
  };
}

const actor = { _id: ids.actor, role: "technician", name: "Policy Tech" };

test("a diagnosis cannot reconcile an initial task assigned to another technician", async () => {
  const originalFind = Task.find;
  const assignedTechnicianId = "507f1f77bcf86cd799439099";
  const task = {
    _id: ids.task,
    farmerId: ids.farmer,
    animalIds: [ids.animal],
    technicianId: assignedTechnicianId,
    taskType: "PD",
    status: "Pending",
    metadata: {
      workflowStage: "initial_confirmation",
      inseminationId: ids.insemination,
    },
    async save() { return this; },
  };
  let queryFilter = null;
  Task.find = (filter) => {
    queryFilter = filter;
    return query([task]);
  };
  try {
    await assert.rejects(
      () => completeInitialConfirmationTask({
        animal: { _id: ids.animal, farmerId: ids.farmer },
        insemination: { _id: ids.insemination, technicianId: ids.actor },
        pregnancy: { _id: ids.pregnancy },
        actor,
        methodCode: "ultrasound",
        policyVersion: activePolicy.version,
        session: {},
      }),
      (error) => error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER" && error.status === 403,
    );
    assert.equal("$or" in queryFilter, false);
    assert.equal(task.status, "Pending");
  } finally {
    Task.find = originalFind;
  }
});

test("automatic diagnosis reconciliation does not complete an unrelated Pregnancy task", async () => {
  const originalFind = Task.find;
  const unrelated = {
    _id: ids.task,
    taskType: "PD",
    status: "Pending",
    metadata: {
      workflowStage: "continuation_recheck",
      pregnancyId: "507f1f77bcf86cd799439098",
    },
  };
  Task.find = () => query([unrelated]);
  try {
    const completed = await completeInitialConfirmationTask({
      animal: { _id: ids.animal, farmerId: ids.farmer },
      insemination: { _id: ids.insemination, technicianId: ids.actor },
      pregnancy: { _id: ids.pregnancy },
      actor,
      session: {},
    });

    assert.equal(completed, null);
    assert.equal(unrelated.status, "Pending");
  } finally {
    Task.find = originalFind;
  }
});

test("method-based early diagnosis snapshots policy and creates one continuation task", async () => {
  const stubs = installDiagnosisStubs({ daysPostAI: 35 });
  try {
    const result = await confirmPregnancyDiagnosis({
      animalId: ids.animal,
      inseminationId: ids.insemination,
      result: "Pregnant",
      diagnosisDate: stubs.now,
      methodCode: "ultrasound",
      policyVersion: activePolicy.version,
      taskId: ids.task,
      actor,
    });
    assert.equal(result.pregnancy.pregnancyDiagnosis.result, "Pregnant");
    assert.equal(result.pregnancy.confirmation.methodCode, "ultrasound");
    assert.equal(result.pregnancy.confirmation.policyVersion, activePolicy.version);
    assert.equal(result.pregnancy.confirmation.earliestThresholdSnapshot, 30);
    assert.equal(result.pregnancy.confirmation.stage, "early");
    assert.equal(result.pregnancy.recheckStatus, "pending");
    assert.equal(stubs.state.continuationTasks.length, 1);
    assert.equal(stubs.state.initialTask.status, "Completed");
    assert.equal(stubs.state.timelineWrites, 1);
    assert.equal(stubs.state.auditWrites, 1);
    assert.equal(stubs.state.insemination.completedAt, stubs.completedAt);
  } finally {
    stubs.restore();
  }
});

test("diagnosis stage and continuation task follow the continuation date, not the method threshold", async () => {
  for (const scenario of [
    { daysPostAI: 59, stage: "early", recheckRequired: true, taskCount: 1 },
    { daysPostAI: 60, stage: "standard", recheckRequired: false, taskCount: 0 },
    { daysPostAI: 65, stage: "standard", recheckRequired: false, taskCount: 0 },
  ]) {
    const stubs = installDiagnosisStubs({ daysPostAI: scenario.daysPostAI });
    try {
      const result = await confirmPregnancyDiagnosis({
        animalId: ids.animal,
        inseminationId: ids.insemination,
        result: "Pregnant",
        diagnosisDate: stubs.now,
        methodCode: "ultrasound",
        policyVersion: activePolicy.version,
        taskId: ids.task,
        actor,
      });
      assert.equal(result.pregnancy.confirmation.stage, scenario.stage);
      assert.equal(result.pregnancy.confirmation.recheckRequired, scenario.recheckRequired);
      assert.equal(result.pregnancy.recheckStatus, scenario.recheckRequired ? "pending" : "not_required");
      assert.equal(stubs.state.continuationTasks.length, scenario.taskCount);
    } finally {
      stubs.restore();
    }
  }
});

test("unconfigured deployments preserve the legacy Day-60 diagnosis contract", async () => {
  const stubs = installDiagnosisStubs({ daysPostAI: 60, configuredPolicy: null });
  try {
    const result = await confirmPregnancyDiagnosis({
      animalId: ids.animal,
      inseminationId: ids.insemination,
      result: "Pregnant",
      diagnosisDate: stubs.now,
      taskId: ids.task,
      actor,
    });
    assert.equal(result.pregnancyReadiness.policyMode, "legacy_day_60");
    assert.equal(result.pregnancyReadiness.isEligible, true);
    assert.equal(result.pregnancy.confirmation.methodCode, null);
    assert.equal(result.pregnancy.confirmation.stage, "legacy_unclassified");
    assert.equal(result.pregnancy.confirmation.policyVersion, "legacy-day-60");
    assert.equal(result.pregnancy.confirmation.earliestThresholdSnapshot, 60);
    assert.equal(result.pregnancy.pregnancyDiagnosis.result, "Pregnant");
    assert.equal(stubs.state.continuationTasks.length, 0);
  } finally {
    stubs.restore();
  }
});

test("method policy rejects missing, disabled, early, stale, and unauthorized submissions", async () => {
  for (const role of ["farmer"]) {
    assert.throws(
      () => confirmPregnancyDiagnosis({ animalId: ids.animal, inseminationId: ids.insemination, result: "Pregnant", actor: { _id: ids.farmer, role } }),
      (error) => error.code === "UNAUTHORIZED_PREGNANCY_CONFIRMATION",
    );
  }
  for (const input of [
    { daysPostAI: 35, methodCode: undefined, code: "DIAGNOSTIC_METHOD_REQUIRED" },
    { daysPostAI: 35, methodCode: "blood_pag", code: "DIAGNOSTIC_METHOD_DISABLED" },
    { daysPostAI: 29, methodCode: "ultrasound", code: "METHOD_NOT_YET_READY" },
    { daysPostAI: 35, methodCode: "ultrasound", policyVersion: "stale", code: "PREGNANCY_POLICY_CHANGED" },
  ]) {
    const stubs = installDiagnosisStubs({ daysPostAI: input.daysPostAI });
    try {
      await assert.rejects(
        () => confirmPregnancyDiagnosis({
          animalId: ids.animal,
          inseminationId: ids.insemination,
          result: "Pregnant",
          diagnosisDate: stubs.now,
          methodCode: input.methodCode,
          policyVersion: input.policyVersion,
          taskId: ids.task,
          actor,
        }),
        (error) => error.code === input.code,
      );
      assert.equal(stubs.state.pregnancy, null);
    } finally {
      stubs.restore();
    }
  }
});

test("standard diagnosis creates no continuation task and negative diagnosis returns animal to Normal", async () => {
  const standard = installDiagnosisStubs({ daysPostAI: 60 });
  try {
    const result = await confirmPregnancyDiagnosis({
      animalId: ids.animal,
      inseminationId: ids.insemination,
      result: "Empty",
      diagnosisDate: standard.now,
      methodCode: "ultrasound",
      policyVersion: activePolicy.version,
      taskId: ids.task,
      actor,
    });
    assert.equal(result.pregnancy.pregnancyDiagnosis.result, "Empty");
    assert.equal(result.pregnancy.confirmation.stage, "standard");
    assert.equal(result.pregnancy.recheckStatus, "not_required");
    assert.equal(standard.state.continuationTasks.length, 0);
    assert.equal(standard.state.animal.reproductiveStatus, "Normal");
  } finally {
    standard.restore();
  }
});

test("duplicate diagnosis is rejected and cannot create another Pregnancy", async () => {
  const existing = {
    _id: ids.pregnancy,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-07-01") },
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 60, existingPregnancy: existing });
  try {
    await assert.rejects(
      () => confirmPregnancyDiagnosis({
        animalId: ids.animal,
        inseminationId: ids.insemination,
        result: "Pregnant",
        diagnosisDate: stubs.now,
        methodCode: "ultrasound",
        policyVersion: activePolicy.version,
        actor,
      }),
      (error) => error.code === "PREGNANCY_DIAGNOSIS_EXISTS",
    );
    assert.equal(stubs.state.pregnancy, existing);
  } finally {
    stubs.restore();
  }
});

test("same-result retry reconciles a matching stale diagnosis task without duplicate records or events", async () => {
  const existing = {
    _id: ids.pregnancy,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-07-01") },
    confirmation: { methodCode: "ultrasound", policyVersion: activePolicy.version },
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 60, existingPregnancy: existing });
  try {
    const result = await confirmPregnancyDiagnosis({
      animalId: ids.animal,
      inseminationId: ids.insemination,
      result: "Pregnant",
      diagnosisDate: stubs.now,
      methodCode: "ultrasound",
      policyVersion: activePolicy.version,
      taskId: ids.task,
      actor,
    });

    assert.equal(result.alreadyRecorded, true);
    assert.equal(result.pregnancy, existing);
    assert.equal(stubs.state.initialTask.status, "Completed");
    assert.equal(stubs.state.initialTask.relatedRecordType, "pregnancy");
    assert.equal(stubs.state.initialTask.relatedRecordId, ids.pregnancy);
    assert.equal(stubs.state.timelineWrites, 0);
    assert.equal(stubs.state.auditWrites, 0);
    assert.equal(stubs.state.continuationTasks.length, 0);
  } finally {
    stubs.restore();
  }
});

test("conflicting retry preserves the official diagnosis and leaves the task open", async () => {
  const existing = {
    _id: ids.pregnancy,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-07-01") },
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 60, existingPregnancy: existing });
  try {
    await assert.rejects(
      () => confirmPregnancyDiagnosis({
        animalId: ids.animal,
        inseminationId: ids.insemination,
        result: "Empty",
        diagnosisDate: stubs.now,
        methodCode: "ultrasound",
        policyVersion: activePolicy.version,
        taskId: ids.task,
        actor,
      }),
      (error) => error.code === "PREGNANCY_DIAGNOSIS_CONFLICT",
    );
    assert.equal(stubs.state.pregnancy, existing);
    assert.equal(stubs.state.initialTask.status, "Pending");
    assert.equal(stubs.state.timelineWrites, 0);
    assert.equal(stubs.state.auditWrites, 0);
  } finally {
    stubs.restore();
  }
});

test("completed matching task replay returns the existing diagnosis without new writes", async () => {
  const existing = {
    _id: ids.pregnancy,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-07-01") },
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 60, existingPregnancy: existing });
  stubs.state.initialTask.status = "Completed";
  stubs.state.initialTask.relatedRecordType = "pregnancy";
  stubs.state.initialTask.relatedRecordId = ids.pregnancy;
  try {
    const result = await confirmPregnancyDiagnosis({
      animalId: ids.animal,
      inseminationId: ids.insemination,
      result: "Pregnant",
      diagnosisDate: stubs.now,
      methodCode: "ultrasound",
      policyVersion: activePolicy.version,
      taskId: ids.task,
      actor,
    });

    assert.equal(result.alreadyRecorded, true);
    assert.equal(result.completedTask, stubs.state.initialTask);
    assert.equal(stubs.state.timelineWrites, 0);
    assert.equal(stubs.state.auditWrites, 0);
  } finally {
    stubs.restore();
  }
});

test("two technicians racing an unassigned diagnosis Task produce one owner and one Pregnancy", async () => {
  const stubs = installDiagnosisStubs({ daysPostAI: 35 });
  const input = {
    animalId: ids.animal,
    inseminationId: ids.insemination,
    result: "Pregnant",
    diagnosisDate: stubs.now,
    methodCode: "ultrasound",
    policyVersion: activePolicy.version,
    taskId: ids.task,
    actor,
  };
  try {
    const outcomes = await Promise.allSettled([
      confirmPregnancyDiagnosis(input),
      confirmPregnancyDiagnosis({
        ...input,
        actor: {
          _id: "507f1f77bcf86cd799439088",
          role: "technician",
        },
      }),
    ]);
    assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1);
    const rejected = outcomes.find((item) => item.status === "rejected");
    assert.ok([
      "PREGNANCY_DIAGNOSIS_EXISTS",
      "PREGNANCY_WORK_ASSIGNED_TO_OTHER",
    ].includes(rejected.reason.code));
    assert.equal(stubs.state.pregnancy._id, ids.pregnancy);
    assert.ok([
      ids.actor,
      "507f1f77bcf86cd799439088",
    ].includes(String(stubs.state.initialTask.technicianId)));
  } finally {
    stubs.restore();
  }
});

test("a late lifecycle failure rolls back the entire confirmation transaction", async () => {
  const stubs = installDiagnosisStubs({ daysPostAI: 35, failAudit: true });
  try {
    await assert.rejects(
      () => confirmPregnancyDiagnosis({
        animalId: ids.animal,
        inseminationId: ids.insemination,
        result: "Pregnant",
        diagnosisDate: stubs.now,
        methodCode: "ultrasound",
        policyVersion: activePolicy.version,
        taskId: ids.task,
        actor,
      }),
      /late audit failure/,
    );
    assert.equal(stubs.state.pregnancy, null);
    assert.equal(stubs.state.animal.reproductiveStatus, "Inseminated");
    assert.equal(stubs.state.insemination.outcome, "Pending");
    assert.equal(stubs.state.initialTask.status, "Pending");
    assert.equal(stubs.state.continuationTasks.length, 0);
    assert.equal(stubs.state.timelineWrites, 0);
    assert.equal(stubs.state.auditWrites, 0);
  } finally {
    stubs.restore();
  }
});

test("continuation results update the existing Pregnancy and never create another", async () => {
  for (const continuationResult of ["continuing", "loss_detected", "follow_up_required"]) {
    const pregnancy = {
      _id: ids.pregnancy,
      animalId: ids.animal,
      farmerId: ids.farmer,
      inseminationId: ids.insemination,
      pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-06-01") },
      confirmation: { methodCode: "ultrasound", policyVersion: activePolicy.version },
      cycleStatus: "active",
      recheckStatus: "pending",
    };
    const stubs = installDiagnosisStubs({ daysPostAI: 65, existingPregnancy: pregnancy });
    const originalPregnancyUpdate = Pregnancy.updateOne;
    const continuationTask = {
      ...stubs.state.initialTask,
      metadata: { workflowStage: "continuation_recheck", pregnancyId: ids.pregnancy },
    };
    Task.findOne = () => query(continuationTask);
    Task.find = () => query([continuationTask]);
    Pregnancy.updateOne = async (_filter, update) => {
      Object.assign(pregnancy, update.$set);
      return { modifiedCount: 1 };
    };
    try {
      const result = await recordPregnancyContinuationRecheck({
        pregnancyId: ids.pregnancy,
        result: continuationResult,
        checkedAt: stubs.now,
        notes: "Continuation test",
        followUpDate: continuationResult === "follow_up_required"
          ? new Date(stubs.now.getTime() + 7 * 24 * 60 * 60 * 1000)
          : undefined,
        taskId: ids.task,
        actor,
      });
      assert.equal(result.recheckStatus, continuationResult);
      assert.equal(stubs.state.pregnancy._id, ids.pregnancy);
      if (continuationResult === "loss_detected") assert.equal(pregnancy.cycleStatus, "lost");
      if (continuationResult === "follow_up_required") assert.ok(result.followUpTask);
    } finally {
      Pregnancy.updateOne = originalPregnancyUpdate;
      stubs.restore();
    }
  }
});

test("diagnostic follow-up task updates the linked Pregnancy instead of creating a new record", async () => {
  const pregnancy = {
    _id: ids.pregnancy,
    animalId: ids.animal,
    farmerId: ids.farmer,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-06-01") },
    confirmation: { methodCode: "ultrasound", policyVersion: activePolicy.version },
    cycleStatus: "active",
    recheckStatus: "follow_up_required",
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 72, existingPregnancy: pregnancy });
  const originalPregnancyUpdate = Pregnancy.updateOne;
  const followUpTask = {
    ...stubs.state.initialTask,
    metadata: { workflowStage: "diagnostic_follow_up", pregnancyId: ids.pregnancy },
  };
  Task.findOne = () => query(followUpTask);
  Task.find = () => query([followUpTask]);
  Pregnancy.updateOne = async (_filter, update) => {
    Object.assign(pregnancy, update.$set);
    return { modifiedCount: 1 };
  };
  try {
    const result = await recordPregnancyContinuationRecheck({
      pregnancyId: ids.pregnancy,
      result: "continuing",
      checkedAt: stubs.now,
      notes: "Follow-up completed",
      taskId: ids.task,
      actor,
    });
    assert.equal(result.recheckStatus, "continuing");
    assert.equal(stubs.state.pregnancy._id, ids.pregnancy);
    assert.equal(followUpTask.status, "Completed");
  } finally {
    Pregnancy.updateOne = originalPregnancyUpdate;
    stubs.restore();
  }
});

test("continuation rejects an explicitly supplied task owned by another technician", async () => {
  const pregnancy = {
    _id: ids.pregnancy,
    animalId: ids.animal,
    farmerId: ids.farmer,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-06-01") },
    confirmation: { recheckRequired: true },
    cycleStatus: "active",
    recheckStatus: "pending",
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 65, existingPregnancy: pregnancy });
  let taskQuery = null;
  Task.findOne = (filter) => {
    taskQuery = filter;
    return query({
      ...stubs.state.initialTask,
      technicianId: "507f1f77bcf86cd799439099",
      metadata: {
        workflowStage: "continuation_recheck",
        pregnancyId: ids.pregnancy,
      },
    });
  };
  try {
    await assert.rejects(
      () => recordPregnancyContinuationRecheck({
        pregnancyId: ids.pregnancy,
        result: "continuing",
        checkedAt: stubs.now,
        taskId: ids.task,
        actor,
      }),
      (error) => error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER" && error.status === 403,
    );
    assert.equal("$or" in taskQuery, false);
    assert.equal(pregnancy.recheckStatus, "pending");
  } finally {
    stubs.restore();
  }
});

test("continuation without a taskId cannot mutate another technician's assigned task", async () => {
  const pregnancy = {
    _id: ids.pregnancy,
    animalId: ids.animal,
    farmerId: ids.farmer,
    inseminationId: ids.insemination,
    pregnancyDiagnosis: { result: "Pregnant", date: new Date("2026-06-01") },
    confirmation: { recheckRequired: true },
    cycleStatus: "active",
    recheckStatus: "pending",
  };
  const stubs = installDiagnosisStubs({ daysPostAI: 65, existingPregnancy: pregnancy });
  const assignedTechnicianId = "507f1f77bcf86cd799439099";
  const continuationTask = {
    ...stubs.state.initialTask,
    technicianId: assignedTechnicianId,
    metadata: {
      workflowStage: "continuation_recheck",
      pregnancyId: ids.pregnancy,
    },
  };
  let taskQuery = null;
  Task.find = (filter) => {
    taskQuery = filter;
    return query([continuationTask]);
  };
  try {
    await assert.rejects(
      () => recordPregnancyContinuationRecheck({
        pregnancyId: ids.pregnancy,
        result: "continuing",
        checkedAt: stubs.now,
        actor,
      }),
      (error) => error.code === "PREGNANCY_WORK_ASSIGNED_TO_OTHER" && error.status === 403,
    );
    assert.equal("$or" in taskQuery, false);
    assert.ok(
      taskQuery["metadata.pregnancyId"].$in.some(
        (value) => String(value) === ids.pregnancy,
      ),
    );
    assert.equal(continuationTask.status, "Pending");
  } finally {
    stubs.restore();
  }
});
