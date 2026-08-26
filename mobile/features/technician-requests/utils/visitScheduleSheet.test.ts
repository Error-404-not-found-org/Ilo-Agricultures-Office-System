import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const read = (...segments: string[]) =>
  fs.readFileSync(
    path.join(currentDirectory, "..", "..", "..", ...segments),
    "utf-8",
  );

test("shared scheduling sheet keeps confirmation and errors local", async (t) => {
  const sheetCode = read(
    "features",
    "technician-requests",
    "components",
    "VisitScheduleSheet.tsx",
  );
  const aiCode = read(
    "features",
    "technician-requests",
    "components",
    "AIRequestDetails.tsx",
  );
  const healthCode = read(
    "features",
    "technician-health-request",
    "components",
    "HealthRequestDetails.tsx",
  );
  const healthModalCode = read(
    "features",
    "technician-health-request",
    "components",
    "HealthVisitScheduleModal.tsx",
  );

  await t.test("confirmation replaces the normal positive action", () => {
    assert.match(sheetCode, /\{!showCurrentPeriodWarning \? \(/);
    assert.match(
      sheetCode,
      /onPress=\{\(\) => void submitSchedule\(true\)\}[\s\S]*Schedule Anyway/,
    );
    assert.match(
      sheetCode,
      /!showCurrentPeriodWarning[\s\S]*accessibilityLabel=\{confirmLabel\}[\s\S]*submitSchedule\(false\)/,
    );
    assert.match(
      sheetCode,
      /samePeriodConfirmed \? \{ samePeriodConfirmed: true \} : \{\}/,
    );
  });

  await t.test(
    "API errors render inside the sheet and clear on interaction",
    () => {
      assert.match(sheetCode, /errorMessage\?: string \| null/);
      assert.match(
        sheetCode,
        /\{errorMessage \? \([\s\S]*accessibilityRole="alert"[\s\S]*\{errorMessage\}/,
      );
      assert.match(sheetCode, /accessibilityLiveRegion="assertive"/);
      assert.match(
        sheetCode,
        /const closeSheet = \(\) => \{[\s\S]*onErrorClear\?\.\(\)/,
      );
      assert.match(
        sheetCode,
        /const selectDate = \([\s\S]*setShowCurrentPeriodWarning\(false\);[\s\S]*onErrorClear\?\.\(\)/,
      );
      assert.match(
        sheetCode,
        /setVisitPeriod\(period\);[\s\S]*onErrorClear\?\.\(\)/,
      );
      assert.match(
        sheetCode,
        /const submitSchedule[\s\S]*onErrorClear\?\.\(\)/,
      );
    },
  );

  await t.test("AI stale conflicts stay inline and refetch authority", () => {
    const scheduleStart = aiCode.indexOf("const handleSchedule");
    const catchStart = aiCode.indexOf("} catch (error: any) {", scheduleStart);
    const catchEnd = aiCode.indexOf("} finally", catchStart);
    const catchCode = aiCode.slice(catchStart, catchEnd);

    assert.match(catchCode, /setScheduleError\(message\)/);
    assert.match(catchCode, /await invalidateWorkflow\(\)/);
    assert.match(catchCode, /await onRefresh\(\)/);
    assert.doesNotMatch(
      catchCode,
      /setScheduleVisible\(false\)|router\.replace/,
    );
    assert.match(aiCode, /errorMessage=\{scheduleError\}/);
    assert.match(
      aiCode,
      /const openSchedule[\s\S]*setScheduleError\(null\);[\s\S]*setScheduleVisible\(true\)/,
    );
    assert.match(aiCode, /onErrorClear=\{\(\) => setScheduleError\(null\)\}/);
  });

  await t.test("Health claim and schedule conflicts remain recoverable", () => {
    const claimConflictStart = healthCode.indexOf("const handleClaimConflict");
    const claimConflictEnd = healthCode.indexOf(
      "const handleSchedule",
      claimConflictStart,
    );
    const claimConflictCode = healthCode.slice(
      claimConflictStart,
      claimConflictEnd,
    );

    assert.match(claimConflictCode, /setScheduleError\(message\)/);
    assert.match(claimConflictCode, /await invalidateHealthWorkflow\(\)/);
    assert.match(claimConflictCode, /await onRefresh\(\)/);
    assert.doesNotMatch(claimConflictCode, /setScheduleVisible\(false\)/);
    assert.match(
      healthCode,
      /Request accepted, but the visit could not be scheduled[\s\S]*setScheduleError\(message\);[\s\S]*setScheduleMode\("schedule"\)/,
    );
    assert.match(healthCode, /errorMessage=\{scheduleError\}/);
    assert.match(
      healthCode,
      /const openSchedule[\s\S]*setScheduleError\(null\)/,
    );
    assert.match(healthModalCode, /errorMessage=\{errorMessage\}/);
    assert.match(
      healthCode,
      /onErrorClear=\{\(\) => setScheduleError\(null\)\}/,
    );
  });
});
