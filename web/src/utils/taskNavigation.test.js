import { describe, expect, it } from "vitest";
import { buildPregnancyActionRequest, getCalendarTarget, getTaskPrimaryActionLabel } from "./taskNavigation";

describe("canonical technician task navigation", () => {
  it("routes a linked task by task id without using its title", () => {
    const target = getCalendarTarget({
      task: "Any presentation title",
      taskId: "task-22",
      metadata: { workflowStage: "continuation_recheck" },
    });
    expect(target).toMatchObject({ kind: "task", path: "/technician/work-queue", search: "?taskId=task-22" });
  });

  it("routes a standalone request to Request Board", () => {
    expect(getCalendarTarget({ requestId: "request-8" })).toMatchObject({
      kind: "request",
      path: "/technician/requests",
      search: "?requestId=request-8",
    });
  });

  it("uses stage-specific pregnancy actions", () => {
    expect(getTaskPrimaryActionLabel({ taskType: "PD", metadata: { workflowStage: "initial_confirmation" } })).toBe("Record pregnancy diagnosis");
    expect(getTaskPrimaryActionLabel({ taskType: "PD", metadata: { workflowStage: "continuation_recheck" } })).toBe("Record continuation recheck");
    expect(getTaskPrimaryActionLabel({ taskType: "PD", metadata: { workflowStage: "diagnostic_follow_up" } })).toBe("Record diagnostic follow-up");
  });

  it("builds an initial diagnosis payload with method policy context", () => {
    const request = buildPregnancyActionRequest({
      task: { _id: "task-1", taskType: "PD", metadata: { workflowStage: "initial_confirmation" }, pregnancyReadiness: { policyVersion: "policy-4" } },
      animalId: "animal-1", inseminationId: "ai-1", result: "Pregnant", note: "Palpated", diagnosisDate: "2026-08-06", diagnosticMethod: "palpation",
    });
    expect(request).toEqual({
      url: "/technician/pregnancy-check",
      payload: { animalId: "animal-1", inseminationId: "ai-1", result: "Pregnant", technicianNote: "Palpated", diagnosisDate: "2026-08-06", taskId: "task-1", methodCode: "palpation", policyVersion: "policy-4" },
    });
  });

  it("builds continuation and diagnostic follow-up payloads against the existing Pregnancy", () => {
    for (const workflowStage of ["continuation_recheck", "diagnostic_follow_up"]) {
      const request = buildPregnancyActionRequest({
        task: { _id: "task-2", taskType: "PD", metadata: { workflowStage, pregnancyId: "preg-1" } },
        result: "follow_up_required", note: "Review again", diagnosisDate: "2026-09-01", followUpDate: "2026-09-08",
      });
      expect(request.url).toBe("/technician/pregnancy-checks/preg-1/continuation-recheck");
      expect(request.payload).toMatchObject({ taskId: "task-2", result: "follow_up_required", followUpDate: "2026-09-08" });
      expect(request.payload).not.toHaveProperty("animalId");
    }
  });
});
