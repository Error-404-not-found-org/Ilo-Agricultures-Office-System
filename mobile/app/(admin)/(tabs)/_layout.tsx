import { Tabs } from "expo-router";
import React from "react";
import AdminBottomNavigator from "../../components/AdminBottomNavigator";

export default function AdminTabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <AdminBottomNavigator {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="admin.dashboard" />
      <Tabs.Screen name="admin.users" />
      <Tabs.Screen name="admin.animals" />
    </Tabs>
  );
}
