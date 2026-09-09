import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPregnancyContinuationPayload,
  buildTechnicianBreedingVerificationPayload,
  isPregnancyContinuationStage,
  isFarmerReturnToHeatReview,
  CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES,
  PILOT_DIAGNOSTIC_METHODS,
  formatDiagnosticMethodLabel,
  getVisibleDiagnosticMethodOptions,
} from "./technicianBreedingVerification.ts";

test("return-to-heat review is classified from the Farmer report", () => {
  assert.equal(
    isFarmerReturnToHeatReview({ farmerOutcomeReport: "return_to_heat" }),
    true,
  );
  assert.equal(
    isFarmerReturnToHeatReview({ farmerOutcomeReport: "possible_pregnancy" }),
    false,
  );
});

test("return-to-heat review payload does not invent a diagnostic method", () => {
  const payload = buildTechnicianBreedingVerificationPayload({
    verificationResult: "return_to_heat",
    checkedAt: new Date("2026-08-15T08:00:00.000Z"),
    technicianNotes: "Standing heat verified.",
    taskId: "task-1",
  });

  assert.equal("checkMethod" in payload, false);
  assert.equal(payload.verificationResult, "return_to_heat");
  assert.equal(payload.taskId, "task-1");
});

test("pregnancy diagnosis payload preserves its selected diagnostic method", () => {
  const payload = buildTechnicianBreedingVerificationPayload({
    verificationResult: "pregnant",
    checkMethod: "ultrasound",
    checkedAt: new Date("2026-08-15T08:00:00.000Z"),
  });

  assert.equal(payload.checkMethod, "ultrasound");
});

test("Pregnancy task stages distinguish initial verification from continuation work", () => {
  assert.equal(isPregnancyContinuationStage("initial_confirmation"), false);
  assert.equal(isPregnancyContinuationStage("continuation_recheck"), true);
  assert.equal(isPregnancyContinuationStage("diagnostic_follow_up"), true);
  assert.equal(isPregnancyContinuationStage("Pregnancy follow-up"), false);
});

test("continuation payload uses only the backend continuation contract", () => {
  const payload = buildPregnancyContinuationPayload({
    result: "follow_up_required",
    checkedAt: new Date("2026-08-20T08:00:00.000Z"),
    notes: "Repeat ultrasound required.",
    followUpDate: new Date("2026-08-27T08:00:00.000Z"),
    taskId: "task-follow-up-1",
  });

  assert.deepEqual(payload, {
    result: "follow_up_required",
    checkedAt: "2026-08-20T08:00:00.000Z",
    notes: "Repeat ultrasound required.",
    followUpDate: "2026-08-27T08:00:00.000Z",
    taskId: "task-follow-up-1",
  });
  assert.equal("verificationResult" in payload, false);
  assert.equal("checkMethod" in payload, false);
});

