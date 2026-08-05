import { Stack, useSegments, router, useRootNavigationState } from "expo-router";
import { Buffer } from 'buffer';
// @ts-ignore
import { decode, encode } from 'base-64';

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
import { useQuery } from "@tanstack/react-query";
import { queryClient, persistOptions } from "../lib/queryClient";
import { tokenCache } from "../utils/cache";
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, Text, Image, useColorScheme, TouchableOpacity, Animated } from "react-native";
import { Toaster, toast } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { useSafeAreaInsets , SafeAreaProvider } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from "@react-native-community/netinfo";
import { processOfflineQueue } from "../lib/offlineQueue";
import { useApi } from "../lib/api";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import Constants from "expo-constants";
import * as Notifications from 'expo-notifications';
import { useTheme } from "@/lib/theme";
import { TranslationProvider } from "../contexts/TranslationContext";
import { getPushNotificationTarget } from "@/features/notifications/utils/notificationPresentation";


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
  onlineProgressAnim: any;
}) {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const handledNotificationResponseId = useRef<string | null>(null);

  useEffect(() => {
    const role = user?.publicMetadata?.role as string | undefined;
    if (!isSignedIn || !navigationState?.key || !role) return;

    const openNotificationResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      if (!response) return;
      const responseId = response.notification.request.identifier;
      if (handledNotificationResponseId.current === responseId) return;

      handledNotificationResponseId.current = responseId;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const target = getPushNotificationTarget(data, role);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      router.push(target as never);
    };

    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        openNotificationResponse,
      );
    Notifications.getLastNotificationResponseAsync()
      .then(openNotificationResponse)
      .catch((error) =>
        console.error("Failed to open notification response", error),
      );

    return () => subscription.remove();
  }, [isSignedIn, navigationState?.key, user?.publicMetadata?.role]);

  // Clear query cache on sign-out to prevent data leakage between different accounts
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      queryClient.clear();
      AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(err =>
        console.error("Failed to clear AsyncStorage react-query cache", err)
      );
    }
  }, [isLoaded, isSignedIn]);

  const { signOut } = useAuth();

  const {
    data: dbUserResponse,
    isLoading: isDbUserLoading,
    error: dbUserError,
    refetch: retryBootstrap,
  } = useQuery({
    queryKey: ["mongodb-user", user?.id],
    queryFn: async () => {
      const res = await api.post("/user/bootstrap");
      return res.data;
    },
    enabled: !!(isSignedIn && user),
    retry: false, // Do not automatically retry 401/403/409 errors
  });

  const dbUser = dbUserResponse?.user;

  // Auth Guard Logic
  useEffect(() => {
    if (!navigationState?.key) return;

    const routeSegments = segments as string[];
    const inAuthGroup = routeSegments[0] === '(auth)';
    const isVerifying = routeSegments[1] === 'verify';
    const inTechnicianGroup = routeSegments[0] === '(technician)';
    const inFarmerGroup = routeSegments[0] === '(farmer)';
    const inAdminGroup = routeSegments[0] === '(admin)';

    const isActuallySignedIn = isSignedIn && !!user;

    if (isActuallySignedIn) {
      if (isDbUserLoading) {
        return; // Wait for the authoritative bootstrap response
      }

      if (dbUserError) {
        // Do not route to dashboard if bootstrap failed
        return;
      }

      if (dbUser) {
        const role = dbUser.role;
        const verified = dbUser.isVerified;

        // 1. Verification Guard
        if (!verified) {
          if (!isVerifying) {
            router.replace('/(auth)/verify');
          }
          return;
        }

        // 2. Redirect to correct dashboard based on authoritative MongoDB role
        const atRoot = routeSegments.length === 0 || routeSegments[0] === '';

        const wrongGroup = (inAdminGroup && role !== 'admin') ||
                           (inTechnicianGroup && role !== 'technician') ||
                           (inFarmerGroup && (role === 'technician' || role === 'admin'));

        if (inAuthGroup || atRoot || wrongGroup) {
          if (role === 'admin') router.replace('/(admin)/(tabs)/admin.dashboard');
          else if (role === 'technician') router.replace('/(technician)/(tabs)/technician.dashboard');
          else router.replace('/(farmer)/(tabs)');
        }
      }
    } else if (isLoaded && !isSignedIn) {
      // 3. Force Auth
      if (!inAuthGroup) {
        router.replace('/(auth)');
      }
    }
  }, [isSignedIn, isLoaded, user, dbUser, isDbUserLoading, dbUserError, segments, navigationState?.key]);
  if (isSignedIn && isDbUserLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#00643B" />
        <Text style={{ marginTop: 12, fontFamily: 'Outfit_600SemiBold', color: '#004D2E' }}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  if (isSignedIn && dbUserError) {
    const errorStatus = (dbUserError as any)?.response?.status;
    const errorMsg = (dbUserError as any)?.response?.data?.message || "Account setup failed.";

    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={{ fontSize: 20, fontFamily: 'Outfit_700Bold', marginTop: 16, textAlign: 'center', color: isDark ? '#f8fafc' : '#1e293b' }}>
          {errorStatus === 403 ? "Account Disabled" : errorStatus === 409 ? "Identity Conflict" : "Setup Incomplete"}
        </Text>
        <Text style={{ marginTop: 12, textAlign: 'center', fontFamily: 'Outfit_400Regular', color: isDark ? '#cbd5e1' : '#64748b' }}>
          {errorMsg}
        </Text>

        {errorStatus !== 403 && errorStatus !== 409 && (
          <TouchableOpacity
            onPress={() => retryBootstrap()}
            style={{ marginTop: 24, backgroundColor: '#00643B', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontFamily: 'Outfit_600SemiBold' }}>Retry Setup</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => signOut()}
          style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: '#ef4444', fontFamily: 'Outfit_600SemiBold' }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />

      {/* Persistent connectivity banner. Kept at the top of the screen. */}
      {showOfflineToast && (
        <View
          pointerEvents="none"
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            top: insets.top + 10,
            left: 16,
            right: 16,
            backgroundColor: isDark ? '#292524' : '#fffbeb',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 99999,
            borderWidth: 1,
            borderColor: isDark ? '#78350f' : '#fcd34d',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <MaterialCommunityIcons
            name="wifi-off"
            size={18}
            color={isDark ? '#fbbf24' : '#92400e'}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{
              color: isDark ? '#fde68a' : '#78350f',
              fontFamily: 'Outfit_700Bold',
              fontSize: 12,
            }}>
              Offline mode
            </Text>
            <Text style={{
              color: isDark ? '#d6d3d1' : '#92400e',
              fontFamily: 'Outfit_500Medium',
              fontSize: 10,
              marginTop: 1,
            }}>
              New records will be saved on this device and synced later.
            </Text>
          </View>
        </View>
      )}

      {/* Redesigned Online Mode Success Dialog (Positioned at the top) */}
      {showOnlineToast && (
        <View
          pointerEvents="none"
          accessibilityRole="alert"
          style={{
            position: 'absolute',
            top: insets.top + 10,
            left: 16,
            right: 16,
            backgroundColor: isDark ? '#292524' : '#f0fdf4',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 99999,
            borderWidth: 1,
            borderColor: isDark ? '#064e3b' : '#bbf7d0',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
            overflow: 'hidden',
          }}
        >
          <MaterialCommunityIcons
            name="wifi"
            size={18}
            color={isDark ? '#34d399' : '#16a34a'}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{
              color: isDark ? '#a7f3d0' : '#166534',
              fontFamily: 'Outfit_700Bold',
              fontSize: 12,
            }}>
              You&apos;re online now
            </Text>
            <Text style={{
              color: isDark ? '#d6d3d1' : '#166534',
              fontFamily: 'Outfit_500Medium',
              fontSize: 10,
              marginTop: 1,
            }}>
              Hurray! Internet is connected.
            </Text>
          </View>
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
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
  const offlineBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineProgressAnim = useRef(new Animated.Value(1)).current;

  // Clear any connection timeouts on unmount
  useEffect(() => {
    return () => {
      if (offlineBannerTimeoutRef.current) {
        clearTimeout(offlineBannerTimeoutRef.current);
      }
    };
  }, []);

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
      const isConnected =
        state.isConnected !== false && state.isInternetReachable !== false;
      const isOfflineMode = isConnected === false;
      setIsOffline(isOfflineMode);

      const prev = connectionRef.current;
      if (prev !== null && prev !== isConnected) {
        if (isConnected) {
          if (offlineBannerTimeoutRef.current) {
            clearTimeout(offlineBannerTimeoutRef.current);
            offlineBannerTimeoutRef.current = null;
          }
          toast.dismiss("connection-offline");
          processOfflineQueue(api);
          setShowOfflineToast(false);
          if (!isToastCooldownRef.current && prev === false) {
            setShowOnlineToast(true);
            const timer = setTimeout(() => {
              setShowOnlineToast(false);
            }, 4000);
          }
        } else {
          if (offlineBannerTimeoutRef.current) {
            clearTimeout(offlineBannerTimeoutRef.current);
          }
          if (!isToastCooldownRef.current) {
            toast.info("You're offline", {
              description: "New records will be saved on this device.",
              duration: 2500,
              id: "connection-offline",
            });
            // Show yellow banner after 2500ms (when the toast disappears)
            offlineBannerTimeoutRef.current = setTimeout(() => {
              setShowOfflineToast(true);
              offlineBannerTimeoutRef.current = null;
            }, 2500);
          }
        }
      } else if (prev === null) {
        if (isOfflineMode && !isToastCooldownRef.current) {
          setShowOfflineToast(true);
        } else if (isConnected) {
          processOfflineQueue(api);
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
        const isConnected =
          state.isConnected !== false && state.isInternetReachable !== false;
        setIsOffline(isConnected === false);
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
      onlineProgressAnim={onlineProgressAnim}
    />
  );
}

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
