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

test("deep-linked observation screen and Animal Details enforce readiness", () => {
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
  for (const code of [form, animal]) {
    assert.match(code, /getFarmerBreedingObservationReadiness/);
  }
  assert.match(form, /!observationReadiness\.isAvailable/);
  assert.match(animal, /observationReadiness\.isAvailable/);
});

test("review completion invalidates the Today work-queue key", () => {
  const verification = source(
    "app",
    "(technician)",
    "pregnancy-verification.tsx",
  );
  assert.match(verification, /technicianKeys\.workQueue\(\)/);
  assert.match(verification, /queryClient\.invalidateQueries/);
});


test("canonical Mobile PD eligibility predicate is exported and shared across screens", () => {
  const lib = source("lib", "reproductionEligibility.ts");
  assert.match(lib, /export function isEligibleInseminationForPD/);
  assert.match(lib, /export function hasEligibleBreedingAttemptForPD/);

  const pdScreen = source("app", "(technician)", "pregnancy-check.tsx");
  assert.match(
    pdScreen,
    /import[\s\S]*?isEligibleInseminationForPD[\s\S]*?from[\s\S]*?reproductionEligibility/,
  );
  assert.match(pdScreen, /inseminations\.filter\(isEligibleInseminationForPD\)/);
  assert.match(pdScreen, /sortedInsemList\.find\(isEligibleInseminationForPD\)/);

  const animalScreen = source(
    "features",
    "animals",
    "screens",
    "RoleAwareAnimalDetailsScreen.tsx",
  );
  assert.match(
    animalScreen,
    /import[\s\S]*?hasEligibleBreedingAttemptForPD[\s\S]*?from[\s\S]*?reproductionEligibility/,
  );
  assert.match(animalScreen, /hasEligibleBreedingAttemptForPD\(animal\)/);
});


test("task-details implements focus refetch and canonical post-calving pregnancy status precedence", () => {
  const taskDetails = source("app", "(technician)", "task-details.tsx");
  assert.match(taskDetails, /useFocusEffect/);
  assert.match(taskDetails, /calvingPregnancyStatus/);
  assert.match(taskDetails, /cycleStatus === "lost"/);
  assert.match(taskDetails, /cycleStatus === "completed"/);
  assert.match(taskDetails, /reproductiveStatus === "Post-partum"/);
  assert.match(taskDetails, /task\?\.status === "Completed"/);
});

test("PregnancyTrackerScreen routes historical attempts to canonical record detail routes", () => {
  const tracker = source(
    "features",
    "breeding",
    "screens",
    "PregnancyTrackerScreen.tsx",
  );
  assert.match(tracker, /\(farmer\)\/animal-record-detail/);
  assert.doesNotMatch(tracker, /\(farmer\)\/record-details/);
});
