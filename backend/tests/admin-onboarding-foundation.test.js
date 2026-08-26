import assert from "node:assert/strict";
import test from "node:test";

import { ENV } from "../src/config/env.js";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import {
  buildNewTechnicianProfile,
  buildTechnicianInvitationPayload,
  normalizeTechnicianRegistrationDispatch,
  createTechnician,
  getUsers,
  toTechnicianFarmerDirectoryEntry,
} from "../src/controllers/user.controllers.js";

const technicianRequest = (email = "tech@example.test") => ({
  body: {
    firstName: "Tech",
    lastName: "One",
    email,
    phoneNumber: "",
    address: {
      city: "Oton",
      barangay: "Poblacion",
      province: "Iloilo",
    },
    serviceMunicipalities: [
      {
        municipalityCode: "0603034000",
        municipalityName: "Oton",
        localityType: "municipality",
        provinceCode: "0603000000",
        provinceName: "Iloilo",
      },
    ],
    serviceCapabilities: ["AI", "HEALTH"],
  },
  user: {
    _id: "507f1f77bcf86cd799439099",
    role: "admin",
    email: "admin@example.test",
  },
  app: { get: () => null },
});

const installTechnicianOnboardingMocks = (t, { existingUser = null } = {}) => {
  const originals = {
    findOne: User.findOne,
    create: User.create,
    auditCreate: AuditLog.create,
    clerkGetUserList: clerkClient.users.getUserList,
    clerkCreateInvitation: clerkClient.invitations.createInvitation,
    clerkRevokeInvitation: clerkClient.invitations.revokeInvitation,
  };
  t.after(() => {
    User.findOne = originals.findOne;
    User.create = originals.create;
    AuditLog.create = originals.auditCreate;
    clerkClient.users.getUserList = originals.clerkGetUserList;
    clerkClient.invitations.createInvitation = originals.clerkCreateInvitation;
    clerkClient.invitations.revokeInvitation = originals.clerkRevokeInvitation;
  });

  let createdCount = 0;
  let invitationPayload;
  User.findOne = async (query) => (query.email ? existingUser : null);
  User.create = async (payload) => {
    createdCount += 1;
    return { _id: "507f1f77bcf86cd799439011", ...payload };
  };
  AuditLog.create = async (payload) => payload;
  clerkClient.users.getUserList = async () => ({ data: [] });
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "invitation_test" };
  };
  clerkClient.invitations.revokeInvitation = async () => null;

  return {
    get createdCount() {
      return createdCount;
    },
    get invitationPayload() {
      return invitationPayload;
    },
  };
};

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(payload) {
      recorder.body = payload;
      return this;
    },
  };
  return recorder;
};

