import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AxiosInstance } from 'axios';

const REGISTERED_PUSH_TOKEN_KEY = 'breedsmart_registered_push_token';
const PUSH_DETACH_TIMEOUT_MS = 2000;
let pendingPushTokenRegistration: Promise<unknown> | null = null;

export async function rememberRegisteredPushToken(pushToken: string) {
  await AsyncStorage.setItem(REGISTERED_PUSH_TOKEN_KEY, pushToken);
}

export async function getRememberedPushToken() {
  return AsyncStorage.getItem(REGISTERED_PUSH_TOKEN_KEY);
}

export async function syncPushTokenForAuthenticatedUser(
  api: AxiosInstance,
  pushToken: string,
) {
  await rememberRegisteredPushToken(pushToken);
  const registration = api.post(
    '/user/push-token',
    { pushToken },
    { timeout: PUSH_DETACH_TIMEOUT_MS },
  );
  pendingPushTokenRegistration = registration;
  try {
    await registration;
  } finally {
    if (pendingPushTokenRegistration === registration) {
      pendingPushTokenRegistration = null;
    }
  }
}

export async function detachPushTokenBestEffort(api: AxiosInstance) {
  const currentPushToken = await AsyncStorage.getItem(REGISTERED_PUSH_TOKEN_KEY);
  if (!currentPushToken) return;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      api.post('/user/push-token', {
        pushToken: null,
        currentPushToken,
      }),
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Push-token cleanup timed out.')),
          PUSH_DETACH_TIMEOUT_MS,
        );
      }),
    ]);
    await AsyncStorage.removeItem(REGISTERED_PUSH_TOKEN_KEY);
  } catch (error) {
    console.warn('Push-token cleanup failed; continuing sign-out.', error);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function signOutWithPushCleanup(
  api: AxiosInstance,
  signOut: () => Promise<unknown>,
) {
  try {
    await pendingPushTokenRegistration;
  } catch {
    // Registration failure does not block the owner-scoped detach attempt.
  }
  await detachPushTokenBestEffort(api);
  await signOut();
}

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
    if (Constants.executionEnvironment === 'storeClient') {
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
