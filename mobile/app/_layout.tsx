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
import { View, ActivityIndicator, Text, Image, useColorScheme, TouchableOpacity } from "react-native";
import { Toaster, toast } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from "@react-native-community/netinfo";
import { processOfflineQueue } from "../lib/offlineQueue";
import { useApi } from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import Constants from "expo-constants";
import * as Notifications from 'expo-notifications';
import { useTheme } from "@/lib/theme";

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
  const insets = useSafeAreaInsets();

  const isFullyLoaded = isLoaded && appReady;

  const [isOffline, setIsOffline] = useState(false);
  const [prevConnected, setPrevConnected] = useState<boolean | null>(null);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [isToastCooldownActive, setIsToastCooldownActive] = useState(true);
  const { colors, isDark } = useTheme();

  // Network Toast Cooldown on App Startup (ignores initial NetInfo instability)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsToastCooldownActive(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

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

  // Clear query cache on sign-out to prevent data leakage between different accounts
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      queryClient.clear();
      AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(err => 
        console.error("Failed to clear AsyncStorage react-query cache", err)
      );
    }
  }, [isLoaded, isSignedIn]);

  // Offline Sync and Connection Monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? true;
      const isOfflineMode = !isConnected;
      setIsOffline(isOfflineMode);

      if (prevConnected !== null && prevConnected !== isConnected) {
        if (isConnected) {
          processOfflineQueue(api);
          setShowOfflineToast(false);
          if (!isToastCooldownActive && prevConnected === false) {
            setShowOnlineToast(true);
            const timer = setTimeout(() => {
              setShowOnlineToast(false);
            }, 4000);
            return () => clearTimeout(timer);
          }
        } else {
          setShowOnlineToast(false);
          if (!isToastCooldownActive) {
            setShowOfflineToast(true);
          }
        }
      } else if (prevConnected === null) {
        if (isOfflineMode && !isToastCooldownActive) {
          setShowOfflineToast(true);
        }
      }
      setPrevConnected(isConnected);
    });
    return () => unsubscribe();
  }, [api, prevConnected, isToastCooldownActive]);

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
        if (role === 'admin') router.replace('/(admin)/(tabs)/admin.dashboard');
        else if (role === 'technician') router.replace('/(technician)/(tabs)/technician.dashboard');
        else router.replace('/(farmer)/(tabs)');
      }
    } else if (isLoaded && !isSignedIn) {
      // 3. Force Auth
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    }
  }, [isSignedIn, isLoaded, user, appReady, segments, navigationState?.key]);


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

  if (isOffline && !isSignedIn) {
    const primaryColor = isDark ? "#10b981" : "#00643B";
    const bgColor = isDark ? "#090d16" : "#f8fafc";
    const textColor = isDark ? "#f8fafc" : "#1e293b";
    const textSecColor = isDark ? "#cbd5e1" : "#64748b";

    const handleTryAgain = async () => {
      const state = await NetInfo.refresh();
      const isConnected = state.isConnected ?? true;
      setIsOffline(!isConnected);
      if (isConnected) {
        toast.success("Network connection restored!");
      } else {
        toast.error("Still no network connection found.");
      }
    };

    return (
      <View style={{
        flex: 1,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}>
        <View style={{
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(0,100,59,0.05)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <MaterialCommunityIcons name="wifi-off" size={48} color={primaryColor} />
        </View>
        <Text style={{
          fontSize: 24,
          fontFamily: 'Outfit_900Black',
          color: textColor,
          marginBottom: 8,
          textAlign: 'center',
        }}>
          No network found
        </Text>
        <Text style={{
          fontSize: 14,
          fontFamily: 'Outfit_500Medium',
          color: textSecColor,
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 20,
        }}>
          Please check your internet connection or turn on your mobile data or Wi-Fi to log in.
        </Text>
        <TouchableOpacity
          onPress={handleTryAgain}
          activeOpacity={0.8}
          style={{
            backgroundColor: primaryColor,
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 16,
            width: '100%',
            alignItems: 'center',
            shadowColor: primaryColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text style={{
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'Outfit_700Bold',
          }}>
            TRY AGAIN
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      
      {/* Redesigned Offline Mode Dialog (Floating Top Card) */}
      {showOfflineToast && (
        <View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 16,
          right: 16,
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          zIndex: 99999,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 6,
        }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MaterialCommunityIcons name="wifi-off" size={22} color={colors.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: colors.textPrimary,
              fontFamily: 'Outfit_700Bold',
              fontSize: 14,
              marginBottom: 2,
            }}>
              You're offline now
            </Text>
            <Text style={{
              color: colors.textMuted,
              fontFamily: 'Outfit_500Medium',
              fontSize: 12,
            }}>
              Oops! Internet is disconnected.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowOfflineToast(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Redesigned Online Mode Success Dialog */}
      {showOnlineToast && (
        <View style={{
          position: 'absolute',
          top: insets.top + 10,
          left: 16,
          right: 16,
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          zIndex: 99999,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 4,
          borderLeftColor: '#10b981',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 6,
        }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: '#10b981',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MaterialCommunityIcons name="wifi" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: colors.textPrimary,
              fontFamily: 'Outfit_700Bold',
              fontSize: 14,
              marginBottom: 2,
            }}>
              You're online now
            </Text>
            <Text style={{
              color: colors.textMuted,
              fontFamily: 'Outfit_500Medium',
              fontSize: 12,
            }}>
              Hurray! Internet is connected.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowOnlineToast(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
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
