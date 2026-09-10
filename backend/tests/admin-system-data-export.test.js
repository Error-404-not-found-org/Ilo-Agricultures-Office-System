import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Calving } from "../src/models/calving.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Config } from "../src/models/config.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import {
  exportDatabaseBackup,
  SYSTEM_DATA_EXPORT_PROJECTIONS,
} from "../src/controllers/admin.controllers.js";
import {
  AdminOnly,
  protectedRoute,
} from "../src/middleware/auth.middleware.js";
import { systemDataExportLimiter } from "../src/middleware/rateLimit.middleware.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";

const responseRecorder = () => {
  const state = {
    statusCode: null,
    jsonBody: null,
    sendBody: null,
    headers: {},
  };
  const response = {
    setHeader(name, value) {
      state.headers[name] = value;
      return response;
    },
    getHeader(name) {
      return state.headers[name];
    },
    status(code) {
      state.statusCode = code;
      return response;
    },
    json(body) {
      state.jsonBody = body;
      return response;
    },
    send(body) {
      state.sendBody = body;
      return response;
    },
  };
  return { state, response };
};

const authorizeAdminRoute = async (req, onAuthorized = null) => {
  const recorder = responseRecorder();
  let authenticated = false;
  await protectedRoute(req, recorder.response, () => {
    authenticated = true;
  });
  if (!authenticated) return { ...recorder, authorized: false };

  let authorized = false;
  AdminOnly(req, recorder.response, () => {
    authorized = true;
  });
  if (authorized && onAuthorized) await onAuthorized();
  return { ...recorder, authorized };
};

const readPath = (value, path) =>
  path.split(".").reduce((current, key) => current?.[key], value);

const writePath = (target, path, value) => {
  const parts = path.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current[parts[index]] ||= {};
    current = current[parts[index]];
  }
  current[parts.at(-1)] = value;
};

const projectDocument = (document, projection) => {
  const projected = {};
  for (const [path, enabled] of Object.entries(projection)) {
    if (!enabled) continue;
    const value = readPath(document, path);
    if (value !== undefined) writePath(projected, path, value);
  }
  return projected;
};

const mockProjectedFind = ({
  mock,
  model,
  collection,
  documents,
  calls,
  filterDocuments = (items) => items,
}) => {
  mock.method(model, "find", (filter) => {
    calls.push({ collection, filter, projection: null });
    const call = calls.at(-1);
    const query = {
      select(projection) {
        call.projection = projection;
        return query;
      },
      async lean() {
        return filterDocuments(documents, filter).map((document) =>
          projectDocument(document, call.projection),
        );
      },
    };
    return query;
  });
};

const assertProjectionExcludes = (projection, fields) => {
  for (const field of fields) {
    assert.equal(
      Object.hasOwn(projection, field),
      false,
      `projection must exclude ${field}`,
    );
  }
};

test("System Data Export: route remains protected by protectedRoute + AdminOnly", () => {
  const routeSource = fs.readFileSync(
    new URL("../src/routes/admin.routes.js", import.meta.url),
    "utf8",
  );
  assert.match(routeSource, /router\.use\(protectedRoute, AdminOnly\)/);
  assert.match(
    routeSource,
    /router\.get\("\/backup", systemDataExportLimiter, exportDatabaseBackup\)/,
  );
});

test("System Data Export: unauthenticated, Farmer, and Technician requests are rejected before export work", async () => {
  let exportSideEffects = 0;

  const countExportSideEffect = () => {
    exportSideEffects += 1;
  };
  const unauthenticated = await authorizeAdminRoute(
    {},
    countExportSideEffect,
  );
  assert.equal(unauthenticated.state.statusCode, 401);
  assert.equal(unauthenticated.authorized, false);

  for (const role of ["farmer", "technician"]) {
    const result = await authorizeAdminRoute({
      auth: { userId: `clerk-${role}` },
      user: {
        _id: `${role}-id`,
        role,
        status: "active",
        deletedAt: null,
      },
    }, countExportSideEffect);
    assert.equal(result.state.statusCode, 403);
    assert.equal(result.authorized, false);
  }

  assert.equal(exportSideEffects, 0);
});

