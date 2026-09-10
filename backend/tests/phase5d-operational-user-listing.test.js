import assert from "node:assert/strict";
import test from "node:test";

import { Animal } from "../src/models/animal.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { Insemination } from "../src/models/insemination.model.js";
import { User } from "../src/models/user.model.js";
import {
  getArchivedUsers,
  getMe,
  getUsers,
  listAllUsersForAdmin,
} from "../src/controllers/user.controllers.js";
import { getOperationalUserRoleFilter } from "../src/policies/user.policy.js";

const fixtures = [
  {
    _id: "farmer-active",
    name: "Farmer Active",
    email: "farmer@example.test",
    phoneNumber: "09170000001",
    role: "farmer",
    deletedAt: null,
    address: { barangay: "Poblacion", city: "Oton" },
  },
  {
    _id: "technician-active",
    name: "Technician Active",
    email: "technician@example.test",
    phoneNumber: "09170000002",
    role: "technician",
    deletedAt: null,
    address: { barangay: "Poblacion", city: "Oton" },
  },
  {
    _id: "admin-active",
    name: "Admin Active",
    email: "admin@example.test",
    role: "admin",
    deletedAt: null,
  },
  {
    _id: "unknown-active",
    name: "Unknown Active",
    email: "unknown@example.test",
    role: "auditor",
    deletedAt: null,
  },
  {
    _id: "farmer-archived",
    name: "Farmer Archived",
    email: "farmer.archived@example.test",
    role: "farmer",
    deletedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    _id: "technician-archived",
    name: "Technician Archived",
    email: "technician.archived@example.test",
    role: "technician",
    deletedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
  {
    _id: "admin-archived",
    name: "Admin Archived",
    email: "admin.archived@example.test",
    role: "admin",
    deletedAt: new Date("2026-01-03T00:00:00.000Z"),
  },
];

const asDocument = (row) => ({
  ...row,
  toObject() {
    return { ...row };
  },
});

const matchesRole = (row, roleFilter) => {
  if (typeof roleFilter === "string") return row.role === roleFilter;
  if (Array.isArray(roleFilter?.$in)) return roleFilter.$in.includes(row.role);
  return true;
};

const matchesDeletedAt = (row, deletedAtFilter) => {
  if (deletedAtFilter === null) return row.deletedAt === null;
  if (deletedAtFilter?.$ne === null) return row.deletedAt !== null;
  return true;
};

const rowsForQuery = (query) =>
  fixtures
    .filter((row) => matchesRole(row, query.role))
    .filter((row) => matchesDeletedAt(row, query.deletedAt));

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
  };
  return { response, state };
};

const installListingMocks = (t) => {
  const originals = {
    userFind: User.find,
    userCountDocuments: User.countDocuments,
    userFindById: User.findById,
    animalCountDocuments: Animal.countDocuments,
    aiCountDocuments: Insemination.countDocuments,
    aiFindOne: Insemination.findOne,
    healthCountDocuments: HealthRequest.countDocuments,
    healthFindOne: HealthRequest.findOne,
  };
  t.after(() => {
    User.find = originals.userFind;
    User.countDocuments = originals.userCountDocuments;
    User.findById = originals.userFindById;
    Animal.countDocuments = originals.animalCountDocuments;
    Insemination.countDocuments = originals.aiCountDocuments;
    Insemination.findOne = originals.aiFindOne;
    HealthRequest.countDocuments = originals.healthCountDocuments;
    HealthRequest.findOne = originals.healthFindOne;
  });

  const captured = { finds: [], counts: [] };
  User.find = (query) => {
    captured.finds.push(query);
    let rows = rowsForQuery(query).map(asDocument);
    let skip = 0;
    let limit = null;
    const operation = {
      select() {
        return operation;
      },
      sort() {
        return operation;
      },
      skip(value) {
        skip = value;
        return operation;
      },
      limit(value) {
        limit = value;
        return operation;
      },
      lean() {
        const selected =
          limit === null ? rows.slice(skip) : rows.slice(skip, skip + limit);
        return Promise.resolve(selected.map((row) => row.toObject()));
      },
      then(resolve, reject) {
        const selected =
          limit === null ? rows.slice(skip) : rows.slice(skip, skip + limit);
        return Promise.resolve(selected).then(resolve, reject);
      },
    };
    return operation;
  };
  User.countDocuments = async (query) => {
    captured.counts.push(query);
    return rowsForQuery(query).length;
  };

  Animal.countDocuments = async () => 0;
  Insemination.countDocuments = async () => 0;
  HealthRequest.countDocuments = async () => 0;
  const emptyFindOne = () => {
    const operation = {
      sort() {
        return operation;
      },
      select() {
        return operation;
      },
      lean() {
        return Promise.resolve(null);
      },
    };
    return operation;
  };
  Insemination.findOne = emptyFindOne;
  HealthRequest.findOne = emptyFindOne;

  return captured;
};