const queryResult = (value, onSelect = () => {}) => {
  const query = {
    select(fields) {
      onSelect(fields);
      return query;
    },
    sort() {
      return query;
    },
    skip() {
      return query;
    },
    limit() {
      return query;
    },
    lean() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
  return query;
};

test("Health request routes load with their role guard resolved", async () => {
  const module = await import("../src/routes/health-request.routes.js");
  assert.ok(module.default);
});

test("Farmer directory scope remains limited to Technicians", async () => {
  const recorder = responseRecorder();
  await getUsers(
    { user: { role: "farmer" }, query: { role: "admin" } },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 403);
});

test("Technician directory rejects non-Farmer enumeration", async () => {
  const recorder = responseRecorder();
  await getUsers(
    { user: { role: "technician" }, query: { role: "technician" } },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 403);
});

test("Technician Farmer directory returns only approved operational fields", () => {
  const entry = toTechnicianFarmerDirectoryEntry({
    _id: "farmer-1",
    name: "Farmer One",
    role: "farmer",
    status: "active",
    email: "farmer@example.test",
    phoneNumber: "09170000000",
    address: { barangay: "Poblacion", city: "Oton" },
    farmLocation: { latitude: 10.7, longitude: 122.4 },
    isVerified: true,
    createdAt: new Date("2026-08-22T00:00:00.000Z"),
    clerkId: "user_private",
    profileClaimStatus: "claimed",
    registeredByTechnician: true,
    pushToken: "push-private",
    deletedAt: null,
    dispatchProfile: { acceptsNewRequests: true },
    animalsCount: 4,
    activeCount: 2,
  });

  assert.equal(entry.appAccountStatus, "connected");
  assert.equal(entry.animalsCount, 4);
  assert.equal(entry.clerkId, undefined);
  assert.equal(entry.profileClaimStatus, undefined);
  assert.equal(entry.registeredByTechnician, undefined);
  assert.equal(entry.pushToken, undefined);
  assert.equal(entry.deletedAt, undefined);
  assert.equal(entry.dispatchProfile, undefined);
});

test("Technician GET /api/user forces Farmer scope and a narrow projection", async (t) => {
  const originals = {
    userFind: User.find,
    userCount: User.countDocuments,
  };
  t.after(() => {
    User.find = originals.userFind;
    User.countDocuments = originals.userCount;
  });

  let capturedQuery;
  let capturedProjection;
  User.find = (query) => {
    capturedQuery = query;
    return queryResult([], (projection) => {
      capturedProjection = projection;
    });
  };
  User.countDocuments = async () => 0;

  const recorder = responseRecorder();
  await getUsers(
    {
      user: { role: "technician" },
      query: { page: "1", limit: "10" },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(capturedQuery.role, "farmer");
  assert.match(capturedProjection, /name/);
  assert.match(capturedProjection, /phoneNumber/);
  assert.doesNotMatch(capturedProjection, /pushToken|deletedAt|dispatchProfile/);
});

test("Admin GET /api/user retains management fields without push-token secrets", async (t) => {
  const originals = { userFind: User.find };
  t.after(() => {
    User.find = originals.userFind;
  });

  let capturedProjection;
  User.find = () =>
    queryResult([], (projection) => {
      capturedProjection = projection;
    });

  const recorder = responseRecorder();
  await getUsers(
    { user: { role: "admin" }, query: {} },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(capturedProjection, "-password -pushToken");
});

test("Admin Technician onboarding stores canonical initial dispatch safely", () => {
  const invitationPayload = buildTechnicianInvitationPayload(
    "tech@example.test",
  );
  const createdPayload = buildNewTechnicianProfile({
    fullName: "Tech One",
    email: "tech@example.test",
    phoneNumber: "",
    normalizedPhoneNumber: "",
    address: {
      city: "Oton",
      barangay: "Poblacion",
      province: "Iloilo",
    },
    imageUrl: "",
  });

  assert.equal(createdPayload.role, "technician");
  assert.equal(createdPayload.profileClaimStatus, "unclaimed");
  assert.equal(createdPayload.dispatchProfile.acceptsNewRequests, false);
  assert.equal(createdPayload.dispatchProfile.availabilityStatus, "off_duty");
  assert.equal(
    createdPayload.dispatchProfile.serviceMunicipalities[0].municipalityCode,
    "0603034000",
  );
  assert.equal(
    createdPayload.dispatchProfile.serviceMunicipalities[0].source,
    "technician_registration",
  );
  assert.equal(createdPayload.address.city, "Oton");
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.TECHNICIAN_INVITATION_REDIRECT_URL,
  );
  assert.notEqual(invitationPayload.redirectUrl, ENV.CLIENT_URL);
  assert.equal(invitationPayload.publicMetadata.role, "technician");
  assert.equal(invitationPayload.ignoreExisting, true);
});

test("Technician registration preserves the existing capability vocabulary", () => {
  const dispatch = normalizeTechnicianRegistrationDispatch({
    serviceMunicipalities: [
      {
        municipalityCode: "063034000",
        municipalityName: "Oton",
        provinceName: "Iloilo",
      },
    ],
    serviceCapabilities: ["AI", "HEALTH", "AI"],
  });

  assert.equal(dispatch.serviceMunicipalities[0].municipalityCode, "0603034000");
  assert.deepEqual(dispatch.serviceCapabilities, ["AI", "HEALTH"]);
});

test("fresh Technician email creates one profile and one Clerk invitation", async (t) => {
  const mocks = installTechnicianOnboardingMocks(t);
  const recorder = responseRecorder();

  await createTechnician(technicianRequest(), recorder.response);

  assert.equal(recorder.statusCode, 201);
  assert.equal(mocks.createdCount, 1);
  assert.equal(mocks.invitationPayload.ignoreExisting, true);
  assert.equal(
    mocks.invitationPayload.redirectUrl,
    ENV.TECHNICIAN_INVITATION_REDIRECT_URL,
  );
  assert.equal(mocks.invitationPayload.publicMetadata.role, "technician");
  assert.equal(
    recorder.body.technician.dispatchProfile.serviceMunicipalities[0]
      .municipalityCode,
    "0603034000",
  );
  assert.deepEqual(
    recorder.body.technician.dispatchProfile.serviceCapabilities,
    ["AI", "HEALTH"],
  );
});

test("existing invitation reuses the unclaimed Technician profile without changing dispatch", async (t) => {
  const existing = {
    _id: "507f1f77bcf86cd799439012",
    name: "Existing Technician",
    email: "tech@example.test",
    role: "technician",
    status: "active",
    isVerified: false,
    profileClaimStatus: "unclaimed",
    dispatchProfile: {
      serviceMunicipalities: [
        {
          municipalityCode: "0603034000",
          municipalityName: "Oton",
          source: "technician_registration",
        },
      ],
      serviceCapabilities: ["CALVING"],
      acceptsNewRequests: false,
      availabilityStatus: "off_duty",
    },
  };
  const dispatchBefore = structuredClone(existing.dispatchProfile);
  const mocks = installTechnicianOnboardingMocks(t, { existingUser: existing });
  const recorder = responseRecorder();

  await createTechnician(technicianRequest(), recorder.response);

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.invitationResent, true);
  assert.equal(mocks.createdCount, 0);
  assert.equal(mocks.invitationPayload.ignoreExisting, true);
  assert.equal(
    mocks.invitationPayload.redirectUrl,
    ENV.TECHNICIAN_INVITATION_REDIRECT_URL,
  );
  assert.equal(recorder.body.technician, existing);
  assert.deepEqual(existing.dispatchProfile, dispatchBefore);
  assert.equal(existing.profileClaimStatus, "unclaimed");
});

test("claimed or Clerk-linked Technician email returns an existing-account response", async (t) => {
  const existing = {
    _id: "507f1f77bcf86cd799439013",
    email: "tech@example.test",
    role: "technician",
    status: "active",
    profileClaimStatus: "claimed",
    clerkId: "user_existing",
  };
  const mocks = installTechnicianOnboardingMocks(t, { existingUser: existing });
  const recorder = responseRecorder();

  await createTechnician(technicianRequest(), recorder.response);

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "TECHNICIAN_ACCOUNT_ALREADY_ACTIVE");
  assert.match(recorder.body.message, /sign in/i);
  assert.equal(mocks.createdCount, 0);
  assert.equal(mocks.invitationPayload, undefined);
});

test("an unclaimed profile already linked to Clerk is not treated as a resend", async (t) => {
  const existing = {
    _id: "507f1f77bcf86cd799439014",
    email: "tech@example.test",
    role: "technician",
    status: "active",
    profileClaimStatus: "unclaimed",
    clerkId: "user_existing",
  };
  const mocks = installTechnicianOnboardingMocks(t, { existingUser: existing });
  const recorder = responseRecorder();

  await createTechnician(technicianRequest(), recorder.response);

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "TECHNICIAN_ACCOUNT_ALREADY_ACTIVE");
  assert.equal(mocks.createdCount, 0);
  assert.equal(mocks.invitationPayload, undefined);
});
