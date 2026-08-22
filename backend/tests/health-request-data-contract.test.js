import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";

import {
  buildFarmerHealthRequest,
  buildTechnicianHealthRequest,
} from "../src/domain/health-request-presentation.js";
import { getHealthRequestDetail } from "../src/controllers/health-workflow.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import {
  activeHealthCaseKey,
  createHealthRequestWithGuard,
} from "../src/services/health-request-creation.service.js";

const baseRequest = (overrides = {}) => ({
  farmerId: new mongoose.Types.ObjectId(),
  animalId: new mongoose.Types.ObjectId(),
  symptoms: "Reduced appetite",
  ...overrides,
});

test("legacy HealthRequest remains valid without handlingMethod", () => {
  const request = new HealthRequest(baseRequest());
  assert.equal(request.validateSync(), undefined);
  assert.equal(request.handlingMethod, undefined);
  assert.equal(request.technicianResponse, undefined);
});

test("handlingMethod accepts only the three future handling values", () => {
  for (const handlingMethod of ["advice", "office_pickup", "farm_visit"]) {
    const request = new HealthRequest(baseRequest({ handlingMethod }));
    assert.equal(request.validateSync(), undefined);
    assert.equal(request.handlingMethod, handlingMethod);
  }

  const invalid = new HealthRequest(
    baseRequest({ handlingMethod: "automatic_treatment" }),
  );
  assert.ok(invalid.validateSync()?.errors?.handlingMethod);
});

test("Advice response reuses existing public, internal, and follow-up fields", () => {
  const followUpDate = new Date("2026-09-15T00:00:00.000Z");
  const request = new HealthRequest(
    baseRequest({
      handlingMethod: "advice",
      advice: "Keep the animal hydrated and monitor appetite.",
      technicianNote: "Review again if symptoms worsen.",
      followUpDate,
    }),
  );

  assert.equal(request.validateSync(), undefined);
  const stored = request.toObject();
  assert.equal(stored.advice, "Keep the animal hydrated and monitor appetite.");
  assert.equal(stored.technicianNote, "Review again if symptoms worsen.");
  assert.deepEqual(stored.followUpDate, followUpDate);
});

test("Office Pickup response persists cohesive pickup guidance", () => {
  const request = new HealthRequest(
    baseRequest({
      handlingMethod: "office_pickup",
      advice: "Bring a clean container when collecting the medicine.",
      technicianNote: "Stock reserved under the farmer's name.",
      followUpDate: new Date("2026-09-20T00:00:00.000Z"),
      technicianResponse: {
        pickup: {
          item: "Oral dewormer",
          availabilityConfirmed: true,
          instructions: "Collect from the municipal agriculture office.",
          dosageOrUseInstructions: "Use only as directed at pickup.",
          withdrawalGuidance: "Confirm the withdrawal period when released.",
        },
      },
    }),
  );

  assert.equal(request.validateSync(), undefined);
  const pickup = request.toObject().technicianResponse.pickup;
  assert.equal(pickup.item, "Oral dewormer");
  assert.equal(pickup.availabilityConfirmed, true);
  assert.equal(
    pickup.instructions,
    "Collect from the municipal agriculture office.",
  );
  assert.equal(pickup.dosageOrUseInstructions, "Use only as directed at pickup.");
  assert.equal(
    pickup.withdrawalGuidance,
    "Confirm the withdrawal period when released.",
  );
  assert.equal(request.withdrawalPeriodDays, undefined);
  assert.equal(request.withdrawalEndDate, undefined);
});

test("Farm Visit continues to use existing schedule fields", () => {
  const scheduledDate = new Date("2026-09-18T00:00:00.000Z");
  const request = new HealthRequest(
    baseRequest({
      handlingMethod: "farm_visit",
      scheduledDate,
      visitPeriod: "Afternoon",
    }),
  );

  assert.equal(request.validateSync(), undefined);
  assert.deepEqual(request.scheduledDate, scheduledDate);
  assert.equal(request.visitPeriod, "afternoon");
  assert.equal(request.technicianResponse, undefined);
});

