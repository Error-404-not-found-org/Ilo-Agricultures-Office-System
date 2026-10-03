import test from "node:test";
import assert from "node:assert/strict";
import { executeCleanup } from "../src/controllers/maintenance.controllers.js";
import { User } from "../src/models/user.model.js";
import { Animal } from "../src/models/animal.model.js";

test("maintenance cleanup cannot hard-delete caller-supplied Farmer IDs", async () => {
  const originalDeleteMany = User.deleteMany;
  let deleteCalled = false;
  User.deleteMany = async () => {
    deleteCalled = true;
    return { deletedCount: 1 };
  };

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await executeCleanup(
      { body: { inactiveFarmerIds: ["507f1f77bcf86cd799439011"] } },
      response,
    );
    assert.equal(deleteCalled, false);
    assert.equal(response.statusCode, 400);
  } finally {
    User.deleteMany = originalDeleteMany;
  }
});

test("maintenance cleanup still performs independently requested orphan-Animal cleanup", async () => {
  const originalDeleteMany = Animal.deleteMany;
  let deletedFilter;
  Animal.deleteMany = async (filter) => {
    deletedFilter = filter;
    return { deletedCount: 1 };
  };
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    await executeCleanup(
      { body: { orphanAnimalIds: ["507f1f77bcf86cd799439012"] } },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.animalsDeleted, 1);
    assert.deepEqual(deletedFilter, {
      _id: { $in: ["507f1f77bcf86cd799439012"] },
    });
  } finally {
    Animal.deleteMany = originalDeleteMany;
  }
});
