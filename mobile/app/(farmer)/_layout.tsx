import { Tabs } from "expo-router";
import React from "react";
import FarmerBottomNavigator from "../components/FarmerBottomNavigator";

export default function FarmerLayout() {
  return (
    <Tabs
      tabBar={(props) => <FarmerBottomNavigator {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="add-animal" />
      <Tabs.Screen name="farmer.records" />
      <Tabs.Screen 
        name="my-requests" 
        options={{
          href: null,
        }}
      />
      <Tabs.Screen 
        name="heat-map" 
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