test("storing response data has no MedicalRecord creation side effect", async () => {
  const originalCreate = MedicalRecord.create;
  let createCalls = 0;
  MedicalRecord.create = async () => {
    createCalls += 1;
  };

  try {
    const request = new HealthRequest(
      baseRequest({
        handlingMethod: "office_pickup",
        technicianResponse: {
          pickup: { item: "Dewormer", availabilityConfirmed: true },
        },
      }),
    );
    await request.validate();
    assert.equal(createCalls, 0);
  } finally {
    MedicalRecord.create = originalCreate;
  }
});

test("legacy clinical fields remain readable", () => {
  const request = new HealthRequest(
    baseRequest({
      findings: "Mild dehydration",
      diagnosis: "Digestive upset",
      treatment: "Supportive care",
      medicineGiven: "Electrolytes",
      dosage: "As directed",
      advice: "Provide clean water",
      resolutionNotes: "Condition improved",
      technicianNote: "Internal observation",
    }),
  ).toObject();

  for (const field of [
    "findings",
    "diagnosis",
    "treatment",
    "medicineGiven",
    "dosage",
    "advice",
    "resolutionNotes",
    "technicianNote",
  ]) {
    assert.equal(typeof request[field], "string");
    assert.notEqual(request[field], "");
  }
});

test("Farmer presentation hides internal notes while retaining public response", () => {
  const request = {
    _id: "health-privacy-1",
    handlingMethod: "office_pickup",
    advice: "Medicine is ready for collection.",
    technicianNote: "Internal stock reference 42.",
    technicianResponse: {
      pickup: {
        item: "Dewormer",
        availabilityConfirmed: true,
        instructions: "Collect at Window 2.",
      },
    },
    followUpDate: new Date("2026-09-20T00:00:00.000Z"),
    statusHistory: [
      {
        status: "approved",
        note: "Internal stock reference 42.",
        actorId: "technician-1",
        createdAt: new Date("2026-09-10T00:00:00.000Z"),
      },
    ],
  };

  const farmer = buildFarmerHealthRequest(request);
  assert.equal("technicianNote" in farmer, false);
  assert.equal(farmer.advice, "Medicine is ready for collection.");
  assert.equal(farmer.technicianResponse.pickup.item, "Dewormer");
  assert.deepEqual(Object.keys(farmer.statusHistory[0]).sort(), [
    "createdAt",
    "status",
  ]);
  assert.doesNotMatch(JSON.stringify(farmer), /Internal stock reference 42/);

  const technician = buildTechnicianHealthRequest(request);
  assert.equal(technician.technicianNote, "Internal stock reference 42.");
  assert.equal(technician.statusHistory[0].note, "Internal stock reference 42.");
});

test("role-shaped detail responses enforce the internal-note privacy boundary", async () => {
  const originalFindOne = HealthRequest.findOne;
  const requestRecord = {
    _id: "health-role-shape-1",
    farmerId: { _id: "farmer-1", name: "Farmer One" },
    animalId: { _id: "animal-1", earTag: "COW-1" },
    handledBy: { _id: "technician-1", name: "Technician One" },
    assignedTechnicianId: null,
    status: "approved",
    handlingMethod: "advice",
    advice: "Continue monitoring appetite.",
    requestDetails: {
      version: 1,
      assistanceRequested: "health_concern",
      observedSigns: ["not_eating_normally"],
      farmerDescription: "Eating less since yesterday.",
    },
    technicianNote: "Internal differential diagnosis.",
    statusHistory: [
      {
        status: "approved",
        note: "Internal differential diagnosis.",
        actorId: "technician-1",
      },
    ],
  };

  const response = () => ({
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  });

  try {
    HealthRequest.findOne = () => {
      const query = {
        populate: () => query,
        lean: async () => requestRecord,
      };
      return query;
    };

    const farmerResponse = response();
    await getHealthRequestDetail(
      {
        params: { id: requestRecord._id },
        user: { _id: "farmer-1", role: "farmer" },
      },
      farmerResponse,
    );
    assert.equal(farmerResponse.statusCode, 200);
    assert.equal(farmerResponse.payload.data.advice, requestRecord.advice);
    assert.deepEqual(
      farmerResponse.payload.data.requestDetails,
      requestRecord.requestDetails,
    );
    assert.equal("technicianNote" in farmerResponse.payload.data, false);
    assert.doesNotMatch(
      JSON.stringify(farmerResponse.payload),
      /Internal differential diagnosis/,
    );

    const technicianResponse = response();
    await getHealthRequestDetail(
      {
        params: { id: requestRecord._id },
        user: { _id: "technician-1", role: "technician" },
      },
      technicianResponse,
    );
    assert.equal(technicianResponse.statusCode, 200);
    assert.equal(
      technicianResponse.payload.data.technicianNote,
      "Internal differential diagnosis.",
    );
    assert.deepEqual(
      technicianResponse.payload.data.requestDetails,
      requestRecord.requestDetails,
    );
  } finally {
    HealthRequest.findOne = originalFindOne;
  }
});

