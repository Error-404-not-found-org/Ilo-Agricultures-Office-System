import { describe, it, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { ENV } from "../src/config/env.js";
import { resolveOrSyncUser } from "../src/services/auth-user.service.js";
import { bootstrapUser } from "../src/controllers/user.controllers.js";
import { requireClerkAuthentication, protectedRoute } from "../src/middleware/auth.middleware.js";

// We mock clerkClient.users.getUser
mock.method(clerkClient.users, "getUser", async () => ({}));

describe("User Sync Bootstrap Hotfix Tests", () => {
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
    clerkClient.users.getUser.mock.resetCalls();
  });

  const mockClerkUser = (overrides = {}) => {
    clerkClient.users.getUser.mock.mockImplementation(async () => ({
      id: "clerk_123",
      primaryEmailAddressId: "email_1",
      emailAddresses: [{ id: "email_1", emailAddress: "test@example.com", verification: { status: "verified" } }],
      firstName: "Test",
      lastName: "User",
      ...overrides
    }));
  };

  describe("Service: resolveOrSyncUser", () => {
    it("1. Existing user found by clerkId is returned", async () => {
      const user = await User.create({ name: "Existing", email: "existing@example.com", clerkId: "clerk_existing", role: "farmer", isVerified: true });
      const resolved = await resolveOrSyncUser("clerk_existing");
      assert.strictEqual(resolved._id.toString(), user._id.toString());
    });

    it("2. New verified Clerk identity creates exactly one Farmer", async () => {
      mockClerkUser({ id: "clerk_new", emailAddresses: [{ id: "email_1", emailAddress: "new@example.com", verification: { status: "verified" } }] });
      const user = await resolveOrSyncUser("clerk_new");
      assert.strictEqual(user.role, "farmer");
      const count = await User.countDocuments({ email: "new@example.com" });
      assert.strictEqual(count, 1);
    });

    it("3. Repeated bootstrap returns the same MongoDB user", async () => {
      mockClerkUser({ id: "clerk_repeat", emailAddresses: [{ id: "email_1", emailAddress: "repeat@example.com", verification: { status: "verified" } }] });
      const user1 = await resolveOrSyncUser("clerk_repeat");
      const user2 = await resolveOrSyncUser("clerk_repeat");
      assert.strictEqual(user1._id.toString(), user2._id.toString());
    });

    it("4. Two concurrent bootstrap calls do not create duplicate users", async () => {
      mockClerkUser({ id: "clerk_concurrent", emailAddresses: [{ id: "email_1", emailAddress: "concurrent@example.com", verification: { status: "verified" } }] });
      const [user1, user2] = await Promise.all([
        resolveOrSyncUser("clerk_concurrent"),
        resolveOrSyncUser("clerk_concurrent")
      ]);
      assert.strictEqual(user1._id.toString(), user2._id.toString());
      const count = await User.countDocuments({ email: "concurrent@example.com" });
      assert.strictEqual(count, 1);
    });

    it("5. Pending Technician is claimed through verified normalized email", async () => {
      await User.create({
        name: "Tech Pending",
        email: "tech@example.com",
        role: "technician",
        profileClaimStatus: "unclaimed",
        isVerified: false,
        dispatchProfile: {
          serviceMunicipalities: [],
          availabilityStatus: "off_duty",
          acceptsNewRequests: false,
        },
      });
      mockClerkUser({ id: "clerk_tech", emailAddresses: [{ id: "email_1", emailAddress: "TECH@example.com", verification: { status: "verified" } }] });

      const user = await resolveOrSyncUser("clerk_tech");
      assert.strictEqual(user.role, "technician");
      assert.strictEqual(user.clerkId, "clerk_tech");
      assert.strictEqual(user.profileClaimStatus, "claimed");
      assert.strictEqual(user.dispatchProfile.acceptsNewRequests, false);
      assert.deepStrictEqual(user.dispatchProfile.serviceMunicipalities, []);
    });

    it("6. Technician role remains Technician", async () => {
      await User.create({ name: "Tech Unclaimed", email: "tech2@example.com", role: "technician", profileClaimStatus: "unclaimed", isVerified: false });
      mockClerkUser({ id: "clerk_tech2", emailAddresses: [{ id: "email_1", emailAddress: "tech2@example.com", verification: { status: "verified" } }] });
      const user = await resolveOrSyncUser("clerk_tech2");
      assert.strictEqual(user.role, "technician");
    });

    it("7. No duplicate Farmer is created for a Technician", async () => {
      await User.create({ name: "Tech Unclaimed 3", email: "tech3@example.com", role: "technician", profileClaimStatus: "unclaimed", isVerified: false });
      mockClerkUser({ id: "clerk_tech3", emailAddresses: [{ id: "email_1", emailAddress: "tech3@example.com", verification: { status: "verified" } }] });
      await resolveOrSyncUser("clerk_tech3");
      const count = await User.countDocuments({ email: "tech3@example.com" });
      assert.strictEqual(count, 1);
    });

    it("7a. Invited Farmer bootstrap claims the existing profile without replacing domain data", async () => {
      const existing = await User.create({
        name: "Invited Farmer",
        email: "invited.farmer@example.com",
        phoneNumber: "09171234567",
        normalizedPhoneNumber: "+639171234567",
        address: { barangay: "Poblacion", city: "Oton", province: "Iloilo" },
        role: "farmer",
        registeredByTechnician: true,
        profileClaimStatus: "unclaimed",
        isVerified: false,
      });
      mockClerkUser({
        id: "clerk_farmer_claim",
        emailAddresses: [{
          id: "email_1",
          emailAddress: "INVITED.FARMER@example.com",
          verification: { status: "verified" },
        }],
      });

      const resolved = await resolveOrSyncUser("clerk_farmer_claim");
      assert.strictEqual(resolved._id.toString(), existing._id.toString());
      assert.strictEqual(resolved.role, "farmer");
      assert.strictEqual(resolved.profileClaimStatus, "claimed");
      assert.ok(resolved.profileClaimedAt instanceof Date);
      assert.strictEqual(resolved.profileClaimedByClerkId, "clerk_farmer_claim");
      assert.strictEqual(resolved.phoneNumber, "09171234567");
      assert.strictEqual(resolved.address.barangay, "Poblacion");
      assert.strictEqual(
        await User.countDocuments({ normalizedEmail: "invited.farmer@example.com" }),
        1,
      );
    });

    it("7b. Existing Clerk-linked Farmer with stale claim metadata is reconciled", async () => {
      const existing = await User.create({
        name: "Linked Farmer",
        email: "linked.farmer@example.com",
        clerkId: "clerk_linked_farmer",
        role: "farmer",
        profileClaimStatus: "unclaimed",
        registeredByTechnician: true,
      });

      const resolved = await resolveOrSyncUser("clerk_linked_farmer");
      assert.strictEqual(resolved._id.toString(), existing._id.toString());
      assert.strictEqual(resolved.profileClaimStatus, "claimed");
      assert.ok(resolved.profileClaimedAt instanceof Date);
      assert.strictEqual(
        resolved.profileClaimedByClerkId,
        "clerk_linked_farmer",
      );
    });

    it("8. Existing Admin remains Admin", async () => {
      await User.create({ name: "Admin", email: "admin@example.com", role: "admin", clerkId: "clerk_admin", isVerified: true });
      mockClerkUser({ id: "clerk_admin", emailAddresses: [{ id: "email_1", emailAddress: "admin@example.com", verification: { status: "verified" } }] });
      const user = await resolveOrSyncUser("clerk_admin");
      assert.strictEqual(user.role, "admin");
    });

    it("11. Name-based linking is not performed", async () => {
      await User.create({ name: "Unique Name", role: "farmer", isVerified: true }); // No email
      mockClerkUser({ id: "clerk_name", firstName: "Unique", lastName: "Name", emailAddresses: [{ id: "email_1", emailAddress: "different@example.com", verification: { status: "verified" } }] });
      const user = await resolveOrSyncUser("clerk_name");
      assert.strictEqual(user.email, "different@example.com");
      const original = await User.findOne({ name: "Unique Name" });
      assert.strictEqual(original.clerkId, undefined);
    });

    it("12. Unverified primary email returns 403 EMAIL_NOT_VERIFIED", async () => {
      mockClerkUser({ emailAddresses: [{ id: "email_1", emailAddress: "unverified@example.com", verification: { status: "unverified" } }] });
      await assert.rejects(
        async () => await resolveOrSyncUser("clerk_123"),
        (err) => err.code === "EMAIL_NOT_VERIFIED" && err.status === 403
      );
    });

    it("13. Missing primary email returns the expected controlled error", async () => {
      mockClerkUser({ emailAddresses: [] });
      await assert.rejects(
        async () => await resolveOrSyncUser("clerk_123"),
        (err) => err.code === "PRIMARY_EMAIL_REQUIRED" && err.status === 400
      );
    });

    it("14. Different existing clerkId returns 409 IDENTITY_LINK_CONFLICT", async () => {
      await User.create({ name: "Conflict", email: "conflict@example.com", clerkId: "clerk_other", role: "farmer", isVerified: true });
      mockClerkUser({ id: "clerk_new", emailAddresses: [{ id: "email_1", emailAddress: "conflict@example.com", verification: { status: "verified" } }] });
      await assert.rejects(
        async () => await resolveOrSyncUser("clerk_new"),
        (err) => err.code === "IDENTITY_LINK_CONFLICT" && err.status === 409
      );
    });

    it("15. Stored conflicting clerkId remains unchanged", async () => {
      await User.create({ name: "Conflict 2", email: "conflict2@example.com", clerkId: "clerk_other2", role: "farmer", isVerified: true });
      mockClerkUser({ id: "clerk_new2", emailAddresses: [{ id: "email_1", emailAddress: "conflict2@example.com", verification: { status: "verified" } }] });
      try { await resolveOrSyncUser("clerk_new2"); } catch (e) {}
      const user = await User.findOne({ email: "conflict2@example.com" });
      assert.strictEqual(user.clerkId, "clerk_other2");
    });

    it("16. Suspended user returns 403 ACCOUNT_SUSPENDED", async () => {
      await User.create({ name: "Suspended", email: "suspended@example.com", clerkId: "clerk_susp", role: "farmer", status: "suspended", isVerified: true });
      mockClerkUser({ id: "clerk_susp", emailAddresses: [{ id: "email_1", emailAddress: "suspended@example.com", verification: { status: "verified" } }] });
      await assert.rejects(
        async () => await resolveOrSyncUser("clerk_susp"),
        (err) => err.code === "ACCOUNT_SUSPENDED" && err.status === 403
      );
    });

    it("17. User with deletedAt returns 403 ACCOUNT_DELETED", async () => {
      await User.create({ name: "Deleted", email: "deleted@example.com", clerkId: "clerk_del", role: "farmer", deletedAt: new Date(), isVerified: true });
      mockClerkUser({ id: "clerk_del", emailAddresses: [{ id: "email_1", emailAddress: "deleted@example.com", verification: { status: "verified" } }] });
      await assert.rejects(
        async () => await resolveOrSyncUser("clerk_del"),
        (err) => err.code === "ACCOUNT_DELETED" && err.status === 403
      );
    });
  });

  describe("API: /api/user/bootstrap & Middlewares", () => {
    it("18. Invalid Clerk session returns 401 AUTH_REQUIRED", async () => {
      const req = { auth: null };
      const res = { status: mock.fn(() => res), json: mock.fn() };

      requireClerkAuthentication(req, res, () => {});
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].code, "AUTH_REQUIRED");
    });

    it("19. Bootstrap works without a pre-existing req.user", async () => {
      mockClerkUser({ id: "clerk_valid", emailAddresses: [{ id: "email_1", emailAddress: "valid@example.com", verification: { status: "verified" } }] });

      const req = { clerkId: "clerk_valid" };
      const res = { status: mock.fn(() => res), json: mock.fn() };

      await bootstrapUser(req, res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].success, true);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].user.role, "farmer");
    });

    it("2. Global middleware does not block bootstrap (global failure)", async () => {
      // Suppose global middleware ran and failed:
      const req = { auth: { userId: "clerk_bypass" }, userResolutionError: true };
      const res = { status: mock.fn(() => res), json: mock.fn() };

      // Step 1: requireClerkAuthentication should succeed and call next
      let nextCalled = false;
      requireClerkAuthentication(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true);

      // Step 2: bootstrapUser shouldn't care about req.userResolutionError
      await bootstrapUser(req, res);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].success, true);
    });

    it("20. Protected controllers do not execute when no MongoDB user resolves", async () => {
      const req = { auth: { userId: "clerk_unresolved" } };
      const res = { status: mock.fn(() => res), json: mock.fn() };

      clerkClient.users.getUser.mock.mockImplementation(async () => { throw new Error("API Error"); });

      await protectedRoute(req, res, () => {
        assert.fail("Next should not be called");
      });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 503);
      assert.strictEqual(res.json.mock.calls[0].arguments[0].code, "USER_SYNC_UNAVAILABLE");
    });
  });
});
