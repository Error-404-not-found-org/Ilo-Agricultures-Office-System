import { Tabs } from "expo-router";
import React from "react";
import BottomNavigator from "../../components/BottomNavigator";

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <BottomNavigator {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="technician.dashboard" />
      <Tabs.Screen name="technician.clients" />
      <Tabs.Screen name="technician.animals" />
      <Tabs.Screen name="technician.records" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
