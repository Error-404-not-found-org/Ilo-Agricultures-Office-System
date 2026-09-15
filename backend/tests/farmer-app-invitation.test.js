import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { User } from "../src/models/user.model.js";

import {
  FARMER_APP_INVITATION_DURATION_DAYS,
  cancelFarmerAppInvitation,
  deriveFarmerInvitationStatus,
  resendFarmerAppInvitation,
  sendFarmerAppInvitation,
} from "../src/services/farmer-app-invitation.service.js";
import {
  buildTechnicianFarmerMetricsPipeline,
  getFarmerAppAccountStatus,
  presentUserDetailForRequester,
  toTechnicianFarmerDirectoryEntry,
} from "../src/controllers/user.controllers.js";
import { requireClerkAuthentication, requireRole } from "../src/middleware/auth.middleware.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

const originals = {
  create: clerkClient.invitations.createInvitation,
  list: clerkClient.invitations.getInvitationList,
  revoke: clerkClient.invitations.revokeInvitation,
};

afterEach(() => {
  clerkClient.invitations.createInvitation = originals.create;
  clerkClient.invitations.getInvitationList = originals.list;
  clerkClient.invitations.revokeInvitation = originals.revoke;
});

const farmer = (overrides = {}) => ({
  _id: "farmer-1",
  role: "farmer",
  status: "active",
  profileClaimStatus: "unclaimed",
  email: "farmer@example.com",
  deletedAt: null,
  saveCount: 0,
  async save() {
    this.saveCount += 1;
    return this;
  },
  ...overrides,
});

test("send requires email and rejects connected or blocked Farmers before Clerk", async () => {
  let createCalls = 0;
  clerkClient.invitations.createInvitation = async () => {
    createCalls += 1;
  };

  await assert.rejects(
    () => sendFarmerAppInvitation({ farmer: farmer({ email: "" }) }),
    (error) => error.code === "FARMER_EMAIL_REQUIRED" && error.status === 400,
  );
  await assert.rejects(
    () => sendFarmerAppInvitation({
      farmer: farmer({ clerkId: "user_connected", profileClaimStatus: "claimed" }),
    }),
    (error) => error.code === "FARMER_ALREADY_CONNECTED",
  );
  await assert.rejects(
    () => sendFarmerAppInvitation({
      farmer: farmer({ status: "suspended", profileClaimStatus: "blocked" }),
    }),
    (error) => error.code === "FARMER_ACCOUNT_BLOCKED",
  );
  assert.equal(createCalls, 0);
});

test("send creates one seven-day invitation and persists its private snapshot", async () => {
  const target = farmer();
  let payload;
  const now = new Date("2026-09-15T00:00:00.000Z");
  clerkClient.invitations.createInvitation = async (value) => {
    payload = value;
    return { id: "invitation-new", createdAt: now.getTime() };
  };

  const snapshot = await sendFarmerAppInvitation({ farmer: target, now });

  assert.equal(payload.ignoreExisting, false);
  assert.equal(payload.expiresInDays, FARMER_APP_INVITATION_DURATION_DAYS);
  assert.equal(payload.publicMetadata.role, "farmer");
  assert.equal(snapshot.status, "pending");
  assert.equal(snapshot.clerkInvitationId, "invitation-new");
  assert.equal(snapshot.sentAt.toISOString(), now.toISOString());
  assert.equal(snapshot.expiresAt.toISOString(), "2026-09-22T00:00:00.000Z");
  assert.equal(target.farmerAppInvitation, snapshot);
  assert.equal(target.saveCount, 1);
});

test("send cannot create a duplicate while a stored invitation is still active", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-active",
      status: "pending",
      expiresAt: new Date("2026-09-22T00:00:00Z"),
    },
  });
  let createCalls = 0;
  clerkClient.invitations.createInvitation = async () => {
    createCalls += 1;
  };

  await assert.rejects(
    () => sendFarmerAppInvitation({
      farmer: target,
      now: new Date("2026-09-15T00:00:00Z"),
    }),
    (error) => error.code === "FARMER_INVITATION_ALREADY_PENDING",
  );
  assert.equal(createCalls, 0);
});

