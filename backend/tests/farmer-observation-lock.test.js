import { test } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { Insemination } from "../src/models/insemination.model.js";
import { submitFarmerBreedingObservation } from "../src/controllers/ai-request.controllers.js";
import { Animal } from "../src/models/animal.model.js";

test("Farmer observation modifications are rejected after a terminal Technician outcome", async (t) => {
  // Mock request, response
  const farmerId = new mongoose.Types.ObjectId();
  const animalId = new mongoose.Types.ObjectId();
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: { reportType: "possible_pregnancy" },
    user: { _id: farmerId, role: "farmer" },
  };

  let jsonResponse = null;
  let statusCode = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return {
        json: (data) => {
          jsonResponse = data;
        },
      };
    },
    json: (data) => {
      statusCode = 200;
      jsonResponse = data;
    },
  };

  // We stub Insemination.findOne to return a mock request
  const originalFindOne = Insemination.findOne;
  const originalFindById = Animal.findById;

  t.after(() => {
    Insemination.findOne = originalFindOne;
    Animal.findById = originalFindById;
  });

  await t.test("Rejects update if the AI outcome is already verified", async () => {
    Insemination.findOne = () => ({
      populate: () => ({
        _id: req.params.id,
        farmerId,
        status: "done",
        inseminationDate: new Date("2026-01-01T00:00:00.000Z"),
        outcome: "Pregnant",
        farmerOutcomeReport: "possible_pregnancy",
        verificationStatus: "verified",
        outcomeVerificationStatus: "verified",
        animalId: { _id: animalId }
      })
    });

    Animal.findById = () => ({ _id: animalId });

    await submitFarmerBreedingObservation(req, res);

    assert.strictEqual(statusCode, 409);
    assert.strictEqual(jsonResponse.code, "AI_ATTEMPT_TERMINAL");
  });
});
