import test from "node:test";
import assert from "node:assert/strict";
import {
  HEAT_RETURN_MONITORING_POLICY,
  getHeatReturnMonitoringDates,
  isTerminalAIAttempt,
} from "../src/domain/reproduction-policy.js";
import { getFarmerBreedingObservationReadiness } from "../src/domain/pregnancy-readiness.js";

test("Heat-Return Monitoring Policy - Unit Tests", async (t) => {
  const inseminationDate = new Date("2026-08-01T00:00:00Z");

  await t.test("TEST 1 & 2: Farmer observation readiness", () => {
    const aiDate = new Date("2026-08-01T00:00:00Z");
    const insemination = { status: "done", inseminationDate: aiDate };

    // Day 17
    const day17 = new Date("2026-08-18T00:00:00Z"); // 17 days
    const notReady = getFarmerBreedingObservationReadiness({ insemination, at: day17 });
    assert.strictEqual(notReady.isEligible, false);
    assert.strictEqual(notReady.minimumDays, 18);

    // Day 18
    const day18 = new Date("2026-08-19T00:00:00Z"); // 18 days
    const ready = getFarmerBreedingObservationReadiness({ insemination, at: day18 });
    assert.strictEqual(ready.isEligible, true);
  });

  await t.test("TEST 3: BreedingFollowUp dueDate calculation", () => {
    const dates = getHeatReturnMonitoringDates(inseminationDate);

    // Day 18
    const expectedObservationStart = new Date("2026-08-19T00:00:00Z");
    assert.strictEqual(dates.observationWindowStartDate.getTime(), expectedObservationStart.getTime());

    // Day 21
    const expectedCycle = new Date("2026-08-22T00:00:00Z");
    assert.strictEqual(dates.expectedEstrousCycleDate.getTime(), expectedCycle.getTime());

    // Day 25
    const expectedFollowUp = new Date("2026-08-26T00:00:00Z");
    assert.strictEqual(dates.technicianFollowUpDate.getTime(), expectedFollowUp.getTime());
  });

  await t.test("TEST 6 & 7: Terminal AI outcomes", () => {
    const returnToHeat = {
      status: "done",
      isSuccess: false,
      outcome: "Failed (Re-heat)",
      outcomeVerificationStatus: "verified",
    };
    assert.strictEqual(isTerminalAIAttempt(returnToHeat), true);

    const negativePd = {
      status: "done",
      isSuccess: false,
      outcome: "Failed (Negative PD)",
      outcomeVerificationStatus: "verified",
    };
    assert.strictEqual(isTerminalAIAttempt(negativePd), true);

    const pregnant = {
      status: "done",
      isSuccess: true,
      outcome: "Pregnant",
      outcomeVerificationStatus: "verified",
    };
    assert.strictEqual(isTerminalAIAttempt(pregnant), true);

    const cancelled = {
      status: "cancelled",
    };
    assert.strictEqual(isTerminalAIAttempt(cancelled), true);
  });

  await t.test("TEST 8 & 9: Non-terminal states remain active", () => {
    const farmerUnsure = {
      status: "done",
      isSuccess: null,
      outcome: null,
    };
    assert.strictEqual(isTerminalAIAttempt(farmerUnsure), false);

    const cannotConfirm = {
      status: "done",
      isSuccess: null,
      outcome: null,
      verificationStatus: "verified",
      // the verified is not outcome verification
    };
    assert.strictEqual(isTerminalAIAttempt(cannotConfirm), false);

    const needsRecheck = {
      status: "done",
      isSuccess: null,
      outcome: null,
      verificationStatus: "pending",
    };
    assert.strictEqual(isTerminalAIAttempt(needsRecheck), false);
  });
});
