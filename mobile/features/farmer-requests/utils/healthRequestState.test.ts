import assert from "node:assert/strict";
import test from "node:test";

import {
  getHealthUrgencyPresentation,
  normalizeHealthUrgency,
} from "./healthRequestState.ts";

test("legacy normal-priority Health urgency values use routine wording", () => {
  for (const value of ["low", "medium", "normal"]) {
    const presentation = getHealthUrgencyPresentation(value);
    assert.equal(normalizeHealthUrgency(value), "normal");
    assert.equal(presentation.priority, "normal");
    assert.equal(presentation.label, "Routine attention");
    assert.doesNotMatch(presentation.label, /low|medium/i);
  }
});

test("legacy urgent-priority Health urgency values use farmer-safe wording", () => {
  for (const value of ["high", "emergency", "critical", "urgent"]) {
    const presentation = getHealthUrgencyPresentation(value);
    assert.equal(normalizeHealthUrgency(value), "urgent");
    assert.equal(presentation.priority, "urgent");
    assert.equal(presentation.label, "Needs urgent attention");
    assert.equal(presentation.technicianContext, "Marked urgent by farmer");
    assert.doesNotMatch(presentation.label, /high|critical|emergency/i);
  }
});

test("unknown Health urgency values degrade conservatively", () => {
  assert.deepEqual(getHealthUrgencyPresentation("legacy-unknown"), {
    priority: "normal",
    label: "Routine attention",
  });
  assert.deepEqual(getHealthUrgencyPresentation(undefined), {
    priority: "normal",
    label: "Routine attention",
  });
});
