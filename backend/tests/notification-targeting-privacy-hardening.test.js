import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { Notification } from "../src/models/notification.model.js";
import {
  resolveBreedingObservationTechnicians,
  resolveReproductiveNotificationTechnicians,
  resolveRequestNotificationTechnicians,
} from "../src/services/notification-recipient-authority.service.js";
import { notifyTechniciansOfBreedingObservation } from "../src/services/breeding-observation-notification.service.js";
import { isRequestDetailAuthorized } from "../src/controllers/notification.controllers.js";
import {
  normalizePushNotificationData,
  presentNotificationCopy,
} from "../src/domain/notification-presentation.js";

const technician = (id, overrides = {}) => ({
  _id: id,
  role: "technician",
  status: "active",
  deletedAt: null,
  isVerified: true,
  profileClaimStatus: "claimed",
  dispatchProfile: {
    acceptsNewRequests: true,
    availabilityStatus: "available",
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityCode: "0603034000" }],
  },
  ...overrides,
});

const mockOwnerLookup = (t, users) => {
  t.mock.method(User, "findOne", (query) => ({
    select: async () => users.get(String(query._id)) || null,
  }));
};

test("owned and reassigned request notifications resolve only the current owner", async (t) => {
  const techA = technician("tech-a");
  const techB = technician("tech-b");
  mockOwnerLookup(t, new Map([["tech-a", techA], ["tech-b", techB]]));

  const before = await resolveRequestNotificationTechnicians({
    requestType: "AI",
    request: { status: "scheduled", approvedBy: "tech-a", technicianId: "tech-a" },
  });
  const after = await resolveRequestNotificationTechnicians({
    requestType: "AI",
    request: { status: "scheduled", approvedBy: "tech-b", technicianId: "tech-b" },
  });
  const conflicting = await resolveRequestNotificationTechnicians({
    requestType: "AI",
    request: { status: "scheduled", approvedBy: "tech-a", technicianId: "tech-b" },
  });

  assert.deepEqual(before.map((item) => String(item._id)), ["tech-a"]);
  assert.deepEqual(after.map((item) => String(item._id)), ["tech-b"]);
  assert.deepEqual(conflicting, []);
});

test("unassigned request and breeding-review targeting use canonical dispatch eligibility", async (t) => {
  const eligible = technician("eligible");
  const offDuty = technician("off-duty", {
    dispatchProfile: {
      ...technician("x").dispatchProfile,
      acceptsNewRequests: false,
      availabilityStatus: "off_duty",
    },
  });
  const wrongArea = technician("wrong-area", {
    dispatchProfile: {
      ...technician("x").dispatchProfile,
      serviceMunicipalities: [{ municipalityCode: "0603022000" }],
    },
  });
  const wrongCapability = technician("wrong-capability", {
    dispatchProfile: {
      ...technician("x").dispatchProfile,
      serviceCapabilities: ["HEALTH"],
    },
  });
  t.mock.method(User, "find", () => ({
    lean: async () => [eligible, offDuty, wrongArea, wrongCapability],
  }));

  const request = {
    status: "pending",
    dispatch: {
      stage: "local",
      location: { municipalityCode: "0603034000" },
    },
  };
  const requestRecipients = await resolveRequestNotificationTechnicians({
    requestType: "AI",
    request,
    allowUnassignedDispatch: true,
  });
  const observationRecipients = await resolveBreedingObservationTechnicians({
    task: { _id: "review-task" },
    insemination: request,
    technicianActionRequired: true,
  });

  assert.deepEqual(requestRecipients.map((item) => item._id), ["eligible"]);
  assert.deepEqual(observationRecipients.map((item) => item._id), ["eligible"]);
});

