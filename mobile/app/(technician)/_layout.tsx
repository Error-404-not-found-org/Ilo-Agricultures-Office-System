import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/lib/theme";

export default function TechnicianLayout() {
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
      
      {/* Other stack screens (hides tab bar natively) */}
      <Stack.Screen name="requests" />
      <Stack.Screen name="technician.reports" />
      <Stack.Screen name="animal-details" />
      <Stack.Screen name="client.profile" />
      <Stack.Screen name="updateclient.profile" />
      <Stack.Screen name="edit-animal" />
      <Stack.Screen name="create-task" />
      <Stack.Screen name="register-client" />
      <Stack.Screen name="register-animal" />
      <Stack.Screen name="pregnancy-check" />
      <Stack.Screen name="pregnancy-tracker" />
      <Stack.Screen name="record-calf-drop" />
      <Stack.Screen name="health-log" />
      <Stack.Screen name="record-ai" />
      <Stack.Screen name="technician.calendar" />
      <Stack.Screen name="technician.tasks" />
      <Stack.Screen name="task-details" />
      <Stack.Screen name="performance" />
      <Stack.Screen name="offline-maps" />
      <Stack.Screen name="sync-history" />
      <Stack.Screen name="photo-notes" />
      <Stack.Screen name="ask-moowie" />
      <Stack.Screen name="request-details" />
      <Stack.Screen name="record-details" />
    </Stack>
  );
}
