import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { protectedRoute } from "../src/middleware/auth.middleware.js";
import { suspendUser, deleteUser, updateRole } from "../src/controllers/admin.controllers.js";

test("Admin Security: protectedRoute blocks suspended users", async () => {
    const originalFindOne = User.findOne;
    User.findOne = () => ({
        maxTimeMS() {
            return Promise.resolve({
                name: "Suspended Farmer",
                status: "suspended",
                deletedAt: null
            });
        }
    });

    const req = {
        auth: { userId: "clerk-id-1" }
    };
    let statusVal = null;
    let jsonVal = null;
    const res = {
        status(code) {
            statusVal = code;
            return {
                json(data) { jsonVal = data; }
            };
        }
    };
    let nextCalled = false;
    const next = () => { nextCalled = true; };

    try {
        await protectedRoute(req, res, next);
        assert.equal(statusVal, 403);
        assert.equal(jsonVal.message, "Account has been suspended.");
        assert.equal(nextCalled, false);
    } finally {
        User.findOne = originalFindOne;
    }
});

test("Admin Security: operational target policy blocks Admin self-targets", async () => {
    const adminId = "507f1f77bcf86cd799439011";
    const originalFindById = User.findById;
    User.findById = async () => ({
        _id: adminId,
        role: "admin",
        status: "active",
        deletedAt: null
    });

    const req = {
        body: { id: adminId },
        user: { _id: adminId, role: "admin" }
    };

    let statusVal = null;
    let sendVal = null;
    const res = {
        status(code) {
            statusVal = code;
            return {
                send(data) { sendVal = data; },
                json(data) { sendVal = data; }
            };
        }
    };

    try {
        await suspendUser(req, res);
        assert.equal(statusVal, 403);
        assert.match(sendVal.message, /Admin accounts cannot be managed/);

        await deleteUser(req, res);
        assert.equal(statusVal, 403);
        assert.match(sendVal.message, /Admin accounts cannot be managed/);

        req.body.role = "farmer";
        await updateRole(req, res);
        assert.equal(statusVal, 403);
        assert.match(sendVal.message, /Admin accounts cannot be managed/);
    } finally {
        User.findById = originalFindById;
    }
});

test("Admin Security: another Admin is blocked regardless of active Admin count", async () => {
    const adminId = "507f1f77bcf86cd799439011";
    const targetAdminId = "507f1f77bcf86cd799439012";

    const originalFindById = User.findById;
    const originalCountDocuments = User.countDocuments;

    User.findById = async () => ({
        _id: targetAdminId,
        role: "admin",
        status: "active",
        deletedAt: null
    });

    // Count is 1 (the last admin)
    let countCalls = 0;
    User.countDocuments = async () => {
        countCalls += 1;
        return 2;
    };

    const req = {
        body: { id: targetAdminId, role: "farmer" },
        user: { _id: adminId }
    };

    let statusVal = null;
    let sendVal = null;
    const res = {
        status(code) {
            statusVal = code;
            return {
                send(data) { sendVal = data; },
                json(data) { sendVal = data; }
            };
        }
    };

    try {
        await updateRole(req, res);
        assert.equal(statusVal, 403);
        assert.match(sendVal.message, /Admin accounts cannot be managed/);
        assert.equal(countCalls, 0);
    } finally {
        User.findById = originalFindById;
        User.countDocuments = originalCountDocuments;
    }
});

test("Admin Security: suspendUser creates audit log and retries clerk failure", async () => {
    const { clerkClient } = await import("@clerk/clerk-sdk-node");
    const { AuditLog } = await import("../src/models/audit-log.model.js");

    const originalFindById = User.findById;
    const originalAuditLogCreate = AuditLog.create;
    const originalBanUser = clerkClient.users?.banUser;

    const mockUser = {
        _id: "507f1f77bcf86cd799439015",
        clerkId: "clerk-user-123",
        role: "farmer",
        status: "active",
        deletedAt: null,
        save: async () => {}
    };

    User.findById = async () => mockUser;

    let auditCreated = null;
    AuditLog.create = async (entry) => {
        auditCreated = entry;
        return entry;
    };

    let clerkCalls = 0;
    if (!clerkClient.users) clerkClient.users = {};
    clerkClient.users.banUser = async (id) => {
        clerkCalls++;
        if (clerkCalls === 1) {
            throw new Error("Temporary Clerk Network Error");
        }
        return { id };
    };

    const req = {
        body: { id: "507f1f77bcf86cd799439015" },
        user: { _id: "507f1f77bcf86cd799439011", email: "admin@test.com", name: "Admin User", role: "admin" }
    };

    let statusVal = null;
    let sendVal = null;
    const res = {
        status(code) {
            statusVal = code;
            return {
                send(data) { sendVal = data; }
            };
        }
    };

    try {
        await suspendUser(req, res);
        
        assert.equal(statusVal, 200);
        assert.equal(clerkCalls, 2); // 1 initial failure + 1 successful retry
        assert.ok(auditCreated);
        assert.equal(auditCreated.entityType, "User");
        assert.equal(auditCreated.action, "suspend");
        assert.equal(auditCreated.actorId, "507f1f77bcf86cd799439011");
        assert.equal(mockUser.status, "suspended");
    } finally {
        User.findById = originalFindById;
        AuditLog.create = originalAuditLogCreate;
        clerkClient.users.banUser = originalBanUser;
    }
});
