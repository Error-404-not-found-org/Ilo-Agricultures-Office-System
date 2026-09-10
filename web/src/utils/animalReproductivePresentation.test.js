import { describe, expect, it } from "vitest";
import {
  getAnimalReproductivePresentation,
  getUnconfirmedReproductiveTimelinePresentation,
  splitReproductiveAttempts,
} from "./animalReproductivePresentation";
import * as reproductivePresentation from "./animalReproductivePresentation";

const activeAttempt = {
  _id: "ai-current",
  attemptNumber: 2,
  inseminationDate: "2026-08-24T00:00:00.000Z",
  status: "completed",
};

describe("animal reproductive presentation", () => {
  it("keeps unknown reproductive data truthful", () => {
    const presentation = getAnimalReproductivePresentation({});

    expect(presentation.statusLabel).toBe("Not recorded");
    expect(presentation.statusLabel).not.toBe("Normal");
    expect(presentation.currentAttempt).toBeNull();
  });

  it("shows the real active insemination and separates previous attempts", () => {
    const previous = {
      _id: "ai-previous",
      attemptNumber: 1,
      inseminationDate: "2026-07-10T00:00:00.000Z",
      outcome: "Failed (Negative PD)",
    };
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Inseminated",
      inseminations: [previous, activeAttempt],
    });

    expect(presentation.statusLabel).toBe("Inseminated");
    expect(presentation.currentAttempt?._id).toBe("ai-current");
    expect(presentation.currentAttemptNumber).toBe(2);
    expect(presentation.historicalAttempts).toEqual([previous]);
  });

  it("shows only authoritative pregnancy confirmation and expected-calving dates", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Pregnant",
      expectedCalvingDate: "2027-06-03T00:00:00.000Z",
      inseminations: [
        {
          ...activeAttempt,
          pregnancy: {
            cycleStatus: "active",
            targetCalvingDate: "2027-06-04T00:00:00.000Z",
            pregnancyDiagnosis: {
              result: "Pregnant",
              date: "2026-09-25T00:00:00.000Z",
            },
          },
        },
      ],
    });

    expect(presentation.pregnancyConfirmed).toBe(true);
    expect(presentation.pregnancyConfirmedAt).toBe("2026-09-25T00:00:00.000Z");
    expect(presentation.expectedCalvingDate).toBe("2027-06-04T00:00:00.000Z");
  });

  it("does not invent pregnancy or expected calving from an AI date", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Inseminated",
      inseminations: [activeAttempt],
    });

    expect(presentation.pregnancyConfirmed).toBe(false);
    expect(presentation.pregnancyConfirmedAt).toBeNull();
    expect(presentation.expectedCalvingDate).toBeNull();
  });

  it("uses the real linked pregnancy recheck task", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Inseminated",
      inseminations: [
        {
          ...activeAttempt,
          pregnancyFollowUpTask: {
            status: "Pending",
            dueDate: "2026-10-10T00:00:00.000Z",
            metadata: { workflowStage: "diagnostic_follow_up" },
          },
        },
      ],
    });

    expect(presentation.nextFollowUp).toEqual({
      label: "Pregnancy recheck",
      date: "2026-10-10T00:00:00.000Z",
      status: "Pending",
    });
  });

  it("uses authoritative next-action context for breeding follow-up", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Inseminated",
      inseminations: [activeAttempt],
      nextAction: {
        type: "MONITOR_RETURN_TO_HEAT",
        label: "Breeding follow-up",
        at: "2026-09-14T00:00:00.000Z",
      },
    });

    expect(presentation.nextFollowUp).toEqual({
      label: "Breeding follow-up",
      date: "2026-09-14T00:00:00.000Z",
      status: null,
    });
  });

  it("presents a recorded return to heat without claiming pregnancy", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "In Heat",
      inseminations: [
        {
          ...activeAttempt,
          isSuccess: false,
          outcome: "Failed (Re-heat)",
          farmerOutcomeReport: "return_to_heat",
          farmerOutcomeReportedAt: "2026-09-12T00:00:00.000Z",
        },
      ],
    });

    expect(presentation.returnToHeat).toBe(true);
    expect(presentation.returnToHeatDate).toBe("2026-09-12T00:00:00.000Z");
    expect(presentation.pregnancyConfirmed).toBe(false);
  });

  it("keeps history-only AI out of the active cycle", () => {
    const historical = {
      ...activeAttempt,
      entryMode: "history_only",
    };
    const presentation = getAnimalReproductivePresentation({
      inseminations: [historical],
    });

    expect(presentation.currentAttempt).toBeNull();
    expect(presentation.latestHistoricalAttempt).toBe(historical);
    expect(presentation.historyOnlyLatest).toBe(true);
    expect(presentation.pregnancyConfirmed).toBe(false);
  });

  it("matches Mobile postpartum recovery semantics", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Normal",
      effectiveReproductiveStatus: "Post-partum",
      lastCalvingDate: "2026-08-30T00:00:00.000Z",
      nextAction: {
        type: "WAIT_FOR_POSTPARTUM_RECOVERY",
        phase: "RECOVERY_PERIOD",
        at: "2026-10-14T00:00:00.000Z",
      },
    });

    expect(presentation.statusLabel).toBe("Post-partum");
    expect(presentation.postpartum).toMatchObject({
      context: "Recovering after calving",
      calvingDate: "2026-08-30T00:00:00.000Z",
      nextEligibleDate: "2026-10-14T00:00:00.000Z",
    });
  });

  it("does not select a non-historical attempt as active for an inactive state", () => {
    const result = splitReproductiveAttempts([activeAttempt], "Normal");

    expect(result.current).toBeNull();
    expect(result.history).toEqual([activeAttempt]);
  });

  it("matches Mobile heat-return and pregnancy-check milestone logic", () => {
    const timeline = getUnconfirmedReproductiveTimelinePresentation({
      aiDate: "2026-07-31T00:00:00.000Z",
      nextAction: {
        type: "MONITOR_RETURN_TO_HEAT",
        at: "2026-08-21T00:00:00.000Z",
      },
      pregnancyReadiness: {
        availableDate: "2026-09-29T00:00:00.000Z",
      },
      now: "2026-08-10T00:00:00.000Z",
    });

    expect(timeline.heatReturnDate.toISOString()).toBe(
      "2026-08-21T00:00:00.000Z",
    );
    expect(timeline.pregnancyCheckDate.toISOString()).toBe(
      "2026-09-29T00:00:00.000Z",
    );
    expect(timeline.heatReturnState).toBe("current");
    expect(timeline.currentIndex).toBe(1);
  });

  it("uses a real diagnostic follow-up as the pregnancy recheck milestone", () => {
    const presentation = getAnimalReproductivePresentation(
      {
        reproductiveStatus: "Inseminated",
        inseminations: [
          {
            ...activeAttempt,
            pregnancyReadiness: {
              availableDate: "2026-09-29T00:00:00.000Z",
            },
            pregnancyFollowUpTask: {
              status: "Pending",
              dueDate: "2026-10-10T00:00:00.000Z",
              metadata: { workflowStage: "diagnostic_follow_up" },
            },
          },
        ],
        nextAction: {
          type: "PERFORM_PREGNANCY_DIAGNOSIS",
          at: "2026-10-10T00:00:00.000Z",
        },
      },
      { now: "2026-10-01T00:00:00.000Z" },
    );

    expect(presentation.context).toBe("Pregnancy recheck follow-up");
    expect(presentation.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "pregnancy-check",
          label: "Pregnancy recheck",
          state: "current",
          date: expect.any(Date),
        }),
      ]),
    );
  });

  it("builds complete chronological history with factual performers", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Pregnant",
      inseminations: [
        {
          _id: "ai-previous",
          attemptNumber: 1,
          entryMode: "history_only",
          inseminationDate: "2026-07-10T00:00:00.000Z",
          approvedBy: { _id: "tech-a", name: "Technician A" },
        },
        {
          _id: "ai-current",
          attemptNumber: 2,
          inseminationDate: "2026-08-24T00:00:00.000Z",
          approvedBy: { _id: "tech-b", name: "Technician B" },
          pregnancy: {
            _id: "pregnancy-1",
            pregnancyDiagnosis: {
              result: "Pregnant",
              date: "2026-09-25T00:00:00.000Z",
            },
            diagnosedBy: "Technician C",
          },
        },
      ],
      calvings: [
        {
          _id: "calving-1",
          date: "2025-12-10T00:00:00.000Z",
          outcome: "live_birth",
        },
      ],
    });

    expect(presentation.historyEvents).toEqual([
      expect.objectContaining({
        kind: "Pregnancy Check",
        result: "Pregnant",
        performedBy: "Technician C",
      }),
      expect.objectContaining({
        kind: "Artificial Insemination",
        attemptNumber: 2,
        performedBy: "Technician B",
        isCurrent: true,
      }),
      expect.objectContaining({
        kind: "Artificial Insemination",
        attemptNumber: 1,
        performedBy: "Technician A",
        isHistoryOnly: true,
      }),
      expect.objectContaining({ kind: "Calving", result: "live_birth" }),
    ]);
  });

  it("distinguishes pending farmer heat report from confirmed return to heat", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Inseminated",
      inseminations: [
        {
          ...activeAttempt,
          isSuccess: null,
          outcome: "Pending",
          farmerOutcomeReport: "return_to_heat",
          farmerOutcomeReportedAt: "2026-09-07T00:00:00.000Z",
          verificationRequested: true,
          verificationStatus: "pending",
        },
      ],
      nextAction: {
        type: "MONITOR_RETURN_TO_HEAT",
        at: "2026-09-15T00:00:00.000Z",
      },
    });

    expect(presentation.returnToHeat).toBe(false);
    expect(presentation.context).toBe("Return to heat reported");
    expect(presentation.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "heat-return-monitoring",
          detail: "Heat signs reported · Awaiting technician verification",
          state: "completed",
        }),
        expect.objectContaining({
          key: "pregnancy-check",
          state: expect.not.stringMatching(/skipped/),
        }),
      ]),
    );
  });

  it("marks expected calving completed, calving recorded, and post-partum as the only current stage post-calving", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Post-partum",
      lastCalvingDate: "2026-09-04T00:00:00.000Z",
      expectedCalvingDate: "2026-09-04T00:00:00.000Z",
      inseminations: [
        {
          _id: "ai-1",
          attemptNumber: 1,
          inseminationDate: "2025-11-25T00:00:00.000Z",
          status: "done",
          outcome: "Success (Pregnant)",
          pregnancy: {
            _id: "preg-1",
            cycleStatus: "completed",
            pregnancyDiagnosis: {
              result: "Pregnant",
              date: "2026-01-25T00:00:00.000Z",
            },
          },
        },
      ],
      calvings: [
        {
          _id: "calving-1",
          date: "2026-09-04T00:00:00.000Z",
          outcome: "live_birth",
        },
      ],
      nextAction: {
        type: "WAIT_FOR_POSTPARTUM_RECOVERY",
        phase: "RECOVERY_PERIOD",
        at: "2026-10-19T00:00:00.000Z",
      },
    });

    const currentStages = presentation.timeline.filter(
      (stage) => stage.state === "current",
    );
    expect(currentStages).toHaveLength(1);
    expect(currentStages[0].key).toBe("postpartum-recovery");

    const expectedCalving = presentation.timeline.find(
      (stage) => stage.key === "expected-calving",
    );
    expect(expectedCalving).toBeDefined();
    expect(expectedCalving.state).toBe("completed");

    const calvingRecorded = presentation.timeline.find(
      (stage) => stage.key === "calving-recorded",
    );
    expect(calvingRecorded).toBeDefined();
    expect(calvingRecorded.state).toBe("completed");
  });

  it("normalizes confirmed pregnancy loss in timeline, context, and history without raw abortion enum", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Post-partum",
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      expectedCalvingDate: "2026-09-09T00:00:00.000Z",
      inseminations: [
        {
          _id: "ai-1",
          attemptNumber: 1,
          inseminationDate: "2026-04-12T00:00:00.000Z",
          status: "done",
          outcome: "Success (Pregnant)",
          breedingCycleStatus: "lost",
          pregnancy: {
            _id: "preg-1",
            cycleStatus: "lost",
            pregnancyDiagnosis: {
              result: "Pregnant",
              date: "2026-06-12T00:00:00.000Z",
            },
          },
        },
      ],
      calvings: [
        {
          _id: "calving-loss-1",
          date: "2026-09-09T00:00:00.000Z",
          outcome: "abortion",
        },
      ],
      nextAction: {
        type: "WAIT_FOR_POSTPARTUM_RECOVERY",
        phase: "RECOVERY_PERIOD",
        at: "2026-10-29T00:00:00.000Z",
      },
    });

    expect(presentation.context).toBe("Recovering after pregnancy loss");
    expect(presentation.context).not.toBe("Recovering after calving");

    const lossMilestone = presentation.timeline.find(
      (m) => m.key === "calving-recorded",
    );
    expect(lossMilestone).toBeDefined();
    expect(lossMilestone.label).toBe("Pregnancy loss confirmed");
    expect(lossMilestone.label).not.toBe("Calving recorded");
    expect(lossMilestone.detail).toBe("Pregnancy loss recorded");
    expect(lossMilestone.date).toBe("2026-09-09T00:00:00.000Z");

    const recoveryMilestone = presentation.timeline.find(
      (m) => m.key === "postpartum-recovery",
    );
    expect(recoveryMilestone).toBeDefined();
    expect(recoveryMilestone.detail).toBe("Recovering after pregnancy loss");
    expect(recoveryMilestone.startDate).toBe("2026-09-09T00:00:00.000Z");
    expect(recoveryMilestone.eligibleDate).toBe("2026-10-29T00:00:00.000Z");

    const historyLoss = presentation.historyEvents.find(
      (e) => e.kind === "Pregnancy Loss",
    );
    expect(historyLoss).toBeDefined();
    expect(historyLoss.result).toBe("Pregnancy loss confirmed");
    expect(JSON.stringify(presentation.historyEvents)).not.toContain("abortion");
  });
  it("allows Pregnancy Diagnosis for a completed active AI without a Pregnancy object", () => {
    expect(typeof reproductivePresentation.hasEligibleBreedingAttemptForPD).toBe("function");
    expect(reproductivePresentation.hasEligibleBreedingAttemptForPD?.({
      reproductiveStatus: "Inseminated",
      gender: "Female",
      inseminations: [{ status: "completed", outcome: "Pending", breedingCycleStatus: "active", inseminationDate: "2026-09-01T00:00:00.000Z" }],
    })).toBe(true);
  });

  it("blocks Pregnancy Diagnosis during postpartum recovery after loss", () => {
    expect(reproductivePresentation.hasEligibleBreedingAttemptForPD?.({
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Post-partum",
      gender: "Female",
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      inseminations: [{ status: "completed", outcome: "Pending", breedingCycleStatus: "active", inseminationDate: "2026-09-01T00:00:00.000Z" }],
    })).toBe(false);
  });

  it("allows Pregnancy Diagnosis for a new active AI after a historical lost cycle", () => {
    expect(reproductivePresentation.hasEligibleBreedingAttemptForPD?.({
      reproductiveStatus: "Inseminated",
      gender: "Female",
      inseminations: [
        { status: "done", outcome: "Success (Pregnant)", breedingCycleStatus: "lost", inseminationDate: "2025-01-01T00:00:00.000Z", pregnancy: { cycleStatus: "lost" } },
        { status: "done", outcome: "Pending", breedingCycleStatus: "active", inseminationDate: "2026-09-01T00:00:00.000Z" },
      ],
    })).toBe(true);
  });

  it("blocks Pregnancy Diagnosis when every AI cycle is closed", () => {
    expect(reproductivePresentation.hasEligibleBreedingAttemptForPD?.({
      reproductiveStatus: "Normal",
      gender: "Female",
      inseminations: [
        { status: "done", outcome: "Pending", breedingCycleStatus: "lost", inseminationDate: "2025-01-01" },
        { status: "done", outcome: "Pending", breedingCycleStatus: "completed", inseminationDate: "2025-08-01" },
        { status: "done", outcome: "Pending", breedingCycleStatus: "superseded", inseminationDate: "2026-01-01" },
      ],
    })).toBe(false);
  });

  it("uses a newer live birth as the current postpartum recovery event despite historical loss", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Post-partum",
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      lastCalvingDate: "2027-05-01T00:00:00.000Z",
      calvings: [
        { date: "2026-09-09T00:00:00.000Z", outcome: "abortion" },
        { date: "2027-05-01T00:00:00.000Z", outcome: "live_birth" },
      ],
    });
    expect(presentation.postpartum?.context).toBe("Recovering after calving");
    expect(presentation.postpartum?.recoveryStartDate).toBe("2027-05-01T00:00:00.000Z");
  });

  it("uses a newer pregnancy loss as the current postpartum recovery event despite historical live birth", () => {
    const presentation = getAnimalReproductivePresentation({
      reproductiveStatus: "Post-partum",
      effectiveReproductiveStatus: "Post-partum",
      lastCalvingDate: "2026-01-01T00:00:00.000Z",
      lastPregnancyLossDate: "2026-09-09T00:00:00.000Z",
      calvings: [
        { date: "2026-01-01T00:00:00.000Z", outcome: "live_birth" },
        { date: "2026-09-09T00:00:00.000Z", outcome: "abortion" },
      ],
    });
    expect(presentation.postpartum?.context).toBe("Recovering after pregnancy loss");
    expect(presentation.postpartum?.recoveryStartDate).toBe("2026-09-09T00:00:00.000Z");
  });
});
