import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import {
  isDeviceNotRegisteredResponse,
  sendPushNotification,
} from "../lib/push-notifications.js";
import { clearInvalidPushTokenForOwner } from "./push-token-ownership.service.js";
import {
  normalizePushNotificationData,
  presentNotificationCopy,
} from "../domain/notification-presentation.js";

const recipientIdentity = (recipient, recipientId) =>
  recipient?._id || recipientId || recipient;

export const sendNotificationPush = async ({
  recipient,
  title,
  message,
  type = "system",
  eventType,
  relatedId,
  linkType,
  notificationId,
  metadata = {},
}) => {
  if (!recipient?.pushToken) return;
  const ownerId = recipientIdentity(recipient);
  if (!ownerId) return;
  const activeTokenFilter = {
    pushToken: recipient.pushToken,
    deletedAt: null,
    status: { $ne: "suspended" },
  };
  const [activeOwnerCount, stillOwned] = await Promise.all([
    User.countDocuments(activeTokenFilter),
    User.exists({ _id: ownerId, ...activeTokenFilter }),
  ]);
  // Historical duplicates or a cross-process registration race are ambiguous.
  // Fail closed until the token is registered again and has exactly one owner.
  if (activeOwnerCount !== 1 || !stillOwned) return;
  const normalizedMetadata = {
    ...metadata,
    ...(eventType ? { eventType } : {}),
  };
  const copy = presentNotificationCopy({
    title,
    message,
    eventType,
    metadata: normalizedMetadata,
  });
  const response = await sendPushNotification(
    recipient.pushToken,
    copy.title,
    copy.message,
    normalizePushNotificationData({
      ...normalizedMetadata,
      notificationId,
      type,
      eventType,
      relatedId,
      linkType,
    }),
  );
  if (isDeviceNotRegisteredResponse(response)) {
    await clearInvalidPushTokenForOwner({
      userId: recipientIdentity(recipient),
      pushToken: recipient.pushToken,
    });
  }
  return response;
};

export const notifyUser = async ({
  recipient,
  recipientId,
  senderId,
  type = "system",
  relatedId,
  category,
  eventType,
  linkType,
  dedupeKey,
  metadata = {},
  title,
  message,
  sendPush = true,
}) => {
  const resolvedRecipientId = recipientIdentity(recipient, recipientId);
  if (!resolvedRecipientId) {
    throw new Error("A notification recipient is required.");
  }

  const normalizedMetadata = {
    ...metadata,
    ...(eventType ? { eventType } : {}),
  };
  const copy = presentNotificationCopy({
    title,
    message,
    eventType,
    metadata: normalizedMetadata,
  });
  const payload = {
    recipientId: resolvedRecipientId,
    senderId,
    type,
    relatedId,
    category,
    eventType,
    linkType,
    dedupeKey,
    metadata: normalizedMetadata,
    ...copy,
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  let notification;
  let shouldSendPush = true;
  if (dedupeKey) {
    const result = await Notification.findOneAndUpdate(
      { dedupeKey },
      { $setOnInsert: payload },
      {
        upsert: true,
        returnDocument: "after",
        includeResultMetadata: true,
      },
    );
    notification = result?.value || result;
    shouldSendPush = result?.lastErrorObject
      ? !result.lastErrorObject.updatedExisting
      : Boolean(notification);
  } else {
    notification = await Notification.create(payload);
  }

  if (shouldSendPush && sendPush && recipient?.pushToken) {
    await sendNotificationPush({
      recipient,
      title: copy.title,
      message: copy.message,
      type,
      eventType,
      relatedId,
      linkType,
      notificationId: notification?._id,
      metadata: normalizedMetadata,
    });
  }

  return notification;
};

export const notifyUserBestEffort = async (payload, context = "notification") => {
  try {
    return await notifyUser(payload);
  } catch (error) {
    console.error(`[${context}] Post-commit notification failed`, {
      message: error?.message || String(error),
      recipientId: payload?.recipientId || payload?.recipient?._id || null,
      relatedId: payload?.relatedId || null,
      eventType: payload?.eventType || null,
    });
    return null;
  }
};
