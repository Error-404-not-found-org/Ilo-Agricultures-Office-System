import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Bell } from 'lucide-react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';

export default function Header() {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useUser();

  const isFarmer = (segments as string[]).includes('(farmer)');
  const roleLabel = isFarmer ? 'Farmer' : 'Technician';

  const userRole = user?.publicMetadata?.role;
  if (userRole && ((isFarmer && userRole !== 'farmer') || (!isFarmer && userRole !== 'technician'))) {
      return null; 
  }

  // Get current date string like "Sunday, 01 Dec 2024"
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
  const today = new Date().toLocaleDateString('en-GB', dateOptions);

  return (
    <View className="flex-row justify-between items-center px-6 pt-16 pb-12 z-10 w-full bg-transparent">
      
      {/* Left side: Avatar + Greeting & Date */}
      <View className="flex-row items-center gap-3">
        {/* User Avatar Section */}
        <TouchableOpacity 
          onPress={() => {
              if (isFarmer) {
                  router.push('/(farmer)/profile');
              } else {
                  router.push('/(technician)/profile');
              }
          }}
          activeOpacity={0.8}
        >
          <View className="w-12 h-12 rounded-full border-[2px] border-white/20 items-center justify-center bg-[#005230] overflow-hidden shadow-sm">
               {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} className="w-full h-full" />
               ) : (
                  <MaterialCommunityIcons name="account" size={26} color="#86EFAC" />
               )}
          </View>
        </TouchableOpacity>
        
        {/* Greeting & Date Section */}
        <View>
          <Text className="text-white text-[20px] font-bold tracking-tight">
            Hello, {user?.lastName || roleLabel}
          </Text>
          <Text className="text-white text-[12px] mt-0.5 font-medium">{roleLabel}</Text>
          <Text className="text-emerald-100/90 text-[12px] mt-0.5 font-medium">
            {today}
          </Text>
        </View>
      </View>

      {/* Right side: Action Buttons */}
      <View className="flex-row items-center gap-2">
        <TouchableOpacity 
          onPress={() => router.push('/notifications')}
          className="w-10 h-10 bg-white/10 rounded-full items-center justify-center"
          activeOpacity={0.7}
        >
          <Bell size={20} color="white" />
        </TouchableOpacity>
      </View>
      
    </View>
  );
}