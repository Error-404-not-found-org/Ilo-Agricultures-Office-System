import assert from "node:assert/strict";
import test from "node:test";

import {
  reassignTechnicianRequest,
  updateTechnicianDispatchProfile,
} from "../src/controllers/admin.controllers.js";
import { presentUserDetailForRequester } from "../src/controllers/user.controllers.js";
import { Insemination } from "../src/models/insemination.model.js";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

const populatedQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

const readyTechnician = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439055",
  name: "Eligible Technician",
  role: "technician",
  status: "active",
  deletedAt: null,
  isVerified: true,
  profileClaimStatus: "claimed",
  dispatchProfile: {
    acceptsNewRequests: true,
    availabilityStatus: "available",
    serviceCapabilities: ["AI", "HEALTH"],
    serviceMunicipalities: [{ municipalityCode: "063034000" }],
  },
  ...overrides,
});

test("Admin reassignment preserves lifecycle status and changes only active ownership", async (t) => {
  const originals = {
    findOne: Insemination.findOne,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    userFindById: User.findById,
    auditCreate: AuditLog.create,
  };
  t.after(() => {
    Insemination.findOne = originals.findOne;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.userFindById;
    AuditLog.create = originals.auditCreate;
  });

  const currentOwner = "507f1f77bcf86cd799439044";
  const request = {
    _id: "507f1f77bcf86cd799439001",
    status: "scheduled",
    approvedBy: currentOwner,
    technicianId: null,
    dispatch: {
      stage: "local",
      location: { municipalityCode: "063034000" },
    },
  };
  let capturedFilter;
  let capturedUpdate;
  let capturedAudit;
  Insemination.findOne = () => ({ lean: async () => request });
  User.findById = () => ({
    select() {
      return this;
    },
    lean: async () => readyTechnician(),
  });
  Insemination.findOneAndUpdate = (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return populatedQuery({
      ...request,
      status: "scheduled",
      approvedBy: readyTechnician()._id,
    });
  };
  AuditLog.create = async (entry) => {
    capturedAudit = entry;
    return entry;
  };

  const recorder = responseRecorder();
  await reassignTechnicianRequest(
    {
      params: { type: "ai", id: request._id },
      body: { technicianId: readyTechnician()._id },
      user: { _id: "507f1f77bcf86cd799439099", role: "admin" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.request.status, "scheduled");
  assert.equal(capturedFilter.status, "scheduled");
  assert.equal(String(capturedUpdate.$set.approvedBy), readyTechnician()._id);
  assert.equal(capturedUpdate.$set.status, undefined);
  assert.equal(capturedAudit.action, "admin_reassigned_request");
});

test("Admin reassignment rejects terminal work and an ineligible target", async (t) => {
  const originals = {
    findOne: Insemination.findOne,
    findOneAndUpdate: Insemination.findOneAndUpdate,
    userFindById: User.findById,
  };
  t.after(() => {
    Insemination.findOne = originals.findOne;
    Insemination.findOneAndUpdate = originals.findOneAndUpdate;
    User.findById = originals.userFindById;
  });
  let writeCalled = false;
  Insemination.findOneAndUpdate = () => {
    writeCalled = true;
    return populatedQuery(null);
  };

  Insemination.findOne = () => ({
    lean: async () => ({
      _id: "507f1f77bcf86cd799439001",
      status: "done",
      approvedBy: "507f1f77bcf86cd799439044",
    }),
  });
  let recorder = responseRecorder();
  await reassignTechnicianRequest(
    {
      params: { type: "ai", id: "507f1f77bcf86cd799439001" },
      body: { technicianId: readyTechnician()._id },
      user: { _id: "507f1f77bcf86cd799439099", role: "admin" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "TERMINAL_REQUEST_CANNOT_BE_REASSIGNED");

  Insemination.findOne = () => ({
    lean: async () => ({
      _id: "507f1f77bcf86cd799439001",
      status: "scheduled",
      approvedBy: "507f1f77bcf86cd799439044",
      dispatch: {
        stage: "local",
        location: { municipalityCode: "063034000" },
      },
    }),
  });
  User.findById = () => ({
    select() {
      return this;
    },
    lean: async () =>
      readyTechnician({
        dispatchProfile: {
          ...readyTechnician().dispatchProfile,
          serviceCapabilities: ["HEALTH"],
        },
      }),
  });
  recorder = responseRecorder();
  await reassignTechnicianRequest(
    {
      params: { type: "ai", id: "507f1f77bcf86cd799439001" },
      body: { technicianId: readyTechnician()._id },
      user: { _id: "507f1f77bcf86cd799439099", role: "admin" },
    },
    recorder.response,
  );
  assert.equal(recorder.statusCode, 403);
  assert.equal(recorder.body.code, "SERVICE_CAPABILITY_REQUIRED");
  assert.equal(writeCalled, false);
});

test("Admin coverage updates never change Technician-owned availability", async (t) => {
  const originalFindById = User.findById;
  t.after(() => {
    User.findById = originalFindById;
  });
  const technician = readyTechnician();
  technician.dispatchProfile.profileVersion = 1;
  technician.save = async () => technician;
  User.findById = async () => technician;

  const recorder = responseRecorder();
  await updateTechnicianDispatchProfile(
    {
      params: { id: technician._id },
      body: {
        serviceMunicipalities: [
          {
            municipalityCode: "063034000",
            municipalityName: "Oton",
            localityType: "municipality",
            provinceCode: "063000000",
            provinceName: "Iloilo",
          },
        ],
        serviceCapabilities: ["AI"],
      },
      user: { _id: "507f1f77bcf86cd799439099", role: "admin" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(technician.dispatchProfile.acceptsNewRequests, true);
  assert.equal(technician.dispatchProfile.availabilityStatus, "available");
  assert.deepEqual(technician.dispatchProfile.serviceCapabilities, ["AI"]);
  assert.equal(
    technician.dispatchProfile.serviceMunicipalities[0].municipalityCode,
    "0603034000",
  );
  assert.equal(
    technician.dispatchProfile.serviceMunicipalities[0].source,
    "admin_assigned",
  );
});

test("Technician user detail projection excludes identity and dispatch internals", () => {
  const target = {
    _id: "farmer-1",
    role: "farmer",
    name: "Farmer One",
    email: "farmer@example.com",
    phoneNumber: "09171234567",
    clerkId: "clerk-secret",
    pushToken: "push-secret",
    profileClaimedByClerkId: "claim-secret",
    phoneVerification: { pendingPhoneNumber: "09170000000" },
    dispatchProfile: { acceptsNewRequests: true },
    deletedAt: null,
  };
  const presented = presentUserDetailForRequester({
    requester: { _id: "technician-1", role: "technician" },
    target,
  });
  assert.equal(presented.name, "Farmer One");
  assert.equal(presented.phoneNumber, "09171234567");
  assert.equal(presented.clerkId, undefined);
  assert.equal(presented.pushToken, undefined);
  assert.equal(presented.profileClaimedByClerkId, undefined);
  assert.equal(presented.phoneVerification, undefined);
  assert.equal(presented.dispatchProfile, undefined);

  const adminView = presentUserDetailForRequester({
    requester: { role: "admin" },
    target,
  });
  assert.equal(adminView.clerkId, "clerk-secret");
});
