import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return;
    }
    
    // For Expo Push Notifications to work, you need a projectId.
    // Learn more: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('No EAS Project ID found. Push notifications will be disabled. Run "npx eas project:init" to fix.');
      return;
    }

    // NEW: Check if running in Expo Go (SDK 53+ does not support remote push in Go)
    if (Constants.appOwnership === 'expo') {
      console.warn('Skipping push token fetch: Not supported in Expo Go (SDK 53+). Everything else will work fine!');
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.error("Error getting push token:", e);
    }
  } else {
    console.warn('Must use physical device for Push Notifications');
  }

  return token;
}
