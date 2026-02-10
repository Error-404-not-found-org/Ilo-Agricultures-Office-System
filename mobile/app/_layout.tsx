import { Stack } from "expo-router";
import "../global.css"
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import { tokenCache } from '@clerk/clerk-expo/token-cache'

import { ClerkProvider } from '@clerk/clerk-expo'

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <ClerkProvider tokenCache={tokenCache}>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{headerShown: false}}/>
        </QueryClientProvider>
      </ClerkProvider>
  )
}
  

