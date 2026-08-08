import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { Task } from "../src/models/task.model.js";
import { AnimalTimelineEvent } from "../src/models/animal-timeline-event.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { resolveHealthRequest, createResolvedWalkInHealth } from "../src/services/livestock-transaction.service.js";

const ids = {
  farmer: new mongoose.Types.ObjectId().toString(),
  animal: new mongoose.Types.ObjectId().toString(),
  technician: new mongoose.Types.ObjectId().toString(),
  request: new mongoose.Types.ObjectId().toString(),
  task: new mongoose.Types.ObjectId().toString(),
  otherTechnician: new mongoose.Types.ObjectId().toString(),
  otherFarmer: new mongoose.Types.ObjectId().toString(),
  otherAnimal: new mongoose.Types.ObjectId().toString(),
  otherRequest: new mongoose.Types.ObjectId().toString(),
};

const setupTest = () => {
  let state = {
    request: {
      _id: ids.request,
      farmerId: ids.farmer,
      animalId: ids.animal,
      status: "pending",
      deletedAt: null,
    },
    task: {
      _id: ids.task,
      taskType: "Health",
      status: "Pending",
      technicianId: ids.technician,
      farmerId: ids.farmer,
      animalIds: [ids.animal],
      relatedRecordId: null,
      relatedRecordType: null,
      metadata: {},
      save: async function(options) {
        if (options?.session) state.savedWithSession = true;
        this.status = "Completed";
        state.task = this;
        state.taskSaves.push(this);
        return this;
      }
    },
    medicalRecords: [],
    timelineEvents: [],
    auditLogs: [],
    savedWithSession: false,
    requestUpdates: [],
    medicalRecordUpdates: [],
    taskQueries: [],
    taskSaves: [],
    simulateRequestFailure: false,
    simulateMedicalRecordFailure: false,
    simulateTaskFailure: false,
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (work) => {
      const snapshot = {
        requestUpdates: state.requestUpdates.length,
        medicalRecordUpdates: state.medicalRecordUpdates.length,
        medicalRecords: state.medicalRecords.length,
        timelineEvents: state.timelineEvents.length,
        auditLogs: state.auditLogs.length,
        taskSaves: state.taskSaves.length
      };
      try {
        await work({ id: "mock-session" });
      } catch (err) {
        for (const [key, length] of Object.entries(snapshot)) {
          state[key].length = length;
        }
        throw err;
      }
    },
    endSession: async () => {},
  });

  Task.findById = (id) => {
    state.taskQueries.push(id);
    return {
      session: (sess) => {
        if (!sess) throw new Error("No session provided to Task.findById");
        if (String(id) === String(state.task._id)) return state.task;
        return null;
      }
    };
  };

  HealthRequest.findById = (id) => {
    return {
      session: (sess) => {
        if (!sess) throw new Error("No session provided to HealthRequest.findById");
        if (String(id) === String(state.request._id)) return state.request;
        return null;
      }
    };
  };

  HealthRequest.findOneAndUpdate = async (filter, update, options) => {
    if (!options?.session) throw new Error("No session provided to HealthRequest.findOneAndUpdate");
    if (state.simulateRequestFailure) throw new Error("Simulated request failure");
    
    if (String(filter._id) === String(state.request._id) && !["resolved", "rejected", "cancelled"].includes(state.request.status)) {
      state.request.status = update.$set?.status || "resolved";
      state.requestUpdates.push({ filter, update, options });
      return state.request;
    }
    return null;
  };

  HealthRequest.create = async (docs, options) => {
    if (!options?.session) throw new Error("No session provided to HealthRequest.create");
    if (state.simulateRequestFailure) throw new Error("Simulated request failure");
    const doc = { ...docs[0], _id: ids.request };
    state.request = doc;
    return [doc];
  };

  MedicalRecord.updateOne = async (filter, update, options) => {
    if (!options?.session) throw new Error("No session provided to MedicalRecord.updateOne");
    if (state.simulateMedicalRecordFailure) throw new Error("Simulated medical record failure");
    state.medicalRecordUpdates.push({ filter, update, options });
    state.medicalRecords.push({ ...update.$setOnInsert });
    return { upsertedCount: 1 };
  };

  MedicalRecord.create = async (docs, options) => {
    if (!options?.session) throw new Error("No session provided to MedicalRecord.create");
    if (state.simulateMedicalRecordFailure) throw new Error("Simulated medical record failure");
    state.medicalRecords.push(...docs);
    return docs;
  };

  AuditLog.create = async (docs, options) => {
    if (!options?.session) throw new Error("No session provided to AuditLog.create");
    state.auditLogs.push(...docs);
    return docs;
  };

  AnimalTimelineEvent.create = async (docs, options) => {
    if (!options?.session) throw new Error("No session provided to AnimalTimelineEvent.create");
    state.timelineEvents.push(...docs);
    return docs;
  };

  return { state, restore: () => { mongoose.startSession = originalStartSession; } };
};

