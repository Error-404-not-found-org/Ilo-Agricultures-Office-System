import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Idempotency } from "../src/models/idempotency.model.js";
import { idempotencyMiddleware } from "../src/middleware/idempotency.middleware.js";

test("Idempotency: bypasses if no key provided", async () => {
  const req = { headers: {} };
  const res = {};
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await idempotencyMiddleware(req, res, next);
  assert.equal(nextCalled, true);
});

test("Idempotency: returns 409 conflict if key status is pending", async () => {
  const req = {
    method: "POST",
    headers: { "idempotency-key": "test-key-1" },
    body: { foo: "bar" },
    user: { _id: "test-user-id" },
    path: "/test-path"
  };
  let statusVal = 0;
  let jsonVal = null;
  const res = {
    status(s) {
      statusVal = s;
      return {
        json(data) {
          jsonVal = data;
        }
      };
    }
  };
  const next = () => {};

  const originalCreate = Idempotency.create;
  Idempotency.create = async () => {
    const err = new Error("Duplicate key");
    err.code = 11000;
    throw err;
  };

  const originalFindOne = Idempotency.findOne;
  Idempotency.findOne = async (query) => {
    assert.equal(query.key, "test-key-1");
    return { key: "test-key-1", status: "pending", createdAt: new Date() };
  };

  try {
    await idempotencyMiddleware(req, res, next);
    assert.equal(statusVal, 409);
    assert.equal(jsonVal.code, "IDEMPOTENCY_IN_PROGRESS");
  } finally {
    Idempotency.create = originalCreate;
    Idempotency.findOne = originalFindOne;
  }
});

test("Idempotency: returns 400 mismatch if request body differs", async () => {
  const req = {
    method: "POST",
    headers: { "idempotency-key": "test-key-2" },
    body: { foo: "different" },
    user: { _id: "test-user-id" },
    path: "/test-path"
  };
  let statusVal = 0;
  let jsonVal = null;
  const res = {
    status(s) {
      statusVal = s;
      return {
        json(data) {
          jsonVal = data;
        }
      };
    }
  };
  const next = () => {};

  const originalCreate = Idempotency.create;
  Idempotency.create = async () => {
    const err = new Error("Duplicate key");
    err.code = 11000;
    throw err;
  };

  const originalFindOne = Idempotency.findOne;
  Idempotency.findOne = async () => {
    return { key: "test-key-2", status: "resolved", requestHash: "original-hash" };
  };

  try {
    await idempotencyMiddleware(req, res, next);
    assert.equal(statusVal, 400);
    assert.match(jsonVal.message, /Idempotency key body mismatch/);
  } finally {
    Idempotency.create = originalCreate;
    Idempotency.findOne = originalFindOne;
  }
});

test("Idempotency: passes and calls next if key is new", async () => {
  const req = {
    method: "POST",
    headers: { "idempotency-key": "test-new-key" },
    body: { foo: "bar" },
    user: { _id: "test-user-id" },
    path: "/test-path"
  };
  const res = {
    statusCode: 200,
    send(body) { return body; },
    json(body) { return body; }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  const originalCreate = Idempotency.create;
  let createCalledWith = null;
  Idempotency.create = async (data) => {
    createCalledWith = data;
    return { ...data, _id: "new-record-id" };
  };

  try {
    await idempotencyMiddleware(req, res, next);
    assert.equal(nextCalled, true);
    assert.ok(createCalledWith);
    assert.equal(createCalledWith.key, "test-new-key");
  } finally {
    Idempotency.create = originalCreate;
  }
});

test("Idempotency: replaying the original key returns the original success", async () => {
  const body = { pregnancyId: "pregnancy-1", animalId: "animal-1" };
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  const req = {
    method: "POST",
    headers: { "idempotency-key": "calving-operation-1" },
    body,
    user: { _id: "farmer-1" },
    path: "/animals/record-calving",
  };
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
  };

  const originalCreate = Idempotency.create;
  const originalFindOne = Idempotency.findOne;
  Idempotency.create = async () => {
    const error = new Error("Duplicate key");
    error.code = 11000;
    throw error;
  };
  Idempotency.findOne = async () => ({
    status: "resolved",
    requestHash,
    responseStatus: 201,
    responseBody: {
      message: "Calving and offspring registered successfully",
      calving: { _id: "calving-1" },
      offspring: [{ _id: "calf-1" }],
    },
  });

  try {
    await idempotencyMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 201);
    assert.equal(responseBody.calving._id, "calving-1");
    assert.equal(responseBody.offspring.length, 1);
  } finally {
    Idempotency.create = originalCreate;
    Idempotency.findOne = originalFindOne;
  }
});
