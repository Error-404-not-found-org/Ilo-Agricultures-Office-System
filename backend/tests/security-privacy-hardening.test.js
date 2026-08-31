import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  cancelHealthRequest,
  getAllHealthRequests,
  getMyHealthRequests,
} from "../src/controllers/health-request.controllers.js";
import {
  getAllAnimals,
  getMyAnimals,
  updateReproductiveStatus,
} from "../src/controllers/animals.controllers.js";
import { getNotificationDetails } from "../src/controllers/notification.controllers.js";
import { cancelAIRequest } from "../src/controllers/ai-request.controllers.js";
import { claimRequest } from "../src/controllers/technician.controllers.js";
import { requireRole } from "../src/middleware/auth.middleware.js";
import { Animal } from "../src/models/animal.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { Notification } from "../src/models/notification.model.js";
import { Pregnancy } from "../src/models/pregnancy.model.js";
import { Task } from "../src/models/task.model.js";
import {
  assertHealthRequestMutationOwnership,
  buildAIRequestMutationOwnershipGuard,
  buildHealthRequestMutationOwnershipGuard,
} from "../src/policies/request.policy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routeSource = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "src", "routes", name), "utf8");

const responseRecorder = () => {
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

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    limit() {
      return query;
    },
    skip() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const runRoleGuard = (role) => {
  const recorder = responseRecorder();
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

test("Security: bulk Health and Animal routes reject Farmers at the role boundary", async () => {
  assert.match(
    routeSource("health-request.routes.js"),
    /router\.get\(\s*"\/",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\),\s*getAllHealthRequests/,
  );
  assert.match(
    routeSource("animals.routes.js"),
    /router\.get\(\s*"\/all",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\),\s*getAllAnimals/,
  );
  assert.equal(runRoleGuard("farmer").statusCode, 403);
  assert.equal(runRoleGuard("technician").nextCalled, true);
  assert.equal(runRoleGuard("admin").nextCalled, true);

  for (const controller of [getAllHealthRequests, getAllAnimals]) {
    const recorder = responseRecorder();
    await controller({ user: { _id: "farmer-1", role: "farmer" }, query: {} }, recorder.response);
    assert.equal(recorder.statusCode, 403);
  }
});

test("Security: Technician and Admin bulk access remains available", async (t) => {
  const originals = {
    healthFind: HealthRequest.find,
    animalFind: Animal.find,
  };
  t.after(() => {
    HealthRequest.find = originals.healthFind;
    Animal.find = originals.animalFind;
  });
  HealthRequest.find = () => populatedQuery([]);
  Animal.find = () => populatedQuery([]);

  for (const role of ["technician", "admin"]) {
    const health = responseRecorder();
    await getAllHealthRequests({ user: { role }, query: {} }, health.response);
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.body, []);

    const animals = responseRecorder();
    await getAllAnimals({ user: { role }, query: {} }, animals.response);
    assert.equal(animals.statusCode, 200);
    assert.deepEqual(animals.body, []);
  }
});

test("Security: Farmer own Health and Animal collection queries remain owner-scoped", async (t) => {
  const originals = {
    healthFind: HealthRequest.find,
    healthCount: HealthRequest.countDocuments,
    animalFind: Animal.find,
    animalCount: Animal.countDocuments,
  };
  t.after(() => {
    HealthRequest.find = originals.healthFind;
    HealthRequest.countDocuments = originals.healthCount;
    Animal.find = originals.animalFind;
    Animal.countDocuments = originals.animalCount;
  });

  let healthQuery;
  let animalQuery;
  HealthRequest.find = (query) => {
    healthQuery = query;
    return populatedQuery([]);
  };
  HealthRequest.countDocuments = async () => 0;
  Animal.find = (query) => {
    animalQuery = query;
    return populatedQuery([]);
  };
  Animal.countDocuments = async () => 0;

  const health = responseRecorder();
  await getMyHealthRequests(
    { user: { _id: "farmer-1", role: "farmer" }, query: {} },
    health.response,
  );
  assert.equal(health.statusCode, 200);
  assert.equal(healthQuery.farmerId, "farmer-1");

  const animals = responseRecorder();
  await getMyAnimals(
    { user: { _id: "farmer-1", role: "farmer" }, query: {} },
    animals.response,
  );
  assert.equal(animals.statusCode, 200);
  assert.equal(animalQuery.farmerId, "farmer-1");
});

test("Privacy: Farmer notification Health detail strips internal clinical and workflow metadata", async (t) => {
  const originals = {
    notificationFindOne: Notification.findOne,
    healthFindById: HealthRequest.findById,
  };
  t.after(() => {
    Notification.findOne = originals.notificationFindOne;
    HealthRequest.findById = originals.healthFindById;
  });

  let notificationPopulateSelection;
  Notification.findOne = () => ({
    populate(_path, selection) {
      notificationPopulateSelection = selection;
      return Promise.resolve({
        _id: "notification-1",
        recipientId: "farmer-1",
        senderId: { name: "Technician One", role: "technician" },
        type: "health-request",
        relatedId: "health-1",
        title: "Health update",
        message: "Advice is ready.",
      });
    },
  });
  HealthRequest.findById = () =>
    populatedQuery({
      _id: "health-1",
      farmerId: "farmer-1",
      status: "resolved",
      technicianNote: "Internal differential diagnosis",
      assignedTechnicianId: "technician-1",
      activeCaseKey: "private-key",
      claimedAt: new Date(),
      dispatch: { assignedTechnicianId: "technician-1" },
      handledBy: {
        _id: "technician-1",
        name: "Technician One",
        imageUrl: "https://example.test/tech.jpg",
        phoneNumber: "09170000000",
        address: { street: "Private staff address" },
      },
      statusHistory: [
        {
          status: "resolved",
          note: "Internal status note",
          actorId: "technician-1",
          createdAt: new Date("2026-08-22T00:00:00.000Z"),
        },
      ],
      advice: "Keep the animal hydrated.",
      technicianResponse: {
        pickup: { item: "Dewormer", instructions: "Collect before 4 PM." },
      },
    });

  const recorder = responseRecorder();
  await getNotificationDetails(
    {
      params: { id: "notification-1" },
      user: { _id: "farmer-1", role: "farmer" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(notificationPopulateSelection, "name imageUrl role");
  assert.equal(recorder.body.relatedData.technicianNote, undefined);
  assert.equal(recorder.body.relatedData.assignedTechnicianId, undefined);
  assert.equal(recorder.body.relatedData.activeCaseKey, undefined);
  assert.equal(recorder.body.relatedData.dispatch, undefined);
  assert.equal(recorder.body.relatedData.handledBy._id, undefined);
  assert.equal(recorder.body.relatedData.handledBy.phoneNumber, undefined);
  assert.equal(recorder.body.relatedData.statusHistory[0].note, undefined);
  assert.equal(recorder.body.relatedData.statusHistory[0].actorId, undefined);
  assert.equal(recorder.body.relatedData.advice, "Keep the animal hydrated.");
  assert.equal(
    recorder.body.relatedData.technicianResponse.pickup.instructions,
    "Collect before 4 PM.",
  );
});

test("Security: Health ownership guards reject unclaimed and other-technician mutations", () => {
  assert.throws(
    () =>
      assertHealthRequestMutationOwnership(
        { _id: "technician-1", role: "technician" },
        { handledBy: null, assignedTechnicianId: null },
      ),
    (error) =>
      error.status === 409 && error.code === "HEALTH_REQUEST_CLAIM_REQUIRED",
  );
  assert.throws(
    () =>
      assertHealthRequestMutationOwnership(
        { _id: "technician-2", role: "technician" },
        {
          handledBy: "technician-1",
          assignedTechnicianId: "technician-1",
        },
      ),
    (error) =>
      error.status === 403 && error.code === "HEALTH_REQUEST_ASSIGNED_TO_OTHER",
  );
  assert.doesNotThrow(() =>
    assertHealthRequestMutationOwnership(
      { _id: "admin-1", role: "admin" },
      { handledBy: "technician-1" },
    ),
  );

  const guard = buildHealthRequestMutationOwnershipGuard({
    technicianId: "technician-1",
  });
  assert.equal(guard.$and.length, 3);
  assert.deepEqual(guard.$and[2], {
    $or: [
      { handledBy: "technician-1" },
      { assignedTechnicianId: "technician-1" },
    ],
  });
});

test("Security: Technician cannot cancel another Technician's Health request", async (t) => {
  const originals = {
    findOne: HealthRequest.findOne,
    findOneAndUpdate: HealthRequest.findOneAndUpdate,
  };
  t.after(() => {
    HealthRequest.findOne = originals.findOne;
    HealthRequest.findOneAndUpdate = originals.findOneAndUpdate;
  });
  let writeCalled = false;
  HealthRequest.findOne = () =>
    populatedQuery({
      _id: "health-owned-1",
      status: "scheduled",
      farmerId: { _id: "farmer-1" },
      animalId: { _id: "animal-1", earTag: "HL-1" },
      handledBy: { _id: "technician-1", name: "Technician One" },
      assignedTechnicianId: "technician-1",
    });
  HealthRequest.findOneAndUpdate = () => {
    writeCalled = true;
    return populatedQuery(null);
  };

  const recorder = responseRecorder();
  await cancelHealthRequest(
    {
      params: { id: "health-owned-1" },
      body: { reason: "Cannot attend" },
      user: { _id: "technician-2", role: "technician" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.code, "HEALTH_REQUEST_ASSIGNED_TO_OTHER");
  assert.equal(writeCalled, false);
});

test("Security: Technician cannot cancel another Technician's AI request", async (t) => {
  const originals = {
    findOne: Insemination.findOne,
    findOneAndUpdate: Insemination.findOneAndUpdate,
  };
  t.after(() => {
    Insemination.findOne = originals.findOne;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
  });
  let writeCalled = false;
  Insemination.findOne = () =>
    populatedQuery({
      _id: "ai-1",
      status: "scheduled",
      farmerId: { _id: "farmer-1" },
      animalId: { _id: "animal-1", earTag: "AI-1" },
      approvedBy: { _id: "technician-1", name: "Technician One" },
      technicianId: null,
    });
  Insemination.findOneAndUpdate = () => {
    writeCalled = true;
    return populatedQuery(null);
  };

  const recorder = responseRecorder();
  await cancelAIRequest(
    {
      params: { id: "ai-1" },
      body: { reason: "Cannot attend" },
      user: { _id: "technician-2", role: "technician" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.code, "AI_REQUEST_ASSIGNED_TO_OTHER");
  assert.equal(writeCalled, false);
  assert.equal(buildAIRequestMutationOwnershipGuard({ technicianId: "technician-1" }).$and.length, 3);
});

test("Security: terminal Health requests cannot be claimed", async (t) => {
  const originalFindById = HealthRequest.findById;
  const originalFindOneAndUpdate = HealthRequest.findOneAndUpdate;
  t.after(() => {
    HealthRequest.findById = originalFindById;
    HealthRequest.findOneAndUpdate = originalFindOneAndUpdate;
  });

  for (const status of ["resolved", "cancelled", "rejected", "done", "completed"]) {
    let writeCalled = false;
    HealthRequest.findById = async () => ({
      _id: `health-${status}`,
      status,
      handledBy: null,
    });
    HealthRequest.findOneAndUpdate = () => {
      writeCalled = true;
      return populatedQuery(null);
    };
    const recorder = responseRecorder();
    await claimRequest(
      {
        params: { type: "health", id: `health-${status}` },
        user: { _id: "technician-1", role: "technician" },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 409);
    assert.equal(recorder.body.code, "REQUEST_NOT_CLAIMABLE");
    assert.equal(writeCalled, false);
  }
});

test("Security: only one Technician can atomically claim a valid pending Health request", async (t) => {
  const originalFindById = HealthRequest.findById;
  const originalFindOneAndUpdate = HealthRequest.findOneAndUpdate;
  t.after(() => {
    HealthRequest.findById = originalFindById;
    HealthRequest.findOneAndUpdate = originalFindOneAndUpdate;
  });

  HealthRequest.findById = async () => ({
    _id: "health-pending",
    animalId: "animal-1",
    requestType: "checkup",
    status: "pending",
    handledBy: null,
    assignedTechnicianId: null,
    dispatch: {
      stage: "local",
      location: { municipalityCode: "063034000" },
    },
  });
  let claimed = false;
  let capturedFilter;
  HealthRequest.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    if (claimed) return populatedQuery(null);
    claimed = true;
    return populatedQuery({
      _id: "health-pending",
      status: "approved",
      handledBy: update.$set.handledBy,
    });
  };
  const app = {
    get() {
      return { to: () => ({ emit() {} }) };
    },
  };
  const first = responseRecorder();
  const second = responseRecorder();
  const readyTechnician = (id) => ({
    _id: id,
    role: "technician",
    status: "active",
    deletedAt: null,
    isVerified: true,
    profileClaimStatus: "claimed",
    dispatchProfile: {
      acceptsNewRequests: true,
      availabilityStatus: "available",
      serviceCapabilities: ["HEALTH"],
      serviceMunicipalities: [{ municipalityCode: "063034000" }],
    },
  });
  await Promise.all([
    claimRequest(
      {
        params: { type: "health", id: "health-pending" },
        user: readyTechnician("technician-1"),
        app,
      },
      first.response,
    ),
    claimRequest(
      {
        params: { type: "health", id: "health-pending" },
        user: readyTechnician("technician-2"),
        app,
      },
      second.response,
    ),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  assert.equal(capturedFilter.status, "pending");
  assert.deepEqual(capturedFilter.$and, [
    {
      $or: [{ handledBy: null }, { handledBy: { $exists: false } }],
    },
    {
      $or: [
        { assignedTechnicianId: null },
        { assignedTechnicianId: { $exists: false } },
      ],
    },
  ]);
});

test("Security: legacy reproductive-status mutation rejects Farmers before any write", async (t) => {
  const originalFindById = Animal.findById;
  let lookupCalled = false;
  Animal.findById = async () => {
    lookupCalled = true;
    return null;
  };
  t.after(() => {
    Animal.findById = originalFindById;
  });

  assert.match(
    routeSource("animals.routes.js"),
    /router\.patch\(\s*"\/:id\/reproductive-status",\s*protectedRoute,\s*requireRole\(\["technician"\]\),\s*updateReproductiveStatus/,
  );

  const recorder = responseRecorder();
  await updateReproductiveStatus(
    {
      params: { id: "animal-1" },
      body: { status: "In Heat", note: "Observed return to heat" },
      user: { _id: "farmer-1", role: "farmer" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.code, "REPRODUCTIVE_STATUS_VERIFICATION_REQUIRED");
  assert.equal(lookupCalled, false);
});

test("Security: only the owning technician can use the protected legacy reproductive-status path", async (t) => {
  const originalFindById = Animal.findById;
  const originalInseminationFindOne = Insemination.findOne;
  const originalPregnancyFindOne = Pregnancy.findOne;
  const originalTaskFindOne = Task.findOne;
  t.after(() => {
    Animal.findById = originalFindById;
    Insemination.findOne = originalInseminationFindOne;
    Pregnancy.findOne = originalPregnancyFindOne;
    Task.findOne = originalTaskFindOne;
  });
  let saveCount = 0;
  Animal.findById = async () => ({
    _id: "animal-1",
    farmerId: "farmer-1",
    reproductiveStatus: "Normal",
    activityLogs: [],
    async save() {
      saveCount += 1;
    },
  });
  const sorted = (value) => ({ sort: async () => value });
  Insemination.findOne = () => sorted({
    _id: "507f1f77bcf86cd799439003",
    technicianId: "technician-1",
    approvedBy: "technician-1",
  });
  Pregnancy.findOne = () => sorted(null);
  Task.findOne = () => sorted(null);

  const technicianRecorder = responseRecorder();
  await updateReproductiveStatus(
    {
      params: { id: "animal-1" },
      body: { status: "Normal", note: "Verified field observation" },
      user: { _id: "technician-1", role: "technician" },
    },
    technicianRecorder.response,
  );
  assert.equal(technicianRecorder.statusCode, 200);

  const adminRecorder = responseRecorder();
  await updateReproductiveStatus(
    {
      params: { id: "animal-1" },
      body: { status: "Normal", note: "Administrative override" },
      user: { _id: "admin-1", role: "admin" },
    },
    adminRecorder.response,
  );
  assert.equal(adminRecorder.statusCode, 403);
  assert.equal(saveCount, 1);
});
