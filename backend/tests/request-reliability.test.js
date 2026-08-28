import test from "node:test";
import assert from "node:assert/strict";
import { User } from "../src/models/user.model.js";
import { Idempotency } from "../src/models/idempotency.model.js";
import { resolveUserMiddleware } from "../src/middleware/resolveUser.middleware.js";
import { protectedRoute } from "../src/middleware/auth.middleware.js";
import { idempotencyMiddleware } from "../src/middleware/idempotency.middleware.js";
import { isValidExpoPushToken } from "../src/lib/push-notifications.js";
import { Insemination } from "../src/models/insemination.model.js";
import { HealthRequest } from "../src/models/health-request.model.js";
import { updateRequestStatus } from "../src/controllers/ai-request.controllers.js";
import { updateHealthRequestStatus } from "../src/controllers/health-request.controllers.js";
import { Notification } from "../src/models/notification.model.js";
import {
  getNotificationDetails,
  markAsRead,
} from "../src/controllers/notification.controllers.js";

test("Request reliability: user resolution runs before idempotency", async () => {
  const originalFindOne = User.findOne;
  const originalCreate = Idempotency.create;
  const resolvedUser = { _id: "507f1f77bcf86cd799439011", clerkId: "clerk-1" };

  User.findOne = () => ({
    maxTimeMS: async () => resolvedUser,
  });

  let idempotencyUserId = null;
  Idempotency.create = async (entry) => {
    idempotencyUserId = entry.userId;
    return { ...entry, _id: "idempotency-1" };
  };

  const req = {
    auth: { userId: "clerk-1" },
    headers: { "idempotency-key": "stable-key" },
    method: "POST",
    path: "/animals/register",
    body: { earTag: "TEST-1" },
  };
  const res = {
    statusCode: 201,
    json(body) {
      return body;
    },
    send(body) {
      return body;
    },
  };

  try {
    await resolveUserMiddleware(req, res, () => {});
    await idempotencyMiddleware(req, res, () => {});

    assert.equal(req.user, resolvedUser);
    assert.equal(idempotencyUserId, resolvedUser._id);
  } finally {
    User.findOne = originalFindOne;
    Idempotency.create = originalCreate;
  }
});

test("Request reliability: supported Expo push token formats are accepted", () => {
  assert.equal(isValidExpoPushToken("ExponentPushToken[legacy-token]"), true);
  assert.equal(isValidExpoPushToken("ExpoPushToken[current-token]"), true);
  assert.equal(isValidExpoPushToken("not-an-expo-token"), false);
  assert.equal(isValidExpoPushToken(""), false);
});

test("Request reliability: notification details are scoped to the recipient", async () => {
  const originalFindOne = Notification.findOne;
  let receivedQuery = null;
  Notification.findOne = (query) => {
    receivedQuery = query;
    return { populate: async () => null };
  };
  const recorder = createResponseRecorder();

  try {
    await getNotificationDetails(
      {
        params: { id: "507f1f77bcf86cd799439031" },
        user: { _id: "507f1f77bcf86cd799439011" },
      },
      recorder.response,
    );
    assert.deepEqual(receivedQuery, {
      _id: "507f1f77bcf86cd799439031",
      recipientId: "507f1f77bcf86cd799439011",
    });
    assert.equal(recorder.statusCode, 404);
  } finally {
    Notification.findOne = originalFindOne;
  }
});

test("Request reliability: marking one notification read is scoped to the recipient", async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;
  let receivedQuery = null;
  Notification.findOneAndUpdate = async (query) => {
    receivedQuery = query;
    return null;
  };
  const recorder = createResponseRecorder();

  try {
    await markAsRead(
      {
        body: { notificationId: "507f1f77bcf86cd799439031" },
        user: { _id: "507f1f77bcf86cd799439011" },
      },
      recorder.response,
    );
    assert.deepEqual(receivedQuery, {
      _id: "507f1f77bcf86cd799439031",
      recipientId: "507f1f77bcf86cd799439011",
    });
    assert.equal(recorder.statusCode, 404);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("Request reliability: account resolution failures stop protected mutations", async () => {
  const req = {
    auth: { userId: "clerk-1" },
    userResolutionError: new Error("temporary identity provider failure"),
  };
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return {
        json(payload) {
          body = payload;
        },
      };
    },
  };
  let nextCalled = false;

  await protectedRoute(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 503);
  assert.equal(body.code, "USER_RESOLUTION_FAILED");
  assert.equal(body.retryable, true);
  assert.equal(nextCalled, false);
});

test("Request reliability: cancellation responses have durable schema fields", () => {
  for (const model of [Insemination, HealthRequest]) {
    assert.ok(model.schema.path("cancellationResponseReason"));
    assert.ok(model.schema.path("cancellationRespondedAt"));
  }
});

const createResponseRecorder = () => {
  const recorder = { statusCode: null, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return {
        json(payload) {
          recorder.body = payload;
        },
      };
    },
  };
  return recorder;
};

test("Request reliability: AI cannot be scheduled without a visit date", async () => {
  const originalFindById = Insemination.findById;
  Insemination.findById = () => ({
    populate: async () => ({
      _id: "507f1f77bcf86cd799439021",
      status: "approved",
      approvedBy: "507f1f77bcf86cd799439011",
    }),
  });
  const recorder = createResponseRecorder();

  try {
    await updateRequestStatus(
      {
        params: { id: "507f1f77bcf86cd799439021" },
        body: { status: "scheduled" },
        user: { _id: "507f1f77bcf86cd799439011", role: "technician" },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 400);
    assert.equal(recorder.body.code, "SCHEDULE_DATE_REQUIRED");
  } finally {
    Insemination.findById = originalFindById;
  }
});

test("Request reliability: health request cannot start before scheduling", async () => {
  const originalFindById = HealthRequest.findById;
  HealthRequest.findById = async () => ({
    _id: "507f1f77bcf86cd799439022",
    status: "approved",
    handledBy: "507f1f77bcf86cd799439011",
    scheduledDate: null,
  });
  const recorder = createResponseRecorder();

  try {
    await updateHealthRequestStatus(
      {
        params: { id: "507f1f77bcf86cd799439022" },
        body: { status: "in-progress" },
        user: { _id: "507f1f77bcf86cd799439011", role: "technician" },
      },
      recorder.response,
    );
    assert.equal(recorder.statusCode, 400);
    assert.equal(recorder.body.code, "VISIT_NOT_SCHEDULED");
  } finally {
    HealthRequest.findById = originalFindById;
  }
});
