import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  claimAndScheduleAIRequest,
  updateRequestStatus,
} from "../src/controllers/ai-request.controllers.js";
import { updateInsemination } from "../src/controllers/insemination.controllers.js";
import { claimRequest } from "../src/controllers/technician.controllers.js";
import { protectedRoute, requireRole } from "../src/middleware/auth.middleware.js";
import { Animal } from "../src/models/animal.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import {
  assertAIRequestStatusAccess,
  buildAIRequestAssignmentGuard,
} from "../src/policies/request.policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeSource = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "src", "routes", name), "utf8");

const createResponseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(payload) {
      recorder.body = payload;
      return this;
    },
  };
  return recorder;
};

const runRoleGuard = (role) => {
  const recorder = createResponseRecorder();
  let nextCalled = false;
  requireRole(["technician", "admin"])(
    { user: role ? { role } : null },
    recorder.response,
    () => {
      nextCalled = true;
    },
  );
  return { ...recorder, nextCalled };
};

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

test("AI authorization: list and status routes require technician or admin", () => {
  const aiRoutes = routeSource("ai-request.routes.js");
  const technicianRoutes = routeSource("technician.routes.js");

  assert.match(
    aiRoutes,
    /router\.get\(\s*"\/",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\),\s*getAllRequests,\s*\)/,
  );
  assert.match(
    aiRoutes,
    /router\.patch\(\s*"\/:id\/status",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\),\s*updateRequestStatus,\s*\)/,
  );
  assert.match(
    aiRoutes,
    /router\.patch\(\s*"\/:id\/claim-and-schedule",\s*protectedRoute,\s*requireRole\(\["technician"\]\),\s*claimAndScheduleAIRequest,\s*\)/,
  );
  assert.match(
    technicianRoutes,
    /router\.patch\(\s*"\/inseminations\/:id\/status",\s*requireRole\(\["technician", "admin"\]\),\s*updateCanonicalAIRequestStatus,\s*\)/,
  );

  assert.equal(runRoleGuard("technician").nextCalled, true);
  assert.equal(runRoleGuard("admin").nextCalled, true);
  assert.equal(runRoleGuard("farmer").statusCode, 403);
  assert.equal(runRoleGuard("veterinarian").statusCode, 403);

  const technicianOnly = createResponseRecorder();
  let technicianOnlyNext = false;
  requireRole(["technician"])(
    { user: { role: "technician" } },
    technicianOnly.response,
    () => {
      technicianOnlyNext = true;
    },
  );
  assert.equal(technicianOnlyNext, true);
  assert.equal(typeof claimAndScheduleAIRequest, "function");
});

test("AI authorization: unauthenticated callers are rejected", async () => {
  const recorder = createResponseRecorder();
  let nextCalled = false;

  await protectedRoute({ auth: {} }, recorder.response, () => {
    nextCalled = true;
  });

  assert.equal(recorder.statusCode, 401);
  assert.equal(recorder.body.code, "AUTH_REQUIRED");
  assert.equal(nextCalled, false);
});

test("AI authorization: farmer cannot update an arbitrary request status", () => {
  assert.throws(
    () =>
      assertAIRequestStatusAccess(
        { _id: "farmer-1", role: "farmer" },
        { _id: "request-1", farmerId: "farmer-1", approvedBy: null },
      ),
    (error) => error.status === 403 && error.code === "STAFF_ACCESS_REQUIRED",
  );
});

test("AI authorization: assigned technician is allowed and another technician is denied", () => {
  const request = { _id: "request-1", approvedBy: "technician-1" };

  assert.doesNotThrow(() =>
    assertAIRequestStatusAccess(
      { _id: "technician-1", role: "technician" },
      request,
    ),
  );
  assert.throws(
    () =>
      assertAIRequestStatusAccess(
        { _id: "technician-2", role: "technician" },
        request,
      ),
    (error) =>
      error.status === 403 && error.code === "AI_REQUEST_ASSIGNED_TO_OTHER",
  );
});

test("AI authorization: unassigned status changes require the claim operation", () => {
  assert.throws(
    () =>
      assertAIRequestStatusAccess(
        { _id: "technician-1", role: "technician" },
        { _id: "request-1", status: "pending", approvedBy: null },
      ),
    (error) =>
      error.status === 409 && error.code === "AI_REQUEST_CLAIM_REQUIRED",
  );
});

