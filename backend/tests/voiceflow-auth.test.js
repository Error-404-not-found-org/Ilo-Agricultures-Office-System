import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { User } from "../src/models/user.model.js";
import { ENV } from "../src/config/env.js";
import { voiceflowAuth } from "../src/middleware/voiceflowAuth.middleware.js";

test("Voiceflow Auth: fails with missing or invalid API key", async () => {
  const originalKey = ENV.VOICEFLOW_API_KEY;
  
  // 1. Missing key case (fails closed with 500)
  ENV.VOICEFLOW_API_KEY = undefined;
  const req = {
    headers: {},
    body: {}
  };
  let status = 0;
  let responseData = null;
  const res = {
    status(s) {
      status = s;
      return {
        json(data) {
          responseData = data;
        }
      };
    }
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await voiceflowAuth(req, res, next);
  assert.equal(status, 500);
  assert.equal(responseData.error, "Voiceflow integration is not configured");
  assert.equal(nextCalled, false);

  // 2. Invalid key case (fails with 401)
  ENV.VOICEFLOW_API_KEY = "test-voiceflow-key";
  try {
    await voiceflowAuth(req, res, next);
    assert.equal(status, 401);
    assert.equal(responseData.error, "Unauthorized - Invalid Voiceflow Key");
    assert.equal(nextCalled, false);

    req.headers["authorization"] = "invalid-key";
    await voiceflowAuth(req, res, next);
    assert.equal(status, 401);
    assert.equal(responseData.error, "Unauthorized - Invalid Voiceflow Key");
    assert.equal(nextCalled, false);
  } finally {
    ENV.VOICEFLOW_API_KEY = originalKey;
  }
});

test("Voiceflow Auth: succeeds and resolves user", async () => {
  const originalKey = ENV.VOICEFLOW_API_KEY;
  ENV.VOICEFLOW_API_KEY = "test-voiceflow-key";

  const userId = "user_123";
  const expiresAt = Date.now() + 10000;
  const signature = crypto.createHmac("sha256", "test-voiceflow-key")
    .update(`${userId}:${expiresAt}`)
    .digest("hex");
  const userToken = `${userId}:${expiresAt}:${signature}`;

  const req = {
    headers: {
      "authorization": "Bearer test-voiceflow-key"
    },
    body: {
      userToken
    }
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
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  const originalFindOne = User.findOne;
  const mockUser = { _id: "user_123", name: "John Doe", role: "farmer" };
  User.findOne = async (query) => {
    assert.equal(query._id, "user_123");
    return mockUser;
  };

  try {
    await voiceflowAuth(req, res, next);
    assert.equal(nextCalled, true);
    assert.deepEqual(req.voiceflowUser, mockUser);
  } finally {
    User.findOne = originalFindOne;
    ENV.VOICEFLOW_API_KEY = originalKey;
  }
});
