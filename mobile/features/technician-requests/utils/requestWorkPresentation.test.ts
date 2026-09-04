import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeTechnicianWorkItem,
  normalizeTechnicianWorkItems,
} from "./requestWorkPresentation.ts";

test("work queue normalization is safe for empty and loading input", () => {
  assert.deepEqual(normalizeTechnicianWorkItems([]), []);
  assert.deepEqual(normalizeTechnicianWorkItems(undefined), []);
  assert.deepEqual(
    normalizeTechnicianWorkItems({ data: [] } as unknown as any[]),
    [],
  );
});

test("one AI Work Queue item is normalized from the canonical item array", () => {
  const [item] = normalizeTechnicianWorkItems([
    {
      id: "ai-1",
      workflowId: "ai-1",
      workflowType: "AI",
      type: "ai",
      status: "scheduled",
      schedule: {
        date: "2026-08-30T08:00:00.000Z",
        visitPeriod: "morning",
      },
    } as any,
  ]);

  assert.equal(item.id, "ai-1");
  assert.equal(item.workType, "ai");
});

test("mixed Work Queue item arrays remain normalized", () => {
  const items = normalizeTechnicianWorkItems([
    {
      id: "ai-1",
      workflowId: "ai-1",
      workflowType: "AI",
      type: "ai",
      status: "pending",
    } as any,
    {
      id: "health-1",
      workflowId: "health-1",
      workflowType: "HEALTH",
      serviceType: "health",
      status: "assigned",
    } as any,
  ]);

  assert.deepEqual(
    items.map((item) => item.workType),
    ["ai", "health"],
  );
});

test("Farmer return-to-heat BreedingFollowUp is presented as an update review in My Work", () => {
  const item = normalizeTechnicianWorkItem({
    id: "task-1",
    taskId: "task-1",
    workflowType: "BreedingFollowUp",
    taskType: "BreedingFollowUp",
    status: "Pending",
    dueDate: "2026-08-15T08:00:00.000Z",
    raw: {
      dueDate: "2026-08-15T08:00:00.000Z",
      metadata: { reportType: "return_to_heat" },
    },
  } as any);

  assert.equal(item.title, "Breeding Follow-up");
  assert.equal(item.actionLabel, "Review Update");
  assert.equal(item.requestKind, "breeding_observation_review");
  assert.doesNotMatch(item.timingLabel || "", /Pregnancy confirmation/);
});

test("active re-insemination is identifiable with its previous attempt context", () => {
  const item = normalizeTechnicianWorkItem({
    id: "attempt-2",
    workflowId: "attempt-2",
    workflowType: "AI",
    type: "ai",
    status: "scheduled",
    attemptNumber: 2,
    previousAttemptId: "attempt-1",
    previousAttemptOutcome: "Failed (Re-heat)",
    previousAttemptVerified: true,
    scheduledDate: "2026-08-16T08:00:00.000Z",
    schedule: {
      date: "2026-08-16T08:00:00.000Z",
      visitPeriod: "morning",
    },
  } as any);

  assert.equal(item.title, "Re-insemination");
  assert.equal(item.requestKind, "re_insemination");
  assert.equal(item.attemptNumber, 2);
  assert.equal(item.previousAttemptId, "attempt-1");
  assert.equal(item.previousAttemptOutcome, "Failed (Re-heat)");
  assert.equal(item.previousAttemptVerified, true);
});

test("completed non-clinical Health responses do not imply a MedicalRecord", () => {
  const officePickup = normalizeTechnicianWorkItem({
    id: "health-pickup-1",
    workflowId: "health-pickup-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "office_pickup",
  } as any);
  const advice = normalizeTechnicianWorkItem({
    id: "health-advice-1",
    workflowId: "health-advice-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "advice",
  } as any);
  const clinical = normalizeTechnicianWorkItem({
    id: "health-clinical-1",
    workflowId: "health-clinical-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
    handlingMethod: "farm_visit",
    medicalRecordId: "medical-1",
  } as any);
  const legacyWithoutRecord = normalizeTechnicianWorkItem({
    id: "health-legacy-1",
    workflowId: "health-legacy-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "resolved",
  } as any);

  assert.equal(officePickup.actionLabel, "View Response");
  assert.equal(officePickup.title, "Office Pickup");
  assert.equal(officePickup.statusLabel, "Pickup info available");
  assert.equal(advice.actionLabel, "View Response");
  assert.equal(advice.title, "Health Advice");
  assert.equal(advice.statusLabel, "Advice provided");
  assert.equal(clinical.actionLabel, "View Record");
  assert.equal(clinical.title, "Health Service");
  assert.equal(clinical.statusLabel, "Completed");
  assert.equal(legacyWithoutRecord.actionLabel, "View Response");
});

test("State 1: Claimed Health without handling method is Needs response with Handle Request action", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-claimed-1",
    workflowId: "health-claimed-1",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Handle Request");
  assert.equal(item.timingLabel, null);
});

test("State 2: Claimed Health with advice handling method is response flow without scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-advice-flow",
    workflowId: "health-advice-flow",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "advice",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Send Advice");
  assert.equal(item.timingLabel, null);
});

test("State 3: Claimed Health with office_pickup handling method is response flow without scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-pickup-flow",
    workflowId: "health-pickup-flow",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "office_pickup",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_response");
  assert.equal(item.statusLabel, "Needs response");
  assert.equal(item.actionLabel, "Office Pickup");
  assert.equal(item.timingLabel, null);
});

test("State 4: Claimed Health with farm_visit handling method and no schedule is Needs scheduling", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-visit-unscheduled",
    workflowId: "health-visit-unscheduled",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "assigned",
    handlingMethod: "farm_visit",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_scheduling");
  assert.equal(item.statusLabel, "Needs scheduling");
  assert.equal(item.actionLabel, "Set Visit");
  assert.equal(item.timingLabel, null);
});

test("State 5: Claimed Health with farm_visit handling method and scheduled date retains temporal presentation", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-visit-scheduled",
    workflowId: "health-visit-scheduled",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "scheduled",
    handlingMethod: "farm_visit",
    scheduledDate: "2026-09-10T08:00:00.000Z",
    schedule: {
      date: "2026-09-10T08:00:00.000Z",
      visitPeriod: "morning",
    },
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "scheduled");
  assert.equal(item.actionLabel, "Record Health Assistance");
});

test("AI claimed without schedule remains Needs scheduling with Set Visit", () => {
  const item = normalizeTechnicianWorkItem({
    id: "ai-claimed-unscheduled",
    workflowId: "ai-claimed-unscheduled",
    workflowType: "AI",
    type: "ai",
    status: "assigned",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.equal(item.state, "needs_scheduling");
  assert.equal(item.statusLabel, "Needs scheduling");
  assert.equal(item.actionLabel, "Set Visit");
});

test("Internal triaged status never exposes user-facing 'triaged' label", () => {
  const item = normalizeTechnicianWorkItem({
    id: "health-triaged",
    workflowId: "health-triaged",
    workflowType: "HEALTH",
    serviceType: "health",
    status: "triaged",
    assignedTechnicianId: "tech-1",
  } as any);

  assert.notEqual(item.statusLabel?.toLowerCase(), "triaged");
  assert.doesNotMatch(item.statusLabel || "", /triage/i);
  assert.equal(item.statusLabel, "Needs response");
});

