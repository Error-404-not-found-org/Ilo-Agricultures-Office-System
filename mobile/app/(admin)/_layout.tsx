import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/lib/theme";

export default function AdminLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {/* The main tab group */}
      <Stack.Screen name="(tabs)" />
      
      {/* Other stack screens */}
      <Stack.Screen name="profile" />
      <Stack.Screen name="create-user" />
      <Stack.Screen name="user-details" />
      <Stack.Screen name="claim-monitoring" />
      <Stack.Screen name="request-monitoring" />
      <Stack.Screen name="request-details" />
      <Stack.Screen name="technician-workload" />
      <Stack.Screen name="animal-details" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="support-tickets" />
      <Stack.Screen name="audit-logs" />
    </Stack>
  );
}
