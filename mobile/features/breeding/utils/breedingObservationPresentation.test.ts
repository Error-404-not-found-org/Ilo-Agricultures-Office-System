import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  getBreedingObservationDraft,
  getBreedingObservationLabel,
  getBreedingObservationPresentation,
  getFarmerBreedingObservationReadiness,
  hasBreedingObservation,
  canOfferFarmerReInsemination,
  isBreedingObservationAuthoritativelyReviewed,
  isVerifiedReturnToHeatOutcome,
  selectBreedingObservationAttempt,
} from "./breedingObservationPresentation.ts";

const DAY = 24 * 60 * 60 * 1000;
const readinessAt = new Date("2026-08-15T08:00:00.000Z");

for (const [day, expected] of [
  [0, false],
  [17, false],
  [18, true],
  [25, true],
  [26, true],
  [30, true],
] as const) {
  test(`Farmer observation presentation readiness at Day ${day}`, () => {
    const readiness = getFarmerBreedingObservationReadiness(
      {
        status: "done",
        inseminationDate: new Date(
          readinessAt.getTime() - day * DAY,
        ).toISOString(),
        pregnancyReadiness: { daysPostAI: day },
      },
      readinessAt,
    );
    assert.equal(readiness.daysPostAI, day);
    assert.equal(readiness.isAvailable, expected);
  });
}

const firstAttempt = {
  _id: "attempt-1",
  attemptNumber: 1,
  inseminationDate: "2026-06-01T08:00:00.000Z",
  status: "done",
  farmerOutcomeReport: "possible_pregnancy" as const,
  farmerObservationSigns: ["Did not return to heat"],
  farmerObservationNotes: "Older attempt observation",
};

const secondAttempt = {
  _id: "attempt-2",
  attemptNumber: 2,
  inseminationDate: "2026-07-25T08:00:00.000Z",
  status: "done",
};

test("latest completed AI with no observation stays in create mode", () => {
  const latest = selectBreedingObservationAttempt([firstAttempt, secondAttempt]);
  const draft = getBreedingObservationDraft(latest, "unsure");

  assert.equal(latest?._id, "attempt-2");
  assert.equal(hasBreedingObservation(latest), false);
  assert.equal(draft.mode, "create");
  assert.equal(draft.reportType, "unsure");
});

test("an older observation never marks the latest attempt as submitted", () => {
  const latest = selectBreedingObservationAttempt([secondAttempt, firstAttempt]);

  assert.equal(latest?._id, "attempt-2");
  assert.equal(getBreedingObservationDraft(latest).mode, "create");
});

test("latest submitted observation restores its persisted update draft", () => {
  const latestSubmitted = {
    ...secondAttempt,
    farmerOutcomeReport: "possible_pregnancy" as const,
    farmerObservationSigns: ["Calmer behavior", "Physical changes observed"],
    farmerObservationNotes: "No return to heat was observed.",
    evidencePhotos: ["https://example.test/evidence-1.jpg"],
  };

  const latest = selectBreedingObservationAttempt([
    firstAttempt,
    latestSubmitted,
  ]);
  const draft = getBreedingObservationDraft(latest);

  assert.equal(latest?._id, "attempt-2");
  assert.equal(draft.mode, "existing");
  assert.equal(draft.reportType, "possible_pregnancy");
  assert.deepEqual(draft.signs, [
    "Calmer behavior",
    "Physical changes observed",
  ]);
  assert.equal(draft.notes, "No return to heat was observed.");
  assert.deepEqual(draft.evidencePhotos, [
    "https://example.test/evidence-1.jpg",
  ]);
});

test("possible pregnancy before readiness stays recorded without claiming technician review", () => {
  const presentation = getBreedingObservationPresentation({
    farmerOutcomeReport: "possible_pregnancy",
    pregnancyReadiness: { isEligible: false },
    pregnancyFollowUpTask: {
      _id: "scheduled-pd-task",
      status: "Pending",
      sourceType: "automatic_pd_followup",
    },
  });

  assert.equal(presentation.stage, "confirmation_not_ready");
  assert.equal(presentation.statusMessage, "No return to heat observed");
  assert.equal(presentation.farmerMessage, "Pregnancy has not been confirmed.");
  assert.equal(
    getBreedingObservationLabel("possible_pregnancy"),
    "No return to heat observed",
  );
  assert.doesNotMatch(presentation.statusMessage, /awaiting technician review/i);
});

test("possible pregnancy becomes technician follow-up only when ready with an active task", () => {
  const presentation = getBreedingObservationPresentation({
    farmerOutcomeReport: "possible_pregnancy",
    pregnancyReadiness: { isEligible: true },
    pregnancyFollowUpTask: { _id: "pd-task", status: "In Progress" },
  });

  assert.equal(presentation.stage, "technician_follow_up");
  assert.equal(presentation.badgeLabel, "Follow-up pending");
});

