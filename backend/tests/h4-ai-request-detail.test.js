import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCandidateAIDetail,
  buildTechnicianCandidateAIDetail,
  getAIRequestDetail,
} from "../src/controllers/ai-request.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";

test("H4 candidate AI detail supports review-first scheduling with safe request data", () => {
  const candidate = buildCandidateAIDetail({
    _id: "66b5f16a1f0d2c3b4a596877",
    type: "ai",
    status: "pending",
    urgency: "normal",
    heatSigns: ["Standing heat", "Clear mucus"],
    comment: "Observed signs this morning.",
    imageUrl: " https://example.test/heat-sign.jpg ",
    photos: [
      "https://example.test/heat-sign.jpg",
      "https://example.test/standing-heat.jpg",
    ],
    createdAt: "2026-08-07T06:00:00.000Z",
    attemptNumber: 2,
    previousAttemptId: {
      _id: "attempt-1",
      attemptNumber: 1,
      outcome: "Failed (Re-heat)",
    },
    animalId: {
      _id: "animal-1",
      earTag: "01DP",
      breed: "Bali Cattle",
      species: "Cattle",
    },
    farmerId: {
      name: "Maria Farmer",
      phoneNumber: "09171234567",
      address: {
        houseNumber: "14",
        street: "Private Road",
        barangay: "Buray",
        municipality: "Oton",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        directionsNote: "Private directions",
      },
    },
  });

  assert.equal(candidate.workflowId, "66b5f16a1f0d2c3b4a596877");
  assert.equal(candidate.workflowType, "AI");
  assert.equal(candidate.allowedAction, "CLAIM_AND_SCHEDULE");
  assert.equal(candidate.actionLabel, "Accept & Set Visit");
  assert.equal(candidate.farmerName, "Maria Farmer");
  assert.equal(candidate.barangay, "Buray");
  assert.equal(candidate.municipality, "Oton");
  assert.deepEqual(candidate.heatSigns, ["Standing heat", "Clear mucus"]);
  assert.equal(candidate.farmerNotes, "Observed signs this morning.");
  assert.equal(candidate.comment, "Observed signs this morning.");
  assert.equal(candidate.imageUrl, "https://example.test/heat-sign.jpg");
  assert.deepEqual(candidate.photos, [
    "https://example.test/heat-sign.jpg",
    "https://example.test/standing-heat.jpg",
  ]);
  assert.equal(candidate.requestKind, "re_insemination");
  assert.equal(candidate.attemptNumber, 2);
  assert.equal(candidate.previousAttemptId._id, "attempt-1");
  assert.equal(candidate.previousAttemptId.outcome, "Failed (Re-heat)");

  for (const privateField of [
    "farmerId",
    "phoneNumber",
    "phone",
    "address",
    "farmLocation",
    "latitude",
    "longitude",
    "directionsNote",
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(candidate, privateField),
      false,
      `${privateField} must not be present in candidate detail`,
    );
  }

  assert.doesNotMatch(
    JSON.stringify(candidate),
    /09171234567|Private Road|Private directions|10\.7|122\.5/,
  );
});

test("H4 authenticated technician AI candidate includes review contact and location", () => {
  const candidate = buildTechnicianCandidateAIDetail({
    _id: "66b5f16a1f0d2c3b4a596880",
    type: "ai",
    status: "pending",
    farmerId: {
      _id: "farmer-1",
      name: "Maria Farmer",
      phoneNumber: "09171234567",
      address: {
        houseNumber: "14",
        street: "Farm Road",
        barangay: "Buray",
        municipality: "Oton",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        landmark: "Beside the covered court",
        directionsNote: "Use the east gate",
      },
    },
  });

  assert.equal(candidate.farmerId.name, "Maria Farmer");
  assert.equal(candidate.farmerId.phoneNumber, "09171234567");
  assert.equal(candidate.farmerId.address.street, "Farm Road");
  assert.equal(candidate.farmerId.farmLocation.latitude, 10.7);
  assert.equal(candidate.farmerId.farmLocation.directionsNote, "Use the east gate");
});

