import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import React from 'react';
import SafeScreen from '@/components/safeScreen';
import { useClerk, useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronRight, LogOut, Settings, HelpCircle, User, Shield, UserPlus } from 'lucide-react-native';
import { toast } from 'sonner-native';

const PRIMARY = '#1e3a5f';

const AdminProfile = () => {
  const { signOut } = useClerk();
  const { user } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      router.replace('/(auth)');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <SafeScreen>
      <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>

        {/* Header Section */}
        <View className="px-6 pt-6 pb-8 bg-white rounded-b-[32px] shadow-sm mb-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-gray-900">My Profile</Text>
            <TouchableOpacity onPress={() => console.log('Edit Profile')}>
              <Text className="text-blue-600 font-semibold">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center gap-4">
            <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center border-2 border-white shadow-sm overflow-hidden">
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} className="w-full h-full" />
              ) : (
                <Shield size={40} color="#2563EB" />
              )}
            </View>
            <View>
              <Text className="text-xl font-bold text-gray-900">{user?.fullName || 'Admin'}</Text>
              <Text className="text-gray-500">{user?.primaryEmailAddress?.emailAddress || 'No email'}</Text>
              <View className="bg-blue-100 px-2 py-0.5 rounded-md self-start mt-1">
                <Text className="text-blue-700 text-xs font-semibold">Administrator</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu Options */}
        <View className="px-6 mb-8">
          <Text className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Administration</Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <MenuItem
              icon={<UserPlus size={20} color="#4B5563" />}
              label="Create New User"
              onPress={() => router.push('/(admin)/create-user' as any)}
            />
            <View className="h-[1px] bg-gray-100 ml-14" />
            <MenuItem
              icon={<User size={20} color="#4B5563" />}
              label="Personal Information"
              onPress={() => console.log('Personal Info')}
            />
            <View className="h-[1px] bg-gray-100 ml-14" />
            <MenuItem
              icon={<Settings size={20} color="#4B5563" />}
              label="Preferences"
              onPress={() => console.log('Preferences')}
            />
          </View>
        </View>

        <View className="px-6 mb-8">
          <Text className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Support</Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <MenuItem
              icon={<HelpCircle size={20} color="#4B5563" />}
              label="Help & FAQ"
              onPress={() => console.log('Help')}
            />
            <View className="h-[1px] bg-gray-100 ml-14" />
            <MenuItem
              icon={<MaterialCommunityIcons name="information-outline" size={20} color="#4B5563" />}
              label="About App"
              onPress={() => console.log('About')}
            />
          </View>
        </View>

        {/* Sign Out */}
        <View className="px-6 mb-10">
          <TouchableOpacity
            onPress={handleSignOut}
            className="flex-row items-center justify-center bg-red-50 py-4 rounded-xl active:bg-red-100"
          >
            <LogOut size={20} color="#EF4444" />
            <Text className="text-red-600 font-bold ml-2">Sign Out</Text>
          </TouchableOpacity>
          <Text className="text-center text-gray-400 text-xs mt-4">Version 1.0.0</Text>
        </View>

      </ScrollView>
    </SafeScreen>
  );
};

const MenuItem = ({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    className="flex-row items-center justify-between p-4 active:bg-gray-50"
  >
    <View className="flex-row items-center gap-3">
      <View className="w-8 h-8 rounded-full bg-gray-50 items-center justify-center">{icon}</View>
      <Text className="text-gray-700 font-medium text-[15px]">{label}</Text>
    </View>
    <ChevronRight size={18} color="#9CA3AF" />
  </TouchableOpacity>
);

export default AdminProfile;
