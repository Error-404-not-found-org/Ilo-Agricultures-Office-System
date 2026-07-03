// app/(farmer)/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/lib/theme";

export default function FarmerLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="animal-details" />
      <Stack.Screen name="my-requests" />
      <Stack.Screen name="heat-map" />
      <Stack.Screen name="ask-moowie" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="record-calving" />
      <Stack.Screen name="pregnancy-tracker" />
      <Stack.Screen name="health-request-detail" />
      <Stack.Screen name="ai-request-detail" />
      <Stack.Screen name="health-report-preview" />
      <Stack.Screen name="sync-center" />
      <Stack.Screen name="breeding-calendar" />
      <Stack.Screen name="report-breeding-observation/index" />
      <Stack.Screen name="request-ai/index" />
      <Stack.Screen name="report-sickness/index" />
    </Stack>
  );
}
