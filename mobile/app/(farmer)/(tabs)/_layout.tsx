import { Tabs } from "expo-router";
import React from "react";
import FarmerBottomNavigator from "../../components/FarmerBottomNavigator";

export default function FarmerTabLayout() {
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <FarmerBottomNavigator {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="add-animal" />
      <Tabs.Screen name="farmer.records" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