test("pending resend reconciles and revokes the old invitation before one replacement", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-old",
      status: "pending",
      email: "farmer@example.com",
      sentAt: new Date("2026-09-14T00:00:00.000Z"),
      expiresAt: new Date("2026-09-21T00:00:00.000Z"),
    },
  });
  let createCalls = 0;
  let revokedId;
  clerkClient.invitations.getInvitationList = async () => [
    { id: "invitation-old", status: "pending" },
  ];
  clerkClient.invitations.revokeInvitation = async (id) => {
    revokedId = id;
    return { id, status: "revoked" };
  };
  clerkClient.invitations.createInvitation = async () => {
    createCalls += 1;
    return { id: "invitation-replacement", createdAt: Date.parse("2026-09-15T00:00:00Z") };
  };

  await resendFarmerAppInvitation({
    farmer: target,
    now: new Date("2026-09-15T00:00:00Z"),
  });

  assert.equal(revokedId, "invitation-old");
  assert.equal(createCalls, 1);
  assert.equal(target.farmerAppInvitation.clerkInvitationId, "invitation-replacement");
  assert.equal(target.farmerAppInvitation.status, "pending");
});

test("email change makes the old pending snapshot stale and resend targets the current email", async () => {
  const target = farmer({
    email: "new@example.com",
    farmerAppInvitation: {
      clerkInvitationId: "invitation-old-email",
      status: "pending",
      email: "old@example.com",
      expiresAt: new Date("2026-09-22T00:00:00Z"),
    },
  });
  let revokedId;
  let replacementPayload;
  clerkClient.invitations.getInvitationList = async () => [
    { id: "invitation-old-email", status: "pending" },
  ];
  clerkClient.invitations.revokeInvitation = async (id) => {
    revokedId = id;
    return { id, status: "revoked" };
  };
  clerkClient.invitations.createInvitation = async (payload) => {
    replacementPayload = payload;
    return { id: "invitation-new-email" };
  };

  assert.equal(getFarmerAppAccountStatus(target), "invitation_expired");
  await resendFarmerAppInvitation({
    farmer: target,
    now: new Date("2026-09-15T00:00:00Z"),
  });

  assert.equal(revokedId, "invitation-old-email");
  assert.equal(replacementPayload.emailAddress, "new@example.com");
  assert.equal(target.farmerAppInvitation.email, "new@example.com");
  assert.equal(target.farmerAppInvitation.status, "pending");
});

test("replacement creation failure leaves the revoked snapshot out of Invitation Sent", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-old",
      status: "pending",
      email: "farmer@example.com",
      expiresAt: new Date("2026-09-22T00:00:00Z"),
    },
  });
  clerkClient.invitations.getInvitationList = async () => [
    { id: "invitation-old", status: "pending" },
  ];
  clerkClient.invitations.revokeInvitation = async () => ({ status: "revoked" });
  clerkClient.invitations.createInvitation = async () => {
    throw new Error("Network unavailable");
  };

  await assert.rejects(
    () => resendFarmerAppInvitation({
      farmer: target,
      now: new Date("2026-09-15T00:00:00Z"),
    }),
    (error) => error.code === "FARMER_INVITATION_SERVICE_UNAVAILABLE",
  );
  assert.equal(target.farmerAppInvitation.status, "revoked");
  assert.notEqual(getFarmerAppAccountStatus(target), "invitation_sent");
});

