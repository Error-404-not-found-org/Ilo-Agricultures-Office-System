import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import axios from "axios";
import { User } from "../src/models/user.model.js";
import { updatePushToken } from "../src/controllers/user.controllers.js";
import {
  clearInvalidPushTokenForOwner,
  clearPushTokenForUser,
  registerPushTokenForUser,
} from "../src/services/push-token-ownership.service.js";
import { sendNotificationPush } from "../src/services/notification-delivery.service.js";
import { isDeviceNotRegisteredResponse } from "../src/lib/push-notifications.js";

const responseRecorder = () => {
  const recorder = { statusCode: 200, body: null };
  recorder.response = {
    status(code) {
      recorder.statusCode = code;
      return this;
    },
    json(body) {
      recorder.body = body;
      return this;
    },
  };
  return recorder;
};

test("registering a token detaches prior accounts before assigning the authenticated user", async (t) => {
  const calls = [];
  t.mock.method(User, "updateMany", async (filter, update) => {
    calls.push({ method: "updateMany", filter, update });
    return { modifiedCount: 1 };
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    calls.push({ method: "findOneAndUpdate", filter, update });
    return { _id: "technician-b", pushToken: update.$set.pushToken };
  });

  await registerPushTokenForUser({
    userId: "technician-b",
    pushToken: "ExpoPushToken[shared-device]",
  });

  assert.deepEqual(calls, [
    {
      method: "updateMany",
      filter: {
        _id: { $ne: "technician-b" },
        pushToken: "ExpoPushToken[shared-device]",
      },
      update: { $unset: { pushToken: 1 } },
    },
    {
      method: "findOneAndUpdate",
      filter: { _id: "technician-b", deletedAt: null },
      update: { $set: { pushToken: "ExpoPushToken[shared-device]" } },
    },
    {
      method: "updateMany",
      filter: {
        _id: { $ne: "technician-b" },
        pushToken: "ExpoPushToken[shared-device]",
      },
      update: { $unset: { pushToken: 1 } },
    },
  ]);
});

test("same-device account switch leaves the token on only the latest authenticated user", async (t) => {
  const users = new Map([
    ["farmer-a", { _id: "farmer-a", deletedAt: null }],
    ["technician-b", { _id: "technician-b", deletedAt: null }],
  ]);
  t.mock.method(User, "updateMany", async (filter) => {
    let modifiedCount = 0;
    for (const user of users.values()) {
      if (
        user._id !== filter._id.$ne &&
        user.pushToken === filter.pushToken
      ) {
        delete user.pushToken;
        modifiedCount += 1;
      }
    }
    return { modifiedCount };
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    const user = users.get(filter._id);
    if (!user || user.deletedAt !== null) return null;
    user.pushToken = update.$set.pushToken;
    return user;
  });

  const token = "ExpoPushToken[same-physical-device]";
  await registerPushTokenForUser({ userId: "farmer-a", pushToken: token });
  await registerPushTokenForUser({ userId: "technician-b", pushToken: token });

  assert.equal(users.get("farmer-a").pushToken, undefined);
  assert.equal(users.get("technician-b").pushToken, token);
  assert.equal(
    [...users.values()].filter((user) => user.pushToken === token).length,
    1,
  );
});

test("concurrent same-token registrations finish with exactly one owner", async (t) => {
  const users = new Map([
    ["farmer-a", { _id: "farmer-a", deletedAt: null }],
    ["technician-b", { _id: "technician-b", deletedAt: null }],
  ]);
  t.mock.method(User, "updateMany", async (filter) => {
    await new Promise((resolve) => setImmediate(resolve));
    for (const user of users.values()) {
      if (user._id !== filter._id.$ne && user.pushToken === filter.pushToken) {
        delete user.pushToken;
      }
    }
    return { modifiedCount: 1 };
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    await new Promise((resolve) => setImmediate(resolve));
    const user = users.get(filter._id);
    user.pushToken = update.$set.pushToken;
    return user;
  });

  const token = "ExpoPushToken[concurrent-device]";
  await Promise.all([
    registerPushTokenForUser({ userId: "farmer-a", pushToken: token }),
    registerPushTokenForUser({ userId: "technician-b", pushToken: token }),
  ]);

  assert.equal(
    [...users.values()].filter((user) => user.pushToken === token).length,
    1,
  );
});

test("caller-supplied userId cannot select the push-token owner", async (t) => {
  let assignedFilter;
  t.mock.method(User, "updateMany", async () => ({ modifiedCount: 0 }));
  t.mock.method(User, "findOneAndUpdate", async (filter) => {
    assignedFilter = filter;
    return { _id: filter._id };
  });
  const recorder = responseRecorder();

  await updatePushToken(
    {
      user: { _id: "farmer-a" },
      body: {
        userId: "technician-b",
        pushToken: "ExponentPushToken[farmer-device]",
      },
    },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 200);
  assert.equal(assignedFilter._id, "farmer-a");
});

test("malformed tokens are rejected before ownership writes", async (t) => {
  let writes = 0;
  t.mock.method(User, "updateMany", async () => {
    writes += 1;
  });
  t.mock.method(User, "findOneAndUpdate", async () => {
    writes += 1;
  });
  const recorder = responseRecorder();

  await updatePushToken(
    { user: { _id: "farmer-a" }, body: { pushToken: "not-an-expo-token" } },
    recorder.response,
  );

  assert.equal(recorder.statusCode, 400);
  assert.equal(recorder.body.code, "INVALID_PUSH_TOKEN");
  assert.equal(writes, 0);
});

