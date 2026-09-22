import assert from "node:assert/strict";
import test from "node:test";

import {
  getCalendarActionLabel,
  getCalendarVisitDate,
  getCalendarWorkCounts,
  getCalendarWorkKind,
  getCalendarVisitTarget,
  getCalendarPresentation,
  getCalendarAccessibleActionLabel,
  isCalendarAttentionItem,
} from "./calendarPresentation.ts";

const scheduledAi = {
  id: "ai-1",
  type: "insemination",
  status: "scheduled",
  dateKind: "scheduled_visit",
  scheduledAt: "2026-09-16T00:00:00.000Z",
};

const farmVisit = {
  id: "health-1",
  type: "health",
  status: "scheduled",
  handlingMethod: "farm_visit",
  dateKind: "scheduled_visit",
  scheduledAt: "2026-09-16T00:00:00.000Z",
};

const pregnancyTask = {
  id: "canonical-pd-task",
  taskId: "canonical-pd-task",
  type: "task",
  taskType: "PD",
  status: "Pending",
  dateKind: "readiness",
  readyFrom: "2026-09-16T06:59:00.000Z",
};

test("separates visits from dated work without changing total work", () => {
  const counts = getCalendarWorkCounts([scheduledAi, pregnancyTask]);
  assert.deepEqual(counts, {
    totalWorkItems: 2,
    scheduledVisits: 1,
    datedWork: 1,
  });
});

test("scheduled AI and Health Farm Visit are visits", () => {
  assert.equal(getCalendarWorkKind(scheduledAi), "visit");
  assert.equal(getCalendarWorkKind(farmVisit), "visit");
});

test("Advice and Office Pickup are not scheduled visits", () => {
  assert.equal(
    getCalendarWorkKind({ ...farmVisit, handlingMethod: "advice" }),
    null,
  );
  assert.equal(
    getCalendarWorkKind({ ...farmVisit, handlingMethod: "office_pickup" }),
    null,
  );
  assert.deepEqual(
    getCalendarWorkCounts([
      { ...farmVisit, handlingMethod: "advice" },
      { ...farmVisit, id: "pickup", handlingMethod: "office_pickup" },
    ]),
    { totalWorkItems: 0, scheduledVisits: 0, datedWork: 0 },
  );
});

test("PD remains dated work and navigates with its canonical Task ID", () => {
  assert.equal(getCalendarWorkKind(pregnancyTask), "task");
  assert.equal(getCalendarActionLabel(pregnancyTask), "View task");
  assert.deepEqual(getCalendarVisitTarget(pregnancyTask), {
    pathname: "/(technician)/task-details",
    params: { id: "canonical-pd-task" },
  });
});

test("uses semantic timing vocabulary for Schedule work", () => {
  const now = new Date("2026-09-16T04:00:00.000Z");
  assert.deepEqual(getCalendarPresentation(pregnancyTask, now), {
    title: "Pregnancy Check",
    statusLabel: "Ready for check",
    timingLabel: null,
    dateLabel: "Ready from",
    dateKind: "readiness",
    sectionKind: "ready_follow_up",
  });
  assert.equal(
    getCalendarPresentation({ ...pregnancyTask, readyFrom: "2026-09-14T00:00:00.000Z" }, now).timingLabel,
    "Since Sep 14, 2026",
  );
  assert.equal(
    getCalendarPresentation({ ...pregnancyTask, readyFrom: "2026-09-18T00:00:00.000Z" }, now).timingLabel,
    "Check from Sep 18, 2026",
  );
});

test("Continue Tracking historical PD uses readiness semantics in Schedule", () => {
  const presentation = getCalendarPresentation({
    ...pregnancyTask,
    readyFrom: "2026-05-01T08:00:00.000Z",
    sourceType: "automatic_pd_followup",
    raw: { taskType: "PD", sourceType: "automatic_pd_followup", metadata: { workflowStage: "initial_confirmation", previousRecordEntry: true } },
  }, new Date("2026-09-21T04:00:00.000Z"));
  assert.equal(presentation.title, "Pregnancy Check");
  assert.equal(presentation.statusLabel, "Ready for check");
  assert.equal(presentation.timingLabel, "Since May 1, 2026");
  assert.doesNotMatch(`${presentation.statusLabel} ${presentation.timingLabel}`, /\b(?:due|overdue)\b/i);
});

