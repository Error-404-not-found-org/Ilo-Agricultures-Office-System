import assert from "node:assert/strict";
import test from "node:test";

import {
  getCalendarActionLabel,
  getCalendarVisitDate,
  getCalendarWorkCounts,
  getCalendarWorkKind,
  getCalendarVisitTarget,
} from "./calendarPresentation.ts";

const scheduledAi = {
  id: "ai-1",
  type: "insemination",
  status: "scheduled",
  scheduledDate: "2026-09-16T00:00:00.000Z",
};

const farmVisit = {
  id: "health-1",
  type: "health",
  status: "scheduled",
  handlingMethod: "farm_visit",
  scheduledDate: "2026-09-16T00:00:00.000Z",
};

const pregnancyTask = {
  id: "canonical-pd-task",
  taskId: "canonical-pd-task",
  type: "task",
  taskType: "PD",
  status: "Pending",
  dueDate: "2026-09-16T06:59:00.000Z",
};

test("separates visits from due work without changing total work", () => {
  const counts = getCalendarWorkCounts([scheduledAi, pregnancyTask]);
  assert.deepEqual(counts, {
    totalWorkItems: 2,
    scheduledVisits: 1,
    dueWork: 1,
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
    { totalWorkItems: 0, scheduledVisits: 0, dueWork: 0 },
  );
});

test("PD remains due work and navigates with its canonical Task ID", () => {
  assert.equal(getCalendarWorkKind(pregnancyTask), "task");
  assert.equal(getCalendarActionLabel(pregnancyTask), "View task");
  assert.deepEqual(getCalendarVisitTarget(pregnancyTask), {
    pathname: "/(technician)/task-details",
    params: { id: "canonical-pd-task" },
  });
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