test("Pregnancy task screen routes continuation work to the continuation endpoint", () => {
  const detailsSource = readFileSync(
    fileURLToPath(new URL("../../../app/(technician)/task-details.tsx", import.meta.url).href),
    "utf8",
  );
  const verificationSource = readFileSync(
    fileURLToPath(new URL("../../../app/(technician)/pregnancy-verification.tsx", import.meta.url).href),
    "utf8",
  );

  assert.match(detailsSource, /workflowStage: String\(pregnancyWorkflowStage\)/);
  assert.match(detailsSource, /pregnancyId: String\(pregnancyId\)/);
  assert.match(
    verificationSource,
    /isContinuationWorkflow[\s\S]*?\/technician\/pregnancy-checks\/\$\{pregnancyId\}\/continuation-recheck/,
  );
  assert.match(
    verificationSource,
    /else \{[\s\S]*?\/ai-request\/\$\{insem\._id\}\/verify-breeding-observation/,
  );
});

test("Technician review presents the Farmer report, date, signs, notes, and photos", () => {
  const cardSource = readFileSync(
    fileURLToPath(
      new URL(
        "../components/FarmerBreedingObservationCard.tsx",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );
  const detailsSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../../app/(technician)/task-details.tsx",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );
  const verificationSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../../app/(technician)/pregnancy-verification.tsx",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );

  assert.match(cardSource, /farmerOutcomeReportedAt/);
  assert.match(cardSource, /farmerObservationSigns/);
  assert.match(cardSource, /farmerObservationNotes/);
  assert.match(cardSource, /evidencePhotos/);
  assert.match(detailsSource, /FarmerPregnancyReportCard/);
  assert.match(detailsSource, /(?:Start Pregnancy Diagnosis|CTA_START_DIAGNOSIS)/);
  assert.match(verificationSource, /Pregnancy Diagnosis/);
  assert.match(cardSource, /photoButton:[\s\S]*?width: 76[\s\S]*?height: 76[\s\S]*?flexShrink: 0/);
  assert.match(cardSource, /photo:[\s\S]*?width: 76[\s\S]*?height: 76/);
});

test("CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES defines the 2x2 canonical diagnosis outcomes", () => {
  assert.deepEqual(
    CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES.map((item) => item.value),
    ["pregnant", "not_pregnant", "return_to_heat", "needs_recheck"],
  );
  assert.deepEqual(
    CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES.map((item) => item.label),
    ["Pregnant", "Not Pregnant", "Returned to Heat", "Recheck Required"],
  );
});

test("diagnostic method labels use pilot-safe terminology and format labels correctly", () => {
  assert.equal(formatDiagnosticMethodLabel("palpation"), "Manual Palpation");
  assert.equal(formatDiagnosticMethodLabel("rectal_palpation"), "Manual Palpation");
  assert.equal(formatDiagnosticMethodLabel("visual_observation"), "Visual Assessment");
  assert.equal(formatDiagnosticMethodLabel("farmer_interview"), "Farmer Interview");
  assert.equal(formatDiagnosticMethodLabel("other"), "Other");
  assert.equal(formatDiagnosticMethodLabel(null), "Not Recorded");
});

test("existing advanced method records preserve display compatibility", () => {
  assert.equal(formatDiagnosticMethodLabel("ultrasound"), "Ultrasound");
  assert.equal(formatDiagnosticMethodLabel("blood_pag"), "Blood PAG");
  assert.equal(formatDiagnosticMethodLabel("milk_pag"), "Milk PAG");
});

test("default diagnostic method options hide ultrasound, blood_pag, and milk_pag using pilot allow-list", () => {
  const defaultOptions = getVisibleDiagnosticMethodOptions();
  assert.equal(
    defaultOptions.some((m) => m.methodCode === "ultrasound"),
    false,
  );
  assert.equal(
    defaultOptions.some((m) => m.methodCode === "blood_pag"),
    false,
  );
  assert.equal(
    defaultOptions.some((m) => m.methodCode === "milk_pag"),
    false,
  );
  assert.deepEqual(
    defaultOptions.map((m) => m.label),
    ["Manual Palpation", "Visual Assessment", "Farmer Interview", "Other"],
  );

  // But if advanced methods were already selected in a draft/record, they remain visible
  const withSelectedUltrasound = getVisibleDiagnosticMethodOptions({
    selectedMethod: "ultrasound",
  });
  assert.equal(
    withSelectedUltrasound.some((m) => m.methodCode === "ultrasound"),
    true,
  );

  const withSelectedBloodPag = getVisibleDiagnosticMethodOptions({
    selectedMethod: "blood_pag",
  });
  assert.equal(
    withSelectedBloodPag.some((m) => m.methodCode === "blood_pag"),
    true,
  );

  const withSelectedMilkPag = getVisibleDiagnosticMethodOptions({
    selectedMethod: "milk_pag",
  });
  assert.equal(
    withSelectedMilkPag.some((m) => m.methodCode === "milk_pag"),
    true,
  );
});

test("Pregnancy Diagnosis screen implements 2x2 outcome grid, Technician diagnosis copy, and canonical validation", () => {
  const verificationSource = readFileSync(
    fileURLToPath(
      new URL(
        "../../../app/(technician)/pregnancy-verification.tsx",
        import.meta.url,
      ).href,
    ),
    "utf8",
  );

  assert.match(verificationSource, /grid2x2/);
  assert.match(verificationSource, /CANONICAL_PREGNANCY_DIAGNOSIS_OUTCOMES/);
  assert.match(verificationSource, /LAST INSEMINATION/);
  assert.match(verificationSource, /since insemination/);
  assert.match(verificationSource, /(?:Technician [Dd]iagnosis|SECTION_FORM_TITLE)/);
  assert.doesNotMatch(verificationSource, /Manual examination/);
  assert.doesNotMatch(verificationSource, /Day \$\{pregnancyReadiness\.daysPostAI\} after AI/);
  assert.doesNotMatch(verificationSource, /AI date:/);
  assert.match(verificationSource, /!isContinuationWorkflow && !checkMethod/);
});
