import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_HEALTH_REQUEST_TYPE,
  HEALTH_HANDLING_METHOD,
  HEALTH_REQUEST_PRIORITY,
  HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP,
  normalizeHealthRequestType,
  normalizeHealthUrgency,
} from "../src/domain/health-request-vocabulary.js";

test("legacy Health request types map to their canonical presentation groups", () => {
  const healthConcerns = [
    "disease",
    "injury",
    "wound",
    "weakness",
    "abnormal_behavior",
    "loss_of_appetite",
    "fever",
  ];
  for (const value of healthConcerns) {
    assert.equal(
      normalizeHealthRequestType(value),
      CANONICAL_HEALTH_REQUEST_TYPE.HEALTH_CONCERN,
    );
  }

  for (const value of ["medicine", "deworming"]) {
    assert.equal(
      normalizeHealthRequestType(value),
      CANONICAL_HEALTH_REQUEST_TYPE.MEDICINE_REQUEST,
    );
  }

  for (const value of ["checkup", "vaccination"]) {
    assert.equal(
      normalizeHealthRequestType(value),
      CANONICAL_HEALTH_REQUEST_TYPE.PREVENTIVE_CARE,
    );
  }

  assert.equal(
    normalizeHealthRequestType("other"),
    CANONICAL_HEALTH_REQUEST_TYPE.OTHER,
  );
  assert.equal(
    normalizeHealthRequestType("pregnancy_complication"),
    HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP.REPRODUCTIVE_CONCERN,
  );
  assert.equal(
    normalizeHealthRequestType("difficult_calving"),
    HEALTH_REQUEST_TYPE_COMPATIBILITY_GROUP.CALVING_CONCERN,
  );
});

test("future canonical request types normalize idempotently", () => {
  for (const value of Object.values(CANONICAL_HEALTH_REQUEST_TYPE)) {
    assert.equal(normalizeHealthRequestType(value), value);
  }
});

test("Health urgency values normalize to normal or urgent presentation", () => {
  for (const value of ["low", "medium", "normal"]) {
    assert.equal(normalizeHealthUrgency(value), HEALTH_REQUEST_PRIORITY.NORMAL);
  }
  for (const value of ["high", "emergency", "critical", "urgent"]) {
    assert.equal(normalizeHealthUrgency(value), HEALTH_REQUEST_PRIORITY.URGENT);
  }
});

test("handling methods expose only the approved future vocabulary", () => {
  assert.deepEqual(Object.values(HEALTH_HANDLING_METHOD), [
    "advice",
    "office_pickup",
    "farm_visit",
  ]);
});

test("unknown compatibility values are preserved rather than rewritten", () => {
  assert.equal(normalizeHealthRequestType("legacy_unknown"), "legacy_unknown");
  assert.equal(normalizeHealthUrgency("legacy_unknown"), "legacy_unknown");
});
