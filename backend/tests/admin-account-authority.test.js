import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { clerkClient } from "@clerk/clerk-sdk-node";
import cloudinary from "../src/config/cloudinary.js";
import { User } from "../src/models/user.model.js";
import { AuditLog } from "../src/models/audit-log.model.js";
import {
  assertOperationallyManageableUser,
  assertOperationalUserRole,
} from "../src/policies/user.policy.js";
import {
  createInvitedUser,
  deleteUser as deleteUserGeneric,
  restoreUser,
  updateUser,
} from "../src/controllers/user.controllers.js";
import {
  deleteUser,
  reactivateUser,
  resetPassword,
  suspendUser,
  updateRole,
  verifyUser,
} from "../src/controllers/admin.controllers.js";

const ADMIN_ID = "507f1f77bcf86cd799439011";
const TARGET_ID = "507f1f77bcf86cd799439012";

const responseRecorder = () => {
  const state = { statusCode: 200, payload: undefined };
  const response = {
    status(code) {
      state.statusCode = code;
      return response;
    },
    json(payload) {
      state.payload = payload;
      return response;
    },
    send(payload) {
      state.payload = payload;
      return response;
    },
  };
  return { response, state };
};

const adminRequester = (id = ADMIN_ID) => ({
  _id: id,
  role: "admin",
  name: "Operations Admin",
  email: "admin@example.test",
});

const appWithIo = {
  get() {
    return { emit() {} };
  },
};

const mockUser = ({
  id = TARGET_ID,
  role,
  clerkId = null,
  deletedAt = null,
  status = "active",
}) => {
  let saveCalls = 0;
  const user = {
    _id: id,
    role,
    clerkId,
    deletedAt,
    status,
    name: `${role} target`,
    email: `${role}@example.test`,
    isVerified: false,
    async save() {
      saveCalls += 1;
    },
  };
  return { user, getSaveCalls: () => saveCalls };
};

const assertForbiddenTarget = (state) => {
  assert.equal(state.statusCode, 403);
  assert.equal(state.payload.code, "OPERATIONAL_USER_TARGET_FORBIDDEN");
  assert.match(state.payload.message, /Admin accounts cannot be managed/);
};

