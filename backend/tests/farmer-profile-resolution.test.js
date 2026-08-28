import test, { afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../src/config/env.js";
import { User } from "../src/models/user.model.js";
import {
  classifyFarmerProfile,
  getFarmerInvitationRedirectUrl,
  resolveFarmerIdentity,
  resolveOrCreateAssistedFarmer,
} from "../src/services/farmer-profile-resolution.service.js";

const originals = {
  findOne: User.findOne,
  create: User.create,
  createInvitation: clerkClient.invitations.createInvitation,
  revokeInvitation: clerkClient.invitations.revokeInvitation,
};

afterEach(() => {
  User.findOne = originals.findOne;
  User.create = originals.create;
  clerkClient.invitations.createInvitation = originals.createInvitation;
  clerkClient.invitations.revokeInvitation = originals.revokeInvitation;
});

const farmer = (overrides = {}) => ({
  _id: "farmer-1",
  role: "farmer",
  status: "active",
  profileClaimStatus: "unclaimed",
  ...overrides,
});

const queryKind = (query) => {
  const serialized = JSON.stringify(query);
  if (serialized.includes("normalizedEmail")) return "email";
  if (serialized.includes("normalizedPhoneNumber")) return "phone";
  return "unknown";
};

test("fresh assisted Farmer sends one resumable invitation and creates one unclaimed profile", async () => {
  let createCount = 0;
  let invitationPayload;
  User.findOne = async () => null;
  User.create = async (payload) => {
    createCount += 1;
    return farmer({ _id: "farmer-new", ...payload });
  };
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "invitation-1" };
  };

  const result = await resolveOrCreateAssistedFarmer({
    email: " New.Farmer@Example.COM ",
    phoneNumber: "0917 123 4567",
    name: "New Farmer",
    source: "test",
    invitationMode: "required",
    inviteExistingUnclaimed: true,
    redirectUrl: getFarmerInvitationRedirectUrl(),
  });

  assert.equal(createCount, 1);
  assert.equal(result.created, true);
  assert.equal(result.invitationSent, true);
  assert.equal(invitationPayload.emailAddress, "new.farmer@example.com");
  assert.equal(invitationPayload.ignoreExisting, true);
  assert.equal(invitationPayload.publicMetadata.role, "farmer");
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.FARMER_INVITATION_REDIRECT_URL,
  );
  assert.equal(result.farmer.phoneNumber, "09171234567");
  assert.equal(result.farmer.normalizedPhoneNumber, "+639171234567");
  assert.equal(result.farmer.profileClaimStatus, "unclaimed");
  assert.equal(result.farmer.registeredByTechnician, true);
});

test("existing unclaimed Farmer is reused and invitation is resent without User.create", async () => {
  const existing = farmer({ email: "farmer@example.com" });
  let createCount = 0;
  let invitationPayload;
  User.findOne = async (query) =>
    queryKind(query) === "email" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };
  clerkClient.invitations.createInvitation = async (payload) => {
    invitationPayload = payload;
    return { id: "resent-1" };
  };

  const result = await resolveOrCreateAssistedFarmer({
    email: "FARMER@example.com",
    name: "Ignored Replacement Name",
    invitationMode: "required",
    inviteExistingUnclaimed: true,
    redirectUrl: getFarmerInvitationRedirectUrl(),
  });

  assert.equal(result.farmer, existing);
  assert.equal(result.reused, true);
  assert.equal(result.invitationResent, true);
  assert.equal(createCount, 0);
  assert.equal(invitationPayload.ignoreExisting, true);
  assert.equal(
    invitationPayload.redirectUrl,
    ENV.FARMER_INVITATION_REDIRECT_URL,
  );
});

