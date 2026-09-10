import assert from "node:assert/strict";
import test from "node:test";
import {
  PREGNANCY_DIAGNOSIS_UI,
  formatDaysSinceInsemination,
  getDiagnosisWindowCopy,
  getFarmerUpdateCopy,
} from "./pregnancyDiagnosisPresentation.ts";
import {
  PILOT_DIAGNOSTIC_METHODS,
  getVisibleDiagnosticMethodOptions,
} from "./technicianBreedingVerification.ts";

test("Diagnosis Window timing copy: explains WHEN diagnosis is appropriate without mixing diagnostic methods", () => {
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_1.SECTION_DIAGNOSIS_WINDOW, "DIAGNOSIS WINDOW");

  // When eligible (e.g. 60 days post-AI)
  const readyCopy = getDiagnosisWindowCopy(true);
  assert.equal(readyCopy.title, "Ready for pregnancy diagnosis");
  assert.equal(
    readyCopy.description,
    "The animal has reached the recommended time for pregnancy diagnosis.",
  );

  // When monitoring in progress (e.g. before 60 days)
  const monitoringCopy = getDiagnosisWindowCopy(false, "Earliest diagnosis is at 60 days.");
  assert.equal(monitoringCopy.title, "Monitoring in progress");
  assert.equal(monitoringCopy.description, "Earliest diagnosis is at 60 days.");

  // Days since insemination formatting
  assert.equal(formatDaysSinceInsemination(60), "60 days since insemination");
  assert.equal(formatDaysSinceInsemination(1), "1 day since insemination");
  assert.equal(formatDaysSinceInsemination(null), null);
  assert.equal(formatDaysSinceInsemination(undefined), null);
});

test("Diagnosis Window timing copy: strictly excludes diagnostic methods and prohibited phrases", () => {
  const readyCopy = getDiagnosisWindowCopy(true);
  const copyText = `${readyCopy.title} ${readyCopy.description}`;

  // Methods belong ONLY on Page 2, NEVER in the Diagnosis Window
  for (const method of PILOT_DIAGNOSTIC_METHODS) {
    assert.equal(
      copyText.toLowerCase().includes(method.label.toLowerCase()),
      false,
      `Diagnosis Window must not mention diagnostic method '${method.label}'`,
    );
  }

  // Must not include generic "Due now" or "technician assessment"
  assert.equal(copyText.toLowerCase().includes("due now"), false);
  assert.equal(copyText.toLowerCase().includes("technician assessment"), false);
});

test("Farmer Update presentation: Case A (in-app report) provides clear subtitle and review guidance", () => {
  const copy = getFarmerUpdateCopy(true);
  assert.equal(copy.subtitle, "Farmer reported possible pregnancy");
  assert.equal(
    copy.guidance,
    "Review the farmer's notes and photos before recording the diagnosis.",
  );
  assert.equal(PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_OBSERVATION, "Farmer's observation");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.FARMER_UPDATE.REPORTED_EVIDENCE, "Evidence");
});

test("Farmer Update presentation: Case B (no report) provides proactive technician prompt", () => {
  const copy = getFarmerUpdateCopy(false);
  assert.equal(copy.subtitle, "No report submitted");
  assert.equal(
    copy.guidance,
    "Ask the farmer if they have noticed any changes since insemination.",
  );
});

test("Breeding reference labels: concise and specific without generic AI Date", () => {
  const labels = PREGNANCY_DIAGNOSIS_UI.PAGE_1.BREEDING_LABELS;
  assert.equal(labels.LAST_INSEMINATION, "Last insemination");
  assert.equal(labels.ATTEMPT, "Attempt");
  assert.equal(labels.SIRE, "Sire");
});

test("Workflow CTAs and titles: consistent handoff between Page 1 and Page 2", () => {
  // Page 1
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_1.CTA_START_DIAGNOSIS, "Start Pregnancy Diagnosis");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_1.CTA_DIAGNOSIS_LOCKED, "Diagnosis Not Yet Available");

  // Page 2
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_2.HEADER_INITIAL, "Record Pregnancy Diagnosis");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_2.SUBTEXT_TIMING, "Pregnancy diagnosis");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_2.SECTION_FORM_TITLE, "Technician Diagnosis");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_2.SECTION_DIAGNOSTIC_METHOD, "Diagnostic Method");
  assert.equal(PREGNANCY_DIAGNOSIS_UI.PAGE_2.CTA_SAVE_INITIAL, "Save Pregnancy Diagnosis");
});

test("Diagnostic Methods: belong exclusively on Page 2 under DIAGNOSTIC METHOD", () => {
  const options = getVisibleDiagnosticMethodOptions();
  const methodLabels = options.map((o) => o.label);
  assert.deepEqual(methodLabels, [
    "Manual Palpation",
    "Visual Assessment",
    "Farmer Interview",
    "Other",
  ]);
});
