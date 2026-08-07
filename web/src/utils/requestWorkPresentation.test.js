import { describe, expect, it } from "vitest";

import {
  deriveScheduleState,
  getServicePresentation,
  getWorkflowStatusPresentation,
  normalizeServiceType,
  normalizeWorkflowStatus,
} from "./requestWorkPresentation";

describe("request and work presentation", () => {
  it.each([
    [{ workflowType: "AI" }, "ai"],
    [{ workflowType: "Health" }, "health"],
    [{ workflowType: "PD" }, "pregnancy"],
    [{ taskType: "CD" }, "calving"],
    [{ taskType: "unmapped_internal_value" }, "unknown"],
  ])("normalizes service contracts without title guessing", (item, expected) => {
    expect(normalizeServiceType(item)).toBe(expected);
  });

  it("returns controlled service labels", () => {
    expect(getServicePresentation("ai").label).toBe("AI");
    expect(getServicePresentation("unknown").label).toBe("Other service");
  });

  it("derives urgency from local calendar dates", () => {
    const now = new Date(2026, 7, 4, 16, 30);
    expect(deriveScheduleState(new Date(2026, 7, 3, 23, 59), now)).toBe(
      "overdue",
    );
    expect(deriveScheduleState(new Date(2026, 7, 4, 0, 1), now)).toBe(
      "due_today",
    );
    expect(deriveScheduleState(new Date(2026, 7, 5, 0, 1), now)).toBe(
      "scheduled",
    );
  });

  it("lets terminal states override schedule urgency", () => {
    const now = new Date(2026, 7, 4);
    const pastSchedule = { schedule: { date: new Date(2026, 7, 1) } };
    expect(normalizeWorkflowStatus({ ...pastSchedule, status: "done" }, now)).toBe(
      "completed",
    );
    expect(
      normalizeWorkflowStatus({ ...pastSchedule, status: "cancelled" }, now),
    ).toBe("cancelled");
    expect(getWorkflowStatusPresentation("completed").label).toBe("Completed");
  });

  it("maps legacy AI in-progress to scheduled instead of exposing it", () => {
    expect(normalizeWorkflowStatus({ workflowType: "AI", status: "in-progress" })).toBe(
      "scheduled",
    );
  });
});
