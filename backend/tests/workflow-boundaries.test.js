import test from "node:test";
import assert from "node:assert/strict";
import { Task } from "../src/models/task.model.js";
import { FieldNote } from "../src/models/field-note.model.js";
import { User } from "../src/models/user.model.js";
import { createTask } from "../src/controllers/tasks.controllers.js";
import {
  createFieldNote,
  deleteFieldNote,
} from "../src/controllers/technician.controllers.js";

function createMockRes() {
  let statusValue = 200;
  let jsonValue = null;
  return {
    status(code) {
      statusValue = code;
      return this;
    },
    json(value) {
      jsonValue = value;
      return this;
    },
    get statusValue() {
      return statusValue;
    },
    get jsonValue() {
      return jsonValue;
    },
  };
}

test("manual task creation rejects official service types before database writes", async () => {
  const originalCreate = Task.create;
  let createCalled = false;
  Task.create = async () => {
    createCalled = true;
  };

  try {
    const req = {
      user: { _id: "technician-1" },
      body: {
        farmerId: "farmer-1",
        category: "Routine",
        notes: "Manual AI visit",
        taskType: "AI",
      },
    };
    const res = createMockRes();

    await createTask(req, res);

    assert.equal(res.statusValue, 400);
    assert.equal(
      res.jsonValue.code,
      "OFFICIAL_SERVICE_WORKFLOW_REQUIRED",
    );
    assert.equal(createCalled, false);
  } finally {
    Task.create = originalCreate;
  }
});

test("field note creation links an explicitly selected farmer without name matching", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = FieldNote.create;
  const farmerId = "64b000000000000000000001";
  const technicianId = "64b000000000000000000002";
  let capturedUserQuery;
  let capturedNote;

  User.findOne = (query) => {
    capturedUserQuery = query;
    return {
      select: async () => ({ _id: farmerId, name: "Maria Santos" }),
    };
  };
  FieldNote.create = async (note) => {
    capturedNote = note;
    return { _id: "field-note-1", ...note };
  };

  try {
    const req = {
      user: { _id: technicianId, name: "Tech One" },
      body: {
        farmerId,
        farmerName: "Wrong display name",
        title: "Fence condition",
        description: "North fence needs repair.",
        latitude: "10.6967",
        longitude: "122.4820",
      },
      app: {
        get: () => ({ emit() {} }),
      },
    };
    const res = createMockRes();

    await createFieldNote(req, res);

    assert.equal(res.statusValue, 201);
    assert.equal(capturedUserQuery._id, farmerId);
    assert.equal(capturedUserQuery.role, "farmer");
    assert.equal(String(capturedNote.farmerId), farmerId);
    assert.equal(capturedNote.farmerName, "Maria Santos");
    assert.equal(capturedNote.latitude, "10.696700");
    assert.equal(capturedNote.longitude, "122.482000");
  } finally {
    User.findOne = originalFindOne;
    FieldNote.create = originalCreate;
  }
});

test("mobile field note deletion only soft-deletes the technician's field note", async () => {
  const originalFindOneAndUpdate = FieldNote.findOneAndUpdate;
  let capturedQuery;
  let capturedUpdate;

  FieldNote.findOneAndUpdate = async (query, update) => {
    capturedQuery = query;
    capturedUpdate = update;
    return { _id: "field-note-1" };
  };

  try {
    const req = {
      user: { _id: "technician-1" },
      params: { id: "field-note-1" },
    };
    const res = createMockRes();

    await deleteFieldNote(req, res);

    assert.equal(res.statusValue, 200);
    assert.deepEqual(capturedQuery, {
      _id: "field-note-1",
      technicianId: "technician-1",
      deletedAt: null,
    });
    assert.ok(capturedUpdate.$set.deletedAt instanceof Date);
    assert.match(res.jsonValue.message, /archived/i);
  } finally {
    FieldNote.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