test("return to heat always communicates authoritative technician verification", () => {
  const presentation = getBreedingObservationPresentation({
    farmerOutcomeReport: "return_to_heat",
    pregnancyReadiness: { isEligible: false },
  });

  assert.equal(presentation.stage, "technician_follow_up");
  assert.match(presentation.statusMessage, /Return to heat reported/i);
  assert.equal(presentation.farmerMessage, "Observation submitted.");
  assert.equal(
    getBreedingObservationLabel("return_to_heat"),
    "Return to heat reported",
  );
});

test("verified return to heat presents a resolved unsuccessful attempt", () => {
  const attempt = {
    status: "done",
    farmerOutcomeReport: "return_to_heat" as const,
    isSuccess: false,
    outcome: "Failed (Re-heat)",
    outcomeVerificationStatus: "verified",
    outcomeConfirmationSource: "technician_return_to_heat",
    failureReason: "return_to_heat",
  };
  const presentation = getBreedingObservationPresentation(attempt);

  assert.equal(isVerifiedReturnToHeatOutcome(attempt), true);
  assert.equal(presentation.stage, "review_complete");
  assert.equal(presentation.statusMessage, "Return to heat confirmed");
  assert.match(presentation.farmerMessage, /not successful/i);
  assert.equal(canOfferFarmerReInsemination(attempt, { eligible: true }), true);
  assert.equal(canOfferFarmerReInsemination(attempt, { eligible: false }), false);
});

test("a completed review alone does not resolve cannot-confirm, possible-pregnancy, or unsure", () => {
  const cannotConfirm = {
    status: "done",
    farmerOutcomeReport: "return_to_heat" as const,
    verificationStatus: "rejected",
  };
  const possiblePregnancy = {
    status: "done",
    farmerOutcomeReport: "possible_pregnancy" as const,
    outcomeVerificationStatus: "reported",
  };
  const unsure = {
    status: "done",
    farmerOutcomeReport: "unsure" as const,
  };

  assert.equal(isVerifiedReturnToHeatOutcome(cannotConfirm), false);
  assert.equal(isVerifiedReturnToHeatOutcome(possiblePregnancy), false);
  assert.equal(isVerifiedReturnToHeatOutcome(unsure), false);
  assert.equal(canOfferFarmerReInsemination(cannotConfirm, { eligible: true }), false);
  assert.equal(canOfferFarmerReInsemination(possiblePregnancy, { eligible: true }), false);
  assert.equal(canOfferFarmerReInsemination(unsure, { eligible: true }), false);
});

test("unsure remains an informational observation", () => {
  const presentation = getBreedingObservationPresentation({
    farmerOutcomeReport: "unsure",
  });

  assert.equal(presentation.stage, "recorded");
  assert.equal(presentation.statusMessage, "Breeding update submitted");
  assert.equal(presentation.farmerMessage, "Continue monitoring your animal.");
});

test("only authoritative technician outcomes lock farmer edits", () => {
  assert.equal(
    isBreedingObservationAuthoritativelyReviewed({
      farmerOutcomeReport: "return_to_heat",
      verificationStatus: "pending",
    }),
    false,
  );
  assert.equal(
    isBreedingObservationAuthoritativelyReviewed({
      farmerOutcomeReport: "return_to_heat",
      verificationStatus: "verified",
    }),
    true,
  );
});

test("canonical workflow ID selects the requested attempt", () => {
  const selected = selectBreedingObservationAttempt(
    [secondAttempt, firstAttempt],
    "attempt-1",
  );

  assert.equal(selected?._id, "attempt-1");
  assert.equal(getBreedingObservationDraft(selected).mode, "existing");
});

test("an invalid workflow ID never falls through to another attempt", () => {
  const selected = selectBreedingObservationAttempt(
    [secondAttempt, firstAttempt],
    "missing-attempt",
  );

  assert.equal(selected, null);
});




test("Animal Details leads with the resolved result and reuses the gated retry route", () => {
  const animalDetailsSource = readFileSync(
    fileURLToPath(
      new URL("../../animals/screens/RoleAwareAnimalDetailsScreen.tsx", import.meta.url).href,
    ),
    "utf8",
  );

  assert.match(animalDetailsSource, /observationPresentation\.statusMessage/);
  assert.match(animalDetailsSource, /AI Attempt #\$\{latestObservation\.attemptNumber \|\| 1\} was not successful/);
  assert.match(animalDetailsSource, /Your observation/);
  assert.match(animalDetailsSource, /Technician result/);
  assert.match(animalDetailsSource, /canOfferFarmerReInsemination/);
  assert.match(animalDetailsSource, /const hasPerformedAI = Boolean/);
  assert.match(animalDetailsSource, /const canRequestInitialAI =/);
  assert.match(
    animalDetailsSource,
    /canRequestInitialAI \|\| canRequestAnotherAI/,
  );
  assert.match(animalDetailsSource, /mode: "re-inseminate"/);
  assert.match(animalDetailsSource, /Request Another AI/);
});
