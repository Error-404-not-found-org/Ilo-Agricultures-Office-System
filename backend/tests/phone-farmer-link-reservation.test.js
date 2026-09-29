import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { linkFarmerProfileByPhone } from "../src/services/phone-farmer-link.service.js";

const sourceId = "507f1f77bcf86cd799439011";
const targetId = "507f1f77bcf86cd799439012";

const makeSource = () => ({
  _id: sourceId, role: "farmer", clerkId: "clerk-phone", email: "phone@example.test",
  imageUrl: "", deletedAt: null,
  phoneVerification: { otpHash: "secret", otpExpiresAt: new Date() },
  async save() { this.saved = (this.saved || 0) + 1; },
});
const makeTarget = () => ({
  _id: targetId, role: "farmer", status: "active", deletedAt: null,
  profileClaimStatus: "unclaimed", phoneVerification: {},
});

test("phone link reserves the target before moving the unique Clerk ID", async () => {
  const original = User.findOneAndUpdate;
  const source = makeSource();
  const target = makeTarget();
  const events = [];
  User.findOneAndUpdate = async (filter, update) => {
    if (update.$set?.farmerClaimReservation) {
      events.push("reserve");
      return { ...target, farmerClaimReservation: update.$set.farmerClaimReservation };
    }
    if (update.$set?.["farmerClaimReservation.phase"] === "committing") {
      events.push("committing");
      return target;
    }
    events.push("finalize");
    assert.equal(filter["farmerClaimReservation.token"] !== undefined, true);
    return { ...target, ...update.$set, _id: targetId };
  };
  source.save = async function () { events.push("transfer"); this.saved = 1; };
  try {
    const linked = await linkFarmerProfileByPhone({
      sourceUser: source, targetFarmer: target,
      phone: { local: "09171234567", normalized: "+639171234567" },
    });
    assert.deepEqual(events, ["reserve", "committing", "transfer", "finalize"]);
    assert.equal(String(linked._id), targetId);
    assert.equal(linked.clerkId, "clerk-phone");
    assert.equal(linked.profileClaimStatus, "claimed");
    assert.equal(linked.isVerified, true);
  } finally {
    User.findOneAndUpdate = original;
  }
});

test("phone link cannot transfer identity if Archive won before reservation", async () => {
  const original = User.findOneAndUpdate;
  const source = makeSource();
  User.findOneAndUpdate = async () => null;
  try {
    await assert.rejects(
      linkFarmerProfileByPhone({ sourceUser: source, targetFarmer: makeTarget(),
        phone: { local: "09171234567", normalized: "+639171234567" } }),
      (error) => error.code === "FARMER_CLAIM_STATE_CHANGED",
    );
    assert.equal(source.clerkId, "clerk-phone");
    assert.equal(source.saved, undefined);
  } finally {
    User.findOneAndUpdate = original;
  }
});

test("phone link restores the source identity when target finalization loses after transfer", async () => {
  const originals = { update: User.findOneAndUpdate, release: User.updateOne };
  const source = makeSource();
  const target = makeTarget();
  const events = [];
  User.findOneAndUpdate = async (filter, update) => {
    if (update.$set?.farmerClaimReservation) {
      events.push("reserve");
      return { ...target, farmerClaimReservation: update.$set.farmerClaimReservation };
    }
    if (update.$set?.["farmerClaimReservation.phase"] === "committing") {
      events.push("committing");
      return target;
    }
    if (String(filter._id) === targetId) {
      events.push("finalize-lost");
      return null;
    }
    events.push("restore-source");
    assert.equal(String(filter._id), sourceId);
    assert.equal(update.$set.clerkId, "clerk-phone");
    return { ...source, ...update.$set };
  };
  source.save = async function () { events.push("transfer"); };
  User.updateOne = async (filter) => {
    events.push("release");
    assert.equal(String(filter._id), targetId);
    assert.ok(filter["farmerClaimReservation.token"]);
    return { modifiedCount: 1 };
  };
  try {
    await assert.rejects(
      linkFarmerProfileByPhone({ sourceUser: source, targetFarmer: target,
        phone: { local: "09171234567", normalized: "+639171234567" } }),
      (error) => error.code === "FARMER_CLAIM_STATE_CHANGED",
    );
    assert.deepEqual(events, ["reserve", "committing", "transfer", "finalize-lost", "restore-source", "release"]);
  } finally {
    User.findOneAndUpdate = originals.update;
    User.updateOne = originals.release;
  }
});

test("failed commit transition releases only its reserved token before source mutation", async () => {
  const originals = { update: User.findOneAndUpdate, release: User.updateOne };
  const source = makeSource();
  const events = [];
  User.findOneAndUpdate = async (_filter, update) => {
    if (update.$set?.farmerClaimReservation) {
      events.push("reserve");
      return { _id: targetId };
    }
    events.push("commit-lost");
    return null;
  };
  User.updateOne = async (filter) => {
    events.push("release");
    assert.equal(filter["farmerClaimReservation.phase"], "reserved");
    return { modifiedCount: 1 };
  };
  try {
    await assert.rejects(linkFarmerProfileByPhone({ sourceUser: source, targetFarmer: makeTarget(),
      phone: { local: "09171234567", normalized: "+639171234567" } }),
    (error) => error.code === "FARMER_CLAIM_STATE_CHANGED");
    assert.deepEqual(events, ["reserve", "commit-lost", "release"]);
    assert.equal(source.saved, undefined);
  } finally {
    User.findOneAndUpdate = originals.update;
    User.updateOne = originals.release;
  }
});

test("uncertain source transfer keeps the critical marker and never reports success", async () => {
  const originals = { update: User.findOneAndUpdate, mark: User.updateOne };
  const source = makeSource();
  const events = [];
  User.findOneAndUpdate = async (_filter, update) => {
    if (update.$set?.farmerClaimReservation) {
      events.push("reserve"); return { _id: targetId };
    }
    events.push("committing"); return { _id: targetId };
  };
  source.save = async () => { events.push("transfer-uncertain"); throw new Error("timeout"); };
  User.updateOne = async (filter, update) => {
    events.push("uncertain");
    assert.equal(filter["farmerClaimReservation.phase"], "committing");
    assert.equal(update.$set["farmerClaimReservation.phase"], "uncertain");
    return { modifiedCount: 1 };
  };
  try {
    await assert.rejects(linkFarmerProfileByPhone({ sourceUser: source, targetFarmer: makeTarget(),
      phone: { local: "09171234567", normalized: "+639171234567" } }),
    (error) => error.code === "FARMER_CLAIM_RECONCILIATION_REQUIRED");
    assert.deepEqual(events, ["reserve", "committing", "transfer-uncertain", "uncertain"]);
  } finally {
    User.findOneAndUpdate = originals.update;
    User.updateOne = originals.mark;
  }
});