test("expected calving and farmer reports never become overdue", () => {
  const now = new Date("2026-09-16T04:00:00.000Z");
  const calving = getCalendarPresentation({ ...pregnancyTask, taskType: "CD", dateKind: "expected_event", readyFrom: undefined, expectedAt: "2026-09-14T00:00:00.000Z" }, now);
  assert.deepEqual(calving, {
    title: "Expected Calving",
    statusLabel: "Past expected date",
    timingLabel: "Past expected date · Sep 14, 2026",
    dateLabel: "Expected calving date",
    dateKind: "expected_event",
    sectionKind: "expected_event",
  });
  const reportItem = {
    ...pregnancyTask,
    taskType: "BreedingFollowUp",
    sourceType: "farmer_pregnancy_loss_report",
    dateKind: "farmer_report",
    reportedAt: "2026-09-15T01:00:00.000Z",
  };
  const report = getCalendarPresentation(reportItem, now);
  assert.equal(report.title, "Pregnancy Loss Review");
  assert.equal(report.statusLabel, "Needs review");
  assert.equal(report.timingLabel, "Reported Sep 15, 2026");
  assert.equal(isCalendarAttentionItem(reportItem, now), true);
  assert.equal(getCalendarAccessibleActionLabel(reportItem, now), "View Pregnancy Loss Review, needs review");
  assert.equal(isCalendarAttentionItem({ ...pregnancyTask, taskType: "CD", dateKind: "expected_event", readyFrom: undefined, expectedAt: "2026-09-14T00:00:00.000Z" }, now), false);
});

test("only true past deadlines enter the overdue attention queue", () => {
  const now = new Date("2026-09-16T04:00:00.000Z");
  const deadline = { ...pregnancyTask, taskType: "BreedingFollowUp", sourceType: "automatic_breeding_followup", dateKind: "deadline", readyFrom: undefined, dueAt: "2026-09-14T00:00:00.000Z" };
  assert.equal(isCalendarAttentionItem(deadline, now), true);
  assert.equal(getCalendarAccessibleActionLabel(deadline, now), "View Breeding Follow-up, overdue");
});

test("semantic calendar dates never borrow dueDate from another meaning", () => {
  const now = new Date("2026-09-16T04:00:00.000Z");
  const malformed = getCalendarPresentation({
    ...pregnancyTask,
    readyFrom: undefined,
    dueDate: "2026-09-01T00:00:00.000Z",
  }, now);
  assert.equal(malformed.statusLabel, "Timing unavailable");
  assert.equal(malformed.timingLabel, null);
  assert.doesNotMatch(`${malformed.statusLabel}`, /due|overdue/i);
});

test("scheduled Pregnancy Check appointment takes precedence over readiness", () => {
  const presentation = getCalendarPresentation({
    ...pregnancyTask,
    dateKind: "scheduled_visit",
    readyFrom: undefined,
    scheduledAt: "2026-09-16T06:59:00.000Z",
    raw: { taskType: "PD", metadata: { visitPeriod: "afternoon" } },
  }, new Date("2026-09-15T04:00:00.000Z"));
  assert.equal(presentation.title, "Pregnancy Check");
  assert.equal(presentation.dateKind, "scheduled_visit");
  assert.equal(presentation.timingLabel, "Scheduled Sep 16, 2026 · Afternoon");
});

test("maps a UTC rollover timestamp to the Manila calendar day", () => {
  const date = getCalendarVisitDate({
    ...pregnancyTask,
    dueDate: "2026-09-15T16:30:00.000Z",
  });
  assert.equal(date?.getFullYear(), 2026);
  assert.equal(date?.getMonth(), 8);
  assert.equal(date?.getDate(), 16);
});
