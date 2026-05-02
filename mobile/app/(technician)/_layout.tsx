import { Tabs } from 'expo-router';
import React from 'react';
import BottomNavigator from '../components/BottomNavigator';

export default function TabLayout() {
  return (
    <Tabs
      // This line is the magic: it swaps the default tab bar for your custom component
      tabBar={(props) => <BottomNavigator {...props} />}
      screenOptions={{
        headerShown: false, // We hide headers because your screens have their own custom headers

      }}
    >
      {/* Route 1: Home/Dashboard */}
      <Tabs.Screen name="technician.dashboard" />

      {/* Route 2: Clients */}
      <Tabs.Screen name="technician.clients" />

      {/* Route 3: Animals */}
      <Tabs.Screen 
        name="technician.animals" 
      />

      {/* Route 4: Records */}
      <Tabs.Screen 
        name="technician.records" 
        options={{
            href: null,
        }}
      />

      {/* Route 5: Profile (Hidden) */}
      <Tabs.Screen 
        name="profile" 
        options={{
            href: null,
        }}
      />

      {/* Route 6: Reports (Hidden) */}
      <Tabs.Screen 
        name="technician.reports" 
        options={{
            href: null,
        }}
      />
    </Tabs>
  );
}