test("logout cleanup compare-and-clears only the authenticated user's current token", async (t) => {
  let capturedFilter;
  t.mock.method(User, "updateOne", async (filter) => {
    capturedFilter = filter;
    return { modifiedCount: 1 };
  });

  await clearPushTokenForUser({
    userId: "technician-b",
    pushToken: "ExpoPushToken[current-device]",
  });

  assert.deepEqual(capturedFilter, {
    _id: "technician-b",
    pushToken: "ExpoPushToken[current-device]",
  });
});

test("invalid-token cleanup is owner and token scoped", async (t) => {
  let capturedFilter;
  t.mock.method(User, "updateOne", async (filter) => {
    capturedFilter = filter;
    return { modifiedCount: 1 };
  });

  await clearInvalidPushTokenForOwner({
    userId: "farmer-a",
    pushToken: "ExpoPushToken[stale]",
  });

  assert.deepEqual(capturedFilter, {
    _id: "farmer-a",
    pushToken: "ExpoPushToken[stale]",
  });
});

test("DeviceNotRegistered clears only the recipient/token pair", async (t) => {
  let capturedFilter;
  t.mock.method(axios, "post", async () => ({
    data: {
      data: {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      },
    },
  }));
  t.mock.method(User, "updateOne", async (filter) => {
    capturedFilter = filter;
    return { modifiedCount: 1 };
  });
  t.mock.method(User, "countDocuments", async () => 1);
  t.mock.method(User, "exists", async () => ({ _id: "farmer-a" }));

  await sendNotificationPush({
    recipient: {
      _id: "farmer-a",
      pushToken: "ExpoPushToken[stale]",
    },
    title: "Test",
    message: "Test notification",
  });

  assert.deepEqual(capturedFilter, {
    _id: "farmer-a",
    pushToken: "ExpoPushToken[stale]",
  });
  assert.equal(
    isDeviceNotRegisteredResponse({
      data: {
        status: "error",
        details: { error: "DeviceNotRegistered" },
      },
    }),
    true,
  );
});

test("a stale recipient snapshot cannot send after token ownership moves", async (t) => {
  let pushCalls = 0;
  t.mock.method(User, "countDocuments", async () => 1);
  t.mock.method(User, "exists", async () => null);
  t.mock.method(axios, "post", async () => {
    pushCalls += 1;
    return { data: { data: { status: "ok" } } };
  });

  await sendNotificationPush({
    recipient: {
      _id: "farmer-a",
      pushToken: "ExpoPushToken[now-owned-by-technician]",
    },
    title: "Private farmer update",
    message: "Private details",
  });

  assert.equal(pushCalls, 0);
});

test("ambiguous duplicate token ownership fails closed before delivery", async (t) => {
  let pushCalls = 0;
  t.mock.method(User, "countDocuments", async () => 2);
  t.mock.method(User, "exists", async () => ({ _id: "farmer-a" }));
  t.mock.method(axios, "post", async () => {
    pushCalls += 1;
    return { data: { data: { status: "ok" } } };
  });

  await sendNotificationPush({
    recipient: {
      _id: "farmer-a",
      pushToken: "ExpoPushToken[ambiguous-historical-owner]",
    },
    title: "Private farmer update",
    message: "Private details",
  });

  assert.equal(pushCalls, 0);
});

test("push-token mutation route stays authenticated and every sign-out path uses cleanup", () => {
  const routes = fs.readFileSync(
    new URL("../src/routes/user.routes.js", import.meta.url),
    "utf8",
  );
  assert.match(
    routes,
    /router\.post\("\/push-token", protectedRoute, updatePushToken\)/,
  );

  const root = new URL("../../mobile/", import.meta.url);
  const signOutPaths = [
    "app/(technician)/(tabs)/profile.tsx",
    "app/(admin)/profile.tsx",
    "features/farmer-profile/hooks/useFarmerProfile.ts",
    "app/(auth)/verify.tsx",
    "features/auth/components/AuthBootstrapGate.tsx",
  ];
  for (const relativePath of signOutPaths) {
    const source = fs.readFileSync(new URL(relativePath, root), "utf8");
    assert.match(source, /signOutWithPushCleanup/);
  }

  const notificationHelpers = fs.readFileSync(
    new URL("../../mobile/lib/notifications.ts", import.meta.url),
    "utf8",
  );
  assert.match(notificationHelpers, /await pendingPushTokenRegistration/);
  assert.match(notificationHelpers, /currentPushToken/);

  const farmerSettings = fs.readFileSync(
    new URL("../../mobile/app/(farmer)/settings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(farmerSettings, /getRememberedPushToken/);
  assert.match(farmerSettings, /rememberRegisteredPushToken/);
});

test("account deactivation clears stored push ownership in both Admin paths", () => {
  const userController = fs.readFileSync(
    new URL("../src/controllers/user.controllers.js", import.meta.url),
    "utf8",
  );
  const adminController = fs.readFileSync(
    new URL("../src/controllers/admin.controllers.js", import.meta.url),
    "utf8",
  );
  assert.match(
    userController,
    /user\.deactivatedBy = req\.user\._id;\s*user\.pushToken = undefined;/,
  );
  assert.match(
    adminController,
    /user\.deactivatedBy = req\.user\._id;\s*user\.pushToken = undefined;/,
  );
});
