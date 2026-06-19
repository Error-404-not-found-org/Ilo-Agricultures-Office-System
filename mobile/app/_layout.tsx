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
import { tokenCache } from "../utils/cache";
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Image, useColorScheme, TouchableOpacity, Animated } from "react-native";
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
import { TranslationProvider } from "../contexts/TranslationContext";

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY');
}

function AppContent({
  isLoaded,
  isSignedIn,
  user,
  api,
  isDark,
  colors,
  insets,
  showOfflineToast,
  showOnlineToast,
  progressAnim,
  onlineProgressAnim,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: any;
  api: any;
  isDark: boolean;
  colors: any;
  insets: any;
  showOfflineToast: boolean;
  showOnlineToast: boolean;
  progressAnim: any;
  onlineProgressAnim: any;
}) {
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Clear query cache on sign-out to prevent data leakage between different accounts
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      queryClient.clear();
      AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(err => 
        console.error("Failed to clear AsyncStorage react-query cache", err)
      );
    }
  }, [isLoaded, isSignedIn]);

  // Auth Guard Logic
  useEffect(() => {
    if (!navigationState?.key) return;

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
  }, [isSignedIn, isLoaded, user, segments, navigationState?.key]);

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
          flexDirection: 'column',
          zIndex: 99999,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          elevation: 6,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%' }}>
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
          </View>
          <View style={{
            height: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: 1.5,
            overflow: 'hidden',
            marginTop: 12,
            width: '100%',
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: isDark ? '#10b981' : '#00643B',
              width: '30%',
              borderRadius: 1.5,
              transform: [{
                translateX: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 300],
                })
              }]
            }} />
          </View>
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
          flexDirection: 'column',
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%' }}>
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
          </View>
          <View style={{
            height: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: 1.5,
            overflow: 'hidden',
            marginTop: 12,
            width: '100%',
          }}>
            <Animated.View style={{
              height: '100%',
              backgroundColor: '#10b981',
              width: onlineProgressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              })
            }} />
          </View>
        </View>
      )}
    </View>
  );
}

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [appReady, setAppReady] = useState(false);
  const { setColorScheme } = useNativeWindColorScheme();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const isFullyLoaded = isLoaded && appReady;

  const [isOffline, setIsOffline] = useState(false);
  const [authTimeout, setAuthTimeout] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { colors, isDark } = useTheme();

  const connectionRef = useRef<boolean | null>(null);
  const isToastCooldownRef = useRef(true);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const onlineProgressAnim = useRef(new Animated.Value(1)).current;

  // Loop for offline loading bar
  useEffect(() => {
    if (showOfflineToast) {
      progressAnim.setValue(0);
      Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [showOfflineToast]);

  // Timer countdown for online success bar
  useEffect(() => {
    if (showOnlineToast) {
      onlineProgressAnim.setValue(1);
      Animated.timing(onlineProgressAnim, {
        toValue: 0,
        duration: 4000,
        useNativeDriver: false,
      }).start();
    }
  }, [showOnlineToast]);

  // Auth loading timeout (triggers if Clerk takes >10 seconds to load)
  useEffect(() => {
    if (isLoaded) {
      setAuthTimeout(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!isLoaded) {
        setAuthTimeout(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Network Toast Cooldown on App Startup (ignores initial NetInfo instability)
  useEffect(() => {
    const timer = setTimeout(() => {
      isToastCooldownRef.current = false;
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

  // Offline Sync and Connection Monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? true;
      const isOfflineMode = !isConnected;
      setIsOffline(isOfflineMode);

      const prev = connectionRef.current;
      if (prev !== null && prev !== isConnected) {
        if (isConnected) {
          processOfflineQueue(api);
          setShowOfflineToast(false);
          if (!isToastCooldownRef.current && prev === false) {
            setShowOnlineToast(true);
            const timer = setTimeout(() => {
              setShowOnlineToast(false);
            }, 4000);
          }
        } else {
          setShowOnlineToast(false);
          if (!isToastCooldownRef.current) {
            setShowOfflineToast(true);
          }
        }
      } else if (prev === null) {
        if (isOfflineMode && !isToastCooldownRef.current) {
          setShowOfflineToast(true);
        }
      }
      connectionRef.current = isConnected;
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

  if (appReady && (isOffline || authTimeout) && !isSignedIn) {
    const primaryColor = isDark ? "#10b981" : "#00643B";
    const bgColor = isDark ? "#090d16" : "#f8fafc";
    const textColor = isDark ? "#f8fafc" : "#1e293b";
    const textSecColor = isDark ? "#cbd5e1" : "#64748b";

    const handleTryAgain = async () => {
      if (isChecking) return;
      setIsChecking(true);
      setAuthTimeout(false);
      try {
        const state = await NetInfo.refresh();
        const isConnected = state.isConnected ?? true;
        setIsOffline(!isConnected);
        if (isConnected) {
          toast.success("Retrying connection...");
        } else {
          toast.error("Still no network connection found.");
        }
      } catch (err) {
        // ignore
      } finally {
        setIsChecking(false);
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
          <MaterialCommunityIcons name={isOffline ? "wifi-off" : "server-network-off"} size={48} color={primaryColor} />
        </View>
        <Text style={{
          fontSize: 24,
          fontFamily: 'Outfit_900Black',
          color: textColor,
          marginBottom: 8,
          textAlign: 'center',
        }}>
          {isOffline ? "No network found" : "Connection trouble"}
        </Text>
        <Text style={{
          fontSize: 14,
          fontFamily: 'Outfit_500Medium',
          color: textSecColor,
          textAlign: 'center',
          marginBottom: 32,
          lineHeight: 20,
        }}>
          {isOffline 
            ? "Please check your internet connection or turn on your mobile data or Wi-Fi to log in."
            : "We are having difficulty connecting to our secure authentication servers. Please verify your connection or try again."}
        </Text>
        <TouchableOpacity
          onPress={handleTryAgain}
          disabled={isChecking}
          activeOpacity={0.8}
          style={{
            backgroundColor: isChecking ? `${primaryColor}80` : primaryColor,
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 16,
            width: '100%',
            alignItems: 'center',
            shadowColor: primaryColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isChecking ? 0 : 0.2,
            shadowRadius: 8,
            elevation: isChecking ? 0 : 4,
          }}
        >
          <Text style={{
            color: '#ffffff',
            fontSize: 14,
            fontFamily: 'Outfit_700Bold',
          }}>
            {isChecking ? "RETRYING..." : "TRY AGAIN"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isFullyLoaded) {
    const splashBg = '#ffffff';
    const accentText = '#00643B';
    const brandNameColor = '#004D2E';
    const subtextColor = '#64748b';

    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: splashBg, 
        alignItems: 'center', 
        justifyContent: 'center',
        paddingHorizontal: 24 
      }}>
        {/* Layered Decorative Background Glows */}
        <View style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(0, 100, 59, 0.02)',
          top: '15%',
          left: -50,
        }} />
        <View style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: 200,
          backgroundColor: 'rgba(0, 100, 59, 0.02)',
          bottom: '10%',
          right: -100,
        }} />

        {/* Content Container */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {/* Logo Frame */}
          <View style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 5,
            marginBottom: 28,
            borderWidth: 1,
            borderColor: '#f1f5f9',
          }}>
            <Image 
              source={require('../assets/logo.png')} 
              style={{ width: 110, height: 110, borderRadius: 55 }} 
              resizeMode="contain" 
            />
          </View>

          {/* Typography */}
          <Text style={{ 
            color: brandNameColor, 
            fontFamily: 'Outfit_900Black', 
            fontSize: 34, 
            letterSpacing: 0.5,
            marginBottom: 4,
          }}>
            BreedSmart
          </Text>

          <Text style={{ 
            color: accentText, 
            fontFamily: 'Outfit_600SemiBold', 
            fontSize: 12, 
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            marginBottom: 40,
            opacity: 0.9
          }}>
            Livestock Management
          </Text>

          {/* Loader */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 30,
            borderWidth: 1,
            borderColor: '#e2e8f0',
            gap: 12
          }}>
            <ActivityIndicator size="small" color="#00643B" />
            <Text style={{ 
              color: brandNameColor, 
              fontFamily: 'Outfit_700Bold', 
              fontSize: 10, 
              letterSpacing: 1.5,
              opacity: 0.85
            }}>
              {isSignedIn ? 'RESOLVING PERMISSIONS...' : 'AUTHENTICATING...'}
            </Text>
          </View>
        </View>

        {/* Footer Brand Info */}
        <View style={{
          position: 'absolute',
          bottom: 40,
          alignItems: 'center'
        }}>
          <Text style={{
            color: subtextColor,
            fontFamily: 'Outfit_500Medium',
            fontSize: 11,
            letterSpacing: 1,
            opacity: 0.6
          }}>
            © 2026 BreedSmart Initiative
          </Text>
        </View>
      </View>
    );
  }

  return (
    <AppContent
      isLoaded={isLoaded}
      isSignedIn={isSignedIn}
      user={user}
      api={api}
      isDark={isDark}
      colors={colors}
      insets={insets}
      showOfflineToast={showOfflineToast}
      showOnlineToast={showOnlineToast}
      progressAnim={progressAnim}
      onlineProgressAnim={onlineProgressAnim}
    />
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
            <TranslationProvider>
              <InitialLayout />
              <Toaster />
            </TranslationProvider>
          </PersistQueryClientProvider>
        </ClerkProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
