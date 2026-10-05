import "./stable-clerk-client.js";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { updateFarmerProfileByTechnician } from "../src/controllers/user.controllers.js";

const originals = {
  findById: User.findById,
  findOne: User.findOne,
  auditCreate: AuditLog.create,
  list: clerkClient.invitations.getInvitationList,
  revoke: clerkClient.invitations.revokeInvitation,
  consoleError: console.error,
};

afterEach(() => {
  User.findById = originals.findById;
  User.findOne = originals.findOne;
  AuditLog.create = originals.auditCreate;
  clerkClient.invitations.getInvitationList = originals.list;
  clerkClient.invitations.revokeInvitation = originals.revoke;
  console.error = originals.consoleError;
});

const FUTURE = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
const PAST = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

const farmer = (overrides = {}) => ({
  _id: "farmer-1",
  name: "Alma Tajo",
  role: "farmer",
  status: "active",
  profileClaimStatus: "unclaimed",
  registeredByTechnician: true,
  email: "old@example.com",
  normalizedEmail: "old@example.com",
  deletedAt: null,
  events: [],
  saveCount: 0,
  async save() {
    this.saveCount += 1;
    this.events.push("save");
    return this;
  },
  ...overrides,
});

const pendingInvitation = (overrides = {}) => ({
  status: "pending",
  clerkInvitationId: "inv-live",
  email: "old@example.com",
  expiresAt: FUTURE,
  ...overrides,
});

const edit = async (target, body) => {
  User.findById = async () => target;
  const recorder = responseRecorder();
  await updateFarmerProfileByTechnician(
    {
      params: { id: target._id },
      body,
      user: { _id: "technician-1", role: "technician", name: "Technician" },
    },
    recorder.response,
  );
  return recorder;
};

const noEmailOwner = () => {
  User.findOne = async () => null;
};

const stubClerk = ({ pendingIds = [], revokeStatus = "revoked", listFails = false } = {}) => {
  const calls = { list: 0, revoked: [] };
  clerkClient.invitations.getInvitationList = async () => {
    calls.list += 1;
    if (listFails) throw new Error("Clerk unavailable");
    return { data: pendingIds.map((id) => ({ id, status: "pending" })) };
  };
  clerkClient.invitations.revokeInvitation = async (id) => {
    calls.revoked.push(id);
    return { id, status: revokeStatus };
  };
  return calls;
};

const stubAudit = () => {
  const entries = [];
  AuditLog.create = async (entry) => {
    entries.push(entry);
    return entry;
  };
  return entries;
};

test("No App Account: email is validated, normalized and saved without touching Clerk", async () => {
  noEmailOwner();
  const clerk = stubClerk();
  const audit = stubAudit();
  const target = farmer();

  const recorder = await edit(target, { email: "  New.Farmer@Example.COM " });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.email, "new.farmer@example.com");
  assert.equal(target.normalizedEmail, "new.farmer@example.com");
  assert.equal(target.saveCount, 1);
  assert.equal(recorder.body.appAccountStatus, "no_app_account");
  assert.equal(recorder.body.invitationRevoked, false);
  assert.equal(clerk.list, 0);
  assert.deepEqual(clerk.revoked, []);
  assert.equal(audit[0]?.action, "update_farmer_email");
});

test("No App Account: a Farmer without any email can be given one", async () => {
  noEmailOwner();
  stubClerk();
  stubAudit();
  const target = farmer({ email: undefined, normalizedEmail: undefined });

  const recorder = await edit(target, { email: "First@Example.com" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.email, "first@example.com");
  assert.equal(recorder.body.appAccountStatus, "no_app_account");
});

test("Invitation Sent: active invitation is revoked, then the Farmer resets to No App Account and the new email is saved", async () => {
  noEmailOwner();
  const target = farmer({ farmerAppInvitation: pendingInvitation() });
  const calls = { order: [] };
  clerkClient.invitations.getInvitationList = async () => {
    target.events.push("list");
    return { data: [{ id: "inv-live", status: "pending" }] };
  };
  clerkClient.invitations.revokeInvitation = async (id) => {
    target.events.push("revoke");
    calls.revoked = id;
    return { id, status: "revoked" };
  };
  const audit = stubAudit();

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(calls.revoked, "inv-live");
  assert.deepEqual(target.events, ["list", "revoke", "save"]);
  assert.equal(target.email, "new@example.com");
  assert.equal(target.farmerAppInvitation, undefined);
  assert.equal(recorder.body.appAccountStatus, "no_app_account");
  assert.equal(recorder.body.invitationRevoked, true);
  assert.equal(audit[0]?.action, "update_farmer_email");
});

test("Invitation Sent: the old invitation is never left valid when revocation cannot be confirmed", async () => {
  noEmailOwner();
  const target = farmer({ farmerAppInvitation: pendingInvitation() });
  clerkClient.invitations.getInvitationList = async () => ({
    data: [{ id: "inv-live", status: "pending" }],
  });
  clerkClient.invitations.revokeInvitation = async (id) => ({ id, status: "pending" });
  console.error = () => {};

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 503);
  assert.equal(recorder.body.code, "FARMER_INVITATION_REVOKE_FAILED");
  assert.equal(target.email, "old@example.com");
  assert.equal(target.farmerAppInvitation.status, "pending");
  assert.equal(target.saveCount, 0);
});

