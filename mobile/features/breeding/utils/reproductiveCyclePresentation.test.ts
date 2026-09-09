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
  getTimelineMilestoneVisualState,
  getUnconfirmedReproductiveTimelinePresentation,
  splitReproductiveAttempts,
} from "./reproductiveCyclePresentation.ts";
import * as reproductiveCyclePresentation from "./reproductiveCyclePresentation.ts";

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

  it("moves an older Continue Tracker cycle past elapsed heat monitoring", () => {
    const presentation = getUnconfirmedReproductiveTimelinePresentation({
      aiDate: "2026-07-31T08:00:00.000Z",
      now: "2026-09-04T08:00:00.000Z",
      nextAction: {
        phase: "PREGNANCY_MONITORING",
        type: "PERFORM_PREGNANCY_DIAGNOSIS",
        at: "2026-09-29T08:00:00.000Z",
      },
    });

    assert.equal(
      presentation.heatReturnDate?.toISOString(),
      "2026-08-21T08:00:00.000Z",
    );
    assert.equal(presentation.heatReturnIsCurrent, false);
    assert.equal(presentation.heatReturnHasElapsed, true);
    assert.equal(
      presentation.heatReturnState,
      "elapsed_without_observation",
    );
    assert.equal(
      presentation.heatReturnDetail,
      "Monitoring window passed\nNo observation recorded",
    );
    assert.equal(presentation.currentIndex, 2);
    assert.equal(
      presentation.pregnancyCheckDate?.toISOString(),
      "2026-09-29T08:00:00.000Z",
    );
    assert.equal(presentation.currentStageLabel, "Next Milestone");

    const visualState = getTimelineMilestoneVisualState({
      index: 1,
      currentIndex: presentation.currentIndex,
      isElapsedWithoutObservation:
        presentation.heatReturnState === "elapsed_without_observation",
    });
    assert.equal(visualState.complete, false);
    assert.equal(visualState.marker, "neutral");
  });

  it("uses the actual recorded heat observation instead of elapsed-without-observation", () => {
    const presentation = getUnconfirmedReproductiveTimelinePresentation({
      aiDate: "2026-07-31T08:00:00.000Z",
      now: "2026-09-04T08:00:00.000Z",
      nextAction: {
        phase: "PREGNANCY_CHECK_DUE",
        type: "PERFORM_PREGNANCY_DIAGNOSIS",
        at: "2026-09-04T08:00:00.000Z",
      },
      hasRecordedHeatObservation: true,
      recordedHeatObservationLabel: "Showing signs of heat",
    });

    assert.equal(presentation.heatReturnState, "recorded");
    assert.equal(presentation.heatReturnDetail, "Showing signs of heat");
    assert.notEqual(
      presentation.heatReturnState,
      "elapsed_without_observation",
    );
    assert.doesNotMatch(presentation.heatReturnDetail, /No observation recorded/);
  });

  it("keeps a recent AI cycle in heat-return monitoring", () => {
    const presentation = getUnconfirmedReproductiveTimelinePresentation({
      aiDate: "2026-08-25T08:00:00.000Z",
      now: "2026-09-04T08:00:00.000Z",
      nextAction: {
        phase: "HEAT_RETURN_MONITORING",
        type: "MONITOR_RETURN_TO_HEAT",
        at: "2026-09-15T08:00:00.000Z",
      },
      pregnancyReadiness: {
        availableDate: "2026-10-24T08:00:00.000Z",
      },
    });

    assert.equal(presentation.heatReturnIsCurrent, true);
    assert.equal(presentation.heatReturnHasElapsed, false);
    assert.equal(presentation.heatReturnState, "current");
    assert.equal(
      presentation.heatReturnDetail,
      "Observe for returning heat signs",
    );
    assert.equal(presentation.currentIndex, 1);
  });

  it("prefers the policy-derived PD Task date over local fallback dates", () => {
    const presentation = getUnconfirmedReproductiveTimelinePresentation({
      aiDate: "2026-07-31T08:00:00.000Z",
      now: "2026-09-04T08:00:00.000Z",
      pregnancyFollowUpTask: {
        dueDate: "2026-09-20T08:00:00.000Z",
      },
      pregnancyReadiness: {
        availableDate: "2026-09-29T08:00:00.000Z",
      },
    });

    assert.equal(
      presentation.pregnancyCheckDate?.toISOString(),
      "2026-09-20T08:00:00.000Z",
    );
    assert.equal(presentation.currentIndex, 2);
    assert.equal(presentation.currentStageLabel, "Next Milestone");
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

  it("aligns confirmed pregnancy milestone semantics: confirmed pregnancy completed and expected calving is current stage", () => {
    // When pregnancy is confirmed, currentIndex is 3 (Expected calving)
    const confirmedCurrentIndex = 3;

    // Index 0: AI completed
    const aiMilestone = getTimelineMilestoneVisualState({
      index: 0,
      currentIndex: confirmedCurrentIndex,
    });
    assert.equal(aiMilestone.complete, true);
    assert.equal(aiMilestone.active, false);
    assert.equal(aiMilestone.marker, "completed");

    // Index 1: Heat return monitoring (historical, passed without observation)
    const heatReturnMilestone = getTimelineMilestoneVisualState({
      index: 1,
      currentIndex: confirmedCurrentIndex,
      isElapsedWithoutObservation: true,
    });
    assert.equal(heatReturnMilestone.complete, false);
    assert.equal(heatReturnMilestone.active, false);
    assert.equal(heatReturnMilestone.marker, "neutral");

    // Index 2: Pregnancy confirmed
    const pregnancyConfirmedMilestone = getTimelineMilestoneVisualState({
      index: 2,
      currentIndex: confirmedCurrentIndex,
    });
    assert.equal(pregnancyConfirmedMilestone.complete, true);
    assert.equal(pregnancyConfirmedMilestone.active, false);
    assert.equal(pregnancyConfirmedMilestone.marker, "completed");

    // Index 3: Expected calving
    const expectedCalvingMilestone = getTimelineMilestoneVisualState({
      index: 3,
      currentIndex: confirmedCurrentIndex,
    });
    assert.equal(expectedCalvingMilestone.complete, false);
    assert.equal(expectedCalvingMilestone.active, true);
    assert.equal(expectedCalvingMilestone.marker, "active");
  });

  it("presents postpartum recovery after confirmed pregnancy loss with distinct recovery start date", () => {
    const presentation = getPostpartumPresentation({
      isCompletedCycle: true,
      effectiveReproductiveStatus: "Post-partum",
      calvingDate: "2026-09-09T00:00:00.000Z",
      isLossRecovery: true,
      nextAction: {
        phase: "RECOVERY_PERIOD",
        type: "WAIT_FOR_POSTPARTUM_RECOVERY",
        at: "2026-10-29T00:00:00.000Z",
      },
    });

    assert.equal(presentation?.title, "Post-partum");
    assert.equal(presentation?.message, "Recovering after pregnancy loss");
    assert.equal(presentation?.recoveryStartDate, "2026-09-09T00:00:00.000Z");
    assert.equal(presentation?.nextEligibleDate, "2026-10-29T00:00:00.000Z");
    assert.equal(presentation?.isLossRecovery, true);
  });

  it("presents historical insemination for pregnancy loss without bare Successful", () => {
    const attempt = {
      attemptNumber: 1,
      inseminationDate: "2026-04-12T00:00:00.000Z",
      outcome: "Success (Pregnant)",
      isSuccess: true,
      breedingCycleStatus: "lost",
      pregnancy: {
        cycleStatus: "lost",
        lossDate: "2026-09-09T00:00:00.000Z",
      },
    };

    const presentation = getHistoricalInseminationPresentation(attempt);
    assert.equal(presentation.title, "Attempt #1");
    assert.equal(presentation.context, "Pregnancy confirmed");
    assert.equal(presentation.outcome, "Pregnancy loss confirmed Sep 9, 2026");
    assert.notEqual(presentation.outcome, "Successful");
    assert.equal(presentation.isLoss, true);
  });
  it("resolves current recovery from the newer live birth instead of a historical loss", () => {
    assert.equal(typeof reproductiveCyclePresentation.resolveCurrentPostpartumRecovery, "function");
    const recovery = reproductiveCyclePresentation.resolveCurrentPostpartumRecovery?.({
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      lastCalvingDate: "2027-05-01T00:00:00.000Z",
      calvings: [
        { date: "2026-09-09T00:00:00.000Z", outcome: "abortion" },
        { date: "2027-05-01T00:00:00.000Z", outcome: "live_birth" },
      ],
    });
    assert.equal(recovery?.isLossRecovery, false);
    assert.equal(recovery?.recoveryStartDate, "2027-05-01T00:00:00.000Z");
  });

  it("resolves current recovery from the newer pregnancy loss instead of a historical live birth", () => {
    const recovery = reproductiveCyclePresentation.resolveCurrentPostpartumRecovery?.({
      lastCalvingDate: "2026-01-01T00:00:00.000Z",
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      calvings: [
        { date: "2026-01-01T00:00:00.000Z", outcome: "live_birth" },
        { date: "2026-09-09T00:00:00.000Z", outcome: "abortion" },
      ],
    });
    assert.equal(recovery?.isLossRecovery, true);
    assert.equal(recovery?.recoveryStartDate, "2026-09-09T00:00:00.000Z");
  });
});