test("System Data Export: Admin receives the privacy-hardened versioned contract", async (t) => {
  t.mock.method(console, "log", () => {});
  const calls = [];
  const auditActions = [];
  const configUpdates = [];

  const userDocuments = [
    {
      _id: "farmer-1",
      name: "Farmer One",
      role: "farmer",
      isVerified: true,
      status: "active",
      email: "private@example.test",
      phoneNumber: "09170000000",
      clerkId: "clerk-secret",
      normalizedEmail: "private@example.test",
      normalizedPhoneNumber: "639170000000",
      profileClaimedByClerkId: "clerk-secret",
      phoneVerification: { failedAttempts: 2 },
      pushToken: "ExpoPushToken[secret]",
      address: { coordinates: { lat: 10.7, lng: 122.5 } },
      farmLocation: { latitude: 10.7, longitude: 122.5 },
      dispatchProfile: { acceptsNewRequests: true },
      deletedAt: null,
      __v: 4,
    },
    {
      _id: "technician-1",
      name: "Technician One",
      role: "technician",
      isVerified: true,
      status: "active",
      deletedAt: null,
    },
    {
      _id: ADMIN_ID,
      name: "Admin One",
      role: "admin",
      status: "active",
      deletedAt: null,
    },
  ];

  mockProjectedFind({
    mock: t.mock,
    model: User,
    collection: "users",
    documents: userDocuments,
    calls,
    filterDocuments: (items, filter) =>
      items.filter(
        (item) =>
          filter.role.$in.includes(item.role) &&
          item.deletedAt === filter.deletedAt,
      ),
  });
  mockProjectedFind({
    mock: t.mock,
    model: Animal,
    collection: "animals",
    documents: [{
      _id: "animal-1",
      farmerId: "farmer-1",
      animalId: "OTN-001",
      earTag: "001",
      species: "Cattle",
      breed: "Brahman",
      imageUrl: "data:image/png;base64,secret",
      activityLogs: [{ event: "internal" }],
      deletedAt: null,
      __v: 1,
    }],
    calls,
  });
  mockProjectedFind({
    mock: t.mock,
    model: Insemination,
    collection: "inseminations",
    documents: [{
      _id: "ai-1",
      farmerId: "farmer-1",
      animalId: "animal-1",
      status: "done",
      outcome: "Pregnant",
      activeRequestKey: "animal-1",
      claimedAt: new Date(),
      technicianNote: "private",
      dispatch: { stage: "local" },
      evidencePhotos: ["data:image/jpeg;base64,secret"],
      imageUrl: "https://private.example/image.jpg",
      deletedAt: null,
    }],
    calls,
  });
  mockProjectedFind({
    mock: t.mock,
    model: Pregnancy,
    collection: "pregnancies",
    documents: [{
      _id: "pregnancy-1",
      animalId: "animal-1",
      farmerId: "farmer-1",
      inseminationId: "ai-1",
      pregnancyDiagnosis: { result: "Pregnant" },
      technicianNote: "private",
      deletedAt: null,
    }],
    calls,
  });
  mockProjectedFind({
    mock: t.mock,
    model: Calving,
    collection: "calvings",
    documents: [{
      _id: "calving-1",
      animalId: "animal-1",
      farmerId: "farmer-1",
      pregnancyId: "pregnancy-1",
      inseminationId: "ai-1",
      outcome: "live_birth",
      locationAddress: "private farm",
      technicianNote: "private",
      deletedAt: null,
    }],
    calls,
  });
  mockProjectedFind({
    mock: t.mock,
    model: MedicalRecord,
    collection: "medicalRecords",
    documents: [{
      _id: "medical-1",
      animalId: "animal-1",
      farmerId: "farmer-1",
      technicianId: "technician-1",
      healthRequestId: "health-1",
      type: "Treatment",
      details: { diagnosis: "Fever", treatment: "Medicine" },
      imageUrl: "data:image/png;base64,secret",
    }],
    calls,
  });
  mockProjectedFind({
    mock: t.mock,
    model: HealthRequest,
    collection: "healthRequests",
    documents: [{
      _id: "health-1",
      farmerId: "farmer-1",
      animalId: "animal-1",
      requestType: "disease",
      symptoms: "Fever",
      status: "resolved",
      activeCaseKey: "animal-1:disease",
      sourceOperationKey: "secret-operation",
      claimedAt: new Date(),
      technicianNote: "private",
      photos: ["data:image/png;base64,secret"],
      imageUrl: "https://private.example/image.jpg",
      dispatch: { stage: "local" },
      deletedAt: null,
    }],
    calls,
  });

  t.mock.method(Config, "findOneAndUpdate", async (filter, update) => {
    configUpdates.push({ filter, update });
    return { ...filter, ...update };
  });
  t.mock.method(AuditLog, "create", async (entry) => {
    auditActions.push(entry.action);
    return entry;
  });

  const authorization = await authorizeAdminRoute({
    auth: { userId: "clerk-admin" },
    user: {
      _id: ADMIN_ID,
      role: "admin",
      status: "active",
      deletedAt: null,
      name: "Admin One",
      email: "admin@example.test",
    },
  });
  assert.equal(authorization.authorized, true);

  await exportDatabaseBackup(
    {
      user: {
        _id: ADMIN_ID,
        role: "admin",
        name: "Admin One",
        email: "admin@example.test",
      },
    },
    authorization.response,
  );

  assert.equal(authorization.state.statusCode, 200);
  const payload = JSON.parse(authorization.state.sendBody);
  assert.equal(payload.metadata.format, "breedsmart-admin-data-export");
  assert.equal(payload.metadata.formatVersion, 1);
  assert.equal(payload.metadata.privacyProfile, "admin-export-v1");
  assert.equal(payload.metadata.consistency, "non-transactional");
  assert.equal(payload.metadata.includesArchived, false);
  assert.equal(payload.metadata.includesAttachments, false);
  assert.equal(payload.metadata.generatedBy.userId, ADMIN_ID);
  assert.deepEqual(Object.keys(payload.data), [
    "users",
    "animals",
    "inseminations",
    "pregnancies",
    "calvings",
    "medicalRecords",
    "healthRequests",
  ]);
  assert.equal(Object.hasOwn(payload, "configs"), false);
  assert.equal(Object.hasOwn(payload.data, "configs"), false);
  assert.equal(payload.data.users.some((user) => user.role === "admin"), false);
  assert.equal(payload.data.users.length, 2);
  assert.equal(payload.data.medicalRecords.length, 1);

  for (const [collection, items] of Object.entries(payload.data)) {
    assert.equal(payload.metadata.collections[collection], items.length);
  }

  const serialized = JSON.stringify(payload);
  for (const sensitiveValue of [
    "clerk-secret",
    "ExpoPushToken[secret]",
    "private@example.test",
    "09170000000",
    "secret-operation",
    "data:image",
    "private.example",
    "private farm",
  ]) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }

  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.users, [
    "email",
    "phoneNumber",
    "clerkId",
    "normalizedEmail",
    "normalizedPhoneNumber",
    "profileClaimedByClerkId",
    "phoneVerification",
    "pushToken",
    "address",
    "farmLocation",
    "dispatchProfile",
    "deletedAt",
    "deactivatedBy",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.animals, [
    "imageUrl",
    "activityLogs",
    "normalizedEarTag",
    "deletedAt",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.inseminations, [
    "activeRequestKey",
    "declinedByTechnicianIds",
    "claimedAt",
    "technicianNote",
    "comment",
    "imageUrl",
    "evidencePhotos",
    "farmerPregnancyPhotos",
    "statusHistory",
    "dispatch",
    "deletedAt",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.pregnancies, [
    "technicianNote",
    "deletedAt",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.calvings, [
    "locationAddress",
    "technicianNote",
    "deletedAt",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.medicalRecords, [
    "imageUrl",
    "__v",
  ]);
  assertProjectionExcludes(SYSTEM_DATA_EXPORT_PROJECTIONS.healthRequests, [
    "activeCaseKey",
    "sourceOperationKey",
    "imageUrl",
    "photos",
    "declinedByTechnicianIds",
    "claimedAt",
    "technicianNote",
    "statusHistory",
    "dispatch",
    "farmerDismissedAt",
    "deletedAt",
    "__v",
  ]);

  assert.deepEqual(auditActions, ["backup_started", "backup_completed"]);
  assert.deepEqual(configUpdates, []);
  assert.equal(authorization.state.headers["Content-Type"], "application/json");
  assert.equal(
    authorization.state.headers["Cache-Control"],
    "private, no-store",
  );
  assert.match(
    authorization.state.headers["Content-Disposition"],
    /^attachment; filename=BreedSmart_Backup_\d{4}-\d{2}-\d{2}\.json$/,
  );

  assert.equal(calls.length, 7);
  assert.deepEqual(calls[0].filter, {
    role: { $in: ["farmer", "technician"] },
    deletedAt: null,
  });
  for (const call of calls.slice(1).filter((entry) => entry.collection !== "medicalRecords")) {
    assert.deepEqual(call.filter, { deletedAt: null });
  }
});

test("System Data Export: failure is audited without exposing internal exception text", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});

  const secretError = "Mongo host production-secret.internal timed out";
  const failedQuery = {
    select() {
      return failedQuery;
    },
    async lean() {
      throw new Error(secretError);
    },
  };
  t.mock.method(User, "find", () => failedQuery);

  for (const model of [
    Animal,
    Insemination,
    Pregnancy,
    Calving,
    MedicalRecord,
    HealthRequest,
  ]) {
    t.mock.method(model, "find", () => {
      const query = {
        select() {
          return query;
        },
        async lean() {
          return [];
        },
      };
      return query;
    });
  }

  const configStates = [];
  const auditEntries = [];
  t.mock.method(Config, "findOneAndUpdate", async (filter, update) => {
    configStates.push(update.value);
    return { ...filter, ...update };
  });
  t.mock.method(AuditLog, "create", async (entry) => {
    auditEntries.push(entry);
    return entry;
  });

  const recorder = responseRecorder();
  await exportDatabaseBackup(
    {
      user: {
        _id: ADMIN_ID,
        role: "admin",
        name: "Admin One",
        email: "admin@example.test",
      },
    },
    recorder.response,
  );

  assert.equal(recorder.state.statusCode, 500);
  assert.deepEqual(recorder.state.jsonBody, {
    message: "Failed to generate system data export.",
    code: "SYSTEM_DATA_EXPORT_FAILED",
  });
  assert.equal(JSON.stringify(recorder.state.jsonBody).includes(secretError), false);
  assert.deepEqual(configStates, []);
  assert.deepEqual(
    auditEntries.map((entry) => entry.action),
    ["backup_started", "backup_failed"],
  );
  const failureAudit = auditEntries.find(
    (entry) => entry.action === "backup_failed",
  );
  assert.equal(failureAudit.metadata.failureCategory, "export_failed");
  assert.equal(JSON.stringify(failureAudit).includes(secretError), false);
  assert.equal(Object.hasOwn(failureAudit.metadata, "error"), false);
  assert.equal(recorder.state.sendBody, null);
});

