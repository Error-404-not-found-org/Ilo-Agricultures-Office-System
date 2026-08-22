import assert from "node:assert/strict";
import test from "node:test";

import { normalizeTechnicianWorkItem } from "./requestWorkPresentation.ts";

test("Farmer return-to-heat task is presented as an update review in My Work", () => {
  const item = normalizeTechnicianWorkItem({
    id: "task-1",
    taskId: "task-1",
    workflowType: "PD",
    taskType: "PD",
    status: "Pending",
    dueDate: "2026-08-15T08:00:00.000Z",
    raw: {
      dueDate: "2026-08-15T08:00:00.000Z",
      metadata: { reportType: "return_to_heat" },
    },
  } as any);

  assert.equal(item.title, "Return-to-Heat Review");
  assert.equal(item.actionLabel, "Review Farmer Update");
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
