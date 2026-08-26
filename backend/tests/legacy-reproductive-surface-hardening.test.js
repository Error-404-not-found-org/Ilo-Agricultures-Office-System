import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { deleteInsemination } from "../src/controllers/admin.controllers.js";
import { deleteRequest } from "../src/controllers/ai-request.controllers.js";
import { getMyReInseminations } from "../src/controllers/technician.controllers.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { Calving } from "../src/models/calving.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { archiveInseminationAsAdmin } from "../src/services/admin-insemination-archive.service.js";

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

const adminActor = {
  _id: "507f1f77bcf86cd799439001",
  role: "admin",
  name: "Admin",
  email: "admin@example.com",
};

const installArchiveStore = (t, {
  record = {
    _id: "507f1f77bcf86cd799439011",
    animalId: "507f1f77bcf86cd799439021",
    status: "pending",
    completedAt: null,
    deletedAt: null,
    activeRequestKey: "507f1f77bcf86cd799439021",
  },
  pregnancy = null,
  calving = null,
  laterAttempt = null,
  archived = undefined,
} = {}) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    inseminationExists: Insemination.exists,
    pregnancyExists: Pregnancy.exists,
    calvingExists: Calving.exists,
    auditCreate: AuditLog.create,
  };
  const calls = {
    update: [],
    audit: [],
    laterAttemptFilters: [],
  };

  Insemination.findById = async () => record;
  Insemination.exists = async (filter) => {
    calls.laterAttemptFilters.push(filter);
    return laterAttempt;
  };
  Pregnancy.exists = async () => pregnancy;
  Calving.exists = async () => calving;
  Insemination.findOneAndUpdate = async (...args) => {
    calls.update.push(args);
    if (archived === null) return null;
    return archived || { ...record, deletedAt: new Date("2026-08-25T00:00:00.000Z") };
  };
  AuditLog.create = async (entry) => {
    calls.audit.push(entry);
    return { _id: "507f1f77bcf86cd799439031", ...entry };
  };

  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    Insemination.exists = originals.inseminationExists;
    Pregnancy.exists = originals.pregnancyExists;
    Calving.exists = originals.calvingExists;
    AuditLog.create = originals.auditCreate;
  });

  return calls;
};

test("legacy re-insemination list returns 410 for Technician and Admin without querying records", async () => {
  for (const role of ["technician", "admin"]) {
    const recorder = responseRecorder();
    await getMyReInseminations({ user: { role }, query: {} }, recorder.response);
    assert.equal(recorder.statusCode, 410);
    assert.equal(
      recorder.body.code,
      "LEGACY_REINSEMINATION_LIST_DEPRECATED",
    );
    assert.equal(
      recorder.body.replacements.openRequests,
      "/api/technician/requests",
    );
    assert.equal(
      recorder.body.replacements.myWork,
      "/api/technician/work-queue",
    );
  }
});

test("both Admin archive URLs retain AdminOnly route middleware", () => {
  const adminRoutes = fs.readFileSync(
    new URL("../src/routes/admin.routes.js", import.meta.url),
    "utf8",
  );
  const aiRoutes = fs.readFileSync(
    new URL("../src/routes/ai-request.routes.js", import.meta.url),
    "utf8",
  );
  assert.match(adminRoutes, /router\.use\(protectedRoute, AdminOnly\)/);
  assert.match(
    adminRoutes,
    /router\.delete\("\/delete-insemination\/:id", deleteInsemination\)/,
  );
  assert.match(
    aiRoutes,
    /router\.delete\("\/:id", protectedRoute, AdminOnly, deleteRequest\)/,
  );
});

test("shared archive authority rejects Farmer and Technician before database access", async (t) => {
  const originalFindById = Insemination.findById;
  let reads = 0;
  Insemination.findById = async () => {
    reads += 1;
    return null;
  };
  t.after(() => {
    Insemination.findById = originalFindById;
  });

  for (const role of ["farmer", "technician"]) {
    await assert.rejects(
      archiveInseminationAsAdmin({
        id: "507f1f77bcf86cd799439011",
        actor: { _id: `${role}-1`, role },
      }),
      (error) => error.status === 403 && error.code === "ADMIN_ARCHIVE_REQUIRED",
    );
  }
  assert.equal(reads, 0);
});

