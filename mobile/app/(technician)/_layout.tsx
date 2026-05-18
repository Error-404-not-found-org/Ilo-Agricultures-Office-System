import { Tabs } from "expo-router";
import React from "react";
import BottomNavigator from "../components/BottomNavigator";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNavigator {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="technician.dashboard" />
      <Tabs.Screen name="technician.clients" />
      <Tabs.Screen name="technician.animals" />
      <Tabs.Screen name="technician.records" />
      
      {/* Hidden Routes */}
      <Tabs.Screen 
        name="profile" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="technician.reports" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="animal-details" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="client-details/index" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="edit-animal" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="create-task" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="register-client" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="register-animal" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="pregnancy-check" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="record-calf-drop" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="health-log" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="record-ai" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="technician.calendar" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="task-details" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="heat-map" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="performance" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="offline-maps" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="sync-history" 
        options={{ href: null }} 
      />
      <Tabs.Screen 
        name="photo-notes" 
        options={{ href: null }} 
      />
    </Tabs>
  );
}