test("Phase 5B operational Admin target authority", async (t) => {
  await t.test("policy allows Farmer/Technician and rejects Admin/unknown roles", () => {
    assert.doesNotThrow(() =>
      assertOperationallyManageableUser({ role: "farmer" }),
    );
    assert.doesNotThrow(() =>
      assertOperationallyManageableUser({ role: "technician" }),
    );
    assert.doesNotThrow(() => assertOperationalUserRole("farmer"));
    assert.doesNotThrow(() => assertOperationalUserRole("technician"));

    for (const role of ["admin", "auditor", undefined]) {
      assert.throws(
        () => assertOperationallyManageableUser({ role }),
        (error) =>
          error.status === 403 &&
          error.code === "OPERATIONAL_USER_TARGET_FORBIDDEN",
      );
      assert.throws(
        () => assertOperationalUserRole(role),
        (error) =>
          error.status === 403 &&
          error.code === "OPERATIONAL_USER_TARGET_FORBIDDEN",
      );
    }
  });

  await t.test("generic update rejects other/self Admin before save or Cloudinary", async (st) => {
    const originals = {
      findById: User.findById,
      upload: cloudinary.uploader.upload,
      destroy: cloudinary.uploader.destroy,
    };
    st.after(() => {
      User.findById = originals.findById;
      cloudinary.uploader.upload = originals.upload;
      cloudinary.uploader.destroy = originals.destroy;
    });

    let cloudinaryCalls = 0;
    cloudinary.uploader.upload = async () => {
      cloudinaryCalls += 1;
      return { secure_url: "https://example.test/new.png" };
    };
    cloudinary.uploader.destroy = async () => {
      cloudinaryCalls += 1;
    };

    for (const selfTarget of [false, true]) {
      const targetId = selfTarget ? ADMIN_ID : TARGET_ID;
      const target = mockUser({ id: targetId, role: "admin" });
      User.findById = async () => target.user;
      const recorder = responseRecorder();

      await updateUser(
        {
          params: { id: targetId },
          body: {
            name: "Unauthorized change",
            imageUrl: "data:image/png;base64,AAAA",
          },
          user: adminRequester(),
          app: appWithIo,
        },
        recorder.response,
      );

      assertForbiddenTarget(recorder.state);
      assert.equal(target.getSaveCalls(), 0);
      assert.equal(target.user.name, "admin target");
    }
    assert.equal(cloudinaryCalls, 0);
  });

  await t.test("generic delete and restore reject Admin before Clerk or Mongo", async (st) => {
    const originals = {
      findById: User.findById,
      banUser: clerkClient.users.banUser,
      unbanUser: clerkClient.users.unbanUser,
    };
    st.after(() => {
      User.findById = originals.findById;
      clerkClient.users.banUser = originals.banUser;
      clerkClient.users.unbanUser = originals.unbanUser;
    });

    let clerkCalls = 0;
    clerkClient.users.banUser = async () => {
      clerkCalls += 1;
    };
    clerkClient.users.unbanUser = async () => {
      clerkCalls += 1;
    };

    for (const selfTarget of [false, true]) {
      const targetId = selfTarget ? ADMIN_ID : TARGET_ID;
      const target = mockUser({
        id: targetId,
        role: "admin",
        clerkId: "clerk-admin",
      });
      User.findById = async () => target.user;
      const recorder = responseRecorder();

      await deleteUserGeneric(
        {
          params: { id: targetId },
          user: adminRequester(),
        },
        recorder.response,
      );

      assertForbiddenTarget(recorder.state);
      assert.equal(target.getSaveCalls(), 0);
      assert.equal(target.user.deletedAt, null);
    }

    const archivedAdmin = mockUser({
      role: "admin",
      clerkId: "clerk-admin",
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    User.findById = async () => archivedAdmin.user;
    const restoreRecorder = responseRecorder();
    await restoreUser(
      { params: { id: TARGET_ID }, user: adminRequester() },
      restoreRecorder.response,
    );

    assertForbiddenTarget(restoreRecorder.state);
    assert.equal(archivedAdmin.getSaveCalls(), 0);
    assert.notEqual(archivedAdmin.user.deletedAt, null);
    assert.equal(clerkCalls, 0);
  });

  await t.test("all dedicated Admin mutations reject Admin before side effects", async (st) => {
    const originals = {
      findById: User.findById,
      auditCreate: AuditLog.create,
      banUser: clerkClient.users.banUser,
      unbanUser: clerkClient.users.unbanUser,
      getUser: clerkClient.users.getUser,
      updateUser: clerkClient.users.updateUser,
    };
    st.after(() => {
      User.findById = originals.findById;
      AuditLog.create = originals.auditCreate;
      clerkClient.users.banUser = originals.banUser;
      clerkClient.users.unbanUser = originals.unbanUser;
      clerkClient.users.getUser = originals.getUser;
      clerkClient.users.updateUser = originals.updateUser;
    });

    let clerkCalls = 0;
    let auditCalls = 0;
    for (const method of ["banUser", "unbanUser", "getUser", "updateUser"]) {
      clerkClient.users[method] = async () => {
        clerkCalls += 1;
        return { publicMetadata: {} };
      };
    }
    AuditLog.create = async () => {
      auditCalls += 1;
    };

    const operations = [
      ["delete", deleteUser],
      ["suspend", suspendUser],
      ["reactivate", reactivateUser],
      ["verify", verifyUser],
      ["reset-password", resetPassword],
    ];

    for (const [name, controller] of operations) {
      const target = mockUser({
        role: "admin",
        clerkId: `clerk-admin-${name}`,
      });
      User.findById = async () => target.user;
      const recorder = responseRecorder();

      await controller(
        { body: { id: TARGET_ID }, user: adminRequester() },
        recorder.response,
      );

      assertForbiddenTarget(recorder.state);
      assert.equal(target.getSaveCalls(), 0, `${name} must not save`);
    }

    assert.equal(clerkCalls, 0);
    assert.equal(auditCalls, 0);
  });

  await t.test("role update rejects existing Admin and destination Admin before side effects", async (st) => {
    const originals = {
      findById: User.findById,
      getUser: clerkClient.users.getUser,
      updateUser: clerkClient.users.updateUser,
    };
    st.after(() => {
      User.findById = originals.findById;
      clerkClient.users.getUser = originals.getUser;
      clerkClient.users.updateUser = originals.updateUser;
    });

    let clerkCalls = 0;
    let findCalls = 0;
    clerkClient.users.getUser = async () => {
      clerkCalls += 1;
      return { publicMetadata: {} };
    };
    clerkClient.users.updateUser = async () => {
      clerkCalls += 1;
    };

    const existingAdmin = mockUser({
      role: "admin",
      clerkId: "clerk-admin",
    });
    User.findById = async () => {
      findCalls += 1;
      return existingAdmin.user;
    };
    const existingRecorder = responseRecorder();
    await updateRole(
      {
        body: { id: TARGET_ID, role: "farmer" },
        user: adminRequester(),
      },
      existingRecorder.response,
    );
    assertForbiddenTarget(existingRecorder.state);
    assert.equal(existingAdmin.getSaveCalls(), 0);

    const destinationRecorder = responseRecorder();
    await updateRole(
      {
        body: { id: TARGET_ID, role: "admin" },
        user: adminRequester(),
      },
      destinationRecorder.response,
    );
    assertForbiddenTarget(destinationRecorder.state);
    assert.equal(findCalls, 1, "destination Admin must reject before target lookup");
    assert.equal(clerkCalls, 0);
  });

  await t.test("Farmer and Technician role corrections remain valid", async (st) => {
    const originals = {
      findById: User.findById,
      auditCreate: AuditLog.create,
    };
    st.after(() => {
      User.findById = originals.findById;
      AuditLog.create = originals.auditCreate;
    });
    AuditLog.create = async (entry) => entry;

    for (const [fromRole, toRole] of [
      ["farmer", "technician"],
      ["technician", "farmer"],
    ]) {
      const target = mockUser({ role: fromRole });
      User.findById = async () => target.user;
      const recorder = responseRecorder();

      await updateRole(
        {
          body: { id: TARGET_ID, role: toRole },
          user: adminRequester(),
        },
        recorder.response,
      );

      assert.equal(recorder.state.statusCode, 200);
      assert.equal(target.user.role, toRole);
      assert.equal(target.getSaveCalls(), 1);
    }
  });

  await t.test("role=admin creation rejects both registered routes before Clerk or Mongo", async (st) => {
    const originals = {
      findOne: User.findOne,
      create: User.create,
      createInvitation: clerkClient.invitations.createInvitation,
    };
    st.after(() => {
      User.findOne = originals.findOne;
      User.create = originals.create;
      clerkClient.invitations.createInvitation = originals.createInvitation;
    });

    let mongoCalls = 0;
    let invitationCalls = 0;
    User.findOne = async () => {
      mongoCalls += 1;
      return null;
    };
    User.create = async () => {
      mongoCalls += 1;
      return null;
    };
    clerkClient.invitations.createInvitation = async () => {
      invitationCalls += 1;
      return { id: "invitation" };
    };

    for (const originalUrl of [
      "/api/user/create-invited-user",
      "/api/admin/create-user",
    ]) {
      const recorder = responseRecorder();
      await createInvitedUser(
        {
          originalUrl,
          body: {
            firstName: "Blocked",
            lastName: "Admin",
            email: "blocked-admin@example.test",
            role: "admin",
          },
          user: adminRequester(),
        },
        recorder.response,
      );
      assertForbiddenTarget(recorder.state);
    }

    assert.equal(invitationCalls, 0);
    assert.equal(mongoCalls, 0);

    const userRoutes = fs.readFileSync(
      new URL("../src/routes/user.routes.js", import.meta.url),
      "utf8",
    );
    const adminRoutes = fs.readFileSync(
      new URL("../src/routes/admin.routes.js", import.meta.url),
      "utf8",
    );
    assert.match(userRoutes, /create-invited-user[\s\S]*createInvitedUser/);
    assert.match(adminRoutes, /post\("\/create-user", createInvitedUser\)/);
  });

  await t.test("Farmer and Technician self-profile update/delete/restore remain valid", async (st) => {
    const originalFindById = User.findById;
    st.after(() => {
      User.findById = originalFindById;
    });

    for (const role of ["farmer", "technician"]) {
      const self = mockUser({ id: TARGET_ID, role });
      User.findById = async () => self.user;
      const updateRecorder = responseRecorder();
      await updateUser(
        {
          params: { id: TARGET_ID },
          body: { name: `Updated ${role}` },
          user: { _id: TARGET_ID, role },
          app: appWithIo,
        },
        updateRecorder.response,
      );
      assert.equal(updateRecorder.state.statusCode, 200);
      assert.equal(self.user.name, `Updated ${role}`);
      assert.equal(self.getSaveCalls(), 1);

      const deletable = mockUser({ id: TARGET_ID, role });
      User.findById = async () => deletable.user;
      const deleteRecorder = responseRecorder();
      await deleteUserGeneric(
        { params: { id: TARGET_ID }, user: adminRequester() },
        deleteRecorder.response,
      );
      assert.equal(deleteRecorder.state.statusCode, 200);
      assert.ok(deletable.user.deletedAt instanceof Date);
      assert.equal(deletable.getSaveCalls(), 1);

      const restorable = mockUser({
        id: TARGET_ID,
        role,
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      User.findById = async () => restorable.user;
      const restoreRecorder = responseRecorder();
      await restoreUser(
        { params: { id: TARGET_ID }, user: adminRequester() },
        restoreRecorder.response,
      );
      assert.equal(restoreRecorder.state.statusCode, 200);
      assert.equal(restorable.user.deletedAt, null);
      assert.equal(restorable.getSaveCalls(), 1);
    }
  });

  await t.test("valid Technician dedicated suspension remains operational", async (st) => {
    const originals = {
      findById: User.findById,
      auditCreate: AuditLog.create,
    };
    st.after(() => {
      User.findById = originals.findById;
      AuditLog.create = originals.auditCreate;
    });
    AuditLog.create = async (entry) => entry;

    const technician = mockUser({ role: "technician" });
    User.findById = async () => technician.user;
    const recorder = responseRecorder();
    await suspendUser(
      { body: { id: TARGET_ID }, user: adminRequester() },
      recorder.response,
    );

    assert.equal(recorder.state.statusCode, 200);
    assert.equal(technician.user.status, "suspended");
    assert.equal(technician.getSaveCalls(), 1);
  });

  await t.test("generic delete still rejects a non-Admin requester", async () => {
    const recorder = responseRecorder();
    await deleteUserGeneric(
      {
        params: { id: TARGET_ID },
        user: { _id: TARGET_ID, role: "farmer" },
      },
      recorder.response,
    );
    assert.equal(recorder.state.statusCode, 403);
    assert.equal(recorder.state.payload.code, "ADMIN_ROLE_REQUIRED");
    assert.match(recorder.state.payload.message, /administrator role is required/);
  });
});
