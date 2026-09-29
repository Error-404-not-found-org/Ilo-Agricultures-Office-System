import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { archiveFarmerAsTechnician } from "../src/services/technician-farmer-archive.service.js";

const ID = "507f1f77bcf86cd799439012";
const baseFarmer = () => ({
  _id: ID,
  role: "farmer",
  deletedAt: null,
  status: "active",
  profileClaimStatus: "unclaimed",
  clerkId: "manual_123",
  farmerAppInvitation: undefined,
});

test("Technician archive preserves the Farmer document and rejects linked/pending profiles", async () => {
  const originals = { findById: User.findById, findOneAndUpdate: User.findOneAndUpdate };
  let farmer = baseFarmer();
  let updates = 0;
  User.findById = async () => farmer;
  User.findOneAndUpdate = async (_filter, update) => {
    updates += 1;
    farmer = { ...farmer, ...update.$set };
    return farmer;
  };
  try {
    const archived = await archiveFarmerAsTechnician({ farmerId: ID, technicianId: ID });
    assert.equal(archived._id, ID);
    assert.ok(archived.deletedAt instanceof Date);
    assert.equal(archived.status, "active");
    assert.equal(updates, 1);

    for (const blocked of [
      { profileClaimStatus: "claimed" },
      { clerkId: "user_real" },
      { role: "technician" },
      { deletedAt: new Date() },
    ]) {
      farmer = { ...baseFarmer(), ...blocked };
      await assert.rejects(
        archiveFarmerAsTechnician({ farmerId: ID, technicianId: ID }),
      );
      assert.equal(updates, 1);
    }
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.findOneAndUpdate;
  }
});

test("Technician Archive revokes pending auto-sent invitation before conditional archive", async () => {
  const originals = {
    findById: User.findById,
    update: User.findOneAndUpdate,
    revoke: clerkClient.invitations.revokeInvitation,
  };
  const target = {
    ...baseFarmer(), email: "farmer@example.test",
    farmerAppInvitation: {
      clerkInvitationId: "inv-auto", status: "pending", email: "farmer@example.test",
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
  const events = [];
  User.findById = async () => target;
  User.findOneAndUpdate = async (filter, update) => {
    events.push({ type: "archive", filter, update });
    return { ...target, ...update.$set };
  };
  clerkClient.invitations.revokeInvitation = async (id) => {
    events.push({ type: "revoke", id });
    return { id, status: "revoked" };
  };
  try {
    const archived = await archiveFarmerAsTechnician({ farmerId: ID, technicianId: ID });
    assert.ok(archived.deletedAt);
    assert.deepEqual(events.map((event) => event.type), ["revoke", "archive"]);
    assert.equal(events[1].filter["farmerAppInvitation.clerkInvitationId"], "inv-auto");
    assert.equal(events[1].update.$set["farmerAppInvitation.status"], "revoked");
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.update;
    clerkClient.invitations.revokeInvitation = originals.revoke;
  }
});

test("Technician Archive refuses to finalize while a claim reservation is active", async () => {
  const originals = { findById: User.findById, update: User.findOneAndUpdate };
  User.findById = async () => ({ ...baseFarmer(), farmerClaimReservation: {
    token: "claim-1", expiresAt: new Date(Date.now() + 60_000),
  } });
  User.findOneAndUpdate = async () => null;
  try {
    await assert.rejects(
      archiveFarmerAsTechnician({ farmerId: ID, technicianId: ID }),
      (error) => error.code === "FARMER_CLAIM_IN_PROGRESS",
    );
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.update;
  }
});

test("Technician archive aborts when the Farmer changes before the final atomic update", async () => {
  const originals = { findById: User.findById, findOneAndUpdate: User.findOneAndUpdate };
  User.findById = async () => baseFarmer();
  User.findOneAndUpdate = async () => null;
  try {
    await assert.rejects(
      archiveFarmerAsTechnician({ farmerId: ID, technicianId: ID }),
      (error) => error.code === "FARMER_ARCHIVE_STATE_CHANGED" && error.status === 409,
    );
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.findOneAndUpdate;
  }
});

test("expired and revoked invitations do not block Technician archive", async () => {
  const originals = { findById: User.findById, findOneAndUpdate: User.findOneAndUpdate };
  let farmer = baseFarmer();
  User.findById = async () => farmer;
  User.findOneAndUpdate = async (_filter, update) => ({ ...farmer, ...update.$set });
  try {
    for (const invitation of [
      { status: "expired", expiresAt: new Date("2026-01-01") },
      { status: "revoked", expiresAt: new Date("2026-12-01") },
      { status: "pending", expiresAt: new Date("2026-01-01") },
    ]) {
      farmer = { ...baseFarmer(), farmerAppInvitation: invitation };
      const result = await archiveFarmerAsTechnician({
        farmerId: ID, technicianId: ID, now: new Date("2026-09-23"),
      });
      assert.ok(result.deletedAt instanceof Date);
    }
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.findOneAndUpdate;
  }
});
