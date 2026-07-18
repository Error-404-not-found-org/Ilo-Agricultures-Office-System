import { describe, expect, it } from "vitest";
import {
  getClaimType,
  getTaskReadiness,
  getTaskStatus,
  getTechnicianStatus,
  getWorkflowStageLabel,
} from "./technicianWorkflow";

describe("technician workflow presentation", () => {
  it("maps Web service aliases to canonical claim types", () => {
    expect(getClaimType("insemination")).toBe("ai");
    expect(getClaimType("ai")).toBe("ai");
    expect(getClaimType("health")).toBe("health");
    expect(getClaimType("pregnancy_check")).toBe("breeding_verification");
    expect(getClaimType("breeding_verification")).toBe("breeding_verification");
    expect(getClaimType("calving")).toBeNull();
  });

  it("uses consistent labels for API status aliases", () => {
    expect(getTechnicianStatus("in_progress").label).toBe("In Progress");
    expect(getTechnicianStatus("in-progress").label).toBe("In Progress");
    expect(getTechnicianStatus("resolved").label).toBe("Resolved");
    expect(getTechnicianStatus("done").label).toBe("Completed");
  });

  it("keeps task status, workflow stage, and readiness as separate domains", () => {
    const continuation = {
      taskType: "PD",
      status: "Pending",
      metadata: { workflowStage: "continuation_recheck", pregnancyId: "preg-1" },
      pregnancyReadiness: { isEligible: false, reason: "Initial window lock" },
    };
    expect(getTaskStatus("Pending").label).toBe("Open");
    expect(getWorkflowStageLabel(continuation)).toBe("Continuation recheck");
    expect(getTaskReadiness(continuation)).toMatchObject({ ready: true, label: "Milestone task" });
  });

  it("locks only an ineligible initial pregnancy diagnosis and marks overdue tasks", () => {
    const initial = {
      taskType: "PD",
      metadata: { workflowStage: "initial_confirmation" },
      pregnancyReadiness: { isEligible: false, reason: "Available Aug 6." },
    };
    expect(getTaskReadiness(initial)).toEqual({ ready: false, label: "Locked", reason: "Available Aug 6." });
    expect(getTaskStatus("Pending", "2026-01-01", new Date("2026-02-01"))).toMatchObject({ label: "Overdue", isOverdue: true });
  });
});
