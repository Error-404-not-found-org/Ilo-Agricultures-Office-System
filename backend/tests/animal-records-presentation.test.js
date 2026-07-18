import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith("farmerDashboard.transforms")) {
      return {
        url: pathToFileURL(
          path.join(
            root,
            "mobile/features/farmer-dashboard/utils/farmerDashboard.transforms.ts",
          ),
        ).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const {
  ANIMAL_RECORD_CATEGORY_OPTIONS,
  formatAnimalRecord,
} = await import(
  "../../mobile/features/animal-records/utils/recordPresentation.ts"
);
const source = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const animal = {
  _id: "animal-1",
  earTag: "SEED-repro-manual-20260717-RC26-260717-05-AI-DAY21",
  breed: "Angus",
  species: "Cattle",
  sex: "Female",
  reproductiveStatus: "Inseminated",
};

test("Farmer and Technician Animal Details share Records categories", () => {
  assert.deepEqual(
    ANIMAL_RECORD_CATEGORY_OPTIONS.map((option) => option.label),
    ["All", "Reproduction", "Health", "Calving"],
  );

  const farmer = source("mobile/features/animals/screens/AnimalDetailsScreen.tsx");
  const technician = source("mobile/app/(technician)/animal-details.tsx");
  assert.match(farmer, /ANIMAL_RECORD_CATEGORY_OPTIONS/);
  assert.match(technician, /ANIMAL_RECORD_CATEGORY_OPTIONS/);
  assert.match(technician, />\s*Records\s*</);
  assert.doesNotMatch(technician, />\s*Medical\s*</);
  assert.match(technician, /useAnimalRecords/);
  assert.doesNotMatch(technician, /useAnimalHealthHistory/);

  const backend = source("backend/src/controllers/animal-workflow.controllers.js");
  assert.match(backend, /normalized === "reproduction"/);
  assert.match(backend, /recordKind === "insemination" \|\| recordKind === "pregnancy"/);
});

test("AI records separate service completion from breeding outcome and expose attempt linkage", () => {
  const pending = formatAnimalRecord(
    { recordKind: "insemination", attemptNumber: 1, status: "done" },
    animal,
  );
  assert.equal(pending.title, "AI attempt 1 · RC26-05");
  assert.deepEqual(
    pending.badges.map((badge) => badge.label),
    ["AI service completed", "Outcome awaiting confirmation"],
  );

  const failed = formatAnimalRecord(
    {
      recordKind: "insemination",
      attemptNumber: 1,
      status: "done",
      isSuccess: false,
      outcome: "Failed (Re-heat)",
      failureReason: "return_to_heat",
      nextAttemptReference: 2,
    },
    animal,
  );
  assert.ok(failed.badges.some((badge) => badge.label === "Attempt unsuccessful"));
  assert.ok(failed.details.includes("Outcome: Unsuccessful"));
  assert.ok(failed.details.includes("Return To Heat"));
  assert.ok(failed.details.includes("Followed by attempt 2"));

  const second = formatAnimalRecord(
    {
      recordKind: "insemination",
      attemptNumber: 2,
      status: "done",
      previousAttemptReference: 1,
    },
    animal,
  );
  assert.ok(second.details.includes("Previous attempt: 1"));
});

test("pregnancy records format method, stage, continuation state, technician, and related attempt", () => {
  const pregnancy = formatAnimalRecord(
    {
      recordKind: "pregnancy",
      pregnancyDiagnosis: { result: "Pregnant", date: "2026-07-17" },
      confirmation: {
        methodCode: "ultrasound",
        stage: "early",
        confirmedBy: { name: "Tech Ana" },
      },
      recheckStatus: "pending",
      inseminationId: { attemptNumber: 1 },
    },
    animal,
  );
  assert.equal(pregnancy.pageTitle, "Pregnancy Diagnosis");
  assert.ok(pregnancy.details.includes("Method: Ultrasound"));
  assert.ok(pregnancy.details.includes("Stage: Early confirmation"));
  assert.ok(pregnancy.details.includes("Related AI attempt: 1"));
  assert.ok(pregnancy.details.includes("Technician: Tech Ana"));
  assert.ok(pregnancy.badges.some((badge) => badge.label === "Continuation recheck due"));

  const continuing = formatAnimalRecord(
    { recordKind: "pregnancy", pregnancyDiagnosis: { result: "Pregnant" }, recheckStatus: "continuing" },
    animal,
  );
  assert.ok(continuing.badges.some((badge) => badge.label === "Pregnancy continuing"));
});

test("farmer observation presentation never claims an official pregnancy", () => {
  const observation = formatAnimalRecord(
    { recordKind: "farmer_observation", notes: "No return to heat observed" },
    animal,
  );
  assert.equal(observation.pageTitle, "Farmer Observation");
  assert.deepEqual(observation.badges.map((badge) => badge.label), [
    "Observation awaiting technician review",
  ]);
  assert.doesNotMatch(`${observation.title} ${observation.badges[0].label}`, /pregnancy confirmed/i);
});

test("calving cards format living, stillbirth, mixed, and offspring references", () => {
  const living = formatAnimalRecord(
    { recordKind: "calving", outcome: "live_birth", livingCalfCount: 1 },
    animal,
  );
  assert.equal(living.details[0], "1 living calf");

  const stillbirth = formatAnimalRecord(
    { recordKind: "calving", outcome: "stillbirth", stillbornCount: 1 },
    animal,
  );
  assert.match(stillbirth.title, /Calving outcome recorded/);
  assert.equal(stillbirth.details[0], "Stillbirth");

  const mixed = formatAnimalRecord(
    {
      recordKind: "calving",
      outcome: "mixed",
      livingCalfCount: 1,
      stillbornCount: 1,
      calves: [{ earTag: "RC26-15" }],
    },
    animal,
  );
  assert.match(mixed.title, /Mixed delivery/);
  assert.ok(mixed.details.includes("1 living, 1 stillborn"));
  assert.ok(mixed.details.includes("Offspring: RC26-15"));
});

test("record identity is compact visually, complete accessibly, and never leaks seed prefixes", () => {
  const record = formatAnimalRecord({ recordKind: "medical_record", type: "Treatment" }, animal);
  assert.match(record.title, /RC26-05/);
  assert.doesNotMatch(record.title, /SEED-repro-manual/i);
  assert.match(record.fullAnimalReference, /SEED-repro-manual/);

  const detail = source("mobile/features/farmer-reports/components/RecordDetailContent.tsx");
  assert.match(detail, /formatAnimalReference/);
  assert.match(detail, /Breed unavailable/);
  assert.doesNotMatch(detail, /Unknown Breed|Unknown Species/);
});

test("contextual actions use truthful labels, disabled reasons, and task workflow stages", () => {
  const farmer = source("mobile/features/animals/screens/AnimalDetailsScreen.tsx");
  const tracker = source("mobile/features/breeding/screens/PregnancyTrackerScreen.tsx");
  const task = source("mobile/app/(technician)/task-details.tsx");

  assert.match(farmer, /Report Possible Pregnancy/);
  assert.match(farmer, /Report Observation/);
  assert.match(farmer, /Request Technician Review/);
  assert.match(farmer, /disabledReason=\{aiUnavailableReason\}/);
  assert.match(farmer, /accessibilityState=\{\{ disabled: Boolean\(disabled\) \}\}/);
  assert.doesNotMatch(farmer, /Confirm Pregnancy 🎉/);
  assert.match(tracker, /Record Calving/);
  assert.doesNotMatch(tracker, /Report Possible Labor/);
  assert.match(task, /Record Continuation Recheck/);
  assert.match(task, /Record Diagnostic Follow-up/);
  assert.match(task, /initialPregnancyCheckLocked/);
});

test("record cards preserve narrow-phone and tablet responsiveness contracts", () => {
  const farmer = source("mobile/features/animals/screens/AnimalDetailsScreen.tsx");
  const technician = source("mobile/app/(technician)/animal-details.tsx");
  const badge = source("mobile/components/shared/StatusBadge.tsx");

  for (const screen of [farmer, technician]) {
    assert.match(screen, /flex-row flex-wrap gap-1\.5/);
    assert.match(screen, /minHeight: 124/);
    assert.match(screen, /flex-1 min-w-0/);
  }
  assert.match(farmer, /minHeight: 72/);
  assert.match(badge, /numberOfLines=\{2\}/);
  assert.match(badge, /flexShrink: 1/);
});