test("Invitation Sent: Clerk lookup failure blocks the email change", async () => {
  noEmailOwner();
  const target = farmer({ farmerAppInvitation: pendingInvitation() });
  stubClerk({ listFails: true });
  console.error = () => {};

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 503);
  assert.equal(recorder.body.code, "FARMER_INVITATION_REVOKE_FAILED");
  assert.equal(target.email, "old@example.com");
  assert.equal(target.saveCount, 0);
});

test("Invitation Sent: an invitation that cannot be verified blocks the email change", async () => {
  noEmailOwner();
  const target = farmer({
    farmerAppInvitation: pendingInvitation({ clerkInvitationId: undefined }),
  });
  const clerk = stubClerk();
  console.error = () => {};

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_INVITATION_UNVERIFIED");
  assert.equal(clerk.list, 0);
  assert.equal(target.saveCount, 0);
});

test("Invitation Expired: email can be edited and the stale invitation is cleared", async () => {
  noEmailOwner();
  const clerk = stubClerk();
  stubAudit();
  const target = farmer({
    farmerAppInvitation: pendingInvitation({ status: "expired", clerkInvitationId: "inv-old" }),
  });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.email, "new@example.com");
  assert.equal(target.farmerAppInvitation, undefined);
  assert.equal(recorder.body.appAccountStatus, "no_app_account");
  assert.equal(recorder.body.invitationRevoked, false);
  assert.equal(clerk.list, 0);
  assert.deepEqual(clerk.revoked, []);
});

test("Invitation Expired by time: nothing left in Clerk to revoke, email is still editable", async () => {
  noEmailOwner();
  const clerk = stubClerk({ pendingIds: [] });
  stubAudit();
  const target = farmer({ farmerAppInvitation: pendingInvitation({ expiresAt: PAST }) });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.email, "new@example.com");
  assert.equal(target.farmerAppInvitation, undefined);
  assert.equal(recorder.body.invitationRevoked, false);
  assert.deepEqual(clerk.revoked, []);
});

test("Connected: claimed Farmers reject email changes and require account recovery", async () => {
  noEmailOwner();
  const clerk = stubClerk();
  const target = farmer({ profileClaimStatus: "claimed", clerkId: "user_real" });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_CHANGE_REQUIRES_ACCOUNT_RECOVERY");
  assert.match(recorder.body.message, /account recovery/i);
  assert.equal(target.email, "old@example.com");
  assert.equal(target.saveCount, 0);
  assert.equal(clerk.list, 0);
});

test("Connected: a real Clerk link alone also blocks email changes", async () => {
  noEmailOwner();
  stubClerk();
  const target = farmer({ clerkId: "user_real" });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_CHANGE_REQUIRES_ACCOUNT_RECOVERY");
  assert.equal(target.saveCount, 0);
});

test("Blocked: blocked claim status rejects email changes", async () => {
  noEmailOwner();
  stubClerk();
  const target = farmer({ profileClaimStatus: "blocked" });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_CHANGE_REQUIRES_ACCOUNT_RECOVERY");
  assert.equal(target.email, "old@example.com");
  assert.equal(target.saveCount, 0);
});

