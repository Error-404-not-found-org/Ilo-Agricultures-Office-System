import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const readRelative = (value: string) => {
  const pathname = decodeURIComponent(new URL(value, import.meta.url).pathname);
  const platformPath = process.platform === "win32" ? pathname.slice(1) : pathname;
  return readFileSync(platformPath, "utf8");
};
describe("Previous AI runtime UX wiring", () => {
  it("uses the shared direct-AI terminology without changing mutation wiring", () => {
    const screen = readRelative("../screens/RecordAIScreen.tsx");

    assert.match(screen, /Record AI Now/);
    assert.match(screen, /Add Past Record/);
    assert.doesNotMatch(screen, /Current AI Service/);
    assert.doesNotMatch(screen, /Previous AI Record/);
    assert.match(screen, /useWalkInInseminationMutation/);
    assert.match(screen, /usePreviousInseminationMutation/);
    assert.match(screen, /useCompleteAIRequestMutation/);
    assert.match(screen, /previousMutation\.mutateAsync/);
    assert.match(screen, /walkInMutation\.mutateAsync/);
    assert.match(screen, /requestMutation\.mutateAsync/);
  });

  it("keeps domain errors inline without sending raw diagnostics to console.error", () => {
    const screen = readRelative("../screens/RecordAIScreen.tsx");
    const form = readRelative("../components/DirectAIRecordForm.tsx");

    assert.doesNotMatch(
      screen,
      /console\.error\(\s*["']\[AI_COMPLETION_PATCH_ERROR\]/,
    );
    assert.match(
      screen,
      /console\.debug\(\s*["']\[AI_COMPLETION_PATCH_ERROR\]/,
    );
    assert.match(
      screen,
      /setPreviousRecordError\(getPreviousAIErrorMessage\(error\)\)/,
    );
    assert.match(form, /isHistoricalMode && submissionError/);
    assert.match(form, /accessibilityRole="alert"/);
  });

  it("uses RoleAwareAnimalDetailsScreen for active animal-detail routes", () => {
    const farmerRoute = readRelative(
      "../../../app/(farmer)/animal-details.tsx",
    );
    const technicianRoute = readRelative(
      "../../../app/(technician)/animal-details.tsx",
    );
    const activeScreen = readRelative(
      "../../animals/screens/RoleAwareAnimalDetailsScreen.tsx",
    );

    assert.match(farmerRoute, /RoleAwareAnimalDetailsScreen/);
    assert.match(technicianRoute, /RoleAwareAnimalDetailsScreen/);
    assert.match(activeScreen, /isHistoryOnlyInsemination/);
    assert.match(activeScreen, /Historical AI:/);
    assert.match(activeScreen, /History only/);
  });
});
