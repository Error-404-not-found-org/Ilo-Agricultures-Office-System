import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import {
  buildLegacyHealthSymptoms,
  HEALTH_OBSERVED_SIGN,
  legacyRequestTypeForAssistance,
  normalizeHealthRequestDetails,
} from "../src/domain/health-request-input.js";
import { buildFarmerHealthRequest } from "../src/domain/health-request-presentation.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { activeHealthCaseKey } from "../src/services/health-request-creation.service.js";

const structured = (overrides = {}) => ({
  version: 1,
  assistanceRequested: "medicine_request",
  observedSigns: ["diarrhea"],
  farmerDescription: "Started yesterday and the animal looks weak.",
  ...overrides,
});

test("Medicine and multiple observed signs coexist independently", () => {
  const details = normalizeHealthRequestDetails(
    structured({ observedSigns: ["diarrhea", "not_eating_normally"] }),
  );

  assert.equal(details.assistanceRequested, "medicine_request");
  assert.deepEqual(details.observedSigns, [
    HEALTH_OBSERVED_SIGN.DIARRHEA,
    HEALTH_OBSERVED_SIGN.NOT_EATING_NORMALLY,
  ]);
  assert.equal(legacyRequestTypeForAssistance(details.assistanceRequested), "medicine");
});

test("Health Concern observations and Preventive Care without signs are valid", () => {
  const concern = normalizeHealthRequestDetails(
    structured({
      assistanceRequested: "health_concern",
      observedSigns: ["fever", "nasal_discharge"],
    }),
  );
  assert.deepEqual(concern.observedSigns, ["fever", "nasal_discharge"]);

  const preventive = normalizeHealthRequestDetails(
    structured({
      assistanceRequested: "preventive_care",
      observedSigns: [],
      farmerDescription: "",
    }),
  );
  assert.deepEqual(preventive.observedSigns, []);
  assert.match(buildLegacyHealthSymptoms(preventive), /Preventive care/);
});

test("Farmer description is independent and can fall back from farmerNotes", () => {
  const explicit = normalizeHealthRequestDetails(structured());
  assert.equal(
    explicit.farmerDescription,
    "Started yesterday and the animal looks weak.",
  );

  const compatibility = normalizeHealthRequestDetails(
    {
      version: 1,
      assistanceRequested: "health_concern",
      observedSigns: ["weakness"],
    },
    { legacyFarmerNotes: "  Legacy description remains available.  " },
  );
  assert.equal(
    compatibility.farmerDescription,
    "Legacy description remains available.",
  );
});

test("schema persists structured details while retaining legacy request fields", async () => {
  const animalId = new mongoose.Types.ObjectId();
  const farmerId = new mongoose.Types.ObjectId();
  const requestDetails = normalizeHealthRequestDetails(
    structured({ observedSigns: ["diarrhea", "weakness"] }),
  );
  const symptoms = buildLegacyHealthSymptoms(requestDetails);
  const request = new HealthRequest({
    animalId,
    farmerId,
    requestType: "medicine",
    symptoms,
    farmerNotes: requestDetails.farmerDescription,
    requestDetails,
    status: "pending",
  });

  await request.validate();
  const stored = request.toObject();
  assert.deepEqual(stored.requestDetails, requestDetails);
  assert.equal(stored.requestType, "medicine");
  assert.equal(stored.symptoms, symptoms);
  assert.equal(stored.farmerNotes, requestDetails.farmerDescription);
  assert.equal(stored.activeCaseKey, activeHealthCaseKey(animalId, "medicine"));
});

test("legacy HealthRequest without structured details remains valid and readable", () => {
  const request = new HealthRequest({
    animalId: new mongoose.Types.ObjectId(),
    farmerId: new mongoose.Types.ObjectId(),
    requestType: "disease",
    symptoms: "Animal has diarrhea.",
    farmerNotes: "Started yesterday.",
  });

  assert.equal(request.validateSync(), undefined);
  assert.equal(request.requestDetails, undefined);
  assert.equal(request.symptoms, "Animal has diarrhea.");
  assert.equal(request.farmerNotes, "Started yesterday.");
});

test("Farmer-safe presentation retains structured input and hides internal notes", () => {
  const requestDetails = structured();
  const farmer = buildFarmerHealthRequest({
    requestDetails,
    symptoms: "Legacy compatibility summary",
    farmerNotes: requestDetails.farmerDescription,
    technicianNote: "Internal clinical thought.",
    statusHistory: [
      {
        status: "pending",
        note: "Internal clinical thought.",
        actorId: "technician-1",
      },
    ],
  });

  assert.deepEqual(farmer.requestDetails, requestDetails);
  assert.equal(farmer.symptoms, "Legacy compatibility summary");
  assert.equal("technicianNote" in farmer, false);
  assert.equal("note" in farmer.statusHistory[0], false);
  assert.equal("actorId" in farmer.statusHistory[0], false);
});

test("invalid versions, assistance values, observed signs, and duplicates are rejected", () => {
  const invalidCases = [
    structured({ version: 2 }),
    structured({ assistanceRequested: "vaccination" }),
    structured({ observedSigns: "diarrhea" }),
    structured({ observedSigns: ["unknown_sign"] }),
    structured({ observedSigns: ["diarrhea", "diarrhea"] }),
  ];

  for (const value of invalidCases) {
    assert.throws(
      () => normalizeHealthRequestDetails(value),
      (error) => error.status === 400,
    );
  }
});
