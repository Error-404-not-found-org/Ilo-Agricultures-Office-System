import assert from "node:assert/strict";
import test from "node:test";

import { getHealthVisitAvailability } from "../src/domain/health-visit-availability.js";

test("Health farm-visit availability uses Asia/Manila calendar dates", async (t) => {
  const now = new Date("2026-09-16T00:30:00.000Z"); // Sep 16, 8:30 AM Manila

  await t.test("future visit is read-only upcoming work", () => {
    assert.deepEqual(
      getHealthVisitAvailability({
        scheduledDate: "2026-09-17",
        now,
      }),
      {
        workTiming: "upcoming",
        allowedAction: "VIEW_DETAILS",
        actionLabel: "View Scheduled Visit",
      },
    );
  });

  await t.test("today is actionable regardless of visit period clock", () => {
    for (const visitPeriod of ["morning", "afternoon"]) {
      assert.deepEqual(
        getHealthVisitAvailability({
          scheduledDate: "2026-09-16",
          visitPeriod,
          now,
        }),
        {
          workTiming: "actionable",
          allowedAction: "START_SERVICE",
          actionLabel: "Start Visit",
        },
      );
    }
  });

  await t.test("unfinished past visit remains actionable and overdue", () => {
    assert.deepEqual(
      getHealthVisitAvailability({
        scheduledDate: "2026-09-15",
        now,
      }),
      {
        workTiming: "overdue",
        allowedAction: "START_SERVICE",
        actionLabel: "Start Visit",
      },
    );
  });
});