const assertOperationalRows = (rows) => {
  const roles = rows.map((row) => row.role);
  assert.ok(roles.length > 0);
  assert.ok(roles.every((role) => ["farmer", "technician"].includes(role)));
  assert.deepEqual([...new Set(roles)].sort(), ["farmer", "technician"]);
};

const assertOperationalRoleRejection = (state) => {
  assert.equal(state.statusCode, 403);
  assert.equal(state.payload.code, "OPERATIONAL_USER_TARGET_FORBIDDEN");
};

test("Phase 5D operational user listing boundary", async (t) => {
  await t.test("shared role filter accepts only Farmer and Technician", () => {
    assert.deepEqual(getOperationalUserRoleFilter(), {
      $in: ["farmer", "technician"],
    });
    assert.equal(getOperationalUserRoleFilter("farmer"), "farmer");
    assert.equal(getOperationalUserRoleFilter("technician"), "technician");
    for (const role of ["admin", "auditor", "Farmer", "", {}, []]) {
      assert.throws(
        () => getOperationalUserRoleFilter(role),
        (error) =>
          error.status === 403 &&
          error.code === "OPERATIONAL_USER_TARGET_FORBIDDEN",
      );
    }
  });

  await t.test("GET /api/user query-level scope excludes Admin and unknown roles", async (st) => {
    const captured = installListingMocks(st);
    const recorder = responseRecorder();
    await getUsers(
      { user: { role: "admin" }, query: {} },
      recorder.response,
    );

    assert.equal(recorder.state.statusCode, 200);
    assertOperationalRows(recorder.state.payload);
    assert.deepEqual(captured.finds[0].role, {
      $in: ["farmer", "technician"],
    });
  });

  await t.test("GET /api/user preserves explicit Farmer and Technician scopes", async (st) => {
    const captured = installListingMocks(st);
    for (const role of ["farmer", "technician"]) {
      const recorder = responseRecorder();
      await getUsers(
        { user: { role: "admin" }, query: { role } },
        recorder.response,
      );
      assert.equal(recorder.state.statusCode, 200);
      assert.ok(recorder.state.payload.length > 0);
      assert.ok(recorder.state.payload.every((row) => row.role === role));
      assert.equal(captured.finds.at(-1).role, role);
    }
  });

  await t.test("GET /api/user rejects Admin and malformed role queries before Mongo", async (st) => {
    const captured = installListingMocks(st);
    for (const role of ["admin", "auditor", "FARMER"]) {
      const recorder = responseRecorder();
      await getUsers(
        { user: { role: "admin" }, query: { role } },
        recorder.response,
      );
      assertOperationalRoleRejection(recorder.state);
    }
    assert.equal(captured.finds.length, 0);
  });

  await t.test("GET /api/user pagination totals and filters use the operational query", async (st) => {
    const captured = installListingMocks(st);
    const recorder = responseRecorder();
    await getUsers(
      {
        user: { role: "admin" },
        query: {
          page: "1",
          limit: "1",
          search: "active",
          barangay: "Poblacion",
          city: "Oton",
        },
      },
      recorder.response,
    );

    assert.equal(recorder.state.statusCode, 200);
    assert.equal(recorder.state.payload.data.length, 1);
    assert.equal(recorder.state.payload.total, 2);
    assert.equal(recorder.state.payload.totalPages, 2);
    assert.deepEqual(captured.finds[0].role, {
      $in: ["farmer", "technician"],
    });
    assert.deepEqual(captured.counts[0].role, {
      $in: ["farmer", "technician"],
    });
    assert.equal(captured.finds[0]["address.barangay"], "Poblacion");
    assert.ok(Array.isArray(captured.finds[0].$or));
    assert.ok(Array.isArray(captured.finds[0].$and));
  });

  await t.test("GET /api/admin/list-users exposes only operational roles", async (st) => {
    const captured = installListingMocks(st);
    const recorder = responseRecorder();
    await listAllUsersForAdmin({ query: {} }, recorder.response);

    assert.equal(recorder.state.statusCode, 200);
    assertOperationalRows(recorder.state.payload);
    assert.deepEqual(captured.finds[0].role, {
      $in: ["farmer", "technician"],
    });

    for (const role of ["farmer", "technician"]) {
      const scoped = responseRecorder();
      await listAllUsersForAdmin({ query: { role } }, scoped.response);
      assert.ok(scoped.state.payload.every((row) => row.role === role));
    }
  });

  await t.test("GET /api/admin/list-users rejects Admin and malformed roles", async (st) => {
    const captured = installListingMocks(st);
    for (const role of ["admin", "auditor", ""]) {
      const recorder = responseRecorder();
      await listAllUsersForAdmin({ query: { role } }, recorder.response);
      assertOperationalRoleRejection(recorder.state);
    }
    assert.equal(captured.finds.length, 0);
  });

  await t.test("GET /api/user/archived excludes archived Admin and preserves operational scopes", async (st) => {
    const captured = installListingMocks(st);
    for (const role of [undefined, "all", "farmer", "technician"]) {
      const recorder = responseRecorder();
      await getArchivedUsers(
        {
          user: { role: "admin" },
          query: role === undefined ? {} : { role },
        },
        recorder.response,
      );
      assert.equal(recorder.state.statusCode, 200);
      const rows = recorder.state.payload.data;
      assert.ok(rows.every((row) => row.deletedAt !== null));
      if (role === "farmer" || role === "technician") {
        assert.ok(rows.every((row) => row.role === role));
      } else {
        assertOperationalRows(rows);
      }
    }
    assert.deepEqual(captured.finds[0].role, {
      $in: ["farmer", "technician"],
    });
  });

  await t.test("GET /api/user/archived rejects Admin and malformed roles", async (st) => {
    const captured = installListingMocks(st);
    for (const role of ["admin", "auditor"]) {
      const recorder = responseRecorder();
      await getArchivedUsers(
        { user: { role: "admin" }, query: { role } },
        recorder.response,
      );
      assertOperationalRoleRejection(recorder.state);
    }
    assert.equal(captured.finds.length, 0);
  });

  await t.test("/api/user/me remains independent from operational listing filters", async (st) => {
    installListingMocks(st);
    const admin = {
      _id: "admin-active",
      name: "Admin Active",
      role: "admin",
      toObject() {
        return { _id: this._id, name: this.name, role: this.role };
      },
    };
    User.findById = () => ({
      select() {
        return Promise.resolve(admin);
      },
    });

    const recorder = responseRecorder();
    await getMe(
      { user: { _id: "admin-active", role: "admin" } },
      recorder.response,
    );
    assert.equal(recorder.state.statusCode, 200);
    assert.equal(recorder.state.payload.role, "admin");
  });
});
