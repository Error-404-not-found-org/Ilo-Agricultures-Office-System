import test from "node:test";
import assert from "node:assert/strict";
import { getReproductionEligibility } from "../src/domain/reproduction-lifecycle.js";

// Mocking global components for offline queue testing
const mockApi = () => {
  let calls = 0;
  const fn = async (options) => {
    calls++;
    return { data: { success: true, options } };
  };
  fn.getCalls = () => calls;
  return fn;
};

// 1. Reproductive transition and postpartum recovery eligibility
test("Reproductive Lifecycle: blocks AI if postpartum window is active", () => {
  const recentCalving = new Date();
  recentCalving.setDate(recentCalving.getDate() - 10); // 10 days ago (standard recovery is ~60 days)

  const animal = {
    reproductiveStatus: "Normal",
    species: "Cattle",
    breed: "Brahman",
    lastCalvingDate: recentCalving,
  };

  const result = getReproductionEligibility({
    animal,
    activePregnancy: null,
    activeRequest: null,
    now: new Date(),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "POSTPARTUM_RECOVERY");
});

test("Reproductive Lifecycle: allows AI after postpartum window passes", () => {
  const oldCalving = new Date();
  oldCalving.setDate(oldCalving.getDate() - 90); // 90 days ago

  const animal = {
    reproductiveStatus: "Normal",
    species: "Cattle",
    breed: "Brahman",
    lastCalvingDate: oldCalving,
  };

  const result = getReproductionEligibility({
    animal,
    activePregnancy: null,
    activeRequest: null,
    now: new Date(),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.code, "AVAILABLE");
});

// 2. Veterinarian Escalations
test("Urgency Escalation Policy: veterinarian notifications sent only on Emergency", () => {
  const veterinarians = [{ _id: "vet-1", role: "veterinarian" }];
  const technicians = [{ _id: "tech-1", role: "technician" }];

  const checkEscalation = (urgency) => {
    // Simulated controller logic
    const veterinariansToNotify = urgency === "emergency" ? veterinarians : [];
    return veterinariansToNotify.length > 0;
  };

  assert.equal(checkEscalation("low"), false);
  assert.equal(checkEscalation("medium"), false);
  assert.equal(checkEscalation("high"), false);
  assert.equal(checkEscalation("emergency"), true);
});

test("Reproductive Lifecycle: active AI response exposes canonical next action", () => {
  const result = getReproductionEligibility({
    animal: {
      _id: "animal-1",
      reproductiveStatus: "Normal",
      species: "Cattle",
      breed: "Holstein",
    },
    activeRequest: {
      _id: "ai-1",
      status: "scheduled",
      preferredDate: "2026-07-20T08:00:00.000Z",
      scheduledDate: "2026-07-22T09:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
  assert.equal(result.nextAction.phase, "AI_SCHEDULED");
  assert.equal(result.nextAction.type, "ATTEND_AI_VISIT");
  assert.equal(result.nextActionAt.toISOString(), "2026-07-22T09:00:00.000Z");
});

test("Reproductive Lifecycle: postpartum response exposes recovery action", () => {
  const result = getReproductionEligibility({
    animal: {
      _id: "animal-1",
      reproductiveStatus: "Post-partum",
      species: "Cattle",
      breed: "Holstein",
      lastCalvingDate: "2026-07-01T00:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "POSTPARTUM_RECOVERY");
  assert.equal(result.nextAction.phase, "RECOVERY_PERIOD");
  assert.equal(result.nextAction.type, "WAIT_FOR_POSTPARTUM_RECOVERY");
  assert.equal(
    result.nextActionAt.toISOString(),
    result.nextAction.at.toISOString(),
  );
});

test("Reproductive Lifecycle: confirmed pregnancy exposes calving preparation", () => {
  const result = getReproductionEligibility({
    animal: {
      _id: "animal-1",
      reproductiveStatus: "Pregnant",
      species: "Cattle",
      breed: "Holstein",
      expectedCalvingDate: "2027-04-20T00:00:00.000Z",
    },
    activePregnancy: {
      targetCalvingDate: "2027-04-18T00:00:00.000Z",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.code, "ACTIVE_REPRODUCTIVE_WORKFLOW");
  assert.equal(result.nextAction.phase, "PREGNANT");
  assert.equal(result.nextAction.type, "PREPARE_FOR_CALVING");
  assert.equal(result.nextActionAt.toISOString(), "2027-04-18T00:00:00.000Z");
});

test("Reproductive Lifecycle: available animal returns no next action", () => {
  const result = getReproductionEligibility({
    animal: {
      _id: "animal-1",
      reproductiveStatus: "Normal",
      species: "Cattle",
      breed: "Holstein",
    },
    now: new Date("2026-07-16T00:00:00.000Z"),
  });

  assert.equal(result.eligible, true);
  assert.equal(result.code, "AVAILABLE");
  assert.equal(result.nextAction, null);
});