import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { completeHealthScheduleTransition } from "./healthScheduleTransition.ts";

test("first Health schedule starts work refresh but reaches My Work without waiting for it", async () => {
  for (const mode of ["accept", "schedule"] as const) {
    const events: string[] = [];
    let finishRefresh!: () => void;
    const pendingRefresh = new Promise<void>((resolve) => { finishRefresh = resolve; });
    const transition = completeHealthScheduleTransition(mode, {
      invalidate: () => { events.push("invalidate"); return pendingRefresh; },
      refresh: async () => { events.push("details-refresh"); },
      navigateToMyWork: () => { events.push("my-work"); },
    });
    await Promise.resolve();
    assert.deepEqual(events, ["invalidate", "my-work"]);
    finishRefresh();
    await transition;
  }
});

test("rescheduling refreshes Health details without navigating away", async () => {
  const events: string[] = [];
  await completeHealthScheduleTransition("reschedule", {
    invalidate: async () => { events.push("invalidate"); },
    refresh: async () => { events.push("refresh"); },
    navigateToMyWork: () => { events.push("my-work"); },
  });
  assert.deepEqual(events, ["invalidate", "refresh"]);
});

test("scheduled visits keep the Record action and early-start failure uses only the inline notice", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../components/HealthRequestDetails.tsx"), "utf8");
  assert.match(source, /isScheduled \|\| isInProgress\s*\? "Record Health Assistance"/);
  const startCatch = source.match(/"The Health visit could not be started\."[\s\S]*?\}\s*finally/);
  assert.ok(startCatch);
  assert.match(startCatch[0], /setActionNotice\(message\)/);
  assert.doesNotMatch(startCatch[0], /toast\.error\(message\)/);
});