test("cancel revokes a pending Clerk invitation and preserves its audit snapshot", async () => {
  const originalSnapshot = {
    clerkInvitationId: "invitation-active",
    status: "pending",
    email: "farmer@example.com",
    sentAt: new Date("2026-09-14T00:00:00Z"),
    expiresAt: new Date("2026-09-21T00:00:00Z"),
  };
  const target = farmer({ farmerAppInvitation: originalSnapshot });
  let revokedId;
  clerkClient.invitations.getInvitationList = async () => [
    { id: "invitation-active", status: "pending" },
  ];
  clerkClient.invitations.revokeInvitation = async (id) => {
    revokedId = id;
    return { id, status: "revoked" };
  };

  const result = await cancelFarmerAppInvitation({
    farmer: target,
    now: new Date("2026-09-15T00:00:00Z"),
  });

  assert.equal(revokedId, "invitation-active");
  assert.equal(result.status, "revoked");
  assert.equal(result.email, originalSnapshot.email);
  assert.equal(result.sentAt, originalSnapshot.sentAt);
  assert.equal(result.expiresAt, originalSnapshot.expiresAt);
  assert.equal(getFarmerAppAccountStatus(target), "no_app_account");
});

test("cancel is idempotent for an already revoked invitation", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-revoked",
      status: "revoked",
      email: "farmer@example.com",
    },
  });
  let clerkCalls = 0;
  clerkClient.invitations.getInvitationList = async () => { clerkCalls += 1; };
  clerkClient.invitations.revokeInvitation = async () => { clerkCalls += 1; };

  const result = await cancelFarmerAppInvitation({ farmer: target });

  assert.equal(result.status, "revoked");
  assert.equal(getFarmerAppAccountStatus(target), "no_app_account");
  assert.equal(clerkCalls, 0);
});

test("cancel rejects a connected Farmer without contacting Clerk", async () => {
  const target = farmer({ clerkId: "user_connected", profileClaimStatus: "claimed" });
  let clerkCalls = 0;
  clerkClient.invitations.getInvitationList = async () => { clerkCalls += 1; };

  await assert.rejects(
    () => cancelFarmerAppInvitation({ farmer: target }),
    (error) => error.code === "FARMER_ALREADY_CONNECTED",
  );
  assert.equal(clerkCalls, 0);
});

test("cancel rejects a blocked Farmer without contacting Clerk", async () => {
  const target = farmer({ profileClaimStatus: "blocked" });
  let clerkCalls = 0;
  clerkClient.invitations.getInvitationList = async () => { clerkCalls += 1; };

  await assert.rejects(
    () => cancelFarmerAppInvitation({ farmer: target }),
    (error) => error.code === "FARMER_ACCOUNT_BLOCKED",
  );
  assert.equal(clerkCalls, 0);
});

test("cancel reconciles a Clerk-expired invitation without reporting it as sent", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-expired-remotely",
      status: "pending",
      email: "farmer@example.com",
      expiresAt: new Date("2026-09-22T00:00:00Z"),
    },
  });
  let listCalls = 0;
  clerkClient.invitations.getInvitationList = async (params) => {
    listCalls += 1;
    return params?.status === "pending"
      ? []
      : [{ id: "invitation-expired-remotely", status: "expired" }];
  };

  const result = await cancelFarmerAppInvitation({
    farmer: target,
    now: new Date("2026-09-15T00:00:00Z"),
  });

  assert.equal(listCalls, 2);
  assert.equal(result.status, "expired");
  assert.equal(getFarmerAppAccountStatus(target), "invitation_expired");
});

test("Clerk revocation failure preserves the truthful pending snapshot", async () => {
  const originalSnapshot = {
    clerkInvitationId: "invitation-active",
    status: "pending",
    email: "farmer@example.com",
    expiresAt: new Date("2026-09-22T00:00:00Z"),
  };
  const target = farmer({ farmerAppInvitation: originalSnapshot });
  clerkClient.invitations.getInvitationList = async () => [
    { id: "invitation-active", status: "pending" },
  ];
  clerkClient.invitations.revokeInvitation = async () => {
    throw new Error("Clerk unavailable");
  };

  await assert.rejects(
    () => cancelFarmerAppInvitation({
      farmer: target,
      now: new Date("2026-09-15T00:00:00Z"),
    }),
    (error) => error.code === "FARMER_INVITATION_SERVICE_UNAVAILABLE",
  );
  assert.equal(target.farmerAppInvitation, originalSnapshot);
  assert.equal(target.saveCount, 0);
  assert.equal(getFarmerAppAccountStatus(target), "invitation_sent");
});

