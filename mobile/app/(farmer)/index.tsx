import { View, Text } from 'react-native';
import SafeScreen from '@/components/safeScreen';
import React from 'react';
import Header from '@/components/Header';
import { useUser } from '@clerk/clerk-expo';

export default function FarmerHome() {
  const { user } = useUser();

  return (
    <SafeScreen>
        <Header />
      <View className="flex-1 px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-900">My Farm</Text>
        <Text className="text-gray-500">Overview</Text>
        
        {/* Farm Content Here */}
        <View className="mt-8 bg-green-50 p-6 rounded-2xl border border-green-100">
            <Text className="text-green-800 font-bold text-lg">Animal Status</Text>
            <Text className="text-gray-600 mt-2">You have 5 active animals.</Text>
        </View>
      </View>
    </SafeScreen>
  );
}