test("AI authorization: assigned technician update uses an atomic assignment and status filter", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOne: Insemination.findOne,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    healthFindOne: HealthRequest.findOne,
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOne = originals.findOne;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    HealthRequest.findOne = originals.healthFindOne;
  });

  const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const existing = {
    _id: "request-1",
    status: "approved",
    approvedBy: "technician-1",
    farmerId: null,
    animalId: "animal-1",
    scheduledDate: null,
  };
  let capturedFilter;
  Insemination.findById = async () => existing;
  Insemination.findOne = async () => null;
  HealthRequest.findOne = async () => null;
  Insemination.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    return populatedQuery({
      ...existing,
      status: "scheduled",
      scheduledDate,
      visitPeriod: update.$set.visitPeriod,
      animalId: { _id: "animal-1", earTag: "AI-1" },
    });
  };

  const recorder = createResponseRecorder();
  await updateRequestStatus(
    {
      params: { id: "request-1" },
      body: {
        status: "scheduled",
        scheduledDate: scheduledDate.toISOString(),
        visitPeriod: "  MoRnInG  ",
      },
      user: {
        _id: "technician-1",
        role: "technician",
        name: "Technician One",
      },
      app: { get: () => ({ emit() {} }) },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(capturedFilter.status, "approved");
  assert.equal(capturedFilter.approvedBy, "technician-1");
  assert.equal(capturedFilter.deletedAt, null);
  assert.equal(recorder.body.request.visitPeriod, "morning");
});

test("AI concurrency: reusable assignment guard permits only self or pending unassigned", () => {
  const guard = buildAIRequestAssignmentGuard({
    technicianId: "technician-1",
    allowPendingUnassigned: true,
  });

  assert.deepEqual(guard.$or, [
    { approvedBy: "technician-1" },
    { status: "pending", approvedBy: null },
    { status: "pending", approvedBy: { $exists: false } },
  ]);
});

test("AI concurrency: an already scheduled request cannot be claimed again", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findOneAndUpdate: Insemination.findOneAndUpdate,
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
  });

  let updateCalled = false;
  Insemination.findById = async () => ({
    _id: "request-1",
    animalId: "animal-1",
    status: "scheduled",
    approvedBy: "technician-1",
  });
  Insemination.findOneAndUpdate = () => {
    updateCalled = true;
    return populatedQuery(null);
  };

  const recorder = createResponseRecorder();
  await claimRequest(
    {
      params: { type: "ai", id: "request-1" },
      user: { _id: "technician-1", role: "technician" },
      app: { get: () => ({ to: () => ({ emit() {} }) }) },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "REQUEST_NOT_CLAIMABLE");
  assert.equal(updateCalled, false);
});

test("AI completion: generic insemination editing cannot mark an active request done", async (t) => {
  const originals = {
    findById: Insemination.findById,
    findByIdAndUpdate: Insemination.findByIdAndUpdate,
    animalUpdate: Animal.findByIdAndUpdate,
  };
  t.after(() => {
    Insemination.findById = originals.findById;
    Insemination.findByIdAndUpdate = originals.findByIdAndUpdate;
    Animal.findByIdAndUpdate = originals.animalUpdate;
  });

  let inseminationWriteCalled = false;
  let animalWriteCalled = false;
  Insemination.findById = async () => ({
    _id: "request-1",
    status: "in-progress",
    animalId: "animal-1",
  });
  Insemination.findByIdAndUpdate = async () => {
    inseminationWriteCalled = true;
    return null;
  };
  Animal.findByIdAndUpdate = async () => {
    animalWriteCalled = true;
    return null;
  };

  const recorder = createResponseRecorder();
  await updateInsemination(
    {
      params: { id: "request-1" },
      body: {
        status: "done",
        sireBreed: "Brahman",
        sireCode: "BR-001",
        estrus: "Natural",
      },
      user: { _id: "technician-1", role: "technician" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "CANONICAL_AI_COMPLETION_REQUIRED");
  assert.equal(inseminationWriteCalled, false);
  assert.equal(animalWriteCalled, false);
});
