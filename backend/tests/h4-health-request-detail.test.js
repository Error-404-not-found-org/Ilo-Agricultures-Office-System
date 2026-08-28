import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCandidateHealthDetail,
  buildTechnicianCandidateHealthDetail,
  getHealthRequestDetail,
} from "../src/controllers/health-workflow.controllers.js";
import { HealthRequest } from "../src/models/health-request.model.js";

test("H4 candidate Health detail exposes decision-safe request and locality fields", () => {
  const candidate = buildCandidateHealthDetail({
    _id: "health-1",
    requestType: "injury",
    status: "pending",
    urgency: "high",
    symptoms: ["Swollen leg", "Limping"],
    farmerNotes: "Started after grazing.",
    requestDetails: {
      version: 1,
      assistanceRequested: "medicine_request",
      observedSigns: ["diarrhea", "not_eating_normally"],
      farmerDescription: "Started after grazing.",
    },
    photos: [" https://example.test/leg.jpg ", "", null],
    imageUrl: "https://example.test/overview.jpg",
    createdAt: "2026-08-07T06:00:00.000Z",
    updatedAt: "2026-08-07T06:05:00.000Z",
    animalId: { _id: "animal-1", earTag: "CAT-200", breed: "Brahman" },
    farmerId: {
      _id: "farmer-1",
      name: "Maria Clara",
      phoneNumber: "09171234567",
      address: {
        houseNumber: "14",
        street: "Private Road",
        barangay: "Balabag",
        city: "Pavia",
        coordinates: { lat: 10.77, lng: 122.54 },
      },
      farmLocation: {
        latitude: 10.77,
        longitude: 122.54,
        landmark: "Private landmark",
        directionsNote: "Turn after the private gate",
      },
    },
  });

  assert.equal(candidate.farmerName, "Maria Clara");
  assert.equal(candidate.barangay, "Balabag");
  assert.equal(candidate.municipality, "Pavia");
  assert.deepEqual(candidate.symptoms, ["Swollen leg", "Limping"]);
  assert.equal(candidate.farmerNotes, "Started after grazing.");
  assert.deepEqual(candidate.requestDetails, {
    version: 1,
    assistanceRequested: "medicine_request",
    observedSigns: ["diarrhea", "not_eating_normally"],
    farmerDescription: "Started after grazing.",
  });
  assert.deepEqual(candidate.photos, ["https://example.test/leg.jpg"]);
  assert.equal(candidate.imageUrl, "https://example.test/overview.jpg");
});

test("H4 authenticated technician Health candidate includes review contact and location", () => {
  const candidate = buildTechnicianCandidateHealthDetail({
    _id: "health-technician-1",
    requestType: "checkup",
    status: "pending",
    farmerId: {
      _id: "farmer-1",
      name: "Juan Dela Cruz",
      phoneNumber: "09999999999",
      address: {
        houseNumber: "9",
        street: "Farm Street",
        barangay: "Jibao-an",
        city: "Pavia",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        landmark: "Near the chapel",
        directionsNote: "Enter at the north gate",
      },
    },
  });

  assert.equal(candidate.farmerId.name, "Juan Dela Cruz");
  assert.equal(candidate.farmerId.phoneNumber, "09999999999");
  assert.equal(candidate.farmerId.address.street, "Farm Street");
  assert.equal(candidate.farmerId.farmLocation.longitude, 122.5);
  assert.equal(candidate.farmerId.farmLocation.landmark, "Near the chapel");
});

test("H4 candidate Health detail does not expose private contact or exact farm data", () => {
  const candidate = buildCandidateHealthDetail({
    _id: "health-2",
    requestType: "checkup",
    status: "pending",
    urgency: "medium",
    symptoms: "Loss of appetite",
    farmerId: {
      name: "Juan Dela Cruz",
      phoneNumber: "09999999999",
      address: {
        houseNumber: "9",
        street: "Exact Street",
        barangay: "Jibao-an",
        city: "Pavia",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        landmark: "Private landmark",
        directionsNote: "Private directions",
      },
    },
  });

  for (const privateField of [
    "farmerId",
    "phoneNumber",
    "phone",
    "address",
    "farmLocation",
    "latitude",
    "longitude",
    "directionsNote",
    "landmark",
  ]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(candidate, privateField),
      false,
      `${privateField} must not be present in candidate detail`,
    );
  }

  const serialized = JSON.stringify(candidate);
  assert.doesNotMatch(serialized, /09999999999|Exact Street|Private landmark|Private directions|10\.7|122\.5/);
});

test("H4 candidate Health detail prefers canonical dispatch locality without leaking location detail", () => {
  const candidate = buildCandidateHealthDetail({
    _id: "health-3",
    requestType: "other",
    status: "pending",
    urgency: "low",
    symptoms: "Observation requested",
    farmerId: {
      name: "Ana Farmer",
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

test("H4 unclaimed technician Health detail includes review contact and location", async () => {
  const originalFindOne = HealthRequest.findOne;
  const requestRecord = {
    _id: "health-4",
    requestType: "wound",
    status: "pending",
    urgency: "high",
    symptoms: "Open wound on rear leg",
    farmerNotes: "Cleaned with water.",
    photos: ["https://example.test/wound.jpg"],
    imageUrl: "",
    animalId: { _id: "animal-4", earTag: "CAT-404" },
    farmerId: {
      _id: "farmer-4",
      name: "Safe Farmer Name",
      phoneNumber: "09170000000",
      address: {
        houseNumber: "88",
        street: "Hidden Street",
        barangay: "Balabag",
        city: "Pavia",
      },
      farmLocation: {
        latitude: 10.7,
        longitude: 122.5,
        directionsNote: "Hidden directions",
      },
    },
    handledBy: null,
    assignedTechnicianId: null,
    createdAt: "2026-08-07T06:00:00.000Z",
    updatedAt: "2026-08-07T06:05:00.000Z",
  };

  try {
    HealthRequest.findOne = () => {
      const query = {
        populate: () => query,
        lean: async () => requestRecord,
      };
      return query;
    };

    const req = {
      params: { id: "health-4" },
      user: { _id: "technician-4", role: "technician" },
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

    await getHealthRequestDetail(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.data.farmerName, "Safe Farmer Name");
    assert.equal(res.payload.data.barangay, "Balabag");
    assert.equal(res.payload.data.municipality, "Pavia");
    assert.equal(res.payload.data.farmerNotes, "Cleaned with water.");
    assert.deepEqual(res.payload.data.photos, ["https://example.test/wound.jpg"]);
    assert.equal(res.payload.data.farmerId.name, "Safe Farmer Name");
    assert.equal(res.payload.data.farmerId.phoneNumber, "09170000000");
    assert.equal(res.payload.data.farmerId.address.street, "Hidden Street");
    assert.equal(res.payload.data.farmerId.farmLocation.latitude, 10.7);
    assert.equal(
      res.payload.data.farmerId.farmLocation.directionsNote,
      "Hidden directions",
    );
  } finally {
    HealthRequest.findOne = originalFindOne;
  }
});
