import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_HEALTH_REQUEST_STATUS,
  HEALTH_REQUEST_STATUS_COMPATIBILITY,
  healthRequestOwnerId,
  normalizeHealthRequestStatus,
} from "../src/domain/health-request-vocabulary.js";
import {
  HEALTH_STATUS,
  normalizeHealthStatus,
} from "../src/domain/status-vocabulary.js";
import { assertStatusTransition } from "../src/domain/livestock-workflow.js";
import { HealthRequest } from "../src/models/health-request.model.js";

test("legacy Health statuses normalize predictably for presentation", () => {
  const activeAliases = [
    "triaged",
    "assigned",
    "approved",
    "scheduled",
    "active",
    "claimed",
  ];
  for (const value of activeAliases) {
    assert.equal(
      normalizeHealthRequestStatus(value),
      CANONICAL_HEALTH_REQUEST_STATUS.ACTIVE,
    );
  }

  assert.equal(normalizeHealthRequestStatus("pending"), "pending");
  assert.equal(normalizeHealthRequestStatus("in_progress"), "in-progress");
  assert.equal(normalizeHealthRequestStatus("in-progress"), "in-progress");
  assert.equal(normalizeHealthRequestStatus("resolved"), "resolved");
  assert.equal(normalizeHealthRequestStatus("done"), "resolved");
  assert.equal(normalizeHealthRequestStatus("completed"), "resolved");
  assert.equal(normalizeHealthRequestStatus("cancelled"), "cancelled");
  assert.equal(
    normalizeHealthRequestStatus("rejected"),
    HEALTH_REQUEST_STATUS_COMPATIBILITY.REJECTED,
  );
  assert.equal(normalizeHealthRequestStatus("unassigned"), "unassigned");
  assert.equal(normalizeHealthRequestStatus("declined"), "declined");
});

test("presentation normalization does not infer request ownership", () => {
  assert.equal(healthRequestOwnerId({ status: "approved" }), null);
  assert.equal(
    healthRequestOwnerId({ handledBy: { _id: "technician-primary" } }),
    "technician-primary",
  );
  assert.equal(
    healthRequestOwnerId({ assignedTechnicianId: "technician-legacy" }),
    "technician-legacy",
  );
});

test("Phase 1 leaves the live Health model enum and writes unchanged", () => {
  assert.equal(HEALTH_STATUS.ACTIVE, undefined);
  assert.equal(
    HealthRequest.schema.path("status").enumValues.includes("active"),
    false,
  );
  assert.deepEqual(
    new Set(HealthRequest.schema.path("status").enumValues),
    new Set(Object.values(HEALTH_STATUS)),
  );
});

test("Phase 1 leaves existing production transition normalization unchanged", () => {
  assert.equal(normalizeHealthStatus("approved"), "approved");
  assert.equal(normalizeHealthStatus("scheduled"), "scheduled");
  assert.equal(normalizeHealthStatus("in_progress"), "in-progress");
  assert.doesNotThrow(() =>
    assertStatusTransition("health", "approved", "scheduled"),
  );
  assert.throws(
    () => assertStatusTransition("health", "pending", "active"),
    (error) => error?.code === "INVALID_STATUS_TRANSITION",
  );
});

test("unknown status values remain readable for explicit compatibility handling", () => {
  assert.equal(normalizeHealthRequestStatus("legacy_unknown"), "legacy_unknown");
});
