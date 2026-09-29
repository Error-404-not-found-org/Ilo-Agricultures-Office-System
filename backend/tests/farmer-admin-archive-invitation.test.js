import test from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { accountStatusClerkUsers } from "../src/services/account-status-clerk.service.js";
import { User } from "../src/models/user.model.js";
import { archiveFarmerAsAdmin } from "../src/services/admin-farmer-archive.service.js";

const farmerId = "507f1f77bcf86cd799439012";
const actorId = "507f1f77bcf86cd799439011";

test("Admin Archive revokes a pending invitation and preserves an unclaimed Farmer ID", async () => {
  const originals = { update: User.findOneAndUpdate, revoke: clerkClient.invitations.revokeInvitation };
  const farmer = {
    _id: farmerId, role: "farmer", status: "active", deletedAt: null,
    profileClaimStatus: "unclaimed", email: "farmer@example.test",
    farmerAppInvitation: {
      status: "pending", clerkInvitationId: "inv-admin", email: "farmer@example.test",
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
  const events = [];
  clerkClient.invitations.revokeInvitation = async (id) => {
    events.push("revoke"); return { id, status: "revoked" };
  };
  User.findOneAndUpdate = async (filter, update) => {
    events.push("archive");
    assert.equal(filter.deletedAt, null);
    assert.equal(filter["farmerAppInvitation.clerkInvitationId"], "inv-admin");
    assert.equal(update.$set["farmerAppInvitation.status"], "revoked");
    return { ...farmer, ...update.$set };
  };
  try {
    const result = await archiveFarmerAsAdmin({ farmer, actorId });
    assert.deepEqual(events, ["revoke", "archive"]);
    assert.equal(String(result._id), farmerId);
    assert.ok(result.deletedAt);
    assert.equal(result.status, "active");
  } finally {
    User.findOneAndUpdate = originals.update;
    clerkClient.invitations.revokeInvitation = originals.revoke;
  }
});

test("Admin Archive refuses an active Farmer claim reservation before banning or archiving", async () => {
  const farmer = {
    _id: farmerId, role: "farmer", status: "active", deletedAt: null,
    profileClaimStatus: "unclaimed",
    farmerClaimReservation: { token: "claim-1", expiresAt: new Date(Date.now() + 60_000) },
  };
  let bans = 0;
  await assert.rejects(
    archiveFarmerAsAdmin({ farmer, actorId, banClerk: async () => { bans += 1; } }),
    (error) => error.code === "FARMER_CLAIM_IN_PROGRESS",
  );
  assert.equal(bans, 0);
});

test("Admin Archive refuses expired committing and uncertain transitions", async () => {
  const farmer = {
    _id: farmerId, role: "farmer", status: "active", deletedAt: null,
    profileClaimStatus: "unclaimed",
    farmerClaimReservation: { token: "claim-1", expiresAt: new Date(0) },
  };
  for (const [phase, code] of [
    ["committing", "FARMER_CLAIM_IN_PROGRESS"],
    ["uncertain", "FARMER_CLAIM_RECONCILIATION_REQUIRED"],
  ]) {
    farmer.farmerClaimReservation.phase = phase;
    await assert.rejects(archiveFarmerAsAdmin({ farmer, actorId }),
      (error) => error.code === code);
  }
});

test("Admin Archive compensates a failed conditional write only while Farmer remains active", async () => {
  const originals = { update: User.findOneAndUpdate, find: User.findById };
  const farmer = {
    _id: farmerId, role: "farmer", status: "active", deletedAt: null,
    profileClaimStatus: "claimed", clerkId: "clerk-linked",
  };
  const events = [];
  User.findOneAndUpdate = async () => { throw new Error("write acknowledgement lost"); };
  User.findById = async () => ({ ...farmer });
  try {
    await assert.rejects(
      archiveFarmerAsAdmin({ farmer, actorId,
        banClerk: async () => { events.push("ban"); },
        unbanClerk: async () => { events.push("unban"); } }),
      (error) => error.code === "FARMER_ARCHIVE_RECONCILIATION_REQUIRED",
    );
    assert.deepEqual(events, ["ban", "unban"]);
    events.length = 0;
    User.findById = async () => ({ ...farmer, deletedAt: new Date() });
    await assert.rejects(
      archiveFarmerAsAdmin({ farmer, actorId,
        banClerk: async () => { events.push("ban"); },
        unbanClerk: async () => { events.push("unban"); } }),
      (error) => error.code === "FARMER_ARCHIVE_RECONCILIATION_REQUIRED",
    );
    assert.deepEqual(events, ["ban"]);
  } finally {
    User.findOneAndUpdate = originals.update;
    User.findById = originals.find;
  }
});

test("linked Farmer Archive never writes Mongo when the runtime Clerk ban fails", async () => {
  const originals = { update: User.findOneAndUpdate, ban: accountStatusClerkUsers.banUser };
  let writes = 0;
  User.findOneAndUpdate = async () => { writes += 1; return null; };
  accountStatusClerkUsers.banUser = async () => { throw new Error("Clerk unavailable"); };
  try {
    await assert.rejects(archiveFarmerAsAdmin({ actorId, farmer: {
      _id: farmerId, role: "farmer", status: "active", deletedAt: null,
      profileClaimStatus: "claimed", clerkId: "user_real_farmer",
    } }), (error) => error.status === 502 && error.code === "CLERK_ARCHIVE_FAILED");
    assert.equal(writes, 0);
  } finally {
    User.findOneAndUpdate = originals.update;
    accountStatusClerkUsers.banUser = originals.ban;
  }
});

test("unlinked Farmer Archive sets deletedAt without contacting runtime Clerk", async () => {
  const originals = { update: User.findOneAndUpdate, ban: accountStatusClerkUsers.banUser };
  const farmer = { _id: farmerId, role: "farmer", status: "active", deletedAt: null,
    profileClaimStatus: "unclaimed", clerkId: "manual_farmer" };
  let banCalls = 0;
  User.findOneAndUpdate = async (_filter, update) => ({ ...farmer, ...update.$set });
  accountStatusClerkUsers.banUser = async () => { banCalls += 1; };
  try {
    const archived = await archiveFarmerAsAdmin({ farmer, actorId });
    assert.equal(banCalls, 0);
    assert.equal(String(archived._id), farmerId);
    assert.ok(archived.deletedAt);
    assert.equal(archived.status, "active");
  } finally {
    User.findOneAndUpdate = originals.update;
    accountStatusClerkUsers.banUser = originals.ban;
  }
});
