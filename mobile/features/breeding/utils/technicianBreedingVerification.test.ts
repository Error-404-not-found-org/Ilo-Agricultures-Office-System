import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTechnicianBreedingVerificationPayload,
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
