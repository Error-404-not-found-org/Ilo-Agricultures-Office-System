import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAuthoritativeReproductiveStatus,
  isBackendPostpartumRecovery,
  shouldUseLegacyPostpartumFallback,
} from "../../../lib/reproductionAuthority.ts";
import {
  getHistoricalInseminationPresentation,
  getPostpartumPresentation,
  splitReproductiveAttempts,
} from "./reproductiveCyclePresentation.ts";

describe("reproductive cycle presentation", () => {
  it("never labels a history-only AI as the current cycle", () => {
    const historical = {
      _id: "history",
      entryMode: "history_only",
      inseminationDate: "2024-08-26",
      outcome: "Pending",
    };
    const split = splitReproductiveAttempts([historical], "Inseminated");

    assert.equal(split.current, null);
    assert.deepEqual(split.history, [historical]);
    assert.deepEqual(getHistoricalInseminationPresentation(historical), {
      title: "Artificial Insemination",
      context: "Historical record",
      outcome: "Outcome not recorded",
    });
  });

  it("allows Continue Tracking to be current only after backend state confirms it", () => {
    const continued = { _id: "continued", entryMode: "continue_tracking" };
    assert.equal(splitReproductiveAttempts([continued], "Normal").current, null);
    assert.equal(
      splitReproductiveAttempts([continued], "Inseminated").current,
      continued,
    );
  });

  it("presents postpartum recovery from backend next-action data", () => {
    const presentation = getPostpartumPresentation({
      isCompletedCycle: true,
      effectiveReproductiveStatus: "Post-partum",
      calvingDate: "2026-07-01",
      nextAction: {
        phase: "RECOVERY_PERIOD",
        type: "WAIT_FOR_POSTPARTUM_RECOVERY",
        at: "2026-08-15",
      },
    });

    assert.equal(presentation?.title, "Post-partum");
    assert.equal(presentation?.message, "Recovering after calving");
    assert.equal(presentation?.nextEligibleDate, "2026-08-15");
    assert.equal(presentation?.availability, "AI unavailable during recovery");
  });

  it("does not claim heat when backend says postpartum recovery is complete", () => {
    const presentation = getPostpartumPresentation({
      isCompletedCycle: true,
      effectiveReproductiveStatus: "Normal",
      calvingDate: "2026-07-01",
      nextAction: null,
    });

    assert.equal(presentation?.title, "Recovery complete");
    assert.match(
      presentation?.message || "",
      /Monitor the animal for signs of heat/,
    );
    assert.doesNotMatch(JSON.stringify(presentation), /Ready for AI|In Heat/);
  });

  it("does not block completed recovery solely because raw status remains Post-partum", () => {
    const animal = {
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Normal",
      nextAction: null,
    };

    assert.equal(getAuthoritativeReproductiveStatus(animal), "Normal");
    assert.equal(isBackendPostpartumRecovery(animal), false);
    assert.equal(shouldUseLegacyPostpartumFallback(animal), false);
  });
});
