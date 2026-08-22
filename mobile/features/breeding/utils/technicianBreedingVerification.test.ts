import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildPregnancyContinuationPayload,
  buildTechnicianBreedingVerificationPayload,
  isPregnancyContinuationStage,
  isFarmerReturnToHeatReview,
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
  assert.match(cardSource, /ImageViewerModal/);
  assert.match(detailsSource, /Review Farmer Update/);
  assert.match(
    detailsSource,
    /isReturnToHeatReview[\s\S]*?"Review Farmer Update"[\s\S]*?: "Record Pregnancy Confirmation"/,
  );
  assert.match(detailsSource, /contentContainerStyle=\{styles\.screenScrollContent\}/);
  assert.match(detailsSource, /screenScrollContent:[\s\S]*?flexGrow: 1[\s\S]*?paddingBottom: 32/);
  assert.match(
    verificationSource,
    /behavior=\{\s*Platform\.OS === "ios" \? "padding" : undefined\s*\}/,
  );
  assert.match(verificationSource, /contentContainerStyle=\{styles\.screenScrollContent\}/);
  assert.match(cardSource, /photoButton:[\s\S]*?width: 76[\s\S]*?height: 76[\s\S]*?flexShrink: 0/);
  assert.match(cardSource, /photo:[\s\S]*?width: 76[\s\S]*?height: 76/);
});