test("breeding and calving continuity prefer explicit workflow Task ownership", async (t) => {
  const owner = technician("task-owner");
  mockOwnerLookup(t, new Map([["task-owner", owner], ["ai-owner", technician("ai-owner")]]));

  const observation = await resolveBreedingObservationTechnicians({
    task: { _id: "task-1", technicianId: "task-owner" },
    insemination: { approvedBy: "ai-owner", technicianId: "ai-owner" },
    technicianActionRequired: true,
  });
  const calving = await resolveReproductiveNotificationTechnicians({
    task: { _id: "task-2", technicianId: "task-owner" },
    pregnancy: { _id: "pregnancy-1", confirmation: { confirmedBy: "ai-owner" } },
    insemination: { _id: "ai-1", approvedBy: "ai-owner", technicianId: "ai-owner" },
  });

  assert.deepEqual(observation.map((item) => item._id), ["task-owner"]);
  assert.deepEqual(calving.map((item) => item._id), ["task-owner"]);
});

test("unresolved reproductive work fails closed without a role-wide fallback", async () => {
  const observation = await resolveBreedingObservationTechnicians({
    task: null,
    insemination: {},
    technicianActionRequired: false,
  });
  const calving = await resolveReproductiveNotificationTechnicians({
    pregnancy: {},
    insemination: {},
    calving: {},
  });

  assert.deepEqual(observation, []);
  assert.deepEqual(calving, []);
});

test("notification linked request details follow current ownership and reassignment", () => {
  const userA = technician("tech-a");
  const userB = technician("tech-b");
  const ownedByA = {
    status: "scheduled",
    approvedBy: "tech-a",
    technicianId: "tech-a",
  };
  const reassignedToB = {
    status: "scheduled",
    approvedBy: "tech-b",
    technicianId: "tech-b",
  };

  assert.equal(isRequestDetailAuthorized({ user: userA, request: ownedByA, requestType: "AI" }), true);
  assert.equal(isRequestDetailAuthorized({ user: userB, request: ownedByA, requestType: "AI" }), false);
  assert.equal(isRequestDetailAuthorized({ user: userA, request: reassignedToB, requestType: "AI" }), false);
  assert.equal(isRequestDetailAuthorized({ user: userB, request: reassignedToB, requestType: "AI" }), true);
});

test("push payload keeps routing IDs and drops private workflow metadata", () => {
  const payload = normalizePushNotificationData({
    type: "health",
    eventType: "health_advice_available",
    requestId: 123,
    animalId: 456,
    phoneNumber: "09171234567",
    exactFarmGps: "10.123,122.456",
    technicianNote: "Internal note",
    symptoms: "Private description",
  });

  assert.equal(payload.type, "health-request");
  assert.equal(payload.requestId, "123");
  assert.equal(payload.animalId, "456");
  assert.equal(payload.phoneNumber, undefined);
  assert.equal(payload.exactFarmGps, undefined);
  assert.equal(payload.technicianNote, undefined);
  assert.equal(payload.symptoms, undefined);

  const farmerCopy = presentNotificationCopy({
    eventType: "health_advice_available",
    metadata: {
      animalTag: "TAG-1",
      technicianNote: "Internal clinical coordination note",
    },
  });
  assert.doesNotMatch(farmerCopy.title, /Internal clinical/i);
  assert.doesNotMatch(farmerCopy.message, /Internal clinical/i);
});

test("breeding observation notification failure is best-effort after the clinical write", async (t) => {
  mockOwnerLookup(t, new Map([["tech-a", technician("tech-a")]]));
  t.mock.method(Notification, "findOneAndUpdate", async () => {
    throw new Error("notification store unavailable");
  });

  const result = await notifyTechniciansOfBreedingObservation({
    farmer: { _id: "farmer-1", name: "Farmer" },
    animal: { _id: "animal-1", earTag: "TAG-1" },
    insemination: {
      _id: "ai-1",
      approvedBy: "tech-a",
      technicianId: "tech-a",
    },
    task: { _id: "task-1", technicianId: "tech-a" },
    reportType: "return_to_heat",
    technicianActionRequired: true,
  });

  assert.deepEqual(result, []);
});