test("Blocked: suspended Farmers reject email changes", async () => {
  noEmailOwner();
  stubClerk();
  const target = farmer({ status: "suspended" });

  const recorder = await edit(target, { email: "new@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_CHANGE_REQUIRES_ACCOUNT_RECOVERY");
  assert.equal(target.saveCount, 0);
});

test("Unchanged email is a no-op, so connected Farmers can still save other fields", async () => {
  noEmailOwner();
  const clerk = stubClerk();
  const audit = stubAudit();
  const target = farmer({
    profileClaimStatus: "claimed",
    clerkId: "user_real",
    farmerAppInvitation: pendingInvitation({ status: "accepted" }),
  });

  const recorder = await edit(target, { email: "  OLD@Example.com ", name: "Alma T. Tajo" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.email, "old@example.com");
  assert.equal(target.saveCount, 1);
  assert.equal(recorder.body.invitationRevoked, false);
  assert.equal(clerk.list, 0);
  assert.equal(audit.length, 0);
});

test("Invalid email formats and email removal are rejected before any side effect", async () => {
  noEmailOwner();
  const clerk = stubClerk();
  const target = farmer({ farmerAppInvitation: pendingInvitation() });

  for (const email of ["not-an-email", "a@b", "two@@example.com", "has space@example.com", "", "   ", 42, null]) {
    const recorder = await edit(target, { email });
    assert.equal(recorder.statusCode, 400, `expected 400 for ${JSON.stringify(email)}`);
    assert.equal(recorder.body.code, "INVALID_EMAIL");
  }

  assert.equal(target.email, "old@example.com");
  assert.equal(target.farmerAppInvitation.status, "pending");
  assert.equal(target.saveCount, 0);
  assert.equal(clerk.list, 0);
  assert.deepEqual(clerk.revoked, []);
});

test("A Farmer without an email can submit an empty email without error", async () => {
  noEmailOwner();
  stubClerk();
  const target = farmer({ email: undefined, normalizedEmail: undefined });

  const recorder = await edit(target, { email: "" });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.saveCount, 1);
  assert.equal(target.email, undefined);
});

test("An email already associated with another user is rejected and the invitation is untouched", async () => {
  const queries = [];
  User.findOne = async (query) => {
    queries.push(query);
    return { _id: "someone-else", role: "technician", email: "taken@example.com" };
  };
  const clerk = stubClerk({ pendingIds: ["inv-live"] });
  const target = farmer({ farmerAppInvitation: pendingInvitation() });

  const recorder = await edit(target, { email: "  TAKEN@Example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_ALREADY_IN_USE");
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]._id, { $ne: "farmer-1" });
  assert.equal(queries[0].$or[0].normalizedEmail, "taken@example.com");
  assert.equal(target.email, "old@example.com");
  assert.equal(target.farmerAppInvitation.status, "pending");
  assert.equal(target.saveCount, 0);
  assert.equal(clerk.list, 0);
  assert.deepEqual(clerk.revoked, []);
});

test("A concurrent duplicate caught by the unique index returns a clean conflict", async () => {
  noEmailOwner();
  stubClerk();
  stubAudit();
  console.error = () => {};
  const target = farmer();
  target.save = async () => {
    const error = new Error("E11000 duplicate key error");
    error.code = 11000;
    error.keyPattern = { normalizedEmail: 1 };
    throw error;
  };

  const recorder = await edit(target, { email: "race@example.com" });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_EMAIL_ALREADY_IN_USE");
});

test("A failed unrelated validation does not revoke the invitation or change the email", async () => {
  User.findOne = async (query) =>
    JSON.stringify(query).includes("normalizedEmail")
      ? null
      : { _id: "other-farmer", role: "farmer" };
  const clerk = stubClerk({ pendingIds: ["inv-live"] });
  const target = farmer({
    farmerAppInvitation: pendingInvitation(),
    address: { barangay: "Poblacion", city: "Oton", province: "Iloilo" },
  });

  const recorder = await edit(target, {
    email: "new@example.com",
    phoneNumber: "09171234567",
  });

  assert.equal(recorder.statusCode, 409);
  assert.equal(recorder.body.code, "FARMER_PHONE_ALREADY_IN_USE");
  assert.equal(clerk.list, 0);
  assert.deepEqual(clerk.revoked, []);
  assert.equal(target.farmerAppInvitation.status, "pending");
  assert.equal(target.saveCount, 0);
});

test("Farmer name behaviour is unchanged by email handling", async () => {
  noEmailOwner();
  stubClerk();
  stubAudit();
  const target = farmer();

  const recorder = await edit(target, { name: "  Alma Reyes Tajo  " });

  assert.equal(recorder.statusCode, 200);
  assert.equal(target.name, "Alma Reyes Tajo");
  assert.equal(target.email, "old@example.com");
  assert.equal(recorder.body.invitationRevoked, false);
});
