import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = (relativePath) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const offlineMutation = source("../../mobile/hooks/useOfflineMutation.ts");
const offlineQueue = source("../../mobile/lib/offlineQueue.ts");
const farmerCalving = source("../../mobile/app/(farmer)/record-calving.tsx");
const technicianCalving = source("../../mobile/app/(technician)/record-calf-drop.tsx");
const technicianAnimalDetails = source(
  "../../mobile/features/animals/screens/RoleAwareAnimalDetailsScreen.tsx",
);
const pregnancyTracker = source(
  "../../mobile/features/breeding/screens/PregnancyTrackerScreen.tsx",
);
const technicianTrackerRoute = source(
  "../../mobile/app/(technician)/pregnancy-tracker.tsx",
);
const confirmationModal = source("../../mobile/components/ConfirmationModal.tsx");

test("Calving mobile: timeout reconciliation replays the original idempotency key", () => {
  assert.match(offlineMutation, /const idempotencyKey = idempotencyKeyInput \|\| createStableId\(\)/);
  assert.match(offlineMutation, /"Idempotency-Key": idempotencyKey/);
  assert.match(offlineMutation, /return reconcileTimedOutRequest\(\)/);
  assert.match(offlineMutation, /error\?\.response\?\.data\?\.code === "IDEMPOTENCY_IN_PROGRESS"/);
});

test("Calving mobile: queue deduplicates an operation by idempotency key, method, and URL", () => {
  assert.match(offlineQueue, /item\.idempotencyKey === mutation\.idempotencyKey/);
  assert.match(offlineQueue, /item\.method === mutation\.method/);
  assert.match(offlineQueue, /item\.url === mutation\.url/);
  assert.match(offlineQueue, /result: \{ item: existingOperation, reused: true \}/);
});

test("Calving mobile: farmer and technician forms lock repeated submissions during reconciliation", () => {
  for (const form of [farmerCalving, technicianCalving]) {
    assert.match(form, /reconcileOnTimeout: true/);
    assert.match(form, /submitLockRef\.current/);
    assert.match(form, /Checking submission status…/);
    assert.match(form, /submissionLocked/);
  }
  assert.match(confirmationModal, /confirmLockRef\.current/);
});

test("Calving mobile: task context is forwarded when a route supplies it", () => {
  assert.match(farmerCalving, /taskId: taskId \|\| undefined/);
  assert.match(technicianCalving, /taskId: taskId \|\| undefined/);
});

test("Calving mobile: technician live outcomes use backend readiness while loss remains available", () => {
  assert.match(technicianCalving, /selectedPregnancy\?\.calvingReadiness/);
  assert.match(technicianCalving, /getCalendarDayDifference/);
  assert.match(technicianCalving, /outcome !== 'abortion'/);
  assert.match(technicianCalving, /isLiveOutcomeTooEarly/);
  assert.match(
    technicianCalving,
    /disabled=\{submissionLocked \|\| isLiveOutcomeTooEarly\}/,
  );
  assert.match(technicianCalving, /Live-birth window not open/);
});

test("Pregnancy tracker: technician details open a role-safe tracker and calving route", () => {
  assert.match(technicianAnimalDetails, /role === "technician"/);
  assert.match(
    technicianAnimalDetails,
    /"\/\(technician\)\/pregnancy-tracker"/,
  );
  assert.match(technicianTrackerRoute, /viewerRole="technician"/);
  assert.match(pregnancyTracker, /!isTechnician/);
  assert.match(pregnancyTracker, /"\/\(technician\)\/record-calf-drop"/);
  assert.match(pregnancyTracker, /Record Calving \/ Loss/);
});
