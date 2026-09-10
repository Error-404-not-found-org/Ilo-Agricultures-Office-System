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
    [{ sourceType: "farmer_pregnancy_loss_report" }, "pregnancy"],
    [{ workflowType: "PregnancyLossReview" }, "pregnancy"],
    [{ taskType: "CD" }, "calving"],
    [{ taskType: "unmapped_internal_value" }, "unknown"],
  ])("normalizes service contracts without title guessing", (item, expected) => {
    expect(normalizeServiceType(item)).toBe(expected);
  });

  it("returns controlled service labels", () => {
    expect(getServicePresentation("ai").label).toBe("AI");
    expect(getServicePresentation("unknown").label).toBe("Other service");
  });

  it("derives timing from Asia/Manila calendar dates", () => {
    const now = new Date("2026-08-04T04:00:00.000Z");
    expect(deriveScheduleState("2026-08-03", now)).toBe("overdue");
    expect(deriveScheduleState("2026-08-04", now)).toBe("due_today");
    expect(deriveScheduleState("2026-08-05", now)).toBe("scheduled");
  });

  it.each([
    [
      "AI scheduled today",
      { workflowType: "AI", status: "scheduled", scheduledDate: "2026-09-05" },
      "scheduled_today",
      "Scheduled Today",
    ],
    [
      "Health Farm Visit scheduled today",
      {
        workflowType: "Health",
        status: "scheduled",
        handlingMethod: "farm_visit",
        scheduledDate: "2026-09-05",
      },
      "scheduled_today",
      "Scheduled Today",
    ],
    [
      "Pregnancy Check due today",
      { workflowType: "PD", status: "Pending", dueDate: "2026-09-05" },
      "due_today",
      "Due Today",
    ],
    [
      "Breeding Follow-up due today",
      {
        workflowType: "BreedingFollowUp",
        status: "Pending",
        dueDate: "2026-09-05",
      },
      "due_today",
      "Due Today",
    ],
    [
      "AI scheduled in the future",
      { workflowType: "AI", status: "scheduled", scheduledDate: "2026-09-06" },
      "scheduled",
      "Scheduled",
    ],
    [
      "Health Farm Visit scheduled in the future",
      {
        workflowType: "Health",
        status: "scheduled",
        handlingMethod: "farm_visit",
        scheduledDate: "2026-09-06",
      },
      "scheduled",
      "Scheduled",
    ],
    [
      "reproductive task due in the future",
      { workflowType: "PD", status: "Pending", dueDate: "2026-09-06" },
      "upcoming",
      "Upcoming",
    ],
    [
      "past unfinished work",
      { workflowType: "PD", status: "Pending", dueDate: "2026-09-04" },
      "overdue",
      "Overdue",
    ],
  ])("%s has source-aware timing language", (_name, item, status, label) => {
    const normalized = normalizeWorkflowStatus(
      item,
      new Date("2026-09-05T04:00:00.000Z"),
    );
    expect(normalized).toBe(status);
    expect(getWorkflowStatusPresentation(normalized).label).toBe(label);
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
      expect(today).toBe("scheduled_today");
      expect(getWorkflowStatusPresentation(today).label).toBe(
        "Scheduled Today",
      );

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

    it("presents farmer pregnancy loss reports as Needs review in work queues", () => {
      const taskBySource = {
        sourceType: "farmer_pregnancy_loss_report",
        status: "Pending",
      };
      expect(normalizeWorkflowStatus(taskBySource)).toBe("needs_review");
      expect(getWorkflowStatusPresentation(normalizeWorkflowStatus(taskBySource)).label).toBe(
        "Needs review",
      );

      const taskByAction = {
        allowedAction: "REVIEW_PREGNANCY_LOSS",
        status: "Pending",
      };
      expect(normalizeWorkflowStatus(taskByAction)).toBe("needs_review");

      const taskByWorkflowType = {
        workflowType: "PregnancyLossReview",
        status: "Pending",
      };
      expect(normalizeWorkflowStatus(taskByWorkflowType)).toBe("needs_review");
    });
  });
});
