import { Stack, useRouter, useSegments } from "expo-router";
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

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
  )
}

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(true);
  const { setColorScheme } = useNativeWindColorScheme();

  // Reliable system theme detection for splash
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';

  // Auto-reset navigation guard - if stuck for more than 5 seconds, let the user in
  useEffect(() => {
    async function initTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem("theme_preference");
        if (savedTheme === "dark" || savedTheme === "light") {
          setColorScheme(savedTheme as "dark" | "light");
        }
      } catch (e) {
        console.error("Theme init error:", e);
      }
    }
    initTheme();
    
    const timer = setTimeout(() => {
      if (isNavigating) setIsNavigating(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isNavigating, setColorScheme]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isVerifying = segments[1] === 'verify';
    const inTechnicianGroup = segments[0] === '(technician)';
    const inFarmerGroup = segments[0] === '(farmer)';
    const inAdminGroup = segments[0] === '(admin)';

    if (isSignedIn) {
      const role = user?.publicMetadata?.role;
      // Logic: Allow if (metadata is true) OR (clerk status is verified AND metadata is not explicitly false)
      const isEmailVerified = 
        user?.publicMetadata?.isVerified === true || 
        (user?.primaryEmailAddress?.verification.status === 'verified' && user?.publicMetadata?.isVerified !== false);

      // 1. Mandatory Verification Guard
      if (!isEmailVerified) {
        if (!isVerifying) {
          router.replace('/(auth)/verify' as any);
        }
        setIsNavigating(false);
        return;
      }

      // 2. Role-based Redirects (only for verified users)
      if (inAuthGroup || isVerifying) {
         if (role === 'admin') {
            router.replace('/(admin)/admin.dashboard' as any);
         } else if (role === 'technician') {
            router.replace('/(technician)/technician.dashboard');
         } else {
            router.replace('/(farmer)');
         }
      } else if (inAdminGroup && role !== 'admin') {
         router.replace('/(farmer)');
      } else if (inTechnicianGroup && role !== 'technician') {
         router.replace('/(farmer)');
      } else if (inFarmerGroup && role === 'technician') {
         router.replace('/(technician)/technician.dashboard');
      } else if (inFarmerGroup && role === 'admin') {
         router.replace('/(admin)/admin.dashboard' as any);
      } else {
        setIsNavigating(false);
      }
    } else if (!isSignedIn) {
      if (!inAuthGroup) {
        router.replace('/(auth)');
      } else {
        // If not signed in and in auth group, we are done navigating
        setIsNavigating(false);
      }
    }
  }, [isSignedIn, isLoaded, user, segments, router]);


  if (!isLoaded || isNavigating) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
         <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Image 
              source={require('../assets/logo.png')} 
              style={{ width: 140, height: 140, marginBottom: 40 }} 
              resizeMode="contain"
            />
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
               <ActivityIndicator size="large" color="#00643B" style={{ transform: [{ scale: 1.5 }] }} />
               <View style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.1)' }} />
            </View>
         </View>
         
         {isSignedIn && (
           <View style={{ marginTop: 60, alignItems: 'center' }}>
              <Text style={{ color: '#00643B', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 4, fontSize: 11 }}>Synchronizing Data Hub</Text>
              <Text style={{ color: isDark ? '#64748b' : '#94a3b8', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2, fontSize: 8, marginTop: 12 }}>Secure Terminal Handshake</Text>
           </View>
         )}
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  useEffect(() => {
    // Hard-fix for "Row too big" error: Clear the cache once if it's potentially corrupted
    const clearCorruptedCache = async () => {
      try {
        const cache = await AsyncStorage.getItem("REACT_QUERY_OFFLINE_CACHE");
        if (cache && cache.length > 1024 * 1024 * 2) { // > 2MB
          console.warn("Clearing oversized cache to prevent crash");
          await AsyncStorage.removeItem("REACT_QUERY_OFFLINE_CACHE");
        }
      } catch (e) {
        console.error("Cache check error:", e);
      }
    };
    clearCorruptedCache();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
            onSuccess={() => console.log("Cache hydrated successfully")}
          >
            <InitialLayout />
            <Toaster />
          </PersistQueryClientProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  )
}
  

