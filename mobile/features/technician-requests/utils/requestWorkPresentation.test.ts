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
