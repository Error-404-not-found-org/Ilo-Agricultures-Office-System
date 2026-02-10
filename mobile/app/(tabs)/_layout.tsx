import { Tabs } from 'expo-router';
import React from 'react';
import BottomNavigator from '../components/BottomNavigator';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      // This line is the magic: it swaps the default tab bar for your custom component
      tabBar={(props) => <BottomNavigator {...props} />}
      screenOptions={{
        headerShown: false, // We hide headers because your screens have their own custom headers

      }}
    >
      {/* Route 1: Home */}
      <Tabs.Screen name="index" />

      {/* Route 2: Clients */}
      <Tabs.Screen name="clients" />

      {/* Route 3: Animals */}
      <Tabs.Screen 
        name="animals" 
      />

      {/* Route 4: Records (Placeholder) */}
      <Tabs.Screen 
        name="records" 
        options={{
            href: null,
        }}
      />
    </Tabs>
  );
}