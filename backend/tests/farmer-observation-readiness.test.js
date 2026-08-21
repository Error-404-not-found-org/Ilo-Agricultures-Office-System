import assert from "node:assert/strict";
import mongoose from "mongoose";
import test from "node:test";

import { submitFarmerBreedingObservation } from "../src/controllers/ai-request.controllers.js";
import {
  assertFarmerBreedingObservationWindow,
  getFarmerBreedingObservationReadiness,
} from "../src/domain/pregnancy-readiness.js";
import { Animal } from "../src/models/animal.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { isVerifiedFailedAIAttempt } from "../src/services/ai-request-creation.service.js";

const DAY = 24 * 60 * 60 * 1000;
const at = new Date("2026-08-15T08:00:00.000Z");
const attemptAtDay = (daysPostAI, overrides = {}) => ({
  status: "done",
  inseminationDate: new Date(at.getTime() - daysPostAI * DAY),
  ...overrides,
});

for (const [day, isEligible, code] of [
  [0, false, "FARMER_OBSERVATION_TOO_EARLY"],
  [17, false, "FARMER_OBSERVATION_TOO_EARLY"],
  [18, true, "FARMER_OBSERVATION_AVAILABLE"],
  [25, true, "FARMER_OBSERVATION_AVAILABLE"],
  [26, true, "FARMER_OBSERVATION_AVAILABLE"],
  [30, true, "FARMER_OBSERVATION_AVAILABLE"],
]) {
  test(`Farmer breeding observation readiness at Day ${day}`, () => {
    const readiness = getFarmerBreedingObservationReadiness({
      insemination: attemptAtDay(day),
      at,
    });
    assert.equal(readiness.daysPostAI, day);
    assert.equal(readiness.isEligible, isEligible);
    assert.equal(readiness.code, code);

    if (isEligible) {
      assert.doesNotThrow(() =>
        assertFarmerBreedingObservationWindow({
          insemination: attemptAtDay(day),
          at,
        }),
      );
    } else {
      assert.throws(
        () =>
          assertFarmerBreedingObservationWindow({
            insemination: attemptAtDay(day),
            at,
          }),
        (error) => error.code === code && error.status === 422,
      );
    }
  });
}

test("Farmer breeding observation requires a completed AI service", () => {
  assert.throws(
    () =>
      assertFarmerBreedingObservationWindow({
        insemination: attemptAtDay(18, { status: "in-progress" }),
        at,
      }),
    (error) => error.code === "AI_SERVICE_NOT_COMPLETED" && error.status === 409,
  );
});

test("a late Farmer return-to-heat report remains non-authoritative", () => {
  const lateReport = attemptAtDay(30, {
    farmerOutcomeReport: "return_to_heat",
    outcomeVerificationStatus: "reported",
    outcomeConfirmationSource: "farmer_return_to_heat",
  });

  assert.equal(
    getFarmerBreedingObservationReadiness({ insemination: lateReport, at })
      .isEligible,
    true,
  );
  assert.equal(isVerifiedFailedAIAttempt(lateReport), false);
  assert.equal(lateReport.isSuccess, undefined);
  assert.equal(lateReport.outcome, undefined);
});

for (const day of [0, 17]) {
  test(`farmer-observation endpoint rejects Day ${day} before any domain mutation`, async () => {
    const originals = {
      findOne: Insemination.findOne,
      findById: Animal.findById,
    };
    const farmerId = new mongoose.Types.ObjectId();
    const animalId = new mongoose.Types.ObjectId();
    const request = {
      _id: new mongoose.Types.ObjectId(),
      farmerId,
      animalId: { _id: animalId },
      status: "done",
      inseminationDate: new Date(
        Date.now() - day * DAY - (day ? 60 * 60 * 1000 : 0),
      ),
      farmerOutcomeReport: null,
    };
    const animal = {
      _id: animalId,
      reproductiveStatus: "Inseminated",
    };
    Insemination.findOne = () => ({ populate: async () => request });
    Animal.findById = async () => animal;
    const recorder = { statusCode: 200, body: null };
    const res = {
      status(code) {
        recorder.statusCode = code;
        return this;
      },
      json(body) {
        recorder.body = body;
        return this;
      },
    };

    try {
      await submitFarmerBreedingObservation(
        {
          params: { id: String(request._id) },
          body: { reportType: "return_to_heat" },
          user: { _id: farmerId, role: "farmer" },
        },
        res,
      );
      assert.equal(recorder.statusCode, 422);
      assert.equal(recorder.body.code, "FARMER_OBSERVATION_TOO_EARLY");
      assert.equal(request.farmerOutcomeReport, null);
      assert.equal(animal.reproductiveStatus, "Inseminated");
    } finally {
      Insemination.findOne = originals.findOne;
      Animal.findById = originals.findById;
    }
  });
}