test("Farmer can send a new invitation after cancellation", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-revoked",
      status: "revoked",
      email: "farmer@example.com",
    },
  });
  clerkClient.invitations.createInvitation = async () => ({ id: "invitation-new" });

  const result = await sendFarmerAppInvitation({ farmer: target });

  assert.equal(result.status, "pending");
  assert.equal(result.clerkInvitationId, "invitation-new");
});

test("expired resend creates one replacement without querying pending Clerk invitations", async () => {
  const target = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "invitation-expired",
      status: "pending",
      expiresAt: new Date("2026-09-14T00:00:00Z"),
    },
  });
  let listCalls = 0;
  let createCalls = 0;
  clerkClient.invitations.getInvitationList = async () => {
    listCalls += 1;
    return [];
  };
  clerkClient.invitations.createInvitation = async () => {
    createCalls += 1;
    return { id: "invitation-new" };
  };

  await resendFarmerAppInvitation({
    farmer: target,
    now: new Date("2026-09-15T00:00:00Z"),
  });

  assert.equal(listCalls, 0);
  assert.equal(createCalls, 1);
  assert.equal(target.farmerAppInvitation.clerkInvitationId, "invitation-new");
});

test("existing Clerk account returns sign-in-required and does not persist a false invitation", async () => {
  const target = farmer();
  clerkClient.invitations.createInvitation = async () => {
    const error = new Error("Email address already exists");
    error.errors = [{ code: "form_identifier_exists", message: "Email address already exists" }];
    throw error;
  };

  await assert.rejects(
    () => sendFarmerAppInvitation({ farmer: target }),
    (error) => error.code === "CLERK_ACCOUNT_EXISTS_SIGN_IN_REQUIRED",
  );
  assert.equal(target.farmerAppInvitation, undefined);
  assert.equal(target.saveCount, 0);
});

test("existing Clerk invitation conflict is not classified as an existing account", async () => {
  const target = farmer();
  clerkClient.invitations.createInvitation = async () => {
    const error = new Error("Invitation already exists for this email address");
    error.errors = [{ code: "duplicate_record", message: error.message }];
    throw error;
  };

  await assert.rejects(
    () => sendFarmerAppInvitation({ farmer: target }),
    (error) => error.code === "FARMER_INVITATION_ALREADY_PENDING",
  );
  assert.equal(target.farmerAppInvitation, undefined);
  assert.equal(target.saveCount, 0);
});

test("Clerk failure leaves an existing snapshot unchanged when send cannot complete", async () => {
  const existing = {
    clerkInvitationId: "old-revoked",
    status: "revoked",
    email: "farmer@example.com",
    expiresAt: new Date("2026-09-01T00:00:00Z"),
  };
  const target = farmer({ farmerAppInvitation: existing });
  clerkClient.invitations.createInvitation = async () => {
    throw new Error("Network unavailable");
  };

  await assert.rejects(
    () => sendFarmerAppInvitation({ farmer: target }),
    (error) => error.code === "FARMER_INVITATION_SERVICE_UNAVAILABLE",
  );
  assert.equal(target.farmerAppInvitation, existing);
  assert.equal(target.saveCount, 0);
});

