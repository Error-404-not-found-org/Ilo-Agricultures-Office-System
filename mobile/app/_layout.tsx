import { Stack, useRouter, useSegments } from "expo-router";
import "../global.css"
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";

const queryClient = new QueryClient();

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

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTechnicianGroup = segments[0] === '(technician)';
    const inFarmerGroup = segments[0] === '(farmer)';

    if (isSignedIn) {
      // Redirect based on role
      const role = user?.publicMetadata?.role;
      
      // Wait for role to be defined
      if (!role) return;

      if (inAuthGroup) {
         if (role === 'technician') {
           router.replace('/(technician)/technician.dashboard');
         } else if (role === 'farmer') {
            router.replace('/(farmer)');
         } else {
           console.warn('Unknown role:', role);
           router.replace('/(technician)/technician.dashboard'); 
         }
      } else if (inTechnicianGroup && role === 'farmer') {
         router.replace('/(farmer)');
      } else if (inFarmerGroup && role === 'technician') {
         router.replace('/(technician)/technician.dashboard');
      } else {
        // If we are signed in and in a valid group for our role, we are done navigating
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
  }, [isSignedIn, isLoaded, user, segments]);

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
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <InitialLayout />
        </QueryClientProvider>
      </ClerkProvider>
  )
}
  

