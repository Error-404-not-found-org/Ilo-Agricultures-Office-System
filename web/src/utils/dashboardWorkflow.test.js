import { describe, expect, it } from "vitest";
import {
  getDashboardScheduleOverview,
  getDashboardScheduleSlot,
} from "./dashboardWorkflow";

const NOW = new Date("2026-09-02T04:00:00.000Z");

const task = (overrides = {}) => ({
  id: "task-1",
  taskId: "task-1",
  type: "task",
  taskType: "PD",
  status: "Pending",
  dueDate: "2026-09-02T00:00:00.000Z",
  ...overrides,
});

describe("Technician Dashboard schedule overview", () => {
  it("counts due and overdue canonical work without treating future work as current", () => {
    const overview = getDashboardScheduleOverview(
      [
        task(),
        task({
          id: "overdue-calving",
          taskId: "overdue-calving",
          taskType: "CD",
          dueDate: "2026-09-01T00:00:00.000Z",
        }),
        task({
          id: "future-pregnancy",
          taskId: "future-pregnancy",
          dueDate: "2026-09-03T00:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(overview.dueCount).toBe(2);
    expect(overview.todayWork.map((item) => item.id)).toEqual(["task-1"]);
  });

  it("uses canonical Schedule filtering for Health response methods", () => {
    const overview = getDashboardScheduleOverview(
      [
        {
          id: "farm-visit",
          type: "health",
          status: "scheduled",
          handlingMethod: "farm_visit",
          scheduledDate: "2026-09-02T00:00:00.000Z",
          visitPeriod: "afternoon",
        },
        {
          id: "advice",
          type: "health",
          status: "resolved",
          handlingMethod: "advice",
          scheduledDate: "2026-09-02T00:00:00.000Z",
        },
      ],
      NOW,
    );

    expect(overview.todayWork).toHaveLength(1);
    expect(overview.todayWork[0].id).toBe("farm-visit");
    expect(getDashboardScheduleSlot(overview.todayWork[0])).toBe("Afternoon");
  });
});
