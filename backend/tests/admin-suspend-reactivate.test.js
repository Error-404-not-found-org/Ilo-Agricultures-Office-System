import test from "node:test";
import assert from "node:assert/strict";
import { accountStatusClerkUsers } from "../src/services/account-status-clerk.service.js";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import { suspendUser, reactivateUser } from "../src/controllers/admin.controllers.js";

const userId = "507f1f77bcf86cd799439012";
const clerkId = "user_linked_farmer";
const admin = { _id: "507f1f77bcf86cd799439011", role: "admin", name: "Admin" };

const response = () => {
  const state = { code: 200, body: null };
  const res = {
    status(code) { state.code = code; return res; },
    json(body) { state.body = body; return res; },
    send(body) { state.body = body; return res; },
  };
  return { state, res };
};

const target = ({ status = "active", clerk = clerkId, failSave = false } = {}) => {
  let saves = 0;
  const user = {
    _id: userId, role: "farmer", status, clerkId: clerk,
    deletedAt: null, isVerified: true, profileClaimStatus: "claimed",
    name: "Farmer", email: "farmer@example.test",
    async save() { saves++; if (failSave) throw new Error("Mongo save failed"); },
  };
  return { user, saves: () => saves };
};

const setup = (t, user) => {
  const originals = {
    findById: User.findById,
    auditCreate: AuditLog.create,
    banUser: accountStatusClerkUsers.banUser,
    unbanUser: accountStatusClerkUsers.unbanUser,
  };
  t.after(() => {
    User.findById = originals.findById;
    AuditLog.create = originals.auditCreate;
    accountStatusClerkUsers.banUser = originals.banUser;
    accountStatusClerkUsers.unbanUser = originals.unbanUser;
  });
  User.findById = async () => user;
  const events = [];
  AuditLog.create = async (entry) => { events.push(entry); return entry; };
  const calls = [];
  accountStatusClerkUsers.banUser = async (id) => { calls.push(["ban", id]); };
  accountStatusClerkUsers.unbanUser = async (id) => { calls.push(["unban", id]); };
  return { calls, events };
};

const invoke = async (controller) => {
  const { state, res } = response();
  await controller({ body: { id: userId }, user: admin }, res);
  return state;
};

test("configured account-status Clerk client exposes ban and unban at runtime", () => {
  assert.equal(typeof accountStatusClerkUsers.banUser, "function");
  assert.equal(typeof accountStatusClerkUsers.unbanUser, "function");
});

test("linked Farmer suspends Clerk first and preserves domain identity", async (t) => {
  const model = target();
  const { calls, events } = setup(t, model.user);
  const result = await invoke(suspendUser);
  assert.equal(result.code, 200);
  assert.deepEqual(calls, [["ban", clerkId]]);
  assert.equal(model.user.status, "suspended");
  assert.equal(model.user._id, userId);
  assert.equal(model.user.clerkId, clerkId);
  assert.equal(model.user.isVerified, true);
  assert.equal(model.saves(), 1);
  assert.equal(events[0].action, "suspend");
});

test("linked Farmer reactivates Clerk first and preserves domain identity", async (t) => {
  const model = target({ status: "suspended" });
  const { calls, events } = setup(t, model.user);
  const result = await invoke(reactivateUser);
  assert.equal(result.code, 200);
  assert.deepEqual(calls, [["unban", clerkId]]);
  assert.equal(model.user.status, "active");
  assert.equal(model.user._id, userId);
  assert.equal(model.user.clerkId, clerkId);
  assert.equal(model.user.isVerified, true);
  assert.equal(model.saves(), 1);
  assert.equal(events[0].action, "reactivate");
});

for (const [name, controller, status, failingMethod] of [
  ["suspend", suspendUser, "active", "banUser"],
  ["reactivate", reactivateUser, "suspended", "unbanUser"],
]) {
  test(`Clerk ${name} failure leaves Mongo unchanged and writes no success audit`, async (t) => {
    const model = target({ status });
    const { events } = setup(t, model.user);
    accountStatusClerkUsers[failingMethod] = async () => { throw new Error("Clerk unavailable"); };
    const result = await invoke(controller);
    assert.equal(result.code, 502);
    assert.equal(result.body.code, `CLERK_${name.toUpperCase()}_FAILED`);
    assert.equal(model.user.status, status);
    assert.equal(model.saves(), 0);
    assert.equal(events.length, 0);
  });
}

for (const [name, controller, status, forward, reverse] of [
  ["suspend", suspendUser, "active", "ban", "unban"],
  ["reactivate", reactivateUser, "suspended", "unban", "ban"],
]) {
  test(`Mongo failure after Clerk ${name} compensates to the prior authentication state`, async (t) => {
    const model = target({ status, failSave: true });
    const { calls, events } = setup(t, model.user);
    const result = await invoke(controller);
    assert.equal(result.code, 500);
    assert.equal(result.body.code, "ACCOUNT_STATUS_SAVE_FAILED_RESTORED");
    assert.deepEqual(calls, [[forward, clerkId], [reverse, clerkId]]);
    assert.equal(model.user.status, status);
    assert.equal(events.length, 0);
  });
}

test("failed compensation returns a distinct reconciliation-required error", async (t) => {
  const model = target({ failSave: true });
  const { events } = setup(t, model.user);
  accountStatusClerkUsers.unbanUser = async () => { throw new Error("Clerk unavailable"); };
  const result = await invoke(suspendUser);
  assert.equal(result.code, 500);
  assert.equal(result.body.code, "ACCOUNT_STATE_RECONCILIATION_REQUIRED");
  assert.equal(events.length, 0);
});

for (const clerk of [null, "", "manual_farmer_1"]) {
  test(`Farmer without real Clerk identity (${String(clerk)}) suspends locally`, async (t) => {
    const model = target({ clerk });
    const { calls } = setup(t, model.user);
    const result = await invoke(suspendUser);
    assert.equal(result.code, 200);
    assert.deepEqual(calls, []);
    assert.equal(model.user.status, "suspended");
  });
}

test("manual Farmer identity reactivates locally without calling Clerk", async (t) => {
  const model = target({ status: "suspended", clerk: "manual_farmer_1" });
  const { calls } = setup(t, model.user);
  const result = await invoke(reactivateUser);
  assert.equal(result.code, 200);
  assert.equal(model.user.status, "active");
  assert.deepEqual(calls, []);
});

test("repeated suspend and reactivate are no-op conflicts before Clerk", async (t) => {
  const model = target({ status: "suspended" });
  const { calls, events } = setup(t, model.user);
  const repeatedSuspend = await invoke(suspendUser);
  assert.equal(repeatedSuspend.code, 409);
  assert.equal(repeatedSuspend.body.code, "ACCOUNT_ALREADY_SUSPENDED");
  model.user.status = "active";
  const repeatedReactivate = await invoke(reactivateUser);
  assert.equal(repeatedReactivate.code, 409);
  assert.equal(repeatedReactivate.body.code, "ACCOUNT_ALREADY_ACTIVE");
  assert.deepEqual(calls, []);
  assert.equal(events.length, 0);
  assert.equal(model.saves(), 0);
});

test("reactivate refuses an on-leave account without changing Clerk or Mongo", async (t) => {
  const model = target({ status: "on-leave" });
  const { calls, events } = setup(t, model.user);
  const result = await invoke(reactivateUser);
  assert.equal(result.code, 409);
  assert.equal(result.body.code, "ACCOUNT_NOT_SUSPENDED");
  assert.equal(model.user.status, "on-leave");
  assert.equal(model.saves(), 0);
  assert.deepEqual(calls, []);
  assert.equal(events.length, 0);
});