test("canonical and compatibility Admin URLs archive the same valid pending request", async (t) => {
  const calls = installArchiveStore(t);
  const controllers = [deleteInsemination, deleteRequest];

  for (const controller of controllers) {
    const recorder = responseRecorder();
    await controller(
      {
        params: { id: "507f1f77bcf86cd799439011" },
        user: adminActor,
        app: { get: () => ({ emit() {} }) },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 200);
    assert.match(recorder.body.message, /soft-deleted successfully/i);
  }

  assert.equal(calls.update.length, 2);
  assert.equal(calls.audit.length, 2);
  for (const [, update] of calls.update) {
    assert.deepEqual(update.$unset, { activeRequestKey: 1 });
  }
  for (const audit of calls.audit) {
    assert.equal(audit.action, "delete_insemination");
    assert.equal(audit.actorId, adminActor._id);
  }
});

test("completed and completed-failed AI history is rejected without writes", async (t) => {
  for (const [name, record] of [
    ["completed", { status: "done", completedAt: new Date() }],
    [
      "completed-failed",
      {
        status: "done",
        completedAt: new Date(),
        isSuccess: false,
        outcome: "Failed (Re-heat)",
      },
    ],
  ]) {
    await t.test(name, async (t) => {
      const calls = installArchiveStore(t, {
        record: {
          _id: `507f1f77bcf86cd79943904${name === "completed" ? "1" : "2"}`,
          animalId: "507f1f77bcf86cd799439021",
          deletedAt: null,
          ...record,
        },
      });
      await assert.rejects(
        archiveInseminationAsAdmin({
          id: "507f1f77bcf86cd799439041",
          actor: adminActor,
        }),
        (error) =>
          error.status === 409 &&
          error.code === "INSEMINATION_ARCHIVE_COMPLETED_RECORD",
      );
      assert.equal(calls.update.length, 0);
      assert.equal(calls.audit.length, 0);
    });
  }
});

test("Pregnancy, Calving, and attempt-series links independently block archive", async (t) => {
  for (const [name, links] of [
    ["pregnancy", { pregnancy: { _id: "pregnancy-1" } }],
    ["calving", { calving: { _id: "calving-1" } }],
    ["later-attempt", { laterAttempt: { _id: "attempt-2" } }],
  ]) {
    await t.test(name, async (t) => {
      const calls = installArchiveStore(t, {
        record: {
          _id: "507f1f77bcf86cd799439051",
          animalId: "507f1f77bcf86cd799439021",
          status: "pending",
          completedAt: null,
          deletedAt: null,
          attemptSeriesId: "507f1f77bcf86cd799439061",
        },
        ...links,
      });
      await assert.rejects(
        archiveInseminationAsAdmin({
          id: "507f1f77bcf86cd799439051",
          actor: adminActor,
        }),
        (error) =>
          error.status === 409 &&
          error.code === "INSEMINATION_ARCHIVE_LINKED_HISTORY",
      );
      assert.equal(calls.update.length, 0);
      assert.equal(calls.audit.length, 0);
      assert.deepEqual(calls.laterAttemptFilters[0].$or, [
        { previousAttemptId: "507f1f77bcf86cd799439051" },
        { attemptSeriesId: "507f1f77bcf86cd799439061" },
      ]);
    });
  }
});

test("a concurrent completion loses the atomic archive and preserves duplicate protection", async (t) => {
  const calls = installArchiveStore(t, { archived: null });

  await assert.rejects(
    archiveInseminationAsAdmin({
      id: "507f1f77bcf86cd799439011",
      actor: adminActor,
    }),
    (error) =>
      error.status === 409 && error.code === "INSEMINATION_ARCHIVE_CONFLICT",
  );

  assert.equal(calls.update.length, 1);
  const [filter, update] = calls.update[0];
  assert.deepEqual(filter, {
    _id: "507f1f77bcf86cd799439011",
    deletedAt: null,
    status: { $ne: "done" },
    completedAt: null,
  });
  assert.deepEqual(update.$unset, { activeRequestKey: 1 });
  assert.equal(calls.audit.length, 0);
});
