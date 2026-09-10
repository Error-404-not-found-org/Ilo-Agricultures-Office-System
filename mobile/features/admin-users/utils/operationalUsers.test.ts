import assert from "node:assert/strict";
import test from "node:test";
import {
  filterOperationalUsers,
  isOperationalUserRole,
} from "./operationalUsers.ts";

const users = [
  { _id: "farmer-1", role: "farmer", name: "Farmer" },
  { _id: "technician-1", role: "technician", name: "Technician" },
  { _id: "admin-1", role: "admin", name: "Admin" },
  { _id: "unknown-1", role: "supervisor", name: "Unknown" },
  { _id: "malformed-1", role: null, name: "Malformed" },
];

test("operational role predicate permits only Farmer and Technician", () => {
  assert.equal(isOperationalUserRole("farmer"), true);
  assert.equal(isOperationalUserRole("technician"), true);
  assert.equal(isOperationalUserRole("admin"), false);
  assert.equal(isOperationalUserRole("supervisor"), false);
  assert.equal(isOperationalUserRole(null), false);
});

test("operational directory filtering excludes Admin and malformed roles", () => {
  assert.deepEqual(
    filterOperationalUsers(users).map((user) => user._id),
    ["farmer-1", "technician-1"],
  );
});

test("operational archive filtering excludes Admin restoration targets", () => {
  const archived = users.map((user) => ({
    ...user,
    deletedAt: "2026-08-29T00:00:00.000Z",
  }));

  assert.deepEqual(
    filterOperationalUsers(archived).map((user) => user.role),
    ["farmer", "technician"],
  );
});
