import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildFarmerAIRequest,
  buildFarmerAIRequests,
} from "../src/domain/ai-request-presentation.js";
import { assertCalvingTaskAuthority } from "../src/services/calving.service.js";
import { assertOwnedAIRequestContext } from "../src/services/livestock-transaction.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = (relativePath) =>
  fs.readFileSync(path.join(__dirname, "..", "src", relativePath), "utf8");

test("Farmer AI presentation keeps useful service data and removes internal authority fields", () => {
  const presented = buildFarmerAIRequest({
    _id: "ai-1",
    status: "scheduled",
    farmerId: "farmer-1",
    animalId: "animal-1",
    approvedBy: { _id: "tech-1", name: "Technician One" },
    technicianId: { _id: "tech-1", name: "Technician One" },
    technicianNote: "internal clinical note",
    activeRequestKey: "animal-1",
    declinedByTechnicianIds: ["tech-2"],
    dispatch: { municipalityCode: "OTON" },
    attemptSeriesId: "series-1",
    sireBreed: "Brahman",
  });

  assert.equal(presented.technicianDisplayName, "Technician One");
  assert.equal(presented.sireBreed, "Brahman");
  assert.equal(presented.approvedBy, undefined);
  assert.equal(presented.technicianId, undefined);
  assert.equal(presented.technicianNote, undefined);
  assert.equal(presented.activeRequestKey, undefined);
  assert.equal(presented.declinedByTechnicianIds, undefined);
  assert.equal(presented.dispatch, undefined);
  assert.equal(presented.attemptSeriesId, undefined);
});

test("Farmer AI list presentation applies the same privacy contract to every item", () => {
  const presented = buildFarmerAIRequests([
    { _id: "ai-1", technicianId: { name: "One" }, technicianNote: "private" },
    { _id: "ai-2", approvedBy: { name: "Two" }, activeRequestKey: "key" },
  ]);

  assert.deepEqual(
    presented.map((item) => item.technicianDisplayName),
    ["One", "Two"],
  );
  assert.ok(presented.every((item) => item.technicianNote === undefined));
  assert.ok(presented.every((item) => item.activeRequestKey === undefined));
});

test("request-backed AI requires matching Farmer, Animal, and a single Technician owner", () => {
  const request = {
    farmerId: "farmer-1",
    animalId: "animal-1",
    approvedBy: "tech-1",
    technicianId: "tech-1",
  };
  const guard = assertOwnedAIRequestContext({
    insemination: request,
    actorId: "tech-1",
    farmerId: "farmer-1",
    animalId: "animal-1",
  });

  assert.deepEqual(guard, {
    farmerId: "farmer-1",
    animalId: "animal-1",
    approvedBy: "tech-1",
    technicianId: "tech-1",
  });
  assert.throws(
    () =>
      assertOwnedAIRequestContext({
        insemination: request,
        actorId: "tech-2",
        farmerId: "farmer-1",
        animalId: "animal-1",
      }),
    (error) => error.status === 403 && error.code === "AI_REQUEST_NOT_OWNED",
  );
  assert.throws(
    () =>
      assertOwnedAIRequestContext({
        insemination: request,
        actorId: "tech-1",
        farmerId: "farmer-2",
        animalId: "animal-1",
      }),
    (error) => error.status === 409 && error.code === "AI_REQUEST_FARMER_MISMATCH",
  );
  assert.throws(
    () =>
      assertOwnedAIRequestContext({
        insemination: request,
        actorId: "tech-1",
        farmerId: "farmer-1",
        animalId: "animal-2",
      }),
    (error) => error.status === 409 && error.code === "AI_REQUEST_ANIMAL_MISMATCH",
  );
});

test("request-backed AI fails closed for unclaimed and conflicting ownership", () => {
  const base = { farmerId: "farmer-1", animalId: "animal-1" };
  for (const insemination of [
    base,
    { ...base, approvedBy: "tech-1", technicianId: "tech-2" },
  ]) {
    assert.throws(
      () =>
        assertOwnedAIRequestContext({
          insemination,
          actorId: "tech-1",
          farmerId: "farmer-1",
          animalId: "animal-1",
        }),
      (error) => error.status === 403 && error.code === "AI_REQUEST_NOT_OWNED",
    );
  }
});

test("Calving Task authority permits owner/unassigned work and blocks another Technician or Admin", () => {
  assert.doesNotThrow(() =>
    assertCalvingTaskAuthority(
      { technicianId: "tech-1" },
      { _id: "tech-1", role: "technician" },
    ),
  );
  assert.doesNotThrow(() =>
    assertCalvingTaskAuthority(
      { technicianId: null },
      { _id: "tech-1", role: "technician" },
    ),
  );
  assert.throws(
    () =>
      assertCalvingTaskAuthority(
        { technicianId: "tech-1" },
        { _id: "tech-2", role: "technician" },
      ),
    (error) =>
      error.status === 403 && error.code === "CALVING_TASK_ASSIGNED_TO_OTHER",
  );
  assert.throws(
    () =>
      assertCalvingTaskAuthority(
        { technicianId: null },
        { _id: "admin-1", role: "admin" },
      ),
    (error) =>
      error.status === 403 && error.code === "CALVING_CLINICAL_ROLE_REQUIRED",
  );
});

test("clinical mutation routes are Technician-only while Farmer calving remains explicit", () => {
  const aiRoutes = source("routes/ai-request.routes.js");
  const technicianRoutes = source("routes/technician.routes.js");
  const healthRoutes = source("routes/health-request.routes.js");
  const inseminationRoutes = source("routes/insemination.routes.js");
  const animalRoutes = source("routes/animals.routes.js");
  const taskRoutes = source("routes/tasks.routes.js");

  assert.match(aiRoutes, /\/:id\/status[\s\S]*requireRole\(\["technician"\]\)/);
  assert.match(technicianRoutes, /walk-in-insemination[\s\S]*requireRole\(\["technician"\]\)/);
  assert.match(technicianRoutes, /previous-insemination[\s\S]*requireRole\(\["technician"\]\)/);
  assert.match(healthRoutes, /\/:id\/triage", protectedRoute, TechnicianOnly/);
  assert.match(healthRoutes, /\/:id\/follow-up", protectedRoute, TechnicianOnly/);
  assert.match(healthRoutes, /\/:id\/status", protectedRoute, TechnicianOnly/);
  assert.match(inseminationRoutes, /create-insemination[\s\S]*requireRole\(\["technician"\]\)/);
  assert.match(animalRoutes, /record-calving[\s\S]*requireRole\(\["farmer", "technician"\]\)/);
  assert.match(taskRoutes, /\/:id\/complete", requireRole\(\["technician"\]\)/);
  assert.match(taskRoutes, /\/:id\/claim", requireRole\(\["technician"\]\)/);
});

test("Admin Request Details uses only the dedicated reassignment mutation", () => {
  const screen = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "..",
      "mobile",
      "features",
      "admin-requests",
      "screens",
      "AdminRequestDetailsScreen.tsx",
    ),
    "utf8",
  );

  assert.match(screen, /\/admin\/requests\/\$\{type\}\/\$\{id\}\/reassign/);
  assert.doesNotMatch(screen, /\/health-request\/\$\{id\}\/status/);
  assert.doesNotMatch(screen, /\/ai-request\/\$\{id\}\/status/);
  assert.doesNotMatch(screen, /handleUrgencyChange|Update Urgency/);
});