test("H4 candidate AI detail prefers canonical dispatch locality", () => {
  const candidate = buildCandidateAIDetail({
    _id: "66b5f16a1f0d2c3b4a596878",
    type: "ai",
    status: "pending",
    farmerId: {
      name: "Safe Farmer",
      address: { barangay: "Legacy Barangay", city: "Legacy City" },
    },
    dispatch: {
      location: {
        barangayName: "Cabugao Norte",
        municipalityName: "Santa Barbara",
      },
    },
  });

  assert.equal(candidate.barangay, "Cabugao Norte");
  assert.equal(candidate.municipality, "Santa Barbara");
});

test("H4 unclaimed technician AI detail response includes review contact and location", async () => {
  const originalFindOne = Insemination.findOne;
  const requestRecord = {
    _id: "66b5f16a1f0d2c3b4a596879",
    type: "ai",
    status: "pending",
    urgency: "normal",
    heatSigns: ["Standing heat"],
    comment: "Farmer-submitted note",
    imageUrl: "https://example.test/ai.jpg",
    photos: [
      "https://example.test/ai.jpg",
      "https://example.test/ai-side.jpg",
    ],
    animalId: { earTag: "01DP", breed: "Bali Cattle" },
    farmerId: {
      name: "Candidate Farmer",
      phoneNumber: "09170000000",
      address: {
        houseNumber: "88",
        street: "Hidden Street",
        barangay: "Buray",
        municipality: "Oton",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        directionsNote: "Hidden directions",
      },
    },
    approvedBy: null,
    technicianId: null,
    createdAt: "2026-08-07T06:00:00.000Z",
    updatedAt: "2026-08-07T06:05:00.000Z",
  };
  const requestDocument = {
    ...requestRecord,
    toObject: () => ({ ...requestRecord }),
  };

  try {
    Insemination.findOne = () => {
      const query = {
        populate: () => query,
        then: (resolve) => resolve(requestDocument),
      };
      return query;
    };

    const req = {
      params: { id: requestRecord._id },
      user: { _id: "technician-1", role: "technician" },
    };
    const res = {
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
    };

    await getAIRequestDetail(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.farmerName, "Candidate Farmer");
    assert.equal(res.payload.barangay, "Buray");
    assert.equal(res.payload.municipality, "Oton");
    assert.equal(res.payload.farmerNotes, "Farmer-submitted note");
    assert.equal(res.payload.imageUrl, "https://example.test/ai.jpg");
    assert.deepEqual(res.payload.photos, [
      "https://example.test/ai.jpg",
      "https://example.test/ai-side.jpg",
    ]);
    assert.equal(res.payload.farmerId.name, "Candidate Farmer");
    assert.equal(res.payload.farmerId.phoneNumber, "09170000000");
    assert.equal(res.payload.farmerId.address.street, "Hidden Street");
    assert.equal(res.payload.farmerId.farmLocation.latitude, 10.7);
    assert.equal(
      res.payload.farmerId.farmLocation.directionsNote,
      "Hidden directions",
    );
  } finally {
    Insemination.findOne = originalFindOne;
  }
});

test("H4 assigned legacy AI detail presents a canonical status without rewriting the record", async () => {
  const originalFindOne = Insemination.findOne;
  const storedStatus = "awaiting-result";
  const requestRecord = {
    _id: "66b5f16a1f0d2c3b4a596881",
    status: storedStatus,
    animalId: { earTag: "01DP", breed: "Bali Cattle" },
    farmerId: { _id: "farmer-1", name: "Maria Farmer" },
    approvedBy: { _id: "technician-1", name: "Assigned Tech" },
    technicianId: { _id: "technician-1", name: "Assigned Tech" },
  };
  const requestDocument = {
    ...requestRecord,
    toObject: () => ({ ...requestRecord }),
  };

  try {
    Insemination.findOne = () => {
      const query = {
        populate: () => query,
        then: (resolve) => resolve(requestDocument),
      };
      return query;
    };

    const res = {
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
    };

    await getAIRequestDetail(
      {
        params: { id: requestRecord._id },
        user: { _id: "technician-1", role: "technician" },
      },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.status, "in-progress");
    assert.equal(requestDocument.status, storedStatus);
  } finally {
    Insemination.findOne = originalFindOne;
  }
});
