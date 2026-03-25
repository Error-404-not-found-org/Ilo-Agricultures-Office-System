import { Tabs } from 'expo-router';
import React from 'react';
import AdminBottomNavigator from '../components/AdminBottomNavigator';

export default function AdminTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <AdminBottomNavigator {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="admin.dashboard" />
      <Tabs.Screen name="admin.users" />
      <Tabs.Screen name="admin.animals" />
      <Tabs.Screen
        name="admin.records"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="create-user"
        options={{ href: null }}
      />
    </Tabs>
  );
}