test("claimed Farmer explicit registration returns FARMER_ACCOUNT_ALREADY_ACTIVE", async () => {
  const existing = farmer({
    clerkId: "user_clerk-1",
    profileClaimStatus: "claimed",
  });
  let invitationCount = 0;
  let createCount = 0;
  User.findOne = async (query) =>
    queryKind(query) === "email" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };
  clerkClient.invitations.createInvitation = async () => {
    invitationCount += 1;
  };

  await assert.rejects(
    resolveOrCreateAssistedFarmer({
      email: "farmer@example.com",
      invitationMode: "required",
      inviteExistingUnclaimed: true,
    }),
    (error) => error.status === 409 && error.code === "FARMER_ACCOUNT_ALREADY_ACTIVE",
  );
  assert.equal(invitationCount, 0);
  assert.equal(createCount, 0);
});

test("phone formatting differences resolve through normalizedPhoneNumber", async () => {
  const existing = farmer({ normalizedPhoneNumber: "+639171234567" });
  let phoneQuery;
  User.findOne = async (query) => {
    phoneQuery = query;
    return existing;
  };

  const result = await resolveFarmerIdentity({
    phoneNumber: "+63 917 123 4567",
  });

  assert.equal(result.farmer, existing);
  assert.equal(result.matchedBy, "phone");
  assert.match(JSON.stringify(phoneQuery), /\+639171234567/);
});

test("different email and phone matches return FARMER_IDENTITY_CONFLICT without merging", async () => {
  User.findOne = async (query) =>
    queryKind(query) === "email"
      ? farmer({ _id: "farmer-email" })
      : farmer({ _id: "farmer-phone" });

  await assert.rejects(
    resolveFarmerIdentity({
      email: "one@example.com",
      phoneNumber: "09171234567",
    }),
    (error) => error.status === 409 && error.code === "FARMER_IDENTITY_CONFLICT",
  );
});

test("walk-in identity matched by email is reused even when submitted phone is new", async () => {
  const existing = farmer({ email: "known@example.com" });
  let createCount = 0;
  User.findOne = async (query) =>
    queryKind(query) === "email" ? existing : null;
  User.create = async () => {
    createCount += 1;
  };

  const result = await resolveOrCreateAssistedFarmer({
    email: "KNOWN@example.com",
    phoneNumber: "09991234567",
    invitationMode: "best-effort",
    allowClaimedExisting: true,
  });

  assert.equal(result.farmer, existing);
  assert.equal(result.matchedBy, "email");
  assert.equal(result.invitationAttempted, false);
  assert.equal(createCount, 0);
});

test("walk-in fresh Farmer survives invitation failure and reports it truthfully", async () => {
  let createCount = 0;
  User.findOne = async () => null;
  User.create = async (payload) => {
    createCount += 1;
    return farmer({ _id: "farmer-new", ...payload });
  };
  clerkClient.invitations.createInvitation = async () => {
    throw new Error("Clerk unavailable");
  };
  const originalConsoleError = console.error;
  console.error = mock.fn();

  try {
    const result = await resolveOrCreateAssistedFarmer({
      email: "walkin@example.com",
      phoneNumber: "09181234567",
      name: "Walk-in Farmer",
      invitationMode: "best-effort",
      allowClaimedExisting: true,
      source: "walk-in-test",
    });

    assert.equal(createCount, 1);
    assert.equal(result.created, true);
    assert.equal(result.invitationAttempted, true);
    assert.equal(result.invitationSent, false);
    assert.match(result.invitationError, /Clerk unavailable/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("classification preserves claimed, suspended, deleted, and manual-unclaimed distinctions", () => {
  assert.equal(classifyFarmerProfile(farmer()), "unclaimed");
  assert.equal(
    classifyFarmerProfile(farmer({ clerkId: "manual_123" })),
    "unclaimed",
  );
  assert.equal(
    classifyFarmerProfile(farmer({ clerkId: "user_123" })),
    "claimed",
  );
  assert.equal(classifyFarmerProfile(farmer({ status: "suspended" })), "suspended");
  assert.equal(classifyFarmerProfile(farmer({ deletedAt: new Date() })), "deleted");
});