const mockEmptyExportFinds = ({ mock, userLean, onFind = () => {} }) => {
  for (const model of [
    User,
    Animal,
    Insemination,
    Pregnancy,
    Calving,
    MedicalRecord,
    HealthRequest,
  ]) {
    mock.method(model, "find", () => {
      onFind(model.modelName);
      const query = {
        select() {
          return query;
        },
        lean:
          model === User
            ? userLean
            : async () => [],
      };
      return query;
    });
  }
};

const exportRequest = (userId = ADMIN_ID) => ({
  user: {
    _id: userId,
    role: "admin",
    name: "Admin One",
    email: "admin@example.test",
  },
});

test("System Data Export: process lock rejects concurrent work and releases after success", async (t) => {
  t.mock.method(console, "log", () => {});
  let resolveUserRead;
  const pendingUserRead = new Promise((resolve) => {
    resolveUserRead = resolve;
  });
  let collectionReads = 0;
  mockEmptyExportFinds({
    mock: t.mock,
    userLean: () => pendingUserRead,
    onFind: () => {
      collectionReads += 1;
    },
  });

  const auditActions = [];
  t.mock.method(AuditLog, "create", async (entry) => {
    auditActions.push(entry.action);
    return entry;
  });

  const first = responseRecorder();
  const firstExport = exportDatabaseBackup(exportRequest(), first.response);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(collectionReads, 7);
  assert.deepEqual(auditActions, ["backup_started"]);

  const concurrent = responseRecorder();
  await exportDatabaseBackup(exportRequest(), concurrent.response);
  assert.equal(concurrent.state.statusCode, 409);
  assert.deepEqual(concurrent.state.jsonBody, {
    message:
      "A system data export is already in progress. Please try again shortly.",
    code: "SYSTEM_DATA_EXPORT_IN_PROGRESS",
    retryable: true,
  });
  assert.equal(collectionReads, 7);
  assert.deepEqual(auditActions, ["backup_started"]);

  resolveUserRead([]);
  await firstExport;
  assert.equal(first.state.statusCode, 200);

  const later = responseRecorder();
  await exportDatabaseBackup(exportRequest(), later.response);
  assert.equal(later.state.statusCode, 200);
  assert.equal(collectionReads, 14);
  assert.deepEqual(auditActions, [
    "backup_started",
    "backup_completed",
    "backup_started",
    "backup_completed",
  ]);
});