test("resolved Health detail exposes report identity only for a real MedicalRecord", async () => {
  const originalHealthFindOne = HealthRequest.findOne;
  const originalMedicalFindOne = MedicalRecord.findOne;
  const response = () => ({
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  });
  let currentRequest;
  let medicalLookupCount = 0;

  try {
    HealthRequest.findOne = () => {
      const query = {
        populate: () => query,
        lean: async () => currentRequest,
      };
      return query;
    };
    MedicalRecord.findOne = () => {
      medicalLookupCount += 1;
      const query = {
        select: () => query,
        lean: async () => ({ _id: "medical-clinical-1" }),
      };
      return query;
    };

    currentRequest = {
      _id: "health-advice-1",
      farmerId: { _id: "farmer-1" },
      animalId: { _id: "animal-1" },
      handledBy: { _id: "technician-1" },
      status: "resolved",
      handlingMethod: "advice",
      advice: "Monitor appetite.",
    };
    const adviceResponse = response();
    await getHealthRequestDetail(
      {
        params: { id: currentRequest._id },
        user: { _id: "farmer-1", role: "farmer" },
      },
      adviceResponse,
    );
    assert.equal(adviceResponse.payload.data.medicalRecordId, null);
    assert.equal(medicalLookupCount, 0);

    currentRequest = {
      ...currentRequest,
      _id: "health-clinical-1",
      handlingMethod: "farm_visit",
    };
    const clinicalResponse = response();
    await getHealthRequestDetail(
      {
        params: { id: currentRequest._id },
        user: { _id: "farmer-1", role: "farmer" },
      },
      clinicalResponse,
    );
    assert.equal(
      clinicalResponse.payload.data.medicalRecordId,
      "medical-clinical-1",
    );
    assert.equal(medicalLookupCount, 1);
  } finally {
    HealthRequest.findOne = originalHealthFindOne;
    MedicalRecord.findOne = originalMedicalFindOne;
  }
});

test("activeCaseKey lifecycle behavior remains unchanged", async () => {
  const animalId = new mongoose.Types.ObjectId();
  const pending = new HealthRequest(
    baseRequest({ animalId, requestType: "medicine", status: "pending" }),
  );
  await pending.validate();
  assert.equal(
    pending.activeCaseKey,
    activeHealthCaseKey(animalId, "medicine"),
  );

  pending.status = "resolved";
  await pending.validate();
  assert.equal(pending.activeCaseKey, undefined);
});

test("existing request creation guard keeps its payload and duplicate key contract", async () => {
  const originalFindOne = HealthRequest.findOne;
  const originalCreate = HealthRequest.create;
  let createdPayload;

  try {
    HealthRequest.findOne = () => ({ sort: async () => null });
    HealthRequest.create = async (payload) => {
      createdPayload = payload;
      return payload;
    };

    const payload = baseRequest({ requestType: "injury", urgency: "high" });
    const result = await createHealthRequestWithGuard(payload);

    assert.equal(result.requestType, "injury");
    assert.equal(result.urgency, "high");
    assert.equal(
      result.activeCaseKey,
      activeHealthCaseKey(payload.animalId, "injury"),
    );
    assert.equal(result.handlingMethod, undefined);
    assert.equal(result.technicianResponse, undefined);
  } finally {
    HealthRequest.findOne = originalFindOne;
    HealthRequest.create = originalCreate;
  }
});
