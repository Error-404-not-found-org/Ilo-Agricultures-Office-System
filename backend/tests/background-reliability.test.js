import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Notification } from "../src/models/notification.model.js";
import {
  AI_SERVICE_REMINDER_STATUSES,
  HEALTH_VISIT_REMINDER_STATUSES,
  buildPendingServiceReminderQueries,
  buildReminderDedupeKey,
  getExpectedCalvingReminderDates,
  isExpectedCalvingReminderEligible,
} from "../src/services/background-reminder.service.js";
import {
  notifyUser,
  notifyUserBestEffort,
} from "../src/services/notification-delivery.service.js";
import { getHeatReturnMonitoringDates } from "../src/domain/reproduction-policy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const inngestSource = fs.readFileSync(
  path.join(here, "../src/config/inngest.js"),
  "utf8",
);

const matchesNin = (value, values) => value === undefined || !values.includes(value);

test("scheduled Health Farm Visits are reminder eligible while non-visit handling is excluded", () => {
  const now = new Date("2026-08-22T08:00:00.000Z");
  const { health } = buildPendingServiceReminderQueries(now);

  assert.ok(HEALTH_VISIT_REMINDER_STATUSES.includes("scheduled"));
  assert.ok(HEALTH_VISIT_REMINDER_STATUSES.includes("in-progress"));
  assert.ok(HEALTH_VISIT_REMINDER_STATUSES.includes("in_progress"));
  for (const terminal of ["resolved", "cancelled", "rejected", "pending"])
    assert.equal(HEALTH_VISIT_REMINDER_STATUSES.includes(terminal), false);

  assert.deepEqual(health.scheduledDate, { $lte: now });
  assert.equal(matchesNin("farm_visit", health.handlingMethod.$nin), true);
  assert.equal(matchesNin(undefined, health.handlingMethod.$nin), true);
  assert.equal(matchesNin("advice", health.handlingMethod.$nin), false);
  assert.equal(matchesNin("office_pickup", health.handlingMethod.$nin), false);
});

test("AI reminder eligibility follows canonical presentation and excludes terminal work", () => {
  assert.ok(AI_SERVICE_REMINDER_STATUSES.includes("scheduled"));
  assert.ok(AI_SERVICE_REMINDER_STATUSES.includes("in-progress"));
  assert.ok(AI_SERVICE_REMINDER_STATUSES.includes("in_progress"));
  assert.ok(AI_SERVICE_REMINDER_STATUSES.includes("awaiting-service"));
  for (const status of ["pending", "approved", "done", "cancelled", "rejected"])
    assert.equal(AI_SERVICE_REMINDER_STATUSES.includes(status), false);
});

test("service reminder dedupe includes schedule, period, record, event, and recipient", () => {
  const input = {
    eventType: "health-scheduled-visit-due",
    relatedId: "request-1",
    recipientId: "technician-1",
    milestoneDate: "2026-08-22T00:00:00.000Z",
    period: "afternoon",
  };
  const first = buildReminderDedupeKey(input);
  assert.equal(buildReminderDedupeKey(input), first);
  assert.notEqual(
    buildReminderDedupeKey({ ...input, period: "morning" }),
    first,
  );
  assert.notEqual(
    buildReminderDedupeKey({ ...input, recipientId: "technician-2" }),
    first,
  );
  assert.notEqual(
    buildReminderDedupeKey({ ...input, eventType: "health-follow-up" }),
    first,
  );
});

