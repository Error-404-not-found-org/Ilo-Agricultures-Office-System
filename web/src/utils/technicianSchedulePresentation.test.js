import { describe, expect, it } from "vitest";
import {
  buildScheduleItems,
  formatDashboardFarmerLocation,
  formatPlannedSchedule,
  getScheduleNavigationTarget,
  getScheduleTimingState,
  getScheduleWorkLabel,
  getPhilippineDateKey,
  isFutureSchedule,
} from "./technicianSchedulePresentation";

const NOW = new Date("2026-09-02T04:00:00.000Z");

const visit = (overrides = {}) => ({
  id: "ai-1",
  type: "insemination",
  status: "scheduled",
  dateKind: "scheduled_visit",
  scheduledAt: "2026-09-03T00:00:00.000Z",
  visitPeriod: "morning",
  ...overrides,
});

const task = (overrides = {}) => ({
  id: "task-1",
  taskId: "task-1",
  type: "task",
  taskType: "PD",
  status: "Pending",
  dateKind: "readiness",
  readyFrom: "2026-09-03T00:00:00.000Z",
  ...overrides,
});

describe("technician Schedule presentation", () => {
  it("maps UTC rollover timestamps to the Manila calendar day", () => {
    expect(getPhilippineDateKey("2026-09-15T16:30:00.000Z")).toBe(
      "2026-09-16",
    );
  });
  it("uses canonical scheduledAt and visitPeriod for AI", () => {
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
    expect(item.scheduleLabel).toBe("Scheduled Health Visit");
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

  it.each([
    ["2026-09-03T00:00:00.000Z", "Upcoming", "Check from Sep 3, 2026"],
    ["2026-09-02T00:00:00.000Z", "Ready for check", null],
    ["2026-09-01T00:00:00.000Z", "Ready for check", "Since Sep 1, 2026"],
  ])("presents Pregnancy Check readiness without deadline wording", (readyFrom, statusLabel, timingLabel) => {
    const [item] = buildScheduleItems([task({ readyFrom })], NOW);
    expect(item).toMatchObject({
      dateKind: "readiness",
      scheduleLabel: "Pregnancy Check",
      statusLabel,
      timingLabel,
      dateLabel: "Ready from",
      sectionKind: "ready_follow_up",
    });
    expect(`${item.statusLabel} ${item.timingLabel || ""}`).not.toMatch(/due|overdue/i);
  });

  it("presents Continue Tracking historical PD with the same readiness semantics", () => {
    const [item] = buildScheduleItems([task({
      readyFrom: "2026-05-01T08:00:00.000Z",
      sourceType: "automatic_pd_followup",
      raw: { taskType: "PD", sourceType: "automatic_pd_followup", metadata: { workflowStage: "initial_confirmation", previousRecordEntry: true } },
    })], new Date("2026-09-21T04:00:00.000Z"));
    expect(item).toMatchObject({ scheduleLabel: "Pregnancy Check", statusLabel: "Ready for check", timingLabel: "Since May 1, 2026", dateKind: "readiness" });
    expect(`${item.statusLabel} ${item.timingLabel}`).not.toMatch(/\b(?:due|overdue)\b/i);
  });

  it("presents Expected Calving as an expected event", () => {
    const [item] = buildScheduleItems(
      [task({ taskType: "CD", dateKind: "expected_event", expectedAt: "2026-09-04T00:00:00.000Z" })],
      NOW,
    );
    expect(item).toMatchObject({
      dateKind: "expected_event",
      scheduleLabel: "Expected Calving",
      scheduleDate: "2026-09-04T00:00:00.000Z",
      statusLabel: "Expected",
      timingLabel: "Expected Sep 4, 2026",
      dateLabel: "Expected calving date",
      sectionKind: "expected_event",
    });
  });

  it("uses report semantics and authoritative report timestamps", () => {
    const items = buildScheduleItems([
      task({
        id: "heat-report",
        taskType: "BreedingFollowUp",
        sourceType: "farmer_requested_verification",
        dateKind: "farmer_report",
        reportedAt: "2026-09-02T01:00:00.000Z",
        raw: { metadata: { reportType: "return_to_heat" } },
      }),
      task({
        id: "loss-report",
        taskType: "BreedingFollowUp",
        sourceType: "farmer_pregnancy_loss_report",
        dateKind: "farmer_report",
        reportedAt: "2026-09-01T01:00:00.000Z",
      }),
    ], NOW);
    expect(items[0]).toMatchObject({ statusLabel: "Needs review", timingLabel: "Reported Sep 1, 2026", dateKind: "farmer_report" });
    expect(items[1]).toMatchObject({ statusLabel: "Needs review", timingLabel: "Reported today", dateKind: "farmer_report" });
    expect(items.map((item) => `${item.statusLabel} ${item.timingLabel}`).join(" ")).not.toMatch(/due|overdue/i);
  });

  it("keeps only automatic Breeding Follow-up as a deadline", () => {
    const [item] = buildScheduleItems([
      task({ taskType: "BreedingFollowUp", sourceType: "automatic_breeding_followup", dateKind: "deadline", dueAt: "2026-09-01T00:00:00.000Z" }),
    ], NOW);
    expect(item).toMatchObject({ dateKind: "deadline", statusLabel: "Overdue", timingLabel: "Overdue", sectionKind: "deadline" });
  });

  it("does not borrow dueDate when a canonical semantic date is missing", () => {
    const [item] = buildScheduleItems([
      task({ dateKind: "readiness", readyFrom: null, dueDate: "2026-08-01T00:00:00.000Z" }),
    ], NOW);
    expect(item).toMatchObject({
      dateKind: "readiness",
      statusLabel: "Timing unavailable",
      timingLabel: null,
      scheduleDate: null,
    });
    expect(`${item.statusLabel} ${item.timingLabel || ""}`).not.toMatch(/due|overdue/i);
  });

  it("presents scheduled visits with date and period", () => {
    const [item] = buildScheduleItems([visit()], NOW);
    expect(item).toMatchObject({ dateKind: "scheduled_visit", statusLabel: "Scheduled", timingLabel: "Scheduled Sep 3, 2026 · Morning", dateLabel: "Scheduled visit", sectionKind: "scheduled_visit" });
  });

  it("gives a Pregnancy Check appointment precedence over readiness wording", () => {
    const [item] = buildScheduleItems([
      task({ dateKind: "scheduled_visit", readyFrom: undefined, scheduledAt: "2026-09-03T00:00:00.000Z", raw: { taskType: "PD", metadata: { visitPeriod: "afternoon" } } }),
    ], NOW);
    expect(item).toMatchObject({ scheduleLabel: "Pregnancy Check", dateKind: "scheduled_visit", statusLabel: "Scheduled", timingLabel: "Scheduled Sep 3, 2026 · Afternoon" });
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
      scheduledAt: "2026-09-01T00:00:00.000Z",
      urgent: false,
    });
    const urgentFuture = visit({
      id: "health-urgent",
      type: "health",
      handlingMethod: "farm_visit",
      scheduledAt: "2026-09-04T00:00:00.000Z",
      urgent: true,
    });
    expect(getScheduleTimingState(overdue, NOW)).toBe("overdue");
    expect(getScheduleTimingState(urgentFuture, NOW)).toBe("upcoming");
  });

  it("keeps due work distinct from upcoming work", () => {
    expect(
      getScheduleTimingState(
        task({ readyFrom: "2026-09-02T01:00:00.000Z" }),
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

describe("isFutureSchedule", () => {
  // NOW is 2026-09-02T04:00:00.000Z = 12:00 PM Manila time
  const morningNow = new Date("2026-09-02T01:00:00.000Z"); // 9:00 AM Manila time
  const afternoonNow = new Date("2026-09-02T06:00:00.000Z"); // 2:00 PM Manila time

  it("identifies tomorrow or later visits as future regardless of period", () => {
    expect(isFutureSchedule("2026-09-03", "morning", morningNow)).toBe(true);
    expect(isFutureSchedule("2026-09-03", "afternoon", afternoonNow)).toBe(true);
  });

  it("identifies today morning visit as not future when it is morning", () => {
    expect(isFutureSchedule("2026-09-02", "morning", morningNow)).toBe(false);
  });

  it("identifies today afternoon visit as future when it is still morning", () => {
    expect(isFutureSchedule("2026-09-02", "afternoon", morningNow)).toBe(true);
  });

  it("identifies today afternoon visit as not future when it is afternoon", () => {
    expect(isFutureSchedule("2026-09-02", "afternoon", afternoonNow)).toBe(false);
  });

  it("identifies past dates as not future", () => {
    expect(isFutureSchedule("2026-09-01", "morning", morningNow)).toBe(false);
    expect(isFutureSchedule("2026-09-01", "afternoon", afternoonNow)).toBe(false);
  });
});

describe("canonical in-progress AI presentation parity", () => {
  it("formats planned schedule with date and period", () => {
    expect(
      formatPlannedSchedule({
        scheduledDate: "2026-09-12T00:00:00.000Z",
        visitPeriod: "afternoon",
      }),
    ).toBe("Sep 12, 2026 · Afternoon");

    expect(
      formatPlannedSchedule({
        scheduledDate: "2026-09-12T00:00:00.000Z",
        visitPeriod: "morning",
      }),
    ).toBe("Sep 12, 2026 · Morning");

    expect(
      formatPlannedSchedule({
        scheduledDate: "2026-09-12T00:00:00.000Z",
      }),
    ).toBe("Sep 12, 2026");

    expect(formatPlannedSchedule({})).toBeNull();
  });

  it("uses Artificial Insemination as scheduleLabel for canonical in-progress AI", () => {
    expect(
      getScheduleWorkLabel({
        type: "insemination",
        status: "in-progress",
      }),
    ).toBe("Artificial Insemination");

    expect(
      getScheduleWorkLabel({
        type: "insemination",
        status: "scheduled",
      }),
    ).toBe("Scheduled AI Visit");
  });

  it("treats canonical in-progress AI as due regardless of future scheduledDate", () => {
    const futureDate = "2026-09-05T00:00:00.000Z";
    const item = {
      type: "insemination",
      status: "in-progress",
      scheduledDate: futureDate,
    };
    expect(getScheduleTimingState(item, NOW)).toBe("due");
  });
});

describe("formatDashboardFarmerLocation for Today's Work", () => {
  it("extracts barangay and municipality from farmer.address over farmLocationLabel", () => {
    const item = {
      farmLocationLabel: "PHF6+GGQ, Doña Luz, Jaro, Iloilo City, Philippines",
      location: "Bita Sur, Oton",
      raw: {
        farmerId: {
          name: "Mario Cabanig",
          address: {
            barangay: "Bita Sur",
            municipality: "Oton",
            province: "Iloilo",
          },
          farmLocation: {
            detectedAddress: "PHF6+GGQ, Doña Luz, Jaro, Iloilo City, Philippines",
          },
        },
      },
    };

    expect(formatDashboardFarmerLocation(item)).toBe("Bita Sur, Oton");
  });

  it("extracts barangay and city when city is used instead of municipality", () => {
    const item = {
      raw: {
        farmerId: {
          address: {
            barangay: "Balabago",
            city: "Jaro",
          },
        },
      },
    };

    expect(formatDashboardFarmerLocation(item)).toBe("Balabago, Jaro");
  });

  it("uses human-readable address fallback when farmer.address is string", () => {
    const item = {
      location: "Bita Sur, Oton",
    };

    expect(formatDashboardFarmerLocation(item)).toBe("Bita Sur, Oton");
  });

  it("rejects plus codes and coordinates, falling back to Location not provided", () => {
    const itemWithPlusCode = {
      farmLocationLabel: "PHF6+GGQ, Doña Luz, Jaro, Iloilo City, Philippines",
      location: "PHF6+GGQ, Doña Luz, Jaro",
    };

    expect(formatDashboardFarmerLocation(itemWithPlusCode)).toBe(
      "Location not provided",
    );

    const itemWithCoords = {
      location: "10.7202, 122.5621",
    };

    expect(formatDashboardFarmerLocation(itemWithCoords)).toBe(
      "Location not provided",
    );
  });

  it("returns Location not provided when address is completely empty or missing", () => {
    expect(formatDashboardFarmerLocation({})).toBe("Location not provided");
    expect(formatDashboardFarmerLocation(null)).toBe("Location not provided");
    expect(
      formatDashboardFarmerLocation({
        location: "Unknown Location",
      }),
    ).toBe("Location not provided");
  });
});