test("System Data Export: failed failure-audit stays sanitized and releases the lock", async (t) => {
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
  let failRead = true;
  mockEmptyExportFinds({
    mock: t.mock,
    userLean: async () => {
      if (failRead) {
        throw new Error("database.internal.example leaked failure");
      }
      return [];
    },
  });

  const auditActions = [];
  t.mock.method(AuditLog, "create", async (entry) => {
    auditActions.push(entry.action);
    if (entry.action === "backup_failed") {
      throw new Error("audit.internal.example leaked failure");
    }
    return entry;
  });

  const failed = responseRecorder();
  await exportDatabaseBackup(exportRequest(), failed.response);
  assert.equal(failed.state.statusCode, 500);
  assert.deepEqual(failed.state.jsonBody, {
    message: "Failed to generate system data export.",
    code: "SYSTEM_DATA_EXPORT_FAILED",
  });
  assert.equal(
    JSON.stringify(failed.state).includes("internal.example"),
    false,
  );

  failRead = false;
  const recovered = responseRecorder();
  await exportDatabaseBackup(exportRequest(), recovered.response);
  assert.equal(recovered.state.statusCode, 200);
  assert.deepEqual(auditActions, [
    "backup_started",
    "backup_failed",
    "backup_started",
    "backup_completed",
  ]);
});

const runExportLimiter = async (userId) => {
  const recorder = responseRecorder();
  let allowed = false;
  await systemDataExportLimiter(
    {
      user: { _id: userId },
      headers: {},
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
    },
    recorder.response,
    () => {
      allowed = true;
    },
  );
  return { ...recorder, allowed };
};

test("System Data Export: limiter allows three attempts per Admin and isolates quotas", async () => {
  const firstAdminId = "507f1f77bcf86cd799439021";
  const secondAdminId = "507f1f77bcf86cd799439022";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await runExportLimiter(firstAdminId);
    assert.equal(result.allowed, true, `attempt ${attempt} should be allowed`);
  }

  const limited = await runExportLimiter(firstAdminId);
  assert.equal(limited.allowed, false);
  assert.equal(limited.state.statusCode, 429);
  assert.equal(
    limited.state.sendBody.code,
    "SYSTEM_DATA_EXPORT_RATE_LIMITED",
  );

  const otherAdmin = await runExportLimiter(secondAdminId);
  assert.equal(otherAdmin.allowed, true);
});
