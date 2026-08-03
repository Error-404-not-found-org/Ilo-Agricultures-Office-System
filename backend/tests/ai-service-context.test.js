import test from "node:test";
import assert from "node:assert/strict";
import { buildAIServiceContext } from "../src/domain/ai-service-context.js";

const now = new Date("2026-08-01T08:00:00+08:00");

test("AI service context allows an eligible animal to use the walk-in flow", () => {
  const context = buildAIServiceContext({
    eligibility: { eligible: true, code: "ELIGIBLE" },
    actorId: "technician-1",
    now,
  });

  assert.equal(context.mode, "walk_in");
  assert.deepEqual(context.allowedActions, [
    "record_walk_in",
    "schedule_visit",
  ]);
  assert.equal(context.activeRequest, null);
});

test("AI service context blocks an ineligible walk-in", () => {
  const context = buildAIServiceContext({
    eligibility: {
      eligible: false,
      code: "ACTIVE_PREGNANCY",
      reason: "There is already an active pregnancy.",
    },
    actorId: "technician-1",
    now,
  });

  assert.equal(context.mode, "blocked");
  assert.equal(context.blockedReason, "There is already an active pregnancy.");
  assert.deepEqual(context.allowedActions, []);
});

test("AI service context directs an unclaimed request to claiming", () => {
  const context = buildAIServiceContext({
    activeRequest: {
      _id: "request-1",
      status: "pending",
      scheduledDate: "2026-08-01T10:00:00+08:00",
      createdAt: "2026-07-31T09:00:00+08:00",
    },
    eligibility: { eligible: true, code: "ACTIVE_REQUEST_FOUND" },
    actorId: "technician-1",
    now,
  });

  assert.equal(context.mode, "request");
  assert.equal(context.activeRequest.assignment, "unclaimed");
  assert.deepEqual(context.allowedActions, ["claim_request"]);
  assert.equal(context.timing.isToday, true);
  assert.equal(context.timing.isEarly, true);
});

test("AI service context opens a request assigned to the current technician", () => {
  const context = buildAIServiceContext({
    activeRequest: {
      _id: "request-1",
      status: "scheduled",
      approvedBy: { _id: "technician-1", name: "John Technician" },
    },
    task: { _id: "task-1" },
    eligibility: { eligible: true, code: "ACTIVE_REQUEST_FOUND" },
    actorId: "technician-1",
    now,
  });

  assert.equal(context.mode, "request");
  assert.equal(context.activeRequest.assignment, "mine");
  assert.equal(context.activeRequest.taskId, "task-1");
  assert.deepEqual(context.allowedActions, ["open_request"]);
});

test("AI service context blocks a request assigned to another technician", () => {
  const context = buildAIServiceContext({
    activeRequest: {
      _id: "request-1",
      status: "approved",
      approvedBy: { _id: "technician-2", name: "Maria Technician" },
    },
    eligibility: { eligible: true, code: "ACTIVE_REQUEST_FOUND" },
    actorId: "technician-1",
    now,
  });

  assert.equal(context.mode, "blocked");
  assert.equal(
    context.blockedReason,
    "This request is assigned to Maria Technician.",
  );
  assert.deepEqual(context.allowedActions, []);
});
