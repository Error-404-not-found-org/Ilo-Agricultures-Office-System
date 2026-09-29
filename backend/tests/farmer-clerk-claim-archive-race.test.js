import test from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { User } from "../src/models/user.model.js";
import { resolveOrSyncUser } from "../src/services/auth-user.service.js";

const farmerId = "507f1f77bcf86cd799439099";

const withClaimStubs = async (finalize, run) => {
  const originals = {
    findOne: User.findOne,
    update: User.findOneAndUpdate,
    getUser: clerkClient.users.getUser,
  };
  let saves = 0;
  const farmer = {
    _id: farmerId,
    role: "farmer",
    status: "active",
    deletedAt: null,
    profileClaimStatus: "unclaimed",
    email: "farmer@example.test",
    isVerified: false,
    farmerAppInvitation: {
      status: "pending", clerkInvitationId: "inv-1", email: "farmer@example.test",
      expiresAt: new Date(Date.now() + 60_000),
    },
    async save() { saves += 1; },
  };
  User.findOne = (query) => query.clerkId
    ? { maxTimeMS: async () => null }
    : Promise.resolve(farmer);
  User.findOneAndUpdate = async (filter, update) => finalize({ farmer, filter, update });
  clerkClient.users.getUser = async () => ({
    primaryEmailAddress: {
      emailAddress: "farmer@example.test", verification: { status: "verified" },
    },
  });
  try { await run({ farmer, getSaves: () => saves }); }
  finally {
    User.findOne = originals.findOne;
    User.findOneAndUpdate = originals.update;
    clerkClient.users.getUser = originals.getUser;
  }
};

test("Clerk claim atomically consumes pending invitation on the same Farmer ID", async () => {
  await withClaimStubs(
    ({ farmer, filter, update }) => {
      assert.equal(String(filter._id), farmerId);
      assert.equal(filter.deletedAt, null);
      assert.equal(update.$set["farmerAppInvitation.status"], "accepted");
      return { ...farmer, ...update.$set };
    },
    async ({ getSaves }) => {
      const claimed = await resolveOrSyncUser("clerk-new");
      assert.equal(String(claimed._id), farmerId);
      assert.equal(claimed.clerkId, "clerk-new");
      assert.equal(claimed.profileClaimStatus, "claimed");
      assert.equal(claimed.isVerified, true);
      assert.equal(getSaves(), 0);
    },
  );
});

test("Clerk claim does not link a Farmer after Archive wins the conditional write", async () => {
  await withClaimStubs(
    () => null,
    async ({ farmer, getSaves }) => {
      await assert.rejects(
        resolveOrSyncUser("clerk-new"),
        (error) => error.code === "FARMER_CLAIM_STATE_CHANGED",
      );
      assert.equal(farmer.clerkId, undefined);
      assert.equal(getSaves(), 0);
    },
  );
});
