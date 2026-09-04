import { describe, expect, it } from "vitest";
import {
  buildScheduleItems,
  getScheduleNavigationTarget,
  getScheduleTimingState,
} from "./technicianSchedulePresentation";

const NOW = new Date("2026-09-02T04:00:00.000Z");

const visit = (overrides = {}) => ({
  id: "ai-1",
  type: "insemination",
  status: "scheduled",
  scheduledDate: "2026-09-03T00:00:00.000Z",
  visitPeriod: "morning",
  ...overrides,
});

const task = (overrides = {}) => ({
  id: "task-1",
  taskId: "task-1",
  type: "task",
  taskType: "PD",
  status: "Pending",
  dueDate: "2026-09-03T00:00:00.000Z",
  ...overrides,
});

describe("technician Schedule presentation", () => {
  it("uses scheduledDate and visitPeriod for AI without legacy exact time", () => {
    const [item] = buildScheduleItems(
      [visit({ time: "10:30 AM", preferredDate: "2026-10-10" })],
      NOW,
    );
    expect(item.scheduleDate).toBe("2026-09-03T00:00:00.000Z");
    expect(item.periodLabel).toBe("Morning");
    expect(item).not.toHaveProperty("displayTime");
    expect(item.scheduleLabel).toBe("Scheduled AI Visit");
  });

  it("uses scheduledDate and visitPeriod for Health Farm Visits", () => {
    const [item] = buildScheduleItems(
      [
        visit({
          id: "health-1",
          type: "health",
          handlingMethod: "farm_visit",
          visitPeriod: "afternoon",
        }),
      ],
      NOW,
    );
    expect(item.scheduleLabel).toBe("Scheduled Health Farm Visit");
    expect(item.periodLabel).toBe("Afternoon");
  });

  it.each(["advice", "office_pickup"])(
    "excludes Health %s responses from Schedule",
    (handlingMethod) => {
      expect(
        buildScheduleItems(
          [visit({ type: "health", handlingMethod })],
          NOW,
        ),
      ).toEqual([]);
    },
  );

  it("uses dueDate and due wording for Pregnancy work", () => {
    const [item] = buildScheduleItems(
      [task({ displayDate: "2026-10-10", time: "2:15 PM" })],
      NOW,
    );
    expect(item.scheduleDate).toBe("2026-09-03T00:00:00.000Z");
    expect(item.scheduleLabel).toBe("Pregnancy Check Due");
    expect(item.periodLabel).toBeNull();
  });

  it("uses dueDate and due wording for Calving work", () => {
    const [item] = buildScheduleItems(
      [task({ taskType: "CD", dueDate: "2026-09-04T00:00:00.000Z" })],
      NOW,
    );
    expect(item.scheduleLabel).toBe("Calving Due");
    expect(item.scheduleDate).toBe("2026-09-04T00:00:00.000Z");
  });

  it.each([
    [visit(), "request", "/technician/requests", "requestId=ai-1"],
    [
      visit({ id: "health-1", type: "health", handlingMethod: "farm_visit" }),
      "request",
      "/technician/requests",
      "requestId=health-1",
    ],
    [task(), "task", "/technician/requests", "taskId=task-1"],
    [
      task({ taskType: "CD", id: "calving-task", taskId: "calving-task" }),
      "task",
      "/technician/requests",
      "taskId=calving-task",
    ],
    [
      task({ taskType: "GeneralVisit", id: "general-task", taskId: "general-task" }),
      "task",
      "/technician/requests",
      "taskId=general-task",
    ],
  ])("routes %o to its canonical %s detail surface", (item, kind, path, search) => {
    const target = getScheduleNavigationTarget(item);
    expect(target.kind).toBe(kind);
    expect(target.path).toBe(path);
    expect(target.search).toContain("section=myWork");
    expect(target.search).toContain(search);
  });

  it.each([
    [task({ taskId: "pd-future", taskType: "PD" }), "task", "previewTaskId=pd-future"],
    [task({ taskId: "calving-future", taskType: "CD" }), "task", "previewTaskId=calving-future"],
    [visit({ id: "ai-future" }), "request", "previewRequestId=ai-future"],
    [visit({ id: "health-future", type: "health", handlingMethod: "farm_visit" }), "request", "previewRequestId=health-future"],
  ])("routes upcoming %o to read-only Schedule preview", (item, kind, search) => {
    const target = getScheduleNavigationTarget(item, "upcoming");
    expect(target.kind).toBe(kind);
    expect(target.path).toBe("/technician/schedule");
    expect(target.action).toBe("preview");
    expect(target.isUpcoming).toBe(true);
    expect(target.search).toContain(search);
  });

  it("keeps overdue timing separate from urgent Health", () => {
    const overdue = visit({
      id: "health-overdue",
      type: "health",
      handlingMethod: "farm_visit",
      scheduledDate: "2026-09-01T00:00:00.000Z",
      urgent: false,
    });
    const urgentFuture = visit({
      id: "health-urgent",
      type: "health",
      handlingMethod: "farm_visit",
      scheduledDate: "2026-09-04T00:00:00.000Z",
      urgent: true,
    });
    expect(getScheduleTimingState(overdue, NOW)).toBe("overdue");
    expect(getScheduleTimingState(urgentFuture, NOW)).toBe("upcoming");
  });

  it("keeps due work distinct from upcoming work", () => {
    expect(
      getScheduleTimingState(
        task({ dueDate: "2026-09-02T01:00:00.000Z" }),
        NOW,
      ),
    ).toBe("due");
    expect(getScheduleTimingState(task(), NOW)).toBe("upcoming");
  });

  it("keeps completed work out of the active Schedule", () => {
    expect(
      buildScheduleItems(
        [
          visit({ status: "done" }),
          task({ id: "completed-task", status: "Completed" }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("suppresses duplicate AI/Health execution Tasks", () => {
    const request = visit({ id: "ai-1" });
    const duplicateTask = task({
      id: "ai-task",
      taskId: "ai-task",
      taskType: "AI",
      raw: { metadata: { inseminationId: "ai-1" } },
    });
    expect(buildScheduleItems([request, duplicateTask], NOW)).toHaveLength(1);
  });

  it("keeps the authoritative Health Farm Visit when its mirrored execution Task is present", () => {
    const request = visit({
      id: "health-request-1",
      type: "health",
      handlingMethod: "farm_visit",
      title: "Scheduled Health Farm Visit",
    });
    const mirroredTask = task({
      id: "health-task-1",
      taskId: "health-task-1",
      taskType: "Health",
      title: "Unrelated presentation text",
      raw: { metadata: { healthRequestId: "health-request-1" } },
    });

    const items = buildScheduleItems([mirroredTask, request], NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "health-request-1",
      scheduleKind: "health",
      handlingMethod: "farm_visit",
    });
  });

  it("does not revive resolved Health mirror work or schedule Advice and Office Pickup", () => {
    expect(
      buildScheduleItems(
        [
          visit({ id: "resolved-health", type: "health", status: "resolved", handlingMethod: "farm_visit" }),
          task({
            id: "resolved-health-task",
            taskType: "Health",
            status: "Completed",
            raw: { metadata: { healthRequestId: "resolved-health" } },
          }),
          visit({ id: "advice", type: "health", handlingMethod: "advice" }),
          visit({ id: "pickup", type: "health", handlingMethod: "office_pickup" }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });
});
