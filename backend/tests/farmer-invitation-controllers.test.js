import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../src/config/env.js";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { createInvitedUser } from "../src/controllers/user.controllers.js";
import { registerFarmer } from "../src/controllers/technician.controllers.js";

const originals = {
  userFindOne: User.findOne,
  userCreate: User.create,
  auditCreate: AuditLog.create,
  createInvitation: clerkClient.invitations.createInvitation,
  revokeInvitation: clerkClient.invitations.revokeInvitation,
};

afterEach(() => {
  User.findOne = originals.userFindOne;
  User.create = originals.userCreate;
  AuditLog.create = originals.auditCreate;
  clerkClient.invitations.createInvitation = originals.createInvitation;
  clerkClient.invitations.revokeInvitation = originals.revokeInvitation;
});

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

const request = (body) => ({
  body,
  user: { _id: "technician-1", role: "technician", name: "Technician" },
  app: { get: () => ({ emit: () => {} }) },
});

const unclaimed = (overrides = {}) => ({
  _id: "farmer-existing",
  name: "Existing Farmer",
  email: "farmer@example.com",
  role: "farmer",
  status: "active",
  profileClaimStatus: "unclaimed",
  registeredByTechnician: true,
  ...overrides,
});

const queryKind = (query) => {
  const serialized = JSON.stringify(query);
  if (serialized.includes("normalizedEmail")) return "email";
  if (serialized.includes("normalizedPhoneNumber")) return "phone";
  return "unknown";
};

test("createInvitedUser creates one unclaimed assisted Farmer and sends resumable invitation", async () => {
  let createCount = 0;
  let invitationPayload;
  User.findOne = async () => null;
  User.create = async (payload) => {
    createCount += 1;
    return unclaimed({ _id: "farmer-new", ...payload });
  };
  AuditLog.create = async () => ({});
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "invitation-1" };
  };

  const recorder = responseRecorder();
  await createInvitedUser(
    request({
      firstName: "Fresh",
      lastName: "Farmer",
      email: "FRESH@example.com",
      role: "farmer",
    }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 201);
  assert.equal(createCount, 1);
  assert.equal(recorder.body.newUser.profileClaimStatus, "unclaimed");
  assert.equal(recorder.body.newUser.registeredByTechnician, true);
  assert.equal(recorder.body.invitationSent, true);
  assert.equal(invitationPayload.ignoreExisting, true);
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.FARMER_INVITATION_REDIRECT_URL,
  );
});

test("createInvitedUser reuses unclaimed Farmer and resends to the Farmer destination", async () => {
  const existing = unclaimed();
  let createCount = 0;
  User.findOne = async (query) =>
    queryKind(query) === "email" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };
  AuditLog.create = async () => ({});
  let invitationPayload;
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "resent-1" };
  };

  const recorder = responseRecorder();
  await createInvitedUser(
    request({
      firstName: "Existing",
      lastName: "Farmer",
      email: "FARMER@example.com",
      role: "farmer",
    }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.newUser, existing);
  assert.equal(recorder.body.invitationResent, true);
  assert.equal(recorder.body.profileReused, true);
  assert.equal(createCount, 0);
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.FARMER_INVITATION_REDIRECT_URL,
  );
});

test("createInvitedUser rejects claimed Farmer without invitation or duplicate profile", async () => {
  const existing = unclaimed({
    clerkId: "user_claimed",
    profileClaimStatus: "claimed",
  });
  let createCount = 0;
  let invitationCount = 0;
  User.findOne = async (query) =>
    queryKind(query) === "email" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };
  clerkClient.invitations.createInvitation = async () => {
    invitationCount += 1;
  };

  const recorder = responseRecorder();
  await createInvitedUser(
    request({
      firstName: "Claimed",
      lastName: "Farmer",
      email: "farmer@example.com",
      role: "farmer",
    }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_ACCOUNT_ALREADY_ACTIVE");
  assert.equal(createCount, 0);
  assert.equal(invitationCount, 0);
});

test("registerFarmer fresh path normalizes identity and creates exactly one profile", async () => {
  let createdPayload;
  let invitationPayload;
  User.findOne = async () => null;
  User.create = async (payload) => {
    createdPayload = payload;
    return unclaimed({ _id: "farmer-new", ...payload });
  };
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "invitation-1" };
  };

  const recorder = responseRecorder();
  await registerFarmer(
    request({
      firstName: "New",
      lastName: "Farmer",
      email: " NEW@Example.com ",
      phoneNumber: "+63 917 123 4567",
      address: { barangay: "Poblacion", city: "Oton" },
    }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 201);
  assert.equal(createdPayload.email, "new@example.com");
  assert.equal(createdPayload.phoneNumber, "09171234567");
  assert.equal(createdPayload.normalizedPhoneNumber, "+639171234567");
  assert.equal(invitationPayload.ignoreExisting, true);
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.FARMER_INVITATION_REDIRECT_URL,
  );
  assert.equal(recorder.body.invitationSent, true);
});

test("registerFarmer reuses normalized-phone unclaimed profile and resends invitation", async () => {
  const existing = unclaimed({
    normalizedPhoneNumber: "+639171234567",
  });
  let createCount = 0;
  User.findOne = async (query) =>
    queryKind(query) === "phone" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };
  clerkClient.invitations.createInvitation = async () => ({ id: "resent-1" });

  const recorder = responseRecorder();
  await registerFarmer(
    request({
      firstName: "Existing",
      lastName: "Farmer",
      email: "farmer@example.com",
      phoneNumber: "0917 123 4567",
      address: { barangay: "Different", city: "Oton" },
    }),
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(recorder.body.user, existing);
  assert.equal(recorder.body.invitationResent, true);
  assert.equal(createCount, 0);
  assert.equal(existing.address, undefined);
});
