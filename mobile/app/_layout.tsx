import { Stack, useSegments, router, useRootNavigationState } from "expo-router";
import { Buffer } from 'buffer';
// @ts-ignore
import { decode, encode } from 'base-64';

// Polyfills for crypto and auth libraries
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
if (typeof global.btoa === 'undefined') {
  global.btoa = encode;
}
if (typeof global.atob === 'undefined') {
  global.atob = decode;
}

import { 
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
  Outfit_900Black 
} from '@expo-google-fonts/outfit';
import "../global.css"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, persistOptions } from "../lib/queryClient";
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, Image, useColorScheme } from "react-native";
import { Toaster } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import NetInfo from "@react-native-community/netinfo";
import { processOfflineQueue } from "../lib/offlineQueue";
import { useApi } from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import Constants from "expo-constants";
import * as Notifications from 'expo-notifications';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const [appReady, setAppReady] = useState(false);
  const { setColorScheme } = useNativeWindColorScheme();
  const api = useApi();
  const navigationState = useRootNavigationState();

  const isFullyLoaded = isLoaded && appReady;

  // Initialization
  useEffect(() => {
    async function init() {
      try {
        const savedTheme = await AsyncStorage.getItem("theme_preference");
        setColorScheme((savedTheme || "light") as any);
      } catch (e) {
        setColorScheme("light");
      }
      setTimeout(() => setAppReady(true), 2000);
    }
    init();
  }, []);

  // Offline Sync
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) processOfflineQueue(api);
    });
    return () => unsubscribe();
  }, [api]);

  // Push Token Sync (runs only when signed-in user changes)
  useEffect(() => {
    if (isSignedIn && user) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          api.post('/user/push-token', { pushToken: token })
            .catch(err => console.error("Push token sync failed", err));
        }
      });
    }
  }, [isSignedIn, user?.id]);

  // Auth Guard Logic
  useEffect(() => {
    if (!isFullyLoaded || !navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isVerifying = segments[1] === 'verify';
    const inTechnicianGroup = segments[0] === '(technician)';
    const inFarmerGroup = segments[0] === '(farmer)';
    const inAdminGroup = segments[0] === '(admin)';

    const isActuallySignedIn = isSignedIn && !!user;

    if (isActuallySignedIn) {
      const role = user?.publicMetadata?.role;
      const verified = user?.publicMetadata?.isVerified === true || 
                       user?.primaryEmailAddress?.verification.status === 'verified';

      // 1. Verification Guard
      if (!verified) {
        if (!isVerifying) {
          router.replace('/(auth)/verify');
        }
        // If they are unverified, stop evaluating routing rules so they stay on the verify screen.
        return;
      }

      // 2. Redirect to correct dashboard
      const atRoot = (segments as any).length === 0 || (segments as any)[0] === '';
      
      // FIX: Only consider it a "wrong group" if the role is actually loaded/defined
      // This prevents the "bounce" effect while role metadata is still syncing
      const wrongGroup = role ? (
        (inAdminGroup && role !== 'admin') || 
        (inTechnicianGroup && role !== 'technician') ||
        (inFarmerGroup && (role === 'technician' || role === 'admin'))
      ) : false;

      // Since we returned early for unverified users, anyone hitting this block IS verified.
      // If a verified user is in the auth group or at root, send them to their dashboard.
      if (inAuthGroup || atRoot || wrongGroup) {
        if (role === 'admin') router.replace('/(admin)/admin.dashboard');
        else if (role === 'technician') router.replace('/(technician)/technician.dashboard');
        else router.replace('/(farmer)');
      }
    } else if (isLoaded && !isSignedIn) {
      // 3. Force Auth
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    }
  }, [isSignedIn, isLoaded, user, appReady, segments, navigationState?.key]);

  const isDark = useColorScheme() === 'dark';

  if (!isFullyLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('../assets/logo.png')} style={{ width: 130, height: 130, marginBottom: 30 }} resizeMode="contain" />
        <ActivityIndicator size="large" color="#00643B" />
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: '#00643B', fontWeight: '900', fontSize: 10, letterSpacing: 2 }}>
            {isSignedIn ? 'RESOLVING PERMISSIONS...' : 'AUTHENTICATING...'}
          </Text>
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

import { SafeAreaProvider } from "react-native-safe-area-context";

// Only set handler if not in Expo Go to avoid SDK 53+ warnings
if (Constants.executionEnvironment !== 'storeClient') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold,
    Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <InitialLayout />
            <Toaster />
          </PersistQueryClientProvider>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
