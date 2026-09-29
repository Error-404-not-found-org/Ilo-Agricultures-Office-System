import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import {
  acquireFarmerClaimReservation,
  releaseFarmerClaimReservation,
  beginFarmerClaimCommit,
  noActiveFarmerClaimReservation,
} from "../src/services/farmer-claim-reservation.service.js";
import { presentUserDetailForRequester } from "../src/controllers/user.controllers.js";

const farmerId = "507f1f77bcf86cd799439012";
const now = new Date("2026-09-23T00:00:00.000Z");

test("claim reservation only acquires on an active unclaimed unlinked Farmer", async () => {
  const original = User.findOneAndUpdate;
  const writes = [];
  User.findOneAndUpdate = async (filter, update) => {
    writes.push({ filter, update });
    return { _id: farmerId, farmerClaimReservation: update.$set.farmerClaimReservation };
  };
  try {
    const result = await acquireFarmerClaimReservation({ farmerId, now });
    assert.equal(result.farmerId, farmerId);
    assert.ok(result.token);
    assert.equal(writes[0].filter.deletedAt, null);
    assert.equal(writes[0].filter.profileClaimStatus, "unclaimed");
    assert.equal(writes[0].filter.role, "farmer");
    assert.equal(writes[0].update.$set.farmerClaimReservation.token, result.token);
    assert.ok(writes[0].update.$set.farmerClaimReservation.expiresAt > now);
  } finally {
    User.findOneAndUpdate = original;
  }
});

test("claim reservation rejects archived, claimed, linked, and concurrently reserved Farmers", async () => {
  const original = User.findOneAndUpdate;
  User.findOneAndUpdate = async () => null;
  try {
    await assert.rejects(
      acquireFarmerClaimReservation({ farmerId, now }),
      (error) => error.code === "FARMER_CLAIM_STATE_CHANGED" && error.status === 409,
    );
  } finally {
    User.findOneAndUpdate = original;
  }
});

test("release matches only its own token, so old cleanup cannot clear a newer reservation", async () => {
  const original = User.updateOne;
  let currentToken = "token-B";
  User.updateOne = async (filter) => {
    assert.equal(filter["farmerClaimReservation.phase"], "reserved");
    if (filter["farmerClaimReservation.token"] !== currentToken) return { modifiedCount: 0 };
    currentToken = null;
    return { modifiedCount: 1 };
  };
  try {
    assert.equal(await releaseFarmerClaimReservation({ farmerId, token: "token-A" }), false);
    assert.equal(currentToken, "token-B");
    assert.equal(await releaseFarmerClaimReservation({ farmerId, token: "token-B" }), true);
    assert.equal(currentToken, null);
  } finally {
    User.updateOne = original;
  }
});

test("ordinary cleanup cannot clear a committing or uncertain claim with the same token", async () => {
  const original = User.updateOne;
  User.updateOne = async (filter) => {
    assert.equal(filter["farmerClaimReservation.token"], "token-A");
    assert.equal(filter["farmerClaimReservation.phase"], "reserved");
    return { modifiedCount: 0 };
  };
  try {
    assert.equal(await releaseFarmerClaimReservation({ farmerId, token: "token-A" }), false);
  } finally {
    User.updateOne = original;
  }
});

test("expired committing and uncertain claims remain ineligible for a new reservation", () => {
  const filter = noActiveFarmerClaimReservation(now);
  assert.deepEqual(filter.$or[1].$and[1].$or, [
    { "farmerClaimReservation.phase": "reserved" },
    { "farmerClaimReservation.phase": { $exists: false } },
  ]);
});

test("begin commit requires the current unexpired token and active Farmer", async () => {
  const original = User.findOneAndUpdate;
  User.findOneAndUpdate = async (filter, update) => {
    assert.equal(filter["farmerClaimReservation.token"], "token-A");
    assert.deepEqual(filter["farmerClaimReservation.expiresAt"], { $gt: now });
    assert.equal(filter.deletedAt, null);
    assert.equal(update.$set["farmerClaimReservation.phase"], "committing");
    return { _id: farmerId };
  };
  try {
    await beginFarmerClaimCommit({ farmerId, token: "token-A", sourceUserId: "source-1", now });
  } finally {
    User.findOneAndUpdate = original;
  }
});

test("claim reservation token is never exposed in Admin or Technician Farmer detail", () => {
  assert.equal(User.schema.path("farmerClaimReservation").options.select, false);
  const farmer = {
    _id: farmerId, role: "farmer", profileClaimStatus: "unclaimed",
    farmerClaimReservation: {
      token: "secret-internal-token", startedAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    },
  };
  for (const role of ["admin", "technician"]) {
    const detail = presentUserDetailForRequester({ requester: { role }, target: farmer });
    assert.equal(JSON.stringify(detail).includes("secret-internal-token"), false);
  }
});
