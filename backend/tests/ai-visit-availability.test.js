import assert from "node:assert/strict";
import test from "node:test";

import { getAIVisitAvailability } from "../src/domain/ai-visit-availability.js";

test("AI visit availability blocks later Manila calendar dates", () => {
  const now = new Date("2026-09-18T08:00:00+08:00");
  const availability = getAIVisitAvailability({
    scheduledDate: new Date("2026-09-19T12:00:00+08:00"),
    now,
  });

  assert.deepEqual(availability, {
    workTiming: "upcoming",
    allowedAction: "VIEW_DETAILS",
    actionLabel: "View Scheduled Visit",
  });
});

test("AI visit availability allows the same Manila date regardless of clock time", () => {
  const morningNow = new Date("2026-09-18T08:00:00+08:00");
  const afternoonNow = new Date("2026-09-18T16:00:00+08:00");
  const storedSchedule = new Date("2026-09-18T12:00:00+08:00");

  assert.deepEqual(
    getAIVisitAvailability({ scheduledDate: storedSchedule, now: morningNow }),
    {
      workTiming: "actionable",
      allowedAction: "RECORD_SERVICE",
      actionLabel: "Record Insemination",
    },
  );
  assert.deepEqual(
    getAIVisitAvailability({ scheduledDate: storedSchedule, now: afternoonNow }),
    {
      workTiming: "actionable",
      allowedAction: "RECORD_SERVICE",
      actionLabel: "Record Insemination",
    },
  );
});

test("AI visit availability keeps past Manila dates actionable as overdue", () => {
  const availability = getAIVisitAvailability({
    scheduledDate: new Date("2026-09-17T12:00:00+08:00"),
    now: new Date("2026-09-18T08:00:00+08:00"),
  });

  assert.deepEqual(availability, {
    workTiming: "overdue",
    allowedAction: "RECORD_SERVICE",
    actionLabel: "Record Completed Service",
  });
});

test("AI visit availability follows Manila dates across the UTC boundary", () => {
  const availability = getAIVisitAvailability({
    scheduledDate: new Date("2026-09-19T04:00:00.000Z"),
    now: new Date("2026-09-18T16:30:00.000Z"),
  });

  assert.equal(availability.workTiming, "actionable");
});

test("AI visit availability returns null for a missing or invalid schedule", () => {
  assert.equal(getAIVisitAvailability({ scheduledDate: null }), null);
  assert.equal(
    getAIVisitAvailability({ scheduledDate: "not-a-date" }),
    null,
  );
});
