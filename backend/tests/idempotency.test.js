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

test("Idempotency: farmer observation replay does not run the route handler twice", async () => {
  const body = {
    reportType: "unsure",
    signs: ["Needs technician check"],
    notes: "Please review.",
    evidencePhotos: [],
    verificationRequested: false,
  };
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  const stored = {
    _id: "farmer-observation-idempotency-1",
    key: "farmer-observation-operation-1",
    userId: "farmer-1",
    method: "POST",
    path: "/ai-request/insemination-1/farmer-observation",
    requestHash,
    status: "pending",
    createdAt: new Date(),
  };
  let routeHandlerCalls = 0;

  const originals = {
    create: Idempotency.create,
    findOne: Idempotency.findOne,
    updateOne: Idempotency.updateOne,
    deleteOne: Idempotency.deleteOne,
  };
  Idempotency.create = async () => {
    if (routeHandlerCalls === 0) return stored;
    const error = new Error("Duplicate key");
    error.code = 11000;
    throw error;
  };
  Idempotency.findOne = async () => stored;
  Idempotency.updateOne = async (_query, update) => {
    Object.assign(stored, update.$set);
  };
  Idempotency.deleteOne = async () => {};

  const makeRequest = () => ({
    method: "POST",
    headers: { "idempotency-key": stored.key },
    body,
    user: { _id: "farmer-1" },
    path: stored.path,
  });
  const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  });

  try {
    const firstResponse = makeResponse();
    await idempotencyMiddleware(makeRequest(), firstResponse, () => {
      routeHandlerCalls += 1;
      firstResponse.status(200).json({
        message: "Breeding observation saved.",
        data: { request: { _id: "insemination-1" } },
      });
    });
    await new Promise((resolve) => setImmediate(resolve));

    const replayResponse = makeResponse();
    await idempotencyMiddleware(makeRequest(), replayResponse, () => {
      routeHandlerCalls += 1;
    });

    assert.equal(routeHandlerCalls, 1);
    assert.equal(stored.status, "resolved");
    assert.equal(replayResponse.statusCode, 200);
    assert.equal(replayResponse.body.message, "Breeding observation saved.");
  } finally {
    Idempotency.create = originals.create;
    Idempotency.findOne = originals.findOne;
    Idempotency.updateOne = originals.updateOne;
    Idempotency.deleteOne = originals.deleteOne;
  }
});
