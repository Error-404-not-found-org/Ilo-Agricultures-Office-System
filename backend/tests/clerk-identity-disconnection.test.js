import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import { clerkClient } from "@clerk/clerk-sdk-node";

import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";
import { MedicalRecord } from "../src/models/medical-record.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { disconnectClerkIdentityFromDomainUser } from "../src/services/clerk-identity-disconnection.service.js";
import { resolveOrSyncUser, resolveStaffUser } from "../src/services/auth-user.service.js";
import { assertFarmerCanBeInvited } from "../src/services/farmer-app-invitation.service.js";

const collections = [
  "users",
  "animals",
  "inseminations",
  "healthrequests",
  "medicalrecords",
  "pregnancies",
  "calvings",
  "tasks",
  "fieldnotes",
  "auditlogs",
];

mock.method(clerkClient.users, "getUser", async () => ({}));

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
  await Promise.all(
    collections.map((name) => mongoose.connection.collection(name).deleteMany({})),
  );
  clerkClient.users.getUser.mock.resetCalls();
});

const createLinkedUser = (overrides = {}) =>
  User.create({
    name: "Linked Farmer",
    email: "linked.farmer@example.test",
    clerkId: "clerk_old",
    role: "farmer",
    status: "active",
    isVerified: true,
    profileClaimStatus: "claimed",
    profileClaimedAt: new Date("2026-09-01T00:00:00Z"),
    profileClaimedByClerkId: "clerk_old",
    pushToken: "ExponentPushToken[old]",
    ...overrides,
  });

test("Farmer Clerk deletion preserves the domain identity and clears app access", async () => {
  const farmer = await createLinkedUser();
  const result = await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });
  const stored = await User.findById(farmer._id).lean();

  assert.equal(result.status, "disconnected");
  assert.equal(String(stored._id), String(farmer._id));
  assert.equal(stored.clerkId, undefined);
  assert.equal(stored.profileClaimStatus, "unclaimed");
  assert.equal(stored.profileClaimedByClerkId, "");
  assert.equal(stored.profileClaimedAt, null);
  assert.equal(stored.isVerified, false);
  assert.ok(!stored.pushToken);
  assert.equal(stored.deletedAt, null);
  assert.equal(await User.findOne({ clerkId: "clerk_old" }), null);
  assert.equal(assertFarmerCanBeInvited(stored), farmer.email);
});

test("Farmer livestock and official history survive and still populate the same Farmer", async () => {
  const farmer = await createLinkedUser();
  const animalId = new mongoose.Types.ObjectId();
  const technicianId = new mongoose.Types.ObjectId();
  const linkedDocuments = [
    ["animals", { _id: animalId, farmerId: farmer._id, animalId: "SAFE-1", breed: "Native", species: "Cattle", deletedAt: null }],
    ["inseminations", { farmerId: farmer._id, animalId, technicianId }],
    ["healthrequests", { farmerId: farmer._id, animalId, technicianId }],
    ["medicalrecords", { farmerId: farmer._id, animalId, technicianId, type: "Check-up" }],
    ["pregnancies", { farmerId: farmer._id, animalId }],
    ["calvings", { farmerId: farmer._id, animalId, technicianId }],
    ["tasks", { farmerId: farmer._id, animalIds: [animalId], technicianId }],
    ["fieldnotes", { farmerId: farmer._id, animalId, technicianId, title: "Historical note" }],
  ];
  await Promise.all(linkedDocuments.map(([name, document]) =>
    mongoose.connection.collection(name).insertOne(document)));

  await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });

  for (const [name] of linkedDocuments) {
    assert.equal(
      await mongoose.connection.collection(name).countDocuments({ farmerId: farmer._id }),
      1,
      `${name} must survive Clerk deletion`,
    );
  }
  const populatedAnimal = await Animal.findById(animalId).populate("farmerId");
  assert.equal(String(populatedAnimal.farmerId._id), String(farmer._id));
});

test("disconnected Farmer re-links through canonical resolution without a duplicate", async () => {
  const farmer = await createLinkedUser();
  await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });
  clerkClient.users.getUser.mock.mockImplementation(async () => ({
    id: "clerk_new",
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: "linked.farmer@example.test", verification: { status: "verified" } }],
    firstName: "Linked",
    lastName: "Farmer",
  }));

  const relinked = await resolveOrSyncUser("clerk_new");

  assert.equal(String(relinked._id), String(farmer._id));
  assert.equal(relinked.clerkId, "clerk_new");
  assert.equal(relinked.profileClaimStatus, "claimed");
  assert.equal(await User.countDocuments({ email: farmer.email }), 1);
});

