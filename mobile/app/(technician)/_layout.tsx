import { Stack } from "expo-router";
import React from "react";

export default function TechnicianLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The main tab group */}
      <Stack.Screen name="(tabs)" />
      
      {/* Other stack screens (hides tab bar natively) */}
      <Stack.Screen name="technician.reports" />
      <Stack.Screen name="animal-details" />
      <Stack.Screen name="client.profile" />
      <Stack.Screen name="updateclient.profile" />
      <Stack.Screen name="edit-animal" />
      <Stack.Screen name="create-task" />
      <Stack.Screen name="register-client" />
      <Stack.Screen name="register-animal" />
      <Stack.Screen name="pregnancy-check" />
      <Stack.Screen name="record-calf-drop" />
      <Stack.Screen name="health-log" />
      <Stack.Screen name="record-ai" />
      <Stack.Screen name="technician.calendar" />
      <Stack.Screen name="task-details" />
      <Stack.Screen name="heat-map" />
      <Stack.Screen name="performance" />
      <Stack.Screen name="offline-maps" />
      <Stack.Screen name="sync-history" />
      <Stack.Screen name="photo-notes" />
    </Stack>
  );
}
