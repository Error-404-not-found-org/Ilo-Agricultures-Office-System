import { Tabs } from 'expo-router';
import React from 'react';
import FarmerBottomNavigator from '../components/FarmerBottomNavigator';

export default function FarmerLayout() {
  return (
    <Tabs
      tabBar={(props) => <FarmerBottomNavigator {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="add-animal" />
       <Tabs.Screen name="records" />
      <Tabs.Screen name="profile" />
      
    </Tabs>
  );
}