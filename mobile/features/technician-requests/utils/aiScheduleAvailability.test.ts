import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getAIVisitWorkTiming } from "./aiVisitWorkTiming.ts";

test("AI start authorization uses the Asia/Manila calendar date", () => {
  const morning = new Date("2026-09-18T08:00:00+08:00");

  assert.equal(getAIVisitWorkTiming("2026-09-19", morning), "upcoming");
  assert.equal(getAIVisitWorkTiming("2026-09-18", morning), "actionable");
  assert.equal(
    getAIVisitWorkTiming("2026-09-18T12:00:00+08:00", morning),
    "actionable",
  );
  assert.equal(getAIVisitWorkTiming("2026-09-17", morning), "overdue");
});

test("AI start authorization respects a Manila date boundary", () => {
  const shortlyAfterMidnight = new Date("2026-09-18T00:05:00+08:00");
  assert.equal(
    getAIVisitWorkTiming("2026-09-18T00:00:00+08:00", shortlyAfterMidnight),
    "actionable",
  );
});

test("Mobile AI details has no early-start retry and keeps future work non-mutating", () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(
    path.join(directory, "..", "components", "AIRequestDetails.tsx"),
    "utf8",
  );

  assert.doesNotMatch(source, /earlyStartConfirmed|Start service early\?|Start Early/);
  assert.match(source, /getAIVisitWorkTiming/);
  assert.match(source, /isUpcomingSchedule[\s\S]*\? ""/);
  assert.match(source, /accessibilityLabel="Reschedule"/);
});
