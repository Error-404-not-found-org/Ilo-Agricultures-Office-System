import { describe, expect, it } from "vitest";
import {
  getLifecycleTaskPresentation,
  getTaskSupportingText,
} from "./technicianLifecyclePresentation";

const now = new Date("2026-09-20T04:00:00.000Z");
const task = (taskType, dueDate, extra = {}) => ({
  workflowType: taskType,
  taskType,
  dueDate,
  status: "Pending",
  ...extra,
});

describe("Technician lifecycle task presentation", () => {
  describe("supporting text", () => {
    it("suppresses only canonical automatic Pregnancy Check summaries", () => {
      expect(
        getTaskSupportingText({
          sourceType: "automatic_pd_followup",
          summary:
            "Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #02AT.",
        }),
      ).toBeNull();
    });

    it("preserves genuine instructions and wording that merely resembles generated text", () => {
      expect(
        getTaskSupportingText({
          sourceType: "manual_task",
          summary: "Bring the portable ultrasound and contact the farmer first.",
        }),
      ).toBe("Bring the portable ultrasound and contact the farmer first.");
      expect(
        getTaskSupportingText({
          sourceType: "manual_task",
          summary:
            "Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #02AT.",
        }),
      ).toBe(
        "Scheduled Pregnancy Diagnosis (PD) follow-up for Animal Tag #02AT.",
      );
    });

    it("supports existing detail-view fallback text without exposing automatic PD notes", () => {
      expect(getTaskSupportingText({}, "No additional service details recorded.")).toBe(
        "No additional service details recorded.",
      );
      expect(
        getTaskSupportingText(
          { raw: { sourceType: "automatic_pd_followup" }, summary: "Stored note" },
          "No additional service details recorded.",
        ),
      ).toBeNull();
    });
  });

  it("uses the report event time for return-to-heat work and never updatedAt", () => {
    expect(getLifecycleTaskPresentation(task("BreedingFollowUp", "2026-09-20", {
      sourceType: "farmer_requested_verification",
      raw: {
        metadata: { reportType: "return_to_heat" },
        updatedAt: "2026-09-25T02:00:00.000Z",
      },
    }), now)).toMatchObject({
      title: "Breeding Follow-up", actionState: "Needs review",
      context: "Return to heat reported", detail: "Reported today",
    });
    expect(getLifecycleTaskPresentation(task("BreedingFollowUp", "2026-09-19"), now)).toMatchObject({
      title: "Breeding Follow-up", context: null, timing: "Overdue · 1 day",
    });
    expect(getLifecycleTaskPresentation({
      taskType: "BreedingFollowUp",
      raw: {
        metadata: { reportType: "return_to_heat" },
        updatedAt: "2026-09-20T02:00:00.000Z",
      },
    }, now)).toMatchObject({
      context: "Return to heat reported",
      detail: null,
    });
  });

  it("uses Pregnancy Check readiness language and keeps loss review distinct", () => {
    expect(getLifecycleTaskPresentation(task("PD", "2026-09-18"), now)).toMatchObject({
      title: "Pregnancy Check", actionState: "Ready for check",
      detail: "Since Sep 18, 2026",
    });
    expect(getLifecycleTaskPresentation(task("BreedingFollowUp", "2026-09-20", {
      raw: {
        sourceType: "farmer_pregnancy_loss_report",
        metadata: { reportedAt: "2026-09-20T02:00:00.000Z" },
      },
    }), now)).toMatchObject({
      title: "Pregnancy Loss Review", actionState: "Needs review",
      context: "Farmer reported pregnancy loss", detail: "Reported today",
    });
  });

  it("keeps Continue Tracking historical PD in readiness semantics", () => {
    const presentation = getLifecycleTaskPresentation(task("PD", "2026-05-01T08:00:00.000Z", {
      sourceType: "automatic_pd_followup",
      raw: {
        taskType: "PD",
        sourceType: "automatic_pd_followup",
        relatedRecordType: "insemination",
        relatedRecordId: "historical-ai",
        metadata: { workflowStage: "initial_confirmation", inseminationId: "historical-ai", previousRecordEntry: true },
      },
    }), new Date("2026-09-21T04:00:00.000Z"));
    expect(presentation).toMatchObject({ title: "Pregnancy Check", actionState: "Ready for check", detail: "Since May 1, 2026" });
    expect(JSON.stringify(presentation)).not.toMatch(/\b(?:due|overdue)\b/i);
  });

  it("uses readiness for future milestones and appointment timing when scheduled", () => {
    expect(getLifecycleTaskPresentation(task("PD", "2026-09-24"), now)).toMatchObject({
      title: "Pregnancy Check", actionState: null,
      detail: "Check from Sep 24, 2026",
    });
    expect(getLifecycleTaskPresentation(task("PD", "2026-09-20", {
      schedule: { date: "2026-09-24", visitPeriod: "morning" },
    }), now)).toMatchObject({
      title: "Pregnancy Check", actionState: "Scheduled",
      detail: "Sep 24, 2026 · Morning",
    });
  });

  it("uses biological milestone timing for expected calving", () => {
    expect(getLifecycleTaskPresentation(task("Calving", "2026-09-20"), now)).toMatchObject({
      title: "Expected Calving", timing: "Expected today",
    });
    expect(getLifecycleTaskPresentation(task("Calving", "2026-09-15"), now)).toMatchObject({
      title: "Expected Calving", timing: "Past expected date · Sep 15, 2026",
    });
  });

  it("does not relabel AI, Health, or formal records", () => {
    expect(getLifecycleTaskPresentation({ workflowType: "AI" }, now)).toBeNull();
    expect(getLifecycleTaskPresentation({ workflowType: "Health" }, now)).toBeNull();
  });

  it("recognizes legacy actionable-work identity strings", () => {
    expect(getLifecycleTaskPresentation({
      workflowType: "PregnancyDiagnosis",
      serviceType: "Pregnancy Diagnosis",
      dueDate: "2026-09-20",
    }, now)).toMatchObject({
      title: "Pregnancy Check",
      actionState: "Ready for check",
    });
    expect(getLifecycleTaskPresentation({
      workflowType: "CalvingAssistance",
      serviceType: "Calving Assistance",
      dueDate: "2026-09-20",
    }, now)).toMatchObject({
      title: "Expected Calving",
      timing: "Expected today",
    });
  });
});
