import { describe, expect, it } from "vitest";
import {
  isActiveTask,
  isOnHoldTask,
  isTaskCompletedThisWeek,
  isTaskDueToday,
  isTaskScheduledThisWeek,
  isTaskUpcoming,
  isTerminalTask,
} from "./workQueue";

describe("work queue task classification", () => {
  it("keeps active, on-hold, and terminal states distinct", () => {
    expect(isActiveTask({ status: "Pending" })).toBe(true);
    expect(isOnHoldTask({ status: "paused" })).toBe(true);
    expect(isTerminalTask({ status: "Done" })).toBe(true);
    expect(isTerminalTask({ status: "cancelled" })).toBe(true);
  });

  it("classifies due dates by the browser's local calendar day", () => {
    const now = new Date(2026, 6, 22, 23, 30);
    const earlierToday = new Date(2026, 6, 22, 1, 0).toISOString();
    const tomorrow = new Date(2026, 6, 23, 1, 0).toISOString();

    expect(isTaskDueToday({ status: "pending", dueDate: earlierToday }, now)).toBe(true);
    expect(isTaskUpcoming({ status: "pending", dueDate: tomorrow }, now)).toBe(true);
  });

  it("does not double-count paused or terminal tasks as due or upcoming", () => {
    const now = new Date(2026, 6, 22, 9, 0);
    const today = new Date(2026, 6, 22, 12, 0).toISOString();
    const tomorrow = new Date(2026, 6, 23, 12, 0).toISOString();

    expect(isTaskDueToday({ status: "paused", dueDate: today }, now)).toBe(false);
    expect(isTaskUpcoming({ status: "completed", dueDate: tomorrow }, now)).toBe(false);
  });

  it("counts only completion timestamps inside the current local week", () => {
    const now = new Date(2026, 6, 22, 12, 0);
    const thisWeek = new Date(2026, 6, 21, 10, 0).toISOString();
    const previousWeek = new Date(2026, 6, 12, 10, 0).toISOString();

    expect(isTaskCompletedThisWeek({ status: "completed", completedAt: thisWeek }, now)).toBe(true);
    expect(isTaskCompletedThisWeek({ status: "completed", completedAt: previousWeek }, now)).toBe(false);
  });

  it("limits assigned-farm summaries to active visits scheduled this week", () => {
    const now = new Date(2026, 6, 22, 12, 0);
    const thisWeek = new Date(2026, 6, 24, 10, 0).toISOString();
    const nextWeek = new Date(2026, 6, 29, 10, 0).toISOString();

    expect(isTaskScheduledThisWeek({ status: "pending", dueDate: thisWeek }, now)).toBe(true);
    expect(isTaskScheduledThisWeek({ status: "completed", dueDate: thisWeek }, now)).toBe(false);
    expect(isTaskScheduledThisWeek({ status: "pending", dueDate: nextWeek }, now)).toBe(false);
  });
});
