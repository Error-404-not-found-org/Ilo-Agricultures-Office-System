import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Search, Bell } from 'lucide-react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

export default function Header() {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useUser();

  // 2. Check if we are inside the '(farmer)' folder
  const isFarmer = (segments as string[]).includes('(farmer)');
  // 3. Set the display text
  const roleLabel = isFarmer ? 'Farmer' : 'Technician';

  // Safety check: Don't render if role doesn't match context (avoids data leak in case of bug)
  const userRole = user?.publicMetadata?.role;
  if (userRole && ((isFarmer && userRole !== 'farmer') || (!isFarmer && userRole !== 'technician'))) {
      return null; 
  }

  return (
    <View className="flex-row justify-between items-center px-6 pt-2 mb-6">
      
      {/* User Info Section */}
      <TouchableOpacity 
        className="flex-row items-center gap-3"
        onPress={() => {
            if (isFarmer) {
                router.push('/(farmer)/profile');
            } else {
                router.push('/(technician)/profile');
            }
        }}
      >
        <View className="w-12 h-12 rounded-full border border-gray-200 items-center justify-center bg-gray-50 overflow-hidden">
             {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} className="w-full h-full" />
             ) : (
                <MaterialCommunityIcons name="account-outline" size={26} color="#374151" />
             )}
        </View>
        <View>
          <Text className="text-sm text-gray-500">Welcome back,</Text>
          {/* Display First Name or fallback to Role */}
          <Text className="text-xl font-bold text-gray-900">{user?.firstName || roleLabel}</Text>
        </View>
      </TouchableOpacity>

      {/* Action Buttons */}
      <View className="flex-row gap-4">
        <TouchableOpacity 
          onPress={() => router.push('/search')}
          className="p-2 bg-gray-50 rounded-full"
        >
          <Search size={24} color="#374151" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.push('/notifications')}
          className="p-2 bg-gray-50 rounded-full"
        >
          <Bell size={24} color="#374151" />
        </TouchableOpacity>
      </View>
    </View>
  );
}