import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';
import SafeScreen from '@/components/safeScreen';

export default function NotificationsScreen() {
  const router = useRouter();

  return (
    <SafeScreen>
      <View className="flex-1 px-6">
        
        {/* Header */}
        <View className="flex-row items-center gap-4 mb-8 mt-2">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold">Notifications</Text>
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center opacity-50">
           <Bell size={64} color="gray" />
           <Text className="text-gray-500 text-lg mt-4">No new notifications</Text>
        </View>

      </View>
    </SafeScreen>
  );
}