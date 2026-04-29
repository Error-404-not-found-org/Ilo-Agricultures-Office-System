import { Stack, useRouter, useSegments } from "expo-router";
import "../global.css"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, asyncStoragePersister } from "../lib/queryClient";
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Toaster } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

  // Auto-reset navigation guard - if stuck for more than 5 seconds, let the user in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isNavigating) setIsNavigating(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister: asyncStoragePersister }}
          >
            <InitialLayout />
            <Toaster />
          </PersistQueryClientProvider>
      </ClerkProvider>
    </GestureHandlerRootView>
  )
}
  

