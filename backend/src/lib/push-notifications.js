import axios from 'axios';
import {
  normalizePushNotificationData,
  presentNotificationCopy,
} from "../domain/notification-presentation.js";

const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

export const isValidExpoPushToken = (pushToken) =>
  typeof pushToken === "string" && EXPO_PUSH_TOKEN_PATTERN.test(pushToken);

export const isDeviceNotRegisteredResponse = (response) => {
  const payload = response?.data ?? response;
  const tickets = Array.isArray(payload) ? payload : [payload];
  return tickets.some(
    (ticket) =>
      ticket?.status === "error" &&
      ticket?.details?.error === "DeviceNotRegistered",
  );
};

/**
 * Sends a push notification via Expo Push API
 * @param {string} pushToken - The recipient's Expo push token
 * @param {string} title - Title of the notification
 * @param {string} body - Body content
 * @param {object} data - Extra data to send
 */
export const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!isValidExpoPushToken(pushToken)) {
    console.warn('[PushNotification] Invalid or missing push token.');
    return;
  }

  const copy = presentNotificationCopy({
    title,
    message: body,
    eventType: data?.eventType,
    metadata: data,
  });
  const message = {
    to: pushToken,
    sound: 'default',
    title: copy.title,
    body: copy.message,
    data: normalizePushNotificationData(data),
  };

  try {
    const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('[PushNotification ERROR]', error.response?.data || error.message);
  }
};
