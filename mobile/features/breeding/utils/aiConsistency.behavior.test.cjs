const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "../../..");
const source = (...parts) =>
  fs.readFileSync(path.join(mobileRoot, ...parts), "utf8");

test("Farmer AI details uses the canonical detail key and focus refresh", () => {
  const detail = source("app", "(farmer)", "ai-request-detail.tsx");
  assert.match(detail, /queryKey:\s*aiRequestKeys\.detail/);
  assert.match(detail, /useFocusEffect/);
  assert.match(detail, /refetchType:\s*"active"/);
});

test("foreground and opened notifications refresh linked request queries", () => {
  const layout = source("app", "_layout.tsx");
  assert.match(layout, /addNotificationReceivedListener/);
  assert.match(layout, /invalidateNotificationLinkedQueries/);
});

test("Record AI receives truthful fallback and merged canonical context", () => {
  const details = source(
    "features",
    "technician-requests",
    "components",
    "AIRequestDetails.tsx",
  );
  assert.match(details, /mergeRecordAIRequestSnapshot/);
  assert.match(details, /farmerName/);
  assert.match(details, /animalName/);
  assert.match(details, /earTag/);
  const context = source(
    "features",
    "technician-ai-recording",
    "hooks",
    "useRecordAIContext.ts",
  );
  assert.match(context, /requestKind/);
});

test("deep-linked observation screen and active entry points enforce readiness", () => {
  const form = source(
    "features",
    "breeding",
    "screens",
    "BreedingObservationScreen.tsx",
  );
  const animal = source(
    "features",
    "animals",
    "screens",
    "RoleAwareAnimalDetailsScreen.tsx",
  );
  const tracker = source(
    "features",
    "breeding",
    "screens",
    "PregnancyTrackerScreen.tsx",
  );
  for (const code of [form, animal, tracker]) {
    assert.match(code, /getFarmerBreedingObservationReadiness/);
  }
  assert.match(form, /if \(!observationReadiness\.isAvailable\)/);
});

test("review completion invalidates the Today work-queue key", () => {
  const verification = source(
    "app",
    "(technician)",
    "pregnancy-verification.tsx",
  );
  assert.match(verification, /technicianKeys\.workQueue\(\)/);
  assert.match(verification, /await Promise\.all/);
});
