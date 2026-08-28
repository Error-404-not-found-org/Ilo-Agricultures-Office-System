import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { Animal } from "../src/models/animal.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import {
  deleteInsemination,
  updateInsemination,
} from "../src/controllers/insemination.controllers.js";
import { deleteInsemination as archiveInsemination } from "../src/controllers/admin.controllers.js";

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
    send(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

const installWriteTripwires = (t) => {
  const originals = {
    findById: Insemination.findById,
    findByIdAndUpdate: Insemination.findByIdAndUpdate,
    updateOne: Insemination.updateOne,
    animalUpdate: Animal.findByIdAndUpdate,
  };
  const calls = [];
  Insemination.findById = async () => {
    calls.push("Insemination.findById");
    throw new Error("generic mutation reached the database");
  };
  Insemination.findByIdAndUpdate = async () => {
    calls.push("Insemination.findByIdAndUpdate");
    throw new Error("generic mutation reached the database");
  };
  Insemination.updateOne = async () => {
    calls.push("Insemination.updateOne");
    throw new Error("generic mutation reached the database");
  };
  Animal.findByIdAndUpdate = async () => {
    calls.push("Animal.findByIdAndUpdate");
    throw new Error("generic mutation reached the database");
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findByIdAndUpdate = originals.findByIdAndUpdate;
    Insemination.updateOne = originals.updateOne;
    Animal.findByIdAndUpdate = originals.animalUpdate;
  });
  return calls;
};