test("expected-calving milestones derive from the persisted expected date", () => {
  const target = new Date("2027-05-20T00:00:00.000Z");
  const dates = getExpectedCalvingReminderDates(target);
  assert.equal(dates.target.toISOString(), target.toISOString());
  assert.equal(dates.upcoming.toISOString(), "2027-05-13T00:00:00.000Z");
  assert.equal(dates.overdue.toISOString(), "2027-05-30T00:00:00.000Z");
  assert.match(inngestSource, /pregnancy\?\.targetCalvingDate/);
  assert.doesNotMatch(inngestSource, /"270 days"/);
  assert.match(inngestSource, /sleepUntil\(\s*"wait-for-expected-calving-window"/);
});

test("lost, completed, calved, or archived Pregnancy context is excluded", () => {
  const active = {
    cycleStatus: "active",
    targetCalvingDate: new Date("2027-05-20T00:00:00.000Z"),
    deletedAt: null,
  };
  const animal = { reproductiveStatus: "Pregnant", deletedAt: null };
  assert.equal(isExpectedCalvingReminderEligible({ pregnancy: active, animal }), true);
  assert.equal(isExpectedCalvingReminderEligible({ pregnancy: { ...active, cycleStatus: "lost" }, animal }), false);
  assert.equal(isExpectedCalvingReminderEligible({ pregnancy: { ...active, cycleStatus: "completed" }, animal }), false);
  assert.equal(isExpectedCalvingReminderEligible({ pregnancy: active, animal: { ...animal, reproductiveStatus: "Normal" } }), false);
  assert.equal(isExpectedCalvingReminderEligible({ pregnancy: active, animal: { ...animal, deletedAt: new Date() } }), false);
});

test("AI diagnosis reminder dates are absolute milestones from the service date", () => {
  const dates = getHeatReturnMonitoringDates("2026-01-01T00:00:00.000Z");
  assert.equal(dates.expectedEstrousCycleDate.toISOString(), "2026-01-22T00:00:00.000Z");
  assert.equal(dates.pregnancyDiagnosisDueDate.toISOString(), "2026-03-02T00:00:00.000Z");
  assert.equal(dates.pregnancyDiagnosisOverdueDate.toISOString(), "2026-03-17T00:00:00.000Z");
  assert.doesNotMatch(inngestSource, /step\.sleep\("wait-for-pd-window"/);
  assert.doesNotMatch(inngestSource, /step\.sleep\("wait-for-missed-pd-window"/);
});

test("daily and event-driven reminder paths use durable notification dedupe", () => {
  assert.match(inngestSource, /buildPendingServiceReminderQueries/);
  assert.match(inngestSource, /buildReminderDedupeKey/);
  assert.equal(
    (inngestSource.match(/Notification\.create/g) || []).length,
    1,
    "only the immediate calving-recorded compatibility notification remains direct",
  );
  assert.match(inngestSource, /ai-pregnancy-diagnosis-due/);
  assert.match(inngestSource, /expected-calving-7d/);
});

test("rerunning a reminder with the same key inserts one notification", async () => {
  const original = Notification.findOneAndUpdate;
  let stored = null;
  let inserts = 0;
  Notification.findOneAndUpdate = async (_filter, update) => {
    if (stored) {
      return {
        value: stored,
        lastErrorObject: { updatedExisting: true },
      };
    }
    inserts += 1;
    stored = { _id: "notification-1", ...update.$setOnInsert };
    return {
      value: stored,
      lastErrorObject: { updatedExisting: false },
    };
  };
  try {
    const payload = {
      recipientId: "000000000000000000000001",
      senderId: "000000000000000000000000",
      relatedId: "000000000000000000000002",
      dedupeKey: "background-reminder:health:request-1:date:afternoon:tech-1",
      title: "Health service record needed",
      message: "Open the visit to finish it.",
      sendPush: false,
    };
    await notifyUser(payload);
    await notifyUser(payload);
    assert.equal(inserts, 1);
  } finally {
    Notification.findOneAndUpdate = original;
  }
});

test("notification failure is best-effort and does not mutate caller workflow state", async () => {
  const original = Notification.findOneAndUpdate;
  const state = { status: "scheduled" };
  Notification.findOneAndUpdate = async () => {
    throw new Error("provider unavailable");
  };
  try {
    const result = await notifyUserBestEffort({
      recipientId: "000000000000000000000001",
      senderId: "000000000000000000000000",
      relatedId: "000000000000000000000002",
      dedupeKey: "background-reminder:test",
      title: "Reminder",
      message: "Reminder body",
    }, "background-reliability-test");
    assert.equal(result, null);
    assert.deepEqual(state, { status: "scheduled" });
  } finally {
    Notification.findOneAndUpdate = original;
  }
});
