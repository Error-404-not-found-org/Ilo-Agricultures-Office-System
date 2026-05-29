import { Stack } from "expo-router";
import React from "react";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The main tab group */}
      <Stack.Screen name="(tabs)" />
      
      {/* Other stack screens */}
      <Stack.Screen name="admin.records" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="create-user" />
    </Stack>
  );
}
