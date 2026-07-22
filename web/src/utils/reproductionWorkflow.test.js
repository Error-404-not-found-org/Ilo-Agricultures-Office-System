import { describe, expect, it } from "vitest";
import {
  getBreedingAttemptPresentation,
  getRequestWorkflowSummary,
  getTaskWorkflowSummary,
  getWorkflowSourceLabel,
} from "./reproductionWorkflow";

describe("reproduction workflow presentation", () => {
  it("distinguishes a farmer observation from an official diagnosis", () => {
    const task = {
      taskType: "PD",
      status: "In Progress",
      technicianId: "tech-1",
      sourceType: "farmer_requested_verification",
      metadata: { workflowStage: "initial_confirmation" },
    };

    expect(getWorkflowSourceLabel(task)).toBe("Farmer observation");
    expect(getTaskWorkflowSummary(task)).toMatchObject({
      stageLabel: "Initial pregnancy diagnosis",
      sourceLabel: "Farmer observation",
      nextActionLabel:
        "Review the observation and record an official diagnosis",
    });
  });

  it("names continuation and diagnostic follow-up tasks independently", () => {
    expect(
      getTaskWorkflowSummary({
        taskType: "PD",
        status: "In Progress",
        technicianId: "tech-1",
        sourceType: "automatic_pd_followup",
        metadata: { workflowStage: "continuation_recheck" },
      }),
    ).toMatchObject({
      sourceLabel: "Official diagnosis follow-up",
      nextActionLabel: "Update the existing pregnancy record",
    });

    expect(
      getTaskWorkflowSummary({
        taskType: "PD",
        status: "In Progress",
        technicianId: "tech-1",
        sourceType: "automatic_pd_followup",
        metadata: { workflowStage: "diagnostic_follow_up" },
      }),
    ).toMatchObject({
      sourceLabel: "Diagnostic follow-up",
      nextActionLabel: "Review and record the diagnostic follow-up",
    });
  });

  it("does not present a farmer observation as a reproductive outcome", () => {
    expect(
      getRequestWorkflowSummary({
        type: "breeding_verification",
        status: "in-progress",
        raw: { sourceType: "farmer_requested_verification" },
      }),
    ).toMatchObject({
      sourceLabel: "Farmer observation",
      nextActionLabel:
        "Review the observation and record an official diagnosis",
    });
  });

  it("separates AI service progress from reproductive outcome", () => {
    expect(
      getBreedingAttemptPresentation({ status: "done", outcome: "Pending" }),
    ).toEqual({
      serviceProgress: {
        label: "Service completed",
        badgeClass: "badge-success",
      },
      reproductiveOutcome: {
        label: "Awaiting official diagnosis",
        badgeClass: "badge-ghost",
      },
    });

    expect(
      getBreedingAttemptPresentation({
        status: "done",
        outcome: "Failed (Negative PD)",
      }).reproductiveOutcome,
    ).toEqual({ label: "Not pregnant", badgeClass: "badge-error" });

    expect(
      getBreedingAttemptPresentation({
        status: "done",
        pregnancy: { pregnancyDiagnosis: { result: "Empty" } },
      }).reproductiveOutcome,
    ).toEqual({ label: "Not pregnant", badgeClass: "badge-error" });
  });
});