test("generic update rejects owning, non-owning, conflicting, and Admin actors with zero writes", async (t) => {
  const calls = installWriteTripwires(t);
  const actors = [
    { _id: "technician-a", role: "technician" },
    { _id: "technician-b", role: "technician" },
    { _id: "admin-a", role: "admin" },
  ];

  for (const user of actors) {
    const recorder = responseRecorder();
    await updateInsemination(
      {
        params: { id: "attempt-1" },
        user,
        body: {
          approvedBy: "technician-a",
          technicianId: "technician-b",
          status: "done",
          outcome: "Failed (Re-heat)",
          failureReason: "return_to_heat",
          previousAttemptId: "different-attempt",
          inseminationDate: "2026-08-01",
          sireBreed: "Brahman",
          sireCode: "BR-001",
          estrus: "Natural",
        },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 405);
    assert.equal(
      recorder.body.code,
      "GENERIC_INSEMINATION_MUTATION_DISABLED",
    );
  }

  assert.deepEqual(calls, []);
});

test("editing a completed AI cannot reset a Pregnant Animal to Inseminated", async (t) => {
  const calls = installWriteTripwires(t);
  const recorder = responseRecorder();

  await updateInsemination(
    {
      params: { id: "completed-attempt" },
      user: { _id: "technician-a", role: "technician" },
      body: { status: "done", sireCode: "BR-002" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 405);
  assert.equal(
    recorder.body.code,
    "GENERIC_INSEMINATION_MUTATION_DISABLED",
  );
  assert.deepEqual(calls, []);
});

test("generic delete cannot erase Insemination, Pregnancy, or Calving lineage", async (t) => {
  const calls = installWriteTripwires(t);

  for (const user of [
    { _id: "technician-a", role: "technician" },
    { _id: "technician-b", role: "technician" },
    { _id: "admin-a", role: "admin" },
  ]) {
    const recorder = responseRecorder();
    await deleteInsemination(
      {
        params: { id: "attempt-1" },
        user,
        body: { reason: "remove history" },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 405);
    assert.equal(
      recorder.body.code,
      "GENERIC_INSEMINATION_MUTATION_DISABLED",
    );
  }

  assert.deepEqual(calls, []);
});

test("explicit Admin archive route remains protected by AdminOnly", () => {
  const routes = fs.readFileSync(
    new URL("../src/routes/admin.routes.js", import.meta.url),
    "utf8",
  );
  assert.match(routes, /router\.use\(protectedRoute, AdminOnly\)/);
  assert.match(
    routes,
    /router\.delete\("\/delete-insemination\/:id", deleteInsemination\)/,
  );
});

test("Admin archive refuses an attempt with linked breeding history before writing", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    inseminationExists: Insemination.exists,
    pregnancyExists: Pregnancy.exists,
    calvingExists: Calving.exists,
  };
  let saveCalled = false;
  let laterAttemptFilter;
  Insemination.findById = async () => ({
    _id: "attempt-1",
    animalId: "animal-1",
    attemptSeriesId: "series-1",
    deletedAt: null,
    async save() {
      saveCalled = true;
    },
  });
  Insemination.exists = async (filter) => {
    laterAttemptFilter = filter;
    return { _id: "attempt-2" };
  };
  Pregnancy.exists = async () => ({ _id: "pregnancy-1" });
  Calving.exists = async () => ({ _id: "calving-1" });
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.exists = originals.inseminationExists;
    Pregnancy.exists = originals.pregnancyExists;
    Calving.exists = originals.calvingExists;
  });

  const recorder = responseRecorder();
  await archiveInsemination(
    {
      params: { id: "attempt-1" },
      user: { _id: "admin-a", role: "admin" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "INSEMINATION_ARCHIVE_LINKED_HISTORY");
  assert.equal(saveCalled, false);
  assert.deepEqual(laterAttemptFilter.$or, [
    { previousAttemptId: "attempt-1" },
    { attemptSeriesId: "series-1" },
  ]);
});

test("Admin archive still audits and archives an unlinked AI record", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    inseminationExists: Insemination.exists,
    pregnancyExists: Pregnancy.exists,
    calvingExists: Calving.exists,
    auditCreate: AuditLog.create,
  };
  const record = {
    _id: "unlinked-attempt",
    animalId: "animal-1",
    deletedAt: null,
    status: "pending",
    completedAt: null,
  };
  let archiveCalls = 0;
  let auditCalls = 0;
  Insemination.findById = async () => record;
  Insemination.exists = async () => null;
  Pregnancy.exists = async () => null;
  Calving.exists = async () => null;
  Insemination.findOneAndUpdate = async () => {
    archiveCalls += 1;
    return { ...record, deletedAt: new Date() };
  };
  AuditLog.create = async () => {
    auditCalls += 1;
    return { _id: "audit-1" };
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    Insemination.exists = originals.inseminationExists;
    Pregnancy.exists = originals.pregnancyExists;
    Calving.exists = originals.calvingExists;
    AuditLog.create = originals.auditCreate;
  });

  const recorder = responseRecorder();
  await archiveInsemination(
    {
      params: { id: "unlinked-attempt" },
      user: {
        _id: "admin-a",
        role: "admin",
        name: "Admin",
        email: "admin@example.com",
      },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(archiveCalls, 1);
  assert.equal(auditCalls, 1);
});

test("Admin archive rejects completed official AI history before link checks or writes", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    inseminationExists: Insemination.exists,
  };
  let queriedLinks = false;
  let archiveCalls = 0;
  Insemination.findById = async () => ({
    _id: "completed-attempt",
    animalId: "animal-1",
    status: "done",
    completedAt: new Date("2026-08-01T00:00:00.000Z"),
  });
  Insemination.exists = async () => {
    queriedLinks = true;
    return null;
  };
  Insemination.findOneAndUpdate = async () => {
    archiveCalls += 1;
    return null;
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    Insemination.exists = originals.inseminationExists;
  });

  const recorder = responseRecorder();
  await archiveInsemination(
    {
      params: { id: "completed-attempt" },
      user: { _id: "admin-a", role: "admin" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "INSEMINATION_ARCHIVE_COMPLETED_RECORD");
  assert.equal(queriedLinks, false);
  assert.equal(archiveCalls, 0);
});
