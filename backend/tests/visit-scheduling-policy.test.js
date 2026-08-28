import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertVisitDaypartAvailable,
  normalizeVisitScheduleDate,
} from "../src/domain/visit-scheduling.js";

const manilaNow = (time) => new Date(`2026-08-26T${time}:00+08:00`);

const scheduleToday = (time) =>
  normalizeVisitScheduleDate("2026-08-26", { now: manilaNow(time) });

const assertAllowed = ({ time, visitPeriod, samePeriodConfirmed = false }) => {
  const now = manilaNow(time);
  assert.doesNotThrow(() =>
    assertVisitDaypartAvailable({
      scheduledDate: scheduleToday(time),
      visitPeriod,
      samePeriodConfirmed,
      now,
    }),
  );
};

const assertRejected = ({
  time,
  visitPeriod,
  code,
  status,
  samePeriodConfirmed = false,
}) => {
  const now = manilaNow(time);
  assert.throws(
    () =>
      assertVisitDaypartAvailable({
        scheduledDate: scheduleToday(time),
        visitPeriod,
        samePeriodConfirmed,
        now,
      }),
    (error) => {
      assert.equal(error.code, code);
      if (status !== undefined) assert.equal(error.status, status);
      return true;
    },
  );
};

test("Morning confirmation begins exactly at 10:00 Asia/Manila", () => {
  assertAllowed({ time: "09:59", visitPeriod: "morning" });
  assertRejected({
    time: "10:00",
    visitPeriod: "morning",
    code: "VISIT_PERIOD_CONFIRMATION_REQUIRED",
    status: 409,
  });
  assertAllowed({
    time: "10:00",
    visitPeriod: "morning",
    samePeriodConfirmed: true,
  });
  assertRejected({
    time: "11:59",
    visitPeriod: "morning",
    code: "VISIT_PERIOD_CONFIRMATION_REQUIRED",
    status: 409,
  });
  assertRejected({
    time: "12:00",
    visitPeriod: "morning",
    code: "VISIT_PERIOD_IN_PAST",
  });
});

test("Afternoon confirmation begins exactly at 15:00 Asia/Manila", () => {
  assertAllowed({ time: "12:00", visitPeriod: "afternoon" });
  assertAllowed({ time: "12:23", visitPeriod: "afternoon" });
  assertAllowed({ time: "14:59", visitPeriod: "afternoon" });
  assertRejected({
    time: "15:00",
    visitPeriod: "afternoon",
    code: "VISIT_PERIOD_CONFIRMATION_REQUIRED",
    status: 409,
  });
  assertAllowed({
    time: "15:00",
    visitPeriod: "afternoon",
    samePeriodConfirmed: true,
  });
  assertRejected({
    time: "17:59",
    visitPeriod: "afternoon",
    code: "VISIT_PERIOD_CONFIRMATION_REQUIRED",
    status: 409,
  });
  assertRejected({
    time: "18:00",
    visitPeriod: "afternoon",
    code: "VISIT_PERIOD_IN_PAST",
  });
});

test("AI and Health scheduling retain the shared policy and explicit confirmation input", () => {
  const aiController = readFileSync(
    new URL("../src/controllers/ai-request.controllers.js", import.meta.url),
    "utf8",
  );
  const healthController = readFileSync(
    new URL("../src/controllers/health-request.controllers.js", import.meta.url),
    "utf8",
  );

  for (const controller of [aiController, healthController]) {
    assert.match(controller, /assertVisitDaypartAvailable\(\{/);
    assert.match(
      controller,
      /samePeriodConfirmed:\s*req\.body\.samePeriodConfirmed === true/,
    );
  }
});
