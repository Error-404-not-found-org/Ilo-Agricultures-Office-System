import { describe, expect, it } from "vitest";
import { getLifecycleTaskPresentation } from "./technicianLifecyclePresentation";

const now = new Date("2026-09-20T04:00:00.000Z");
const task = (taskType, dueDate, extra = {}) => ({
  workflowType: taskType,
  taskType,
  dueDate,
  status: "Pending",
  ...extra,
});

describe("Technician lifecycle task presentation", () => {
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
