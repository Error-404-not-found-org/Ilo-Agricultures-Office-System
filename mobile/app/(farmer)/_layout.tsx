import { Stack } from "expo-router";
import React from "react";

export default function FarmerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The main tab group */}
      <Stack.Screen name="(tabs)" />
      
      {/* Other stack screens */}
      <Stack.Screen name="my-requests" />
      <Stack.Screen name="heat-map" />
      <Stack.Screen name="ask-moowie" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="record-calving" />
    </Stack>
  );
}
