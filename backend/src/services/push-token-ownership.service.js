import { User } from "../models/user.model.js";
import { isValidExpoPushToken } from "../lib/push-notifications.js";

const tokenRegistrationLocks = new Map();

const withTokenRegistrationLock = async (pushToken, work) => {
  const previous = tokenRegistrationLocks.get(pushToken) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  tokenRegistrationLocks.set(pushToken, queued);

  await previous;
  try {
    return await work();
  } finally {
    release();
    if (tokenRegistrationLocks.get(pushToken) === queued) {
      tokenRegistrationLocks.delete(pushToken);
    }
  }
};

export const registerPushTokenForUser = async ({ userId, pushToken }) => {
  const normalizedToken = String(pushToken || "").trim();
  if (!isValidExpoPushToken(normalizedToken)) {
    const error = new Error("A valid Expo push token is required.");
    error.status = 400;
    error.code = "INVALID_PUSH_TOKEN";
    throw error;
  }

  return withTokenRegistrationLock(normalizedToken, async () => {
    // Clear the token from every previous account before assigning it to the
    // authenticated user. If assignment subsequently fails, notifications are
    // safely disabled rather than remaining attached to the wrong account.
    await User.updateMany(
      { _id: { $ne: userId }, pushToken: normalizedToken },
      { $unset: { pushToken: 1 } },
    );

    const user = await User.findOneAndUpdate(
      { _id: userId, deletedAt: null },
      { $set: { pushToken: normalizedToken } },
      { returnDocument: "after" },
    );
    if (!user) {
      const error = new Error("User not found.");
      error.status = 404;
      error.code = "USER_NOT_FOUND";
      throw error;
    }

    await User.updateMany(
      { _id: { $ne: userId }, pushToken: normalizedToken },
      { $unset: { pushToken: 1 } },
    );

    return user;
  });
};

export const clearPushTokenForUser = async ({ userId, pushToken }) => {
  const normalizedToken = String(pushToken || "").trim();
  if (!isValidExpoPushToken(normalizedToken)) {
    const error = new Error("The current device push token is required.");
    error.status = 400;
    error.code = "CURRENT_PUSH_TOKEN_REQUIRED";
    throw error;
  }
  return User.updateOne(
    { _id: userId, pushToken: normalizedToken },
    { $unset: { pushToken: 1 } },
  );
};

export const clearInvalidPushTokenForOwner = async ({ userId, pushToken }) => {
  if (!userId || !pushToken) return { modifiedCount: 0 };
  return User.updateOne(
    { _id: userId, pushToken },
    { $unset: { pushToken: 1 } },
  );
};
