import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { updateDispatchStatus } from "../src/controllers/technician.controllers.js";

describe("Dispatch Profile APIs", () => {
  let techUser;
  let legacyTechUser;

  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test_db");
    }
  });

  after(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    techUser = new User({
      clerkId: new mongoose.Types.ObjectId().toString(),
      email: "modern@tech.com",
      name: "Modern Tech",
      role: "technician",
      status: "active",
      isVerified: true,
      dispatchProfile: {
        availabilityStatus: "available",
        acceptsNewRequests: true,
        serviceCapabilities: ["AI"],
        serviceMunicipalities: [{ municipalityCode: "063043000", municipalityName: "Tigbauan" }]
      }
    });
    await techUser.save();

    legacyTechUser = new User({
      clerkId: new mongoose.Types.ObjectId().toString(),
      email: "legacy@tech.com",
      name: "Legacy Tech",
      role: "technician",
      status: "active",
      isVerified: true
      // Intentionally missing dispatchProfile
    });
    await legacyTechUser.save();
  });

  const mockReqRes = (userId, role, body) => {
    let response = { statusCode: null, body: null };
    const req = { user: { _id: userId, role }, body };
    const res = {
      status: (code) => {
        response.statusCode = code;
        return {
          json: (data) => {
            response.body = data;
          }
        };
      }
    };
    return { req, res, response };
  };

  it("PATCH /api/technician/dispatch-status updates availability and acceptsNewRequests", async () => {
    const { req, res, response } = mockReqRes(techUser._id, "technician", {
      availabilityStatus: "busy",
      acceptsNewRequests: false
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.dispatchProfile.availabilityStatus, "busy");
    assert.equal(response.body.dispatchProfile.acceptsNewRequests, false);

    const dbUser = await User.findById(techUser._id).lean();
    assert.equal(dbUser.dispatchProfile.availabilityStatus, "busy");
    assert.equal(dbUser.dispatchProfile.acceptsNewRequests, false);
  });

  it("Farmer or non-Technician cannot update dispatch status", async () => {
    const { req, res, response } = mockReqRes(techUser._id, "farmer", {
      acceptsNewRequests: false
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.body.message, "Forbidden");
  });

  it("Admin-managed municipalities and capabilities cannot be modified by the Technician endpoint", async () => {
    const { req, res, response } = mockReqRes(techUser._id, "technician", {
      serviceCapabilities: ["HEALTH"],
      serviceMunicipalities: [{ municipalityCode: "123456789", municipalityName: "Fake" }]
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message, "No updates provided.");
    
    // Ensure DB unchanged
    const dbUser = await User.findById(techUser._id).lean();
    assert.ok(dbUser.dispatchProfile.serviceCapabilities.includes("AI"));
    assert.ok(!dbUser.dispatchProfile.serviceCapabilities.includes("HEALTH"));
  });

  it("invalid availabilityStatus is rejected", async () => {
    const { req, res, response } = mockReqRes(techUser._id, "technician", {
      availabilityStatus: "vacation"
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 400);
    assert.equal(response.body.message, "Invalid availability status.");
  });

  it("missing or unchanged field when only the toggle is sent preserves availabilityStatus", async () => {
    const { req, res, response } = mockReqRes(techUser._id, "technician", {
      acceptsNewRequests: false
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 200);
    const dbUser = await User.findById(techUser._id).lean();
    assert.equal(dbUser.dispatchProfile.availabilityStatus, "available", "Availability remains unchanged");
    assert.equal(dbUser.dispatchProfile.acceptsNewRequests, false);
  });

  it("Strict Boolean Validation: rejects non-boolean acceptsNewRequests", async () => {
    const cases = ["true", "false", 1, null, ""];
    for (const val of cases) {
      const { req, res, response } = mockReqRes(techUser._id, "technician", {
        acceptsNewRequests: val
      });
      await updateDispatchStatus(req, res);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.message, "acceptsNewRequests must be a boolean.");
    }
  });

  it("Legacy Technician accepting-requests toggle persists safely via database", async () => {
    const { req, res, response } = mockReqRes(legacyTechUser._id, "technician", {
      acceptsNewRequests: true
    });

    await updateDispatchStatus(req, res);

    assert.equal(response.statusCode, 200);

    const dbUser = await User.findById(legacyTechUser._id).lean();
    assert.ok(dbUser.dispatchProfile);
    assert.equal(dbUser.dispatchProfile.acceptsNewRequests, true);
    assert.equal(dbUser.dispatchProfile.availabilityStatus, "off_duty", "Initialized to off_duty");
    assert.ok(!dbUser.dispatchProfile.serviceCapabilities || dbUser.dispatchProfile.serviceCapabilities.length === 0);
    assert.ok(!dbUser.dispatchProfile.serviceMunicipalities || dbUser.dispatchProfile.serviceMunicipalities.length === 0);
  });
});