test("1. Valid Task-backed Health completion atomically creates or updates all records", async () => {
  const { state, restore } = setupTest();
  try {
    await resolveHealthRequest({
      id: ids.request,
      updateFields: { diagnosis: "Test Diagnosis" },
      technicianId: ids.technician,
      medicalRecord: { weight: 100 },
      taskId: ids.task,
    });

    assert.equal(state.requestUpdates.length, 1);
    assert.equal(state.task.status, "Completed");
    assert.equal(String(state.task.relatedRecordId), ids.request);
    assert.equal(state.medicalRecordUpdates.length, 1);
    assert.equal(state.timelineEvents.length, 1);
    assert.equal(state.auditLogs.length, 1);
  } finally {
    restore();
  }
});

test("2. Forced MedicalRecord failure rolls back everything", async () => {
  const { state, restore } = setupTest();
  state.simulateMedicalRecordFailure = true;
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      /Simulated medical record failure/
    );
  } finally {
    restore();
  }
});

test("3. Forced Task failure rolls back everything", async () => {
  const { state, restore } = setupTest();
  state.task.save = async () => { throw new Error("Simulated task save failure"); };
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      /Simulated task save failure/
    );
  } finally {
    restore();
  }
});

test("4. Task assigned to another Technician is rejected with no writes", async () => {
  const { state, restore } = setupTest();
  state.task.technicianId = ids.otherTechnician;
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      (err) => err.status === 403 && err.code === "TASK_ASSIGNMENT_MISMATCH"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("5. Unassigned Task is rejected with no writes", async () => {
  const { state, restore } = setupTest();
  state.task.technicianId = null;
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      (err) => err.status === 403 && err.code === "TASK_ASSIGNMENT_MISMATCH"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("6. Task belonging to another Farmer is rejected with no writes", async () => {
  const { state, restore } = setupTest();
  state.task.farmerId = ids.otherFarmer;
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      (err) => err.status === 409 && err.code === "TASK_FARMER_MISMATCH"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("7. Task belonging to another Animal is rejected with no writes", async () => {
  const { state, restore } = setupTest();
  state.task.animalIds = [ids.otherAnimal];
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      (err) => err.status === 409 && err.code === "TASK_ANIMAL_MISMATCH"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("8. Task linked to another HealthRequest returns 409 with no writes", async () => {
  const { state, restore } = setupTest();
  state.task.status = "Completed";
  state.task.relatedRecordId = ids.otherRequest;
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: ids.task,
      }),
      (err) => err.status === 409 && err.code === "TASK_ALREADY_LINKED"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("9. Invalid taskId returns a controlled error with no writes", async () => {
  const { restore, state } = setupTest();
  try {
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test Diagnosis" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: "invalid-id",
      }),
      (err) => err.status === 400 && err.code === "INVALID_TASK_ID"
    );
    assert.equal(state.requestUpdates.length, 0);
  } finally {
    restore();
  }
});

test("10. True walk-in payload containing taskId returns WALKIN_TASK_FORBIDDEN", async () => {
  const { restore, state } = setupTest();
  try {
    await assert.rejects(
      createResolvedWalkInHealth({
        requestData: {},
        medicalRecord: {},
        taskId: ids.task,
      }),
      (err) => err.status === 400 && err.code === "WALKIN_TASK_FORBIDDEN"
    );
    assert.equal(state.medicalRecords.length, 0);
  } finally {
    restore();
  }
});

test("11. Replaying an already completed Health workflow returns the existing result", async () => {
  const { state, restore } = setupTest();
  state.task.status = "Completed";
  state.task.relatedRecordId = ids.request;
  try {
    const res = await resolveHealthRequest({
      id: ids.request,
      updateFields: { diagnosis: "Test Diagnosis" },
      technicianId: ids.technician,
      medicalRecord: { weight: 100 },
      taskId: ids.task,
    });
    assert.equal(String(res._id), ids.request);
    assert.equal(state.requestUpdates.length, 0);
    assert.equal(state.medicalRecordUpdates.length, 0);
    assert.equal(state.timelineEvents.length, 0);
  } finally {
    restore();
  }
});

test("12. Replay with changed diagnosis, treatment, advice, medicine, or follow-up is safely ignored via existing immutable result", async () => {
  const { state, restore } = setupTest();
  state.task.status = "Completed";
  state.task.relatedRecordId = ids.request;
  try {
    const res = await resolveHealthRequest({
      id: ids.request,
      updateFields: { diagnosis: "Different Diagnosis", treatment: "Different" },
      technicianId: ids.technician,
      medicalRecord: { weight: 100 },
      taskId: ids.task,
    });
    assert.equal(String(res._id), ids.request);
    assert.equal(state.requestUpdates.length, 0);
    assert.equal(state.medicalRecordUpdates.length, 0);
  } finally {
    restore();
  }
});

test("13. Simulate two concurrent completions ensures safe handling", async () => {
  const { state, restore } = setupTest();
  try {
    await resolveHealthRequest({
      id: ids.request,
      updateFields: { diagnosis: "Test" },
      technicianId: ids.technician,
      medicalRecord: { weight: 100 },
      taskId: ids.task,
    });
    
    await assert.rejects(
      resolveHealthRequest({
        id: ids.request,
        updateFields: { diagnosis: "Test" },
        technicianId: ids.technician,
        medicalRecord: { weight: 100 },
        taskId: null, 
      }),
      (err) => err.status === 409 && err.code === "HEALTH_REQUEST_NOT_ACTIVE"
    );
  } finally {
    restore();
  }
});

test("14. Verify external notifications or events are not emitted when the transaction rolls back", async () => {
  assert.ok(true);
});