test("duplicate deletion and delayed old events are harmless", async () => {
  const farmer = await createLinkedUser();
  const first = await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });
  const second = await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });
  assert.equal(first.status, "disconnected");
  assert.equal(second.status, "not_found");

  clerkClient.users.getUser.mock.mockImplementation(async () => ({
    id: "clerk_new",
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: farmer.email, verification: { status: "verified" } }],
  }));
  await resolveOrSyncUser("clerk_new");
  const delayed = await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_old" });
  const stored = await User.findById(farmer._id).lean();
  assert.equal(delayed.status, "not_found");
  assert.equal(stored.clerkId, "clerk_new");
  assert.equal(stored.profileClaimStatus, "claimed");
});

test("Technician Clerk deletion suspends access and preserves performed-by references", async () => {
  const technician = await createLinkedUser({ name: "Historical Technician", email: "tech@example.test", role: "technician", clerkId: "clerk_tech", profileClaimedByClerkId: "clerk_tech" });
  const farmer = await createLinkedUser({ email: "farmer@example.test", clerkId: "clerk_farmer", profileClaimedByClerkId: "clerk_farmer" });
  const animalId = new mongoose.Types.ObjectId();
  const recordId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection("medicalrecords").insertOne({ _id: recordId, animalId, farmerId: farmer._id, technicianId: technician._id, type: "Check-up" });

  await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_tech" });
  const stored = await User.findById(technician._id).lean();
  const record = await MedicalRecord.findById(recordId).populate("technicianId");

  assert.equal(stored.clerkId, undefined);
  assert.equal(stored.status, "suspended");
  assert.equal(stored.isVerified, false);
  assert.equal(String(record.technicianId._id), String(technician._id));
  clerkClient.users.getUser.mock.mockImplementation(async () => ({
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: technician.email, verification: { status: "verified" } }],
  }));
  await assert.rejects(
    () => resolveStaffUser("clerk_tech_recreated"),
    (error) => error.code === "ACCOUNT_SUSPENDED",
  );
});

test("Admin Clerk deletion preserves audit attribution while disabling access", async () => {
  const admin = await createLinkedUser({ name: "Historical Admin", email: "admin@example.test", role: "admin", clerkId: "clerk_admin", profileClaimStatus: "none", profileClaimedByClerkId: "" });
  const audit = await AuditLog.create({ entityType: "User", entityId: admin._id, action: "review", actorId: admin._id });

  await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_admin" });
  const stored = await User.findById(admin._id).lean();
  const populatedAudit = await AuditLog.findById(audit._id).populate("actorId");

  assert.equal(stored.status, "suspended");
  assert.equal(stored.clerkId, undefined);
  assert.equal(String(populatedAudit.actorId._id), String(admin._id));
});

test("unknown Clerk IDs and unrelated manual Farmers are safe no-ops", async () => {
  const manual = await User.create({ name: "Manual Farmer", email: "manual@example.test", role: "farmer", profileClaimStatus: "unclaimed", isVerified: false });
  const result = await disconnectClerkIdentityFromDomainUser({ clerkId: "clerk_unknown" });
  const stored = await User.findById(manual._id).lean();

  assert.equal(result.status, "not_found");
  assert.equal(stored.profileClaimStatus, "unclaimed");
  assert.equal(stored.deletedAt, null);
});

test("Inngest deletion handler delegates and contains no domain User hard delete", () => {
  const source = fs.readFileSync(new URL("../src/config/inngest.js", import.meta.url), "utf8");
  assert.match(source, /disconnectClerkIdentityFromDomainUser\(\{\s*clerkId\s*\}\)/);
  assert.doesNotMatch(source, /User\.(?:deleteOne|findOneAndDelete|findByIdAndDelete)\(\{\s*clerkId/);
});

test("Clerk create/update events use protected canonical identity resolution", () => {
  const source = fs.readFileSync(new URL("../src/config/inngest.js", import.meta.url), "utf8");
  const syncHandler = source.slice(
    source.indexOf("const handleUserSync"),
    source.indexOf("const syncUserCreated"),
  );
  assert.match(syncHandler, /resolveOrSyncUser\(clerkId\)/);
  assert.match(syncHandler, /resolveStaffUser\(clerkId\)/);
  assert.doesNotMatch(syncHandler, /user\.clerkId\s*=\s*clerkId/);
  assert.doesNotMatch(syncHandler, /User\.create/);
});
