import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { completeTechnicianOnboarding } from "../src/controllers/technician.controllers.js";
import { User } from "../src/models/user.model.js";

describe("Technician onboarding", () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db",
      );
    }
  });

  after(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  const invoke = async (user, body = {}) => {
    const response = { statusCode: null, body: null };
    const req = { user: { _id: user._id, role: user.role }, body };
    const res = {
      status(statusCode) {
        response.statusCode = statusCode;
        return {
          json(payload) {
            response.body = payload;
          },
        };
      },
    };
    await completeTechnicianOnboarding(req, res);
    return response;
  };

  it("creates invited Technicians with onboarding incomplete", async () => {
    const technician = await User.create({
      name: "New Technician",
      email: "new.technician@example.com",
      role: "technician",
      profileClaimStatus: "unclaimed",
    });

    assert.equal(technician.technicianOnboardingCompletedAt, null);
  });

  it("uses a server timestamp and preserves an Off Duty dispatch profile", async () => {
    const technician = await User.create({
      name: "Claimed Technician",
      email: "claimed.technician@example.com",
      role: "technician",
      profileClaimStatus: "claimed",
      dispatchProfile: {
        availabilityStatus: "off_duty",
        acceptsNewRequests: false,
      },
    });
    const before = Date.now();

    const response = await invoke(technician, {
      technicianOnboardingCompletedAt: "2000-01-01T00:00:00.000Z",
      userId: new mongoose.Types.ObjectId().toString(),
    });

    const stored = await User.findById(technician._id).lean();
    assert.equal(response.statusCode, 200);
    assert.ok(stored.technicianOnboardingCompletedAt.getTime() >= before);
    assert.notEqual(stored.technicianOnboardingCompletedAt.getUTCFullYear(), 2000);
    assert.equal(stored.dispatchProfile.availabilityStatus, "off_duty");
    assert.equal(stored.dispatchProfile.acceptsNewRequests, false);
  });

  it("is idempotent and preserves the original completion timestamp", async () => {
    const technician = await User.create({
      name: "Returning Technician",
      email: "returning.technician@example.com",
      role: "technician",
      profileClaimStatus: "claimed",
    });
    const first = await invoke(technician);
    const second = await invoke(technician);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(
      new Date(first.body.technicianOnboardingCompletedAt).getTime(),
      new Date(second.body.technicianOnboardingCompletedAt).getTime(),
    );
  });

  it("does not complete onboarding for an unclaimed Technician profile", async () => {
    const technician = await User.create({
      name: "Unclaimed Technician",
      email: "unclaimed.technician@example.com",
      role: "technician",
      profileClaimStatus: "unclaimed",
    });

    const response = await invoke(technician);
    const stored = await User.findById(technician._id).lean();

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "TECHNICIAN_PROFILE_NOT_CLAIMED");
    assert.equal(stored.technicianOnboardingCompletedAt, null);
  });

  it("rejects Farmer and Admin callers without modifying them", async () => {
    for (const role of ["farmer", "admin"]) {
      const user = await User.create({
        name: `${role} account`,
        email: `${role}@example.com`,
        role,
      });
      const response = await invoke(user);
      const stored = await User.findById(user._id).lean();

      assert.equal(response.statusCode, 403);
      assert.equal(stored.technicianOnboardingCompletedAt, null);
    }
  });
});
