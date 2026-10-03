import "./stable-clerk-client.js";
import test from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { accountStatusClerkUsers } from "../src/services/account-status-clerk.service.js";
import { User } from "../src/models/user.model.js";
import { restoreUser } from "../src/controllers/user.controllers.js";
import { deleteUser as archiveUserAsAdmin } from "../src/controllers/admin.controllers.js";
import { AuditLog } from "../src/models/audit-log.model.js";

test("restoring an archived suspended Farmer does not unban Clerk", async () => {
  const originalFindById = User.findById;
  const originalUnbanUser = accountStatusClerkUsers.unbanUser;
  let unbanCalls = 0;
  const farmer = {
    _id: "507f1f77bcf86cd799439012",
    role: "farmer",
    status: "suspended",
    clerkId: "user_real_farmer",
    deletedAt: new Date("2026-09-01"),
    deactivatedBy: "507f1f77bcf86cd799439011",
    async save() {},
  };
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => { unbanCalls += 1; };
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await restoreUser(
      { params: { id: farmer._id }, user: { _id: "507f1f77bcf86cd799439011", role: "admin" } },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(farmer.deletedAt, null);
    assert.equal(farmer.status, "suspended");
    assert.equal(unbanCalls, 0);
  } finally {
    User.findById = originalFindById;
    accountStatusClerkUsers.unbanUser = originalUnbanUser;
  }
});