test("directory status is local, prioritizes Blocked and Connected, and never exposes Clerk invitation ID", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60_000);
  const past = new Date(now.getTime() - 60_000);
  const pending = farmer({
    farmerAppInvitation: {
      clerkInvitationId: "secret-invitation-id",
      status: "pending",
      email: "farmer@example.com",
      expiresAt: future,
    },
  });

  assert.equal(getFarmerAppAccountStatus(pending), "invitation_sent");
  assert.equal(
    getFarmerAppAccountStatus({ ...pending, farmerAppInvitation: { ...pending.farmerAppInvitation, expiresAt: past } }),
    "invitation_expired",
  );
  assert.equal(
    getFarmerAppAccountStatus({ ...pending, clerkId: "user_real", profileClaimStatus: "claimed" }),
    "connected",
  );
  assert.equal(
    getFarmerAppAccountStatus({
      ...pending,
      clerkId: "user_real",
      profileClaimStatus: "claimed",
      farmerAppInvitation: { ...pending.farmerAppInvitation, expiresAt: past },
    }),
    "connected",
  );
  assert.equal(
    getFarmerAppAccountStatus({ ...pending, profileClaimStatus: "blocked" }),
    "blocked",
  );
  assert.equal(
    getFarmerAppAccountStatus({ ...pending, status: "suspended" }),
    "blocked",
  );
  assert.equal(deriveFarmerInvitationStatus(pending.farmerAppInvitation, now), "pending");

  const presented = toTechnicianFarmerDirectoryEntry(pending);
  assert.equal(presented.appAccountStatus, "invitation_sent");
  assert.equal("farmerAppInvitation" in presented, false);
  assert.equal(JSON.stringify(presented).includes("secret-invitation-id"), false);

  const serialized = new User({
    name: "Safe Farmer",
    role: "farmer",
    farmerAppInvitation: pending.farmerAppInvitation,
  }).toJSON();
  assert.equal(serialized.farmerAppInvitation.status, "pending");
  assert.equal("clerkInvitationId" in serialized.farmerAppInvitation, false);

  const adminDetail = presentUserDetailForRequester({
    requester: { role: "admin" },
    target: pending,
  });
  assert.equal("clerkInvitationId" in adminDetail.farmerAppInvitation, false);
  assert.equal(JSON.stringify(adminDetail).includes("secret-invitation-id"), false);
});

test("No App Account metric excludes active invitations and includes expired invitations", () => {
  const pipeline = buildTechnicianFarmerMetricsPipeline({ role: "farmer" });
  const source = JSON.stringify(pipeline);
  assert.match(source, /invitation_sent/);
  assert.match(source, /invitation_expired/);
  const group = pipeline.find((stage) => stage.$group).$group;
  assert.deepEqual(
    group.noAppAccount.$sum.$cond[0].$in[1],
    ["no_app_account", "profile_only", "invitation_expired"],
  );
  assert.equal(getFarmerAppAccountStatus(farmer({
    farmerAppInvitation: { status: "revoked", email: "farmer@example.com" },
  })), "no_app_account");
});

test("Farmer invitation routes require authenticated Technician or Admin role", () => {
  const source = fs.readFileSync(
    path.join(testDirectory, "..", "src", "routes", "user.routes.js"),
    "utf8",
  );
  assert.match(
    source,
    /"\/:id\/app-invitation",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\)/,
  );
  assert.match(
    source,
    /"\/:id\/app-invitation\/resend",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\)/,
  );
  assert.match(
    source,
    /router\.delete\(\s*"\/:id\/app-invitation",\s*protectedRoute,\s*requireRole\(\["technician", "admin"\]\)/,
  );
});

test("invitation authorization allows staff and denies Farmer or missing identity", () => {
  const authorize = requireRole(["technician", "admin"]);
  const response = () => {
    const output = { statusCode: 200, body: null };
    output.res = {
      status(code) { output.statusCode = code; return this; },
      json(body) { output.body = body; return this; },
    };
    return output;
  };

  for (const role of ["technician", "admin"]) {
    let allowed = false;
    authorize({ user: { role } }, response().res, () => { allowed = true; });
    assert.equal(allowed, true);
  }

  const farmerResponse = response();
  authorize({ user: { role: "farmer" } }, farmerResponse.res, () => {});
  assert.equal(farmerResponse.statusCode, 403);

  const missingRoleResponse = response();
  authorize({}, missingRoleResponse.res, () => {});
  assert.equal(missingRoleResponse.statusCode, 403);

  const unauthenticatedResponse = response();
  requireClerkAuthentication({}, unauthenticatedResponse.res, () => {});
  assert.equal(unauthenticatedResponse.statusCode, 401);
});
