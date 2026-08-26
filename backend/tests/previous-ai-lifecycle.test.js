import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENT_AI_ATTEMPT_QUERY,
  assertAIRecordSupportsCurrentTracking,
  assertPreviousAICanContinueTracking,
  normalizePreviousAIEntryMode,
  validatePreviousAIEventDate,
} from "../src/domain/previous-ai-entry.js";
import {
  getReproductionEligibility,
  resolveEffectiveReproductiveStatus,
} from "../src/domain/reproduction-lifecycle.js";
import { Insemination } from "../src/models/insemination.model.js";

test("Previous AI requires an explicit entry mode", () => {
  assert.throws(
    () => normalizePreviousAIEntryMode(undefined),
    (error) => error.code === "PREVIOUS_AI_ENTRY_MODE_REQUIRED",
  );
  assert.equal(normalizePreviousAIEntryMode("history_only"), "history_only");
  assert.equal(
    normalizePreviousAIEntryMode("continue_tracking"),
    "continue_tracking",
  );
});

test("Previous AI rejects future and pre-birth event dates", () => {
  assert.throws(
    () =>
      validatePreviousAIEventDate({
        eventDate: "2027-01-01",
        birthDate: "2022-01-01",
        now: "2026-01-01",
      }),
    (error) => error.code === "PREVIOUS_AI_DATE_IN_FUTURE",
  );
  assert.throws(
    () =>
      validatePreviousAIEventDate({
        eventDate: "2021-01-01",
        birthDate: "2022-01-01",
        now: "2026-01-01",
      }),
    (error) => error.code === "PREVIOUS_AI_BEFORE_BIRTH",
  );
});

test("Previous AI uses breeding age on the entered service date", () => {
  const common = {
    birthDate: "2025-01-15T00:00:00.000Z",
    species: "Cattle",
    now: "2026-08-27T00:00:00.000Z",
  };

  assert.throws(
    () => validatePreviousAIEventDate({
      ...common,
      eventDate: common.birthDate,
    }),
    (error) => error.code === "PREVIOUS_AI_BELOW_BREEDING_AGE",
  );
  assert.throws(
    () => validatePreviousAIEventDate({
      ...common,
      eventDate: "2026-01-14T00:00:00.000Z",
    }),
    (error) =>
      error.code === "PREVIOUS_AI_BELOW_BREEDING_AGE" &&
      error.message ===
        "The insemination date is earlier than this animal's minimum breeding age.",
  );
  assert.doesNotThrow(() => validatePreviousAIEventDate({
    ...common,
    eventDate: "2026-01-15T00:00:00.000Z",
  }));
});

test("Continue Tracking uses the breed gestation window", () => {
  assert.throws(
    () =>
      assertPreviousAICanContinueTracking({
        eventDate: "2025-01-01",
        now: "2026-01-01",
        species: "Cattle",
        breed: "Brahman",
      }),
    (error) =>
      error.code === "PREVIOUS_AI_TRACKING_WINDOW_CLOSED" &&
      error.details.avgGestationDays === 290,
  );
  assert.doesNotThrow(() =>
    assertPreviousAICanContinueTracking({
      eventDate: "2026-06-20",
      now: "2026-08-20",
      species: "Cattle",
      breed: "Brahman",
    }),
  );
});

test("history-only records cannot become current attempts or receive outcomes", () => {
  assert.deepEqual(CURRENT_AI_ATTEMPT_QUERY, {
    entryMode: { $ne: "history_only" },
  });
  assert.throws(
    () => assertAIRecordSupportsCurrentTracking({ entryMode: "history_only" }),
    (error) => error.code === "HISTORICAL_AI_NOT_TRACKABLE",
  );
});

test("history-only schema defaults do not create attempt lineage", () => {
  const history = new Insemination({
    farmerId: "507f1f77bcf86cd799439001",
    animalId: "507f1f77bcf86cd799439002",
    entryMode: "history_only",
    status: "done",
  });
  const live = new Insemination({
    farmerId: "507f1f77bcf86cd799439001",
    animalId: "507f1f77bcf86cd799439002",
    status: "done",
  });
  assert.equal(history.attemptNumber, undefined);
  assert.equal(history.attemptSeriesId, undefined);
  assert.equal(live.attemptNumber, 1);
  assert.ok(live.attemptSeriesId);
});

test("postpartum recovery derives Normal after VWP, never In Heat", () => {
  const now = new Date("2026-08-20T00:00:00.000Z");
  const base = {
    reproductiveStatus: "Post-partum",
    species: "Cattle",
    breed: "Brahman",
  };
  const recovering = {
    ...base,
    lastCalvingDate: new Date("2026-08-01T00:00:00.000Z"),
  };
  const recovered = {
    ...base,
    lastCalvingDate: new Date("2026-06-01T00:00:00.000Z"),
  };
  assert.equal(
    resolveEffectiveReproductiveStatus({ animal: recovering, now }),
    "Post-partum",
  );
  assert.equal(
    getReproductionEligibility({ animal: recovering, now }).code,
    "POSTPARTUM_RECOVERY",
  );
  const eligibility = getReproductionEligibility({ animal: recovered, now });
  assert.equal(eligibility.eligible, true);
  assert.equal(eligibility.effectiveReproductiveStatus, "Normal");
  assert.notEqual(eligibility.effectiveReproductiveStatus, "In Heat");
});
