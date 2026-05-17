import axios from 'axios';

/**
 * Sends a push notification via Expo Push API
 * @param {string} pushToken - The recipient's Expo push token
 * @param {string} title - Title of the notification
 * @param {string} body - Body content
 * @param {object} data - Extra data to send
 */
export const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) {
    console.warn('[PushNotification] Invalid or missing push token:', pushToken);
    return;
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
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
