import { describe, expect, it } from "vitest";

import {
  deriveScheduleState,
  formatCanonicalVisitSchedule,
  getServicePresentation,
  getWorkflowStatusPresentation,
  isDateOnlyWorkflowType,
  normalizeServiceType,
  normalizeWorkflowStatus,
} from "./requestWorkPresentation";

describe("request and work presentation", () => {
  it("formats canonical visit dates with periods and no invented clock time", () => {
    const morning = formatCanonicalVisitSchedule({
      date: "2026-08-12T04:00:00.000Z",
      visitPeriod: "morning",
    });
    const afternoon = formatCanonicalVisitSchedule({
      date: "2026-08-12T04:00:00.000Z",
      visitPeriod: "afternoon",
    });

    expect(morning).toBe("August 12, 2026 · Morning");
    expect(afternoon).toBe("August 12, 2026 · Afternoon");
    expect(`${morning} ${afternoon}`).not.toContain("12:00");
    expect(formatCanonicalVisitSchedule()).toBe("Not scheduled");
    expect(formatCanonicalVisitSchedule({ date: "not-a-date" })).toBe(
      "Not scheduled",
    );
  });

  it("keeps reproductive milestone deadlines date-only", () => {
    expect(isDateOnlyWorkflowType("PD")).toBe(true);
    expect(isDateOnlyWorkflowType("Pregnancy")).toBe(true);
    expect(isDateOnlyWorkflowType("CD")).toBe(true);
    expect(isDateOnlyWorkflowType("Calving")).toBe(true);
    expect(isDateOnlyWorkflowType("GeneralVisit")).toBe(false);
  });

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

  describe("canonical Health handling method state matrix", () => {
    it("1. claimed Health without handling method returns needs_response (no false scheduled or needs_scheduling)", () => {
      const item = {
        workflowType: "Health",
        status: "assigned",
      };
      const workflowStatus = normalizeWorkflowStatus(item);
      expect(workflowStatus).toBe("needs_response");
      expect(getWorkflowStatusPresentation(workflowStatus).label).toBe(
        "Needs response",
      );
    });

    it("2. Health with advice returns needs_response without visit scheduling", () => {
      const item = {
        workflowType: "Health",
        status: "assigned",
        handlingMethod: "advice",
      };
      const workflowStatus = normalizeWorkflowStatus(item);
      expect(workflowStatus).toBe("needs_response");
      expect(getWorkflowStatusPresentation(workflowStatus).label).toBe(
        "Needs response",
      );
    });

    it("3. Health with office_pickup returns needs_response without visit scheduling", () => {
      const item = {
        workflowType: "Health",
        status: "assigned",
        handlingMethod: "office_pickup",
      };
      const workflowStatus = normalizeWorkflowStatus(item);
      expect(workflowStatus).toBe("needs_response");
      expect(getWorkflowStatusPresentation(workflowStatus).label).toBe(
        "Needs response",
      );
    });

    it("4. Health with farm_visit and NO schedule date returns needs_scheduling", () => {
      const item = {
        workflowType: "Health",
        status: "assigned",
        handlingMethod: "farm_visit",
      };
      const workflowStatus = normalizeWorkflowStatus(item);
      expect(workflowStatus).toBe("needs_scheduling");
      expect(getWorkflowStatusPresentation(workflowStatus).label).toBe(
        "Needs scheduling",
      );
    });

    it("5. Health with farm_visit and scheduledDate uses temporal presentation", () => {
      const now = new Date(2026, 7, 4, 10, 0);
      const future = normalizeWorkflowStatus(
        {
          workflowType: "Health",
          status: "assigned",
          handlingMethod: "farm_visit",
          scheduledDate: "2026-08-05",
        },
        now,
      );
      expect(future).toBe("scheduled");
      expect(getWorkflowStatusPresentation(future).label).toBe("Scheduled");

      const today = normalizeWorkflowStatus(
        {
          workflowType: "Health",
          status: "assigned",
          handlingMethod: "farm_visit",
          scheduledDate: "2026-08-04",
        },
        now,
      );
      expect(today).toBe("due_today");
      expect(getWorkflowStatusPresentation(today).label).toBe("Due Today");

      const overdue = normalizeWorkflowStatus(
        {
          workflowType: "Health",
          status: "assigned",
          handlingMethod: "farm_visit",
          scheduledDate: "2026-08-03",
        },
        now,
      );
      expect(overdue).toBe("overdue");
      expect(getWorkflowStatusPresentation(overdue).label).toBe("Overdue");
    });

    it("never exposes user-facing 'triaged' label", () => {
      expect(getWorkflowStatusPresentation("triaged").label).toBe(
        "Needs response",
      );
      expect(getWorkflowStatusPresentation("triaged").label).not.toMatch(
        /triage/i,
      );
    });
  });
});