test("restoring an archived active Farmer may unban Clerk", async () => {
  const originalFindById = User.findById;
  const originalUnbanUser = accountStatusClerkUsers.unbanUser;
  let unbanCalls = 0;
  const farmer = {
    _id: "507f1f77bcf86cd799439013", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: new Date(), async save() {},
  };
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => { unbanCalls += 1; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await restoreUser({ params: { id: farmer._id }, user: { role: "admin" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(unbanCalls, 1);
    assert.equal(farmer.deletedAt, null);
  } finally {
    User.findById = originalFindById;
    accountStatusClerkUsers.unbanUser = originalUnbanUser;
  }
});

test("runtime Clerk client archives linked Farmer before the Mongo write", async () => {
  const originals = {
    find: User.findById, update: User.findOneAndUpdate,
    ban: accountStatusClerkUsers.banUser, oldBan: clerkClient.users.banUser,
    audit: AuditLog.create,
  };
  const farmer = { _id: "507f1f77bcf86cd799439015", role: "farmer", status: "active",
    profileClaimStatus: "claimed", clerkId: "user_real_farmer", deletedAt: null };
  const events = [];
  User.findById = async () => farmer;
  User.findOneAndUpdate = async (_filter, update) => {
    events.push("mongo"); return { ...farmer, ...update.$set };
  };
  AuditLog.create = async () => ({});
  accountStatusClerkUsers.banUser = async () => { events.push("ban"); };
  clerkClient.users.banUser = undefined;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } };
  try {
    await archiveUserAsAdmin({ body: { id: farmer._id }, user: { _id: "507f1f77bcf86cd799439011", role: "admin" } }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(events, ["ban", "mongo"]);
  } finally {
    User.findById = originals.find;
    User.findOneAndUpdate = originals.update;
    AuditLog.create = originals.audit;
    accountStatusClerkUsers.banUser = originals.ban;
    clerkClient.users.banUser = originals.oldBan;
  }
});

test("Restore unbans through runtime client and re-bans if Mongo save fails", async () => {
  const originals = { find: User.findById, ban: accountStatusClerkUsers.banUser,
    unban: accountStatusClerkUsers.unbanUser, oldUnban: clerkClient.users.unbanUser };
  const events = [];
  const farmer = { _id: "507f1f77bcf86cd799439016", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: new Date(),
    async save() { events.push("mongo-fail"); throw new Error("db unavailable"); } };
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => { events.push("unban"); };
  accountStatusClerkUsers.banUser = async () => { events.push("ban"); };
  clerkClient.users.unbanUser = undefined;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  try {
    await restoreUser({ params: { id: farmer._id }, user: { role: "admin" } }, response);
    assert.notEqual(response.statusCode, 200);
    assert.deepEqual(events, ["unban", "mongo-fail", "ban"]);
  } finally {
    User.findById = originals.find;
    accountStatusClerkUsers.banUser = originals.ban;
    accountStatusClerkUsers.unbanUser = originals.unban;
    clerkClient.users.unbanUser = originals.oldUnban;
  }
});

test("Restore of unlinked Farmer changes only local archive fields", async () => {
  const originals = { find: User.findById, unban: accountStatusClerkUsers.unbanUser };
  const farmer = { _id: "507f1f77bcf86cd799439017", role: "farmer", status: "active",
    clerkId: "manual_farmer", deletedAt: new Date(), async save() {} };
  let unbanCalls = 0;
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => { unbanCalls += 1; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  try {
    await restoreUser({ params: { id: farmer._id }, user: { role: "admin" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(unbanCalls, 0);
    assert.equal(farmer.deletedAt, null);
    assert.equal(String(farmer._id), "507f1f77bcf86cd799439017");
  } finally {
    User.findById = originals.find;
    accountStatusClerkUsers.unbanUser = originals.unban;
  }
});

test("Restore leaves archived Farmer unchanged when runtime Clerk unban fails", async () => {
  const originals = { find: User.findById, unban: accountStatusClerkUsers.unbanUser };
  const archivedAt = new Date("2026-09-01");
  const farmer = { _id: "507f1f77bcf86cd799439018", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: archivedAt,
    async save() { throw new Error("must not save"); } };
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => { throw new Error("Clerk unavailable"); };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  try {
    await restoreUser({ params: { id: farmer._id }, user: { role: "admin" } }, response);
    assert.equal(response.statusCode, 502);
    assert.equal(response.body.code, "CLERK_RESTORE_FAILED");
    assert.equal(farmer.deletedAt, archivedAt);
  } finally {
    User.findById = originals.find;
    accountStatusClerkUsers.unbanUser = originals.unban;
  }
});

test("Restore reports reconciliation when Mongo save and Clerk re-ban both fail", async () => {
  const originals = { find: User.findById, unban: accountStatusClerkUsers.unbanUser,
    ban: accountStatusClerkUsers.banUser };
  const archivedAt = new Date("2026-09-01");
  const farmer = { _id: "507f1f77bcf86cd799439019", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: archivedAt,
    async save() { throw new Error("db unavailable"); } };
  User.findById = async () => farmer;
  accountStatusClerkUsers.unbanUser = async () => {};
  accountStatusClerkUsers.banUser = async () => { throw new Error("Clerk unavailable"); };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
  try {
    await restoreUser({ params: { id: farmer._id }, user: { role: "admin" } }, response);
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.code, "FARMER_RESTORE_RECONCILIATION_REQUIRED");
    assert.equal(farmer.deletedAt, archivedAt);
  } finally {
    User.findById = originals.find;
    accountStatusClerkUsers.unbanUser = originals.unban;
    accountStatusClerkUsers.banUser = originals.ban;
  }
});

test("Admin archive reconciles a claimed Farmer's stale pending invitation", async () => {
  const originalFindById = User.findById;
  const originalUpdate = User.findOneAndUpdate;
  const originalAudit = AuditLog.create;
  const originalBanUser = accountStatusClerkUsers.banUser;
  let banCalls = 0;
  let saveCalls = 0;
  let finalUpdate;
  const farmer = {
    _id: "507f1f77bcf86cd799439014", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: null, profileClaimStatus: "claimed",
    farmerAppInvitation: { status: "pending", expiresAt: new Date(Date.now() + 60_000) },
    async save() { saveCalls += 1; },
  };
  User.findById = async () => farmer;
  User.findOneAndUpdate = async (_filter, update) => {
    finalUpdate = update;
    return { ...farmer, ...update.$set };
  };
  AuditLog.create = async () => ({});
  accountStatusClerkUsers.banUser = async () => { banCalls += 1; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } };
  try {
    await archiveUserAsAdmin({ body: { id: farmer._id }, user: { _id: "507f1f77bcf86cd799439011", role: "admin" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(banCalls, 1);
    assert.equal(saveCalls, 0);
    assert.equal(finalUpdate.$set["farmerAppInvitation.status"], "accepted");
  } finally {
    User.findById = originalFindById;
    User.findOneAndUpdate = originalUpdate;
    AuditLog.create = originalAudit;
    accountStatusClerkUsers.banUser = originalBanUser;
  }
});

test("Admin archive bans a linked Farmer while preserving their User identity and status", async () => {
  const originals = {
    findById: User.findById,
    update: User.findOneAndUpdate,
    banUser: accountStatusClerkUsers.banUser,
    createAudit: AuditLog.create,
  };
  let banCalls = 0;
  let saveCalls = 0;
  const farmer = {
    _id: "507f1f77bcf86cd799439015", role: "farmer", status: "active",
    clerkId: "user_real_farmer", deletedAt: null, isVerified: true,
    farmerAppInvitation: undefined,
    async save() { saveCalls += 1; },
  };
  User.findById = async () => farmer;
  User.findOneAndUpdate = async (_filter, update) => ({ ...farmer, ...update.$set });
  accountStatusClerkUsers.banUser = async () => { banCalls += 1; };
  AuditLog.create = async () => ({});
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } };
  try {
    await archiveUserAsAdmin({ body: { id: farmer._id }, user: { _id: "507f1f77bcf86cd799439011", role: "admin" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(banCalls, 1);
    assert.equal(saveCalls, 0);
    assert.equal(farmer._id, "507f1f77bcf86cd799439015");
    assert.equal(farmer.status, "active");
    assert.equal(farmer.isVerified, true);
  } finally {
    User.findById = originals.findById;
    User.findOneAndUpdate = originals.update;
    accountStatusClerkUsers.banUser = originals.banUser;
    AuditLog.create = originals.createAudit;
  }
